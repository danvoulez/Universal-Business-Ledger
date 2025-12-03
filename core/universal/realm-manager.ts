/**
 * REALM MANAGER - Multitenancy Engine
 * 
 * Manages the isolation and interaction between realms (tenants).
 * Each realm is a self-contained universe that can have its own:
 * - Entities
 * - Assets
 * - Agreements
 * - Workflows
 * - Configuration
 * 
 * Realms are established by Agreements (Tenant License).
 * Cross-realm interactions require explicit agreements.
 */

import type { EntityId, Timestamp, Event } from '../schema/ledger';
import type { Realm, RealmConfig, Entity, Agreement, Asset, Role } from './primitives';
import type { EventStore } from '../store/event-store';

// ============================================================================
// REALM MANAGER INTERFACE
// ============================================================================

export interface RealmManager {
  /**
   * Create the primordial realm and system entity (bootstrap)
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
   */
  getRealm(realmId: EntityId): Promise<Realm | null>;
  
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
  const realms = new Map<EntityId, Realm>();
  const entities = new Map<EntityId, Entity>();
  const realmMemberships = new Map<EntityId, Set<EntityId>>(); // entityId -> realmIds
  
  const PRIMORDIAL_REALM_ID = '00000000-0000-0000-0000-000000000000' as EntityId;
  const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000001' as EntityId;
  const GENESIS_AGREEMENT_ID = '00000000-0000-0000-0000-000000000002' as EntityId;
  
  return {
    async bootstrap(): Promise<BootstrapResult> {
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
      
      // Store
      realms.set(PRIMORDIAL_REALM_ID, primordialRealm);
      entities.set(SYSTEM_ENTITY_ID, systemEntity);
      
      // Emit events
      await eventStore.append({
        type: 'RealmCreated',
        aggregateId: PRIMORDIAL_REALM_ID,
        aggregateType: 'Flow', // Using Flow as a proxy for Realm
        aggregateVersion: 1,
        payload: {
          type: 'RealmCreated',
          name: primordialRealm.name,
          establishedBy: GENESIS_AGREEMENT_ID,
          config: primordialRealm.config,
        },
        actor: { type: 'System', systemId: 'bootstrap' },
      });
      
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
      
      realms.set(realmId, realm);
      
      await eventStore.append({
        type: 'RealmCreated',
        aggregateId: realmId,
        aggregateType: 'Flow',
        aggregateVersion: 1,
        payload: {
          type: 'RealmCreated',
          name,
          establishedBy: licenseAgreementId,
          config: fullConfig,
        },
        actor: { type: 'System', systemId: 'realm-manager' },
      });
      
      return realm;
    },
    
    async getRealm(realmId: EntityId): Promise<Realm | null> {
      return realms.get(realmId) ?? null;
    },
    
    async getChildRealms(parentRealmId: EntityId): Promise<readonly Realm[]> {
      return Array.from(realms.values()).filter(r => r.parentRealmId === parentRealmId);
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
      
      const updatedRealm: Realm = {
        ...realm,
        config: { ...realm.config, ...changes },
      };
      
      realms.set(realmId, updatedRealm);
      
      await eventStore.append({
        type: 'RealmConfigUpdated',
        aggregateId: realmId,
        aggregateType: 'Flow',
        aggregateVersion: 2, // Would need proper versioning
        payload: {
          type: 'RealmConfigUpdated',
          changes,
          reason: `Updated by agreement ${agreementId}`,
        },
        actor: { type: 'System', systemId: 'realm-manager' },
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
      const realm = realms.get(realmId);
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
      
      const sourceRealm = realms.get(sourceRealmId);
      const targetRealm = realms.get(targetRealmId);
      
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
        let current: Realm | undefined = targetRealm;
        while (current) {
          if (current.id === sourceRealmId) {
            return { allowed: true }; // Target is descendant of source
          }
          current = current.parentRealmId ? realms.get(current.parentRealmId) : undefined;
        }
        
        current = sourceRealm;
        while (current) {
          if (current.id === targetRealmId) {
            return { allowed: true }; // Source is descendant of target
          }
          current = current.parentRealmId ? realms.get(current.parentRealmId) : undefined;
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

