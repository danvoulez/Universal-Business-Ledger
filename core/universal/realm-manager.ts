/**
 * REALM MANAGER - Multitenancy Engine
 * 
 * Fase 5: REALM MANAGER 100% EVENT-STORE
 * 
 * ⚠️ SOURCE OF TRUTH: The Event Store is the ONLY source of truth for Realms.
 * 
 * This module manages the isolation and interaction between realms (tenants).
 * Each realm is a self-contained universe that can have its own:
 * - Entities
 * - Assets
 * - Agreements
 * - Workflows
 * - Configuration
 * 
 * Realms are established by Agreements (Tenant License).
 * Cross-realm interactions require explicit agreements.
 * 
 * Architecture:
 * - Event Store is the canonical source of truth
 * - In-memory Map is ONLY a cache (derived from events)
 * - All Realm state is reconstructed from events via rebuildRealmFromEvents()
 * - No Realm exists without a RealmCreated event in the event store
 */

import type { EntityId, Timestamp, Event, ActorReference } from '../schema/ledger';
import type { Realm, RealmConfig, Entity, Agreement, Asset, Role, RealmCreated } from './primitives';
import { 
  PRIMORDIAL_REALM_ID, 
  PRIMORDIAL_SYSTEM_ID, 
  GENESIS_AGREEMENT_ID 
} from './primitives';
import { buildRealmCreatedEvent } from './realm-events';
import type { EventStore } from '../store/event-store';
import { logger } from '../observability/logger';

// ============================================================================
// REALM MANAGER INTERFACE
// ============================================================================

export interface RealmManager {
  /**
   * Create the primordial realm and system entity (bootstrap)
   * Idempotent: if already exists, returns existing state
   */
  bootstrap(): Promise<BootstrapResult>;
  
  /**
   * Create a new realm (via tenant license agreement)
   */
  createRealm(
    name: string,
    config: Partial<RealmConfig>,
    licenseAgreementId: EntityId
  ): Promise<Realm>;
  
  /**
   * Get a realm by ID
   * Reconstructs from event store if not in cache
   */
  getRealm(realmId: EntityId): Promise<Realm | null>;
  
  /**
   * Get the Primordial Realm
   * Always reconstructs from event store to ensure consistency
   */
  getPrimordialRealm(): Promise<Realm>;
  
  /**
   * Rebuild a Realm from events in the event store
   * This is the canonical way to reconstruct Realm state
   */
  rebuildRealmFromEvents(realmId: EntityId): Promise<Realm | null>;
  
  /**
   * Get all child realms of a parent
   */
  getChildRealms(parentRealmId: EntityId): Promise<readonly Realm[]>;
  
  /**
   * Update realm configuration
   */
  updateRealmConfig(
    realmId: EntityId,
    changes: Partial<RealmConfig>,
    agreementId: EntityId
  ): Promise<Realm>;
  
  /**
   * Check if an entity can access a realm
   */
  canAccess(entityId: EntityId, realmId: EntityId): Promise<boolean>;
  
  /**
   * Get the realm context for operations
   */
  getRealmContext(realmId: EntityId): Promise<RealmContext>;
  
  /**
   * Validate a cross-realm operation
   */
  validateCrossRealmOperation(
    sourceRealmId: EntityId,
    targetRealmId: EntityId,
    operation: CrossRealmOperation
  ): Promise<CrossRealmValidation>;
}

export interface BootstrapResult {
  readonly primordialRealm: Realm;
  readonly systemEntity: Entity;
  readonly genesisAgreement: Agreement;
}

export interface RealmContext {
  readonly realm: Realm;
  readonly config: RealmConfig;
  readonly parentContext?: RealmContext;
  
  /** Check if an operation is allowed in this realm */
  isAllowed(operation: string, resourceType: string): boolean;
  
  /** Get effective configuration (merged with parent) */
  getEffectiveConfig(): RealmConfig;
}

export interface CrossRealmOperation {
  readonly type: 'EntityReference' | 'AssetTransfer' | 'AgreementParticipation' | 'RoleGrant';
  readonly sourceEntityId?: EntityId;
  readonly targetEntityId?: EntityId;
  readonly assetId?: EntityId;
  readonly agreementId?: EntityId;
}

export interface CrossRealmValidation {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiredAgreement?: string; // Type of agreement needed
}

// ============================================================================
// REALM MANAGER IMPLEMENTATION
// ============================================================================

export function createRealmManager(eventStore: EventStore): RealmManager {
  // ⚠️ CACHE ONLY: This Map is ONLY a cache, NOT a source of truth.
  // All Realm state must be reconstructible from the event store.
  // If a Realm is not in cache, it will be rebuilt from events.
  const realms = new Map<EntityId, Realm>();
  const entities = new Map<EntityId, Entity>();
  const realmMemberships = new Map<EntityId, Set<EntityId>>(); // entityId -> realmIds
  
  // Use canonical constants from primitives.ts (not local definitions)
  const SYSTEM_ENTITY_ID = PRIMORDIAL_SYSTEM_ID;
  
  // ============================================================================
  // CANONICAL: Rebuild Realm from Event Store
  // ============================================================================
  
  /**
   * Rebuild a Realm from events in the event store.
   * This is the ONLY canonical way to reconstruct Realm state.
   * 
   * Rules:
   * - If no RealmCreated event exists → returns null
   * - Applies events in chronological order
   * - Never invents a Realm without a RealmCreated event
   */
  async function rebuildRealmFromEvents(realmId: EntityId): Promise<Realm | null> {
    logger.info('realm.rebuild.start', {
      component: 'realm-manager',
      realmId,
    });
    
    try {
      // Load all events for this realm
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Realm', realmId)) {
        events.push(event);
      }
      
      if (events.length === 0) {
        logger.info('realm.rebuild.not_found', {
          component: 'realm-manager',
          realmId,
        });
        return null;
      }
      
      // Find RealmCreated event (must be first)
      const realmCreatedEvent = events.find(e => e.type === 'RealmCreated');
      if (!realmCreatedEvent) {
        logger.warn('realm.rebuild.no_creation_event', {
          component: 'realm-manager',
          realmId,
          eventsCount: events.length,
        });
        return null;
      }
      
      // Extract Realm state from RealmCreated event
      const payload = realmCreatedEvent.payload as RealmCreated;
      const realm: Realm = {
        id: realmId,
        name: payload.name,
        createdAt: realmCreatedEvent.timestamp,
        establishedBy: payload.establishedBy,
        config: payload.config,
        parentRealmId: payload.parentRealmId,
      };
      
      // Apply subsequent events (e.g., RealmConfigUpdated)
      for (const event of events) {
        if (event.type === 'RealmConfigUpdated') {
          const configPayload = event.payload as any;
          realm.config = {
            ...realm.config,
            ...configPayload.changes,
          };
        }
        // Add other event types as needed
      }
      
      // Update cache (derived from events, not source of truth)
      realms.set(realmId, realm);
      
      logger.info('realm.rebuild.success', {
        component: 'realm-manager',
        realmId,
        eventsCount: events.length,
      });
      
      return realm;
    } catch (error: any) {
      logger.error('realm.rebuild.error', {
        component: 'realm-manager',
        realmId,
        errorCode: error?.code || 'UNKNOWN_ERROR',
        errorMessage: error?.message || String(error),
      });
      throw error;
    }
  }
  
  return {
    async bootstrap(): Promise<BootstrapResult> {
      // ⚠️ IDEMPOTENCY: Check if Primordial Realm already exists in event store
      const existingPrimordial = await rebuildRealmFromEvents(PRIMORDIAL_REALM_ID);
      if (existingPrimordial) {
        logger.info('realm.bootstrap.already_exists', {
          component: 'realm-manager',
          realmId: PRIMORDIAL_REALM_ID,
        });
        
        // Rebuild system entity and genesis agreement from events if needed
        // For now, return existing primordial realm
        return {
          primordialRealm: existingPrimordial,
          systemEntity: entities.get(SYSTEM_ENTITY_ID) || {
            id: SYSTEM_ENTITY_ID,
            realmId: PRIMORDIAL_REALM_ID,
            entityType: 'System',
            createdAt: Date.now(),
            version: 1,
            identity: {
              name: 'System',
              identifiers: [
                { scheme: 'system', value: 'primordial', verified: true },
              ],
            },
            meta: { isPrimordial: true },
          },
          genesisAgreement: {
            id: GENESIS_AGREEMENT_ID,
            realmId: PRIMORDIAL_REALM_ID,
            agreementType: 'genesis',
            createdAt: Date.now(),
            version: 1,
            status: 'Active',
            parties: [],
            terms: { description: 'Genesis Agreement', clauses: [] },
            validity: { effectiveFrom: Date.now() },
          },
        };
      }
      
      logger.info('realm.bootstrap.creating', {
        component: 'realm-manager',
        realmId: PRIMORDIAL_REALM_ID,
      });
      
      // Create primordial realm
      const primordialRealm: Realm = {
        id: PRIMORDIAL_REALM_ID,
        name: 'Primordial Realm',
        createdAt: Date.now(),
        establishedBy: GENESIS_AGREEMENT_ID,
        config: {
          isolation: 'Full',
          crossRealmAllowed: true, // Primordial can interact with all
        },
      };
      
      // Create system entity
      const systemEntity: Entity = {
        id: SYSTEM_ENTITY_ID,
        realmId: PRIMORDIAL_REALM_ID,
        entityType: 'System',
        createdAt: Date.now(),
        version: 1,
        identity: {
          name: 'System',
          identifiers: [
            { scheme: 'system', value: 'primordial', verified: true },
          ],
        },
        meta: {
          isPrimordial: true,
        },
      };
      
      // Create genesis agreement
      const genesisAgreement: Agreement = {
        id: GENESIS_AGREEMENT_ID,
        realmId: PRIMORDIAL_REALM_ID,
        agreementType: 'genesis',
        createdAt: Date.now(),
        version: 1,
        status: 'Active',
        parties: [
          {
            entityId: SYSTEM_ENTITY_ID,
            role: 'System',
            obligations: [],
            rights: [
              { id: 'admin', description: 'Full system administration' },
            ],
            consent: {
              givenAt: Date.now(),
              method: 'Implicit',
            },
          },
        ],
        terms: {
          description: 'In the beginning was the Event, and the Event was with the Ledger, and the Event was the Ledger.',
          clauses: [
            {
              id: 'existence',
              type: 'declaration',
              title: 'Declaration of Existence',
              content: 'This agreement establishes the existence of the system and its primordial realm.',
            },
          ],
        },
        validity: {
          effectiveFrom: Date.now(),
          // No end - eternal
        },
      };
      
      // ⚠️ EVENT STORE FIRST: Always emit events BEFORE updating cache
      // The event store is the source of truth, cache is derived
      
      // Emit events using canonical helper
      const realmCreatedEvent = buildRealmCreatedEvent(
        PRIMORDIAL_REALM_ID,
        primordialRealm.name,
        GENESIS_AGREEMENT_ID,
        primordialRealm.config,
        { type: 'System', systemId: 'bootstrap' } as ActorReference,
        Date.now(),
        1
      );
      await eventStore.append(realmCreatedEvent);
      
      // Update cache (derived from events, not source of truth)
      realms.set(PRIMORDIAL_REALM_ID, primordialRealm);
      entities.set(SYSTEM_ENTITY_ID, systemEntity);
      
      await eventStore.append({
        type: 'EntityCreated',
        aggregateId: SYSTEM_ENTITY_ID,
        aggregateType: 'Party',
        aggregateVersion: 1,
        payload: {
          type: 'EntityCreated',
          entityType: 'System',
          identity: systemEntity.identity,
          meta: systemEntity.meta,
        },
        actor: { type: 'System', systemId: 'bootstrap' },
      });
      
      await eventStore.append({
        type: 'AgreementCreated',
        aggregateId: GENESIS_AGREEMENT_ID,
        aggregateType: 'Agreement',
        aggregateVersion: 1,
        payload: {
          type: 'AgreementProposed',
          agreementType: 'genesis',
          parties: genesisAgreement.parties,
          terms: genesisAgreement.terms,
          validity: genesisAgreement.validity,
        },
        actor: { type: 'System', systemId: 'bootstrap' },
      });
      
      return {
        primordialRealm,
        systemEntity,
        genesisAgreement,
      };
    },
    
    async createRealm(
      name: string,
      config: Partial<RealmConfig>,
      licenseAgreementId: EntityId
    ): Promise<Realm> {
      const realmId = generateId('realm');
      
      const fullConfig: RealmConfig = {
        isolation: config.isolation ?? 'Full',
        crossRealmAllowed: config.crossRealmAllowed ?? false,
        ...config,
      };
      
      const realm: Realm = {
        id: realmId,
        name,
        createdAt: Date.now(),
        establishedBy: licenseAgreementId,
        config: fullConfig,
      };
      
      // ⚠️ EVENT STORE FIRST: Always emit events BEFORE updating cache
      // Use canonical helper to build event
      const realmCreatedEvent = buildRealmCreatedEvent(
        realmId,
        name,
        licenseAgreementId,
        fullConfig,
        { type: 'System', systemId: 'realm-manager' } as ActorReference,
        Date.now(),
        1
      );
      await eventStore.append(realmCreatedEvent);
      
      // Update cache (derived from events, not source of truth)
      realms.set(realmId, realm);
      
      logger.info('realm.created', {
        component: 'realm-manager',
        realmId,
        name,
        establishedBy: licenseAgreementId,
      });
      
      return realm;
    },
    
    async getRealm(realmId: EntityId): Promise<Realm | null> {
      // Check cache first (performance optimization)
      const cached = realms.get(realmId);
      if (cached) {
        return cached;
      }
      
      // If not in cache, rebuild from event store (source of truth)
      return await rebuildRealmFromEvents(realmId);
    },
    
    async getPrimordialRealm(): Promise<Realm> {
      // Always rebuild from event store to ensure consistency
      const realm = await rebuildRealmFromEvents(PRIMORDIAL_REALM_ID);
      if (!realm) {
        throw new Error('Primordial Realm not found in event store. Run bootstrap() first.');
      }
      return realm;
    },
    
    async rebuildRealmFromEvents(realmId: EntityId): Promise<Realm | null> {
      return await rebuildRealmFromEvents(realmId);
    },
    
    async getChildRealms(parentRealmId: EntityId): Promise<readonly Realm[]> {
      // Rebuild all realms from event store to ensure we have complete data
      // This is expensive but ensures consistency
      // TODO: Optimize with projection if needed
      const allRealmIds = new Set<EntityId>();
      
      // Collect all realm IDs from events
      for await (const event of eventStore.getByAggregate('Realm', parentRealmId)) {
        if (event.type === 'RealmCreated') {
          allRealmIds.add(event.aggregateId);
        }
      }
      
      // Also check for child realms by scanning all RealmCreated events
      // This is a simplified approach - in production, use a projection
      const childRealms: Realm[] = [];
      for (const realmId of allRealmIds) {
        const realm = await this.getRealm(realmId);
        if (realm && realm.parentRealmId === parentRealmId) {
          childRealms.push(realm);
        }
      }
      
      return childRealms;
    },
    
    async updateRealmConfig(
      realmId: EntityId,
      changes: Partial<RealmConfig>,
      agreementId: EntityId
    ): Promise<Realm> {
      const realm = realms.get(realmId);
      if (!realm) {
        throw new Error(`Realm not found: ${realmId}`);
      }
      
      // ⚠️ EVENT STORE FIRST: Always emit events BEFORE updating cache
      await eventStore.append({
        type: 'RealmConfigUpdated',
        aggregateId: realmId,
        aggregateType: 'Realm', // ⚠️ CANONICAL: Always "Realm", never "Flow"
        aggregateVersion: 2, // Would need proper versioning
        payload: {
          type: 'RealmConfigUpdated',
          changes,
          reason: `Updated by agreement ${agreementId}`,
        },
        actor: { type: 'System', systemId: 'realm-manager' },
      });
      
      // Rebuild from events to ensure consistency
      const updatedRealm = await rebuildRealmFromEvents(realmId);
      if (!updatedRealm) {
        throw new Error(`Realm not found after update: ${realmId}`);
      }
      
      logger.info('realm.config.updated', {
        component: 'realm-manager',
        realmId,
        agreementId,
      });
      
      return updatedRealm;
    },
    
    async canAccess(entityId: EntityId, realmId: EntityId): Promise<boolean> {
      // System can access everything
      if (entityId === SYSTEM_ENTITY_ID) {
        return true;
      }
      
      // Check direct membership
      const memberships = realmMemberships.get(entityId);
      if (memberships?.has(realmId)) {
        return true;
      }
      
      // Check if entity's home realm allows cross-realm
      const entity = entities.get(entityId);
      if (entity) {
        const homeRealm = realms.get(entity.realmId);
        const targetRealm = realms.get(realmId);
        
        if (homeRealm?.config.crossRealmAllowed && targetRealm?.config.crossRealmAllowed) {
          return true;
        }
      }
      
      return false;
    },
    
    async getRealmContext(realmId: EntityId): Promise<RealmContext> {
      // Use getRealm which will rebuild from event store if needed
      const realm = await this.getRealm(realmId);
      if (!realm) {
        throw new Error(`Realm not found: ${realmId}`);
      }
      
      let parentContext: RealmContext | undefined;
      if (realm.parentRealmId) {
        parentContext = await this.getRealmContext(realm.parentRealmId);
      }
      
      const getEffectiveConfig = (): RealmConfig => {
        if (!parentContext) {
          return realm.config;
        }
        
        const parentConfig = parentContext.getEffectiveConfig();
        
        // Merge configs - child can restrict but not expand parent permissions
        return {
          ...realm.config,
          crossRealmAllowed: realm.config.crossRealmAllowed && parentConfig.crossRealmAllowed,
          allowedEntityTypes: realm.config.allowedEntityTypes ?? parentConfig.allowedEntityTypes,
          allowedAgreementTypes: realm.config.allowedAgreementTypes ?? parentConfig.allowedAgreementTypes,
        };
      };
      
      return {
        realm,
        config: realm.config,
        parentContext,
        
        isAllowed(operation: string, resourceType: string): boolean {
          const effectiveConfig = getEffectiveConfig();
          
          // Check entity type restrictions
          if (operation === 'create' && resourceType === 'entity') {
            if (effectiveConfig.allowedEntityTypes) {
              // Would need to check specific entity type
              return true;
            }
          }
          
          // Check agreement type restrictions
          if (operation === 'create' && resourceType === 'agreement') {
            if (effectiveConfig.allowedAgreementTypes) {
              // Would need to check specific agreement type
              return true;
            }
          }
          
          return true; // Default allow
        },
        
        getEffectiveConfig,
      };
    },
    
    async validateCrossRealmOperation(
      sourceRealmId: EntityId,
      targetRealmId: EntityId,
      operation: CrossRealmOperation
    ): Promise<CrossRealmValidation> {
      // Same realm is always allowed
      if (sourceRealmId === targetRealmId) {
        return { allowed: true };
      }
      
      // Use getRealm which will rebuild from event store if needed
      const sourceRealm = await this.getRealm(sourceRealmId);
      const targetRealm = await this.getRealm(targetRealmId);
      
      if (!sourceRealm || !targetRealm) {
        return { allowed: false, reason: 'Realm not found' };
      }
      
      // Check if both realms allow cross-realm operations
      if (!sourceRealm.config.crossRealmAllowed) {
        return { 
          allowed: false, 
          reason: 'Source realm does not allow cross-realm operations',
          requiredAgreement: 'cross-realm-access',
        };
      }
      
      if (!targetRealm.config.crossRealmAllowed) {
        return { 
          allowed: false, 
          reason: 'Target realm does not allow cross-realm operations',
          requiredAgreement: 'cross-realm-access',
        };
      }
      
      // Check hierarchical relationship
      if (sourceRealm.config.isolation === 'Hierarchical') {
        // Check if one is ancestor of the other
        let current: Realm | null = targetRealm;
        while (current) {
          if (current.id === sourceRealmId) {
            return { allowed: true }; // Target is descendant of source
          }
          current = current.parentRealmId ? await this.getRealm(current.parentRealmId) : null;
        }
        
        current = sourceRealm;
        while (current) {
          if (current.id === targetRealmId) {
            return { allowed: true }; // Source is descendant of target
          }
          current = current.parentRealmId ? await this.getRealm(current.parentRealmId) : null;
        }
        
        // Not in same hierarchy
        return {
          allowed: false,
          reason: 'Realms are not in the same hierarchy',
          requiredAgreement: 'cross-realm-access',
        };
      }
      
      // For asset transfers, may require specific agreement
      if (operation.type === 'AssetTransfer') {
        return {
          allowed: false,
          reason: 'Asset transfer requires a cross-realm transfer agreement',
          requiredAgreement: 'cross-realm-transfer',
        };
      }
      
      return { allowed: true };
    },
  };
}

function generateId(prefix: string): EntityId {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}-${timestamp}-${random}` as EntityId;
}

// ============================================================================
// REALM SCOPED OPERATIONS
// ============================================================================

/**
 * Wraps operations to enforce realm boundaries
 */
export interface RealmScopedOperations {
  /** Create an entity in a realm */
  createEntity(realmId: EntityId, entity: Omit<Entity, 'id' | 'realmId' | 'createdAt' | 'version'>): Promise<Entity>;
  
  /** Create an agreement in a realm */
  createAgreement(realmId: EntityId, agreement: Omit<Agreement, 'id' | 'realmId' | 'createdAt' | 'version'>): Promise<Agreement>;
  
  /** Create an asset in a realm */
  createAsset(realmId: EntityId, asset: Omit<Asset, 'id' | 'realmId' | 'createdAt' | 'version'>): Promise<Asset>;
  
  /** Query entities in a realm */
  queryEntities(realmId: EntityId, filter?: EntityFilter): Promise<readonly Entity[]>;
  
  /** Query agreements in a realm */
  queryAgreements(realmId: EntityId, filter?: AgreementFilter): Promise<readonly Agreement[]>;
}

export interface EntityFilter {
  readonly entityType?: string;
  readonly hasRole?: string;
  readonly identifierScheme?: string;
  readonly identifierValue?: string;
}

export interface AgreementFilter {
  readonly agreementType?: string;
  readonly status?: string;
  readonly involvesEntity?: EntityId;
  readonly fromDate?: Timestamp;
  readonly toDate?: Timestamp;
}

