/**
 * ADMIN API - Management Endpoints
 * 
 * Endpoints for managing realms, entities, and API keys.
 * These are public endpoints for self-service setup.
 */

import type { EntityId, ActorReference } from '../core/shared/types';
import type { IntentHandler } from '../core/api/intent-api';
import type { RealmConfig } from '../core/universal/primitives';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateRealmRequest {
  name: string;
  config?: {
    isolation?: 'Full' | 'Shared' | 'Hierarchical';
    crossRealmAllowed?: boolean;
    allowedEntityTypes?: string[];
    allowedAgreementTypes?: string[];
  };
}

export interface CreateEntityRequest {
  realmId: EntityId;
  entityType: 'Person' | 'Organization' | 'System';
  name: string;
  identifiers?: Array<{ scheme: string; value: string }>;
}

export interface CreateUserRequest {
  realmId: EntityId; // OBRIGATÓRIO - usuário sempre pertence a um realm
  email: string;
  name: string;
  password?: string; // Opcional - se não fornecido, gera senha temporária
  isAdmin?: boolean; // Se true, cria como admin do realm
  createRealmIfNotExists?: boolean; // Se true e realm não existe, cria o realm primeiro
}

export interface CreateApiKeyRequest {
  realmId: EntityId;
  entityId: EntityId;
  name: string;
  scopes?: string[];
  expiresInDays?: number;
}

// ============================================================================
// EVENT STORE-BASED STORAGE (Following ORIGINAL philosophy)
// ============================================================================
// All data comes from Event Store - no in-memory storage
// This follows the ORIGINAL philosophy: everything is in the event stream

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

function generateId(prefix: string): EntityId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${timestamp}-${random}` as EntityId;
}

function generateApiKey(): string {
  const part1 = Math.random().toString(36).slice(2, 15);
  const part2 = Math.random().toString(36).slice(2, 15);
  return `ubl_${part1}_${part2}`;
}

export async function createRealm(
  request: CreateRealmRequest,
  intentHandler?: IntentHandler
): Promise<{ realm: any; entityId: EntityId; apiKey: string }> {
  const PRIMORDIAL_REALM_ID = '00000000-0000-0000-0000-000000000000' as EntityId;
  
  // Following the philosophy: Agreement first, realm created via hook
  // Step 1: Create System entity (Licensor) in primordial realm
  let systemEntityId: EntityId | undefined;
  if (intentHandler) {
    try {
      const systemResult = await intentHandler.handle({
        intent: 'register',
        realm: PRIMORDIAL_REALM_ID,
        actor: { type: 'System', systemId: 'genesis' } as ActorReference,
        timestamp: Date.now(),
        payload: {
          entityType: 'System',
          identity: {
            name: `System - ${request.name}`,
            identifiers: [{ scheme: 'system', value: 'tenant-licensor', verified: true }],
          },
        },
      });
      if (systemResult.success && systemResult.outcome.type === 'Created') {
        systemEntityId = systemResult.outcome.id;
      } else {
        console.warn('System entity creation failed:', systemResult);
      }
    } catch (e) {
      console.error('Could not create system entity via intent handler:', e);
      throw new Error(`Failed to create system entity: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    throw new Error('Intent handler is required to create realm');
  }
  
  // Step 2: Create Organization entity (Licensee) in primordial realm
  let licenseeEntityId: EntityId | undefined;
  if (intentHandler) {
    try {
      const orgResult = await intentHandler.handle({
        intent: 'register',
        realm: PRIMORDIAL_REALM_ID,
        actor: { type: 'System', systemId: 'genesis' } as ActorReference,
        timestamp: Date.now(),
        payload: {
          entityType: 'Organization',
          identity: {
            name: request.name,
            identifiers: [{ scheme: 'name', value: request.name, verified: true }],
          },
        },
      });
      if (orgResult.success && orgResult.outcome.type === 'Created') {
        licenseeEntityId = orgResult.outcome.id;
      } else {
        console.warn('Organization entity creation failed:', orgResult);
      }
    } catch (e) {
      console.error('Could not create organization entity via intent handler:', e);
      throw new Error(`Failed to create organization entity: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  if (!systemEntityId || !licenseeEntityId) {
    throw new Error(`Failed to create required entities for tenant-license agreement. System: ${systemEntityId ? 'OK' : 'FAILED'}, Licensee: ${licenseeEntityId ? 'OK' : 'FAILED'}`);
  }
  
  // Step 3: Propose tenant-license agreement in primordial realm
  const agreementId = generateId('agreement');
  let createdRealmId: EntityId | undefined;
  
  // Get services from context (outside try block so they're available after catch)
  const handlerContext = (intentHandler as any).context;
  if (!handlerContext) {
    throw new Error('Intent handler context is not available');
  }
  const eventStore = handlerContext.eventStore;
  const agreementTypeRegistry = handlerContext.agreements;
  const realmManager = handlerContext.realmManager;
  
  if (!eventStore) {
    console.error('Handler context keys:', Object.keys(handlerContext));
    throw new Error(`eventStore is not defined in context. Available keys: ${Object.keys(handlerContext).join(', ')}`);
  }
  if (!agreementTypeRegistry) {
    throw new Error('agreementTypeRegistry is not defined');
  }
  if (!realmManager) {
    throw new Error('realmManager is not defined');
  }
  
  try {
    
    if (!eventStore) {
      console.error('Handler context keys:', Object.keys(handlerContext));
      throw new Error(`eventStore is not defined in context. Available keys: ${Object.keys(handlerContext).join(', ')}`);
    }
    if (!agreementTypeRegistry) {
      throw new Error('agreementTypeRegistry is not defined');
    }
    if (!realmManager) {
      throw new Error('realmManager is not defined');
    }
    
    // Propose agreement
    const proposeEvent = await eventStore.append({
      type: 'AgreementProposed',
      aggregateType: 'Agreement' as any,
      aggregateId: agreementId,
      aggregateVersion: 1,
      actor: { type: 'System', systemId: 'genesis' } as ActorReference,
      timestamp: Date.now(),
      payload: {
        agreementType: 'tenant-license',
        parties: [
          {
            entityId: systemEntityId,
            role: 'Licensor',
          },
          {
            entityId: licenseeEntityId,
            role: 'Licensee',
          },
        ],
        terms: {
          description: `Tenant license for ${request.name}`,
          realmName: request.name, // For hook to extract
          realmConfig: {
            isolation: request.config?.isolation || 'Full',
            crossRealmAllowed: request.config?.crossRealmAllowed || false,
            allowedEntityTypes: request.config?.allowedEntityTypes,
            allowedAgreementTypes: request.config?.allowedAgreementTypes,
          },
        },
        validity: {
          effectiveFrom: Date.now(),
        },
      },
    });
    
    // Step 4: Give consent from Licensee
    await eventStore.append({
      type: 'PartyConsented',
      aggregateType: 'Agreement' as any,
      aggregateId: agreementId,
      aggregateVersion: 2,
      actor: { type: 'Entity', entityId: licenseeEntityId } as ActorReference,
      timestamp: Date.now(),
      payload: {
        partyId: licenseeEntityId,
        method: 'Implicit',
      },
    });
    
    // Step 5: Activate agreement (all required consents given)
    const activateEvent = await eventStore.append({
      type: 'AgreementActivated',
      aggregateType: 'Agreement' as any,
      aggregateId: agreementId,
      aggregateVersion: 3,
      actor: { type: 'System', systemId: 'genesis' } as ActorReference,
      timestamp: Date.now(),
      payload: {
        activatedAt: Date.now(),
      },
    });
    
    // Step 6: Process hooks (CreateRealm hook will create the realm)
    const agreementTypeDef = agreementTypeRegistry.get('tenant-license');
    if (agreementTypeDef?.hooks?.onActivated) {
      // Rehydrate agreement state for hook processing
      const agreementState = {
        id: agreementId,
        agreementType: 'tenant-license',
        parties: [
          { entityId: systemEntityId, role: 'Licensor' },
          { entityId: licenseeEntityId, role: 'Licensee' },
        ],
        terms: {
          description: `Tenant license for ${request.name}`,
          realmName: request.name,
          realmConfig: {
            isolation: request.config?.isolation || 'Full',
            crossRealmAllowed: request.config?.crossRealmAllowed || false,
            allowedEntityTypes: request.config?.allowedEntityTypes,
            allowedAgreementTypes: request.config?.allowedAgreementTypes,
          },
        },
        status: 'Active',
      };
      
      // Import and use hook processor
      const { processAgreementActivatedHooks } = await import('../core/universal/agreement-hooks-processor');
      const hookResult = await processAgreementActivatedHooks(
        agreementId,
        'tenant-license',
        agreementState,
        {
          eventStore,
          agreementTypeRegistry,
          realmManager,
        }
      );
      
    // Get created realm ID from hook processor result
    if (hookResult.createdRealmId) {
      createdRealmId = hookResult.createdRealmId;
    }
  }
  
  // If hook didn't create realm (fallback), create it via Event Store
  if (!createdRealmId) {
    const realmId = generateId('realm');
    // Get current aggregate version
    const latestRealmEvent = await eventStore.getLatest('Realm' as any, realmId);
    const nextRealmVersion = latestRealmEvent ? latestRealmEvent.aggregateVersion + 1 : 1;
    
    // Create realm via Event Store using canonical helper
    const { buildRealmCreatedEvent } = await import('../core/universal/realm-events');
    const realmConfig: RealmConfig = {
      isolation: request.config?.isolation || 'Full',
      crossRealmAllowed: request.config?.crossRealmAllowed || false,
      allowedEntityTypes: request.config?.allowedEntityTypes,
      allowedAgreementTypes: request.config?.allowedAgreementTypes,
    };
    const realmCreatedEvent = buildRealmCreatedEvent(
      realmId,
      request.name,
      agreementId,
      realmConfig,
      { type: 'Entity', entityId: licenseeEntityId } as ActorReference,
      Date.now(),
      nextRealmVersion
    );
    await eventStore.append(realmCreatedEvent);
    createdRealmId = realmId;
  }
    
  } catch (e) {
    console.error('Error creating tenant-license agreement:', e);
    throw e;
  }
  
  // Step 7: Create API key for Licensee entity
  if (!eventStore) {
    throw new Error('eventStore is not available for API key creation');
  }
  const apiKeyData = await createApiKey({
    realmId: createdRealmId!,
    entityId: licenseeEntityId,
    name: `${request.name} - Master Key`,
    scopes: ['read', 'write', 'admin'],
  }, eventStore);
  
  // Get realm from Event Store (following ORIGINAL philosophy)
  const realm = await getRealm(createdRealmId!, eventStore);
  if (!realm) {
    throw new Error('Realm was not created');
  }
  
  return { 
    realm, 
    entityId: licenseeEntityId,
    apiKey: apiKeyData.key 
  };
}

/**
 * Get realm from Event Store (following ORIGINAL philosophy)
 * Reads RealmCreated events to reconstruct realm state
 */
export async function getRealm(
  realmId: EntityId,
  eventStore?: any
): Promise<any | null> {
  // If eventStore not provided, try to get from context
  if (!eventStore) {
    // This function should be called with eventStore from context
    // For backward compatibility, return null if not provided
    return null;
  }
  
  // Read RealmCreated events for this realm
  // Realms use 'Flow' as aggregate type (as per ORIGINAL)
  const events: any[] = [];
  for await (const event of eventStore.getByAggregate('Flow' as any, realmId)) {
    events.push(event);
    if (event.type === 'RealmCreated') {
      const payload = event.payload as any;
      return {
        id: realmId,
        name: payload.name || payload.type?.name || 'Unnamed Realm',
        createdAt: event.timestamp,
        establishedBy: payload.establishedBy || payload.type?.establishedBy,
        config: payload.config || payload.type?.config || {},
        parentRealmId: payload.parentRealmId,
      };
    }
  }
  
  return null;
}

/**
 * List all realms from Event Store (following ORIGINAL philosophy)
 * Reads all RealmCreated events
 */
export async function listRealms(eventStore?: any): Promise<any[]> {
  if (!eventStore) {
    return [];
  }
  
  const realms: any[] = [];
  const seenRealmIds = new Set<EntityId>();
  
  // Iterate through all events to find RealmCreated events
  // Note: This is not efficient for large event streams, but follows ORIGINAL philosophy
  // In production, use projections for better performance
  for await (const event of eventStore.getBySequence(1n)) {
    if (event.type === 'RealmCreated' && !seenRealmIds.has(event.aggregateId)) {
      const payload = event.payload as any;
      realms.push({
        id: event.aggregateId,
        name: payload.name || payload.type?.name || 'Unnamed Realm',
        createdAt: event.timestamp,
        establishedBy: payload.establishedBy || payload.type?.establishedBy,
        config: payload.config || payload.type?.config || {},
        parentRealmId: payload.parentRealmId,
      });
      seenRealmIds.add(event.aggregateId);
    }
  }
  
  return realms;
}

export async function createEntity(
  request: CreateEntityRequest,
  intentHandler?: IntentHandler
): Promise<{ entity: any }> {
  // Create entity via intent handler (following ORIGINAL philosophy: everything via intents)
  if (!intentHandler) {
    throw new Error('Intent handler required to create entity');
  }
  
  try {
    const result = await intentHandler.handle({
      intent: 'register',
      realm: request.realmId,
      actor: { type: 'System', systemId: 'admin' } as ActorReference,
      timestamp: Date.now(),
      payload: {
        entityType: request.entityType,
        identity: {
          name: request.name,
          identifiers: request.identifiers || [],
        },
      },
    });
    
    if (result.success && result.outcome.type === 'Created') {
      // Get entity from Event Store
      const context = (intentHandler as any).context;
      const aggregates = context?.aggregates;
      if (aggregates) {
        const entity = await aggregates.getParty(result.outcome.id);
        return { entity: entity ? {
          id: entity.id,
          realmId: request.realmId,
          entityType: entity.type,
          name: entity.identity.name,
          createdAt: entity.createdAt,
          identifiers: entity.identity.identifiers,
        } : null };
      }
    }
    
    throw new Error('Failed to create entity');
  } catch (e) {
    console.error('Could not create entity via intent handler:', e);
    throw e;
  }
}

/**
 * Get entity from Event Store (following ORIGINAL philosophy)
 * Uses aggregate repository to reconstruct entity state
 */
export async function getEntity(
  entityId: EntityId,
  aggregates?: any
): Promise<any | null> {
  if (!aggregates) {
    return null;
  }
  
  const party = await aggregates.getParty(entityId);
  if (!party) {
    return null;
  }
  
  return {
    id: party.id,
    realmId: party.realmId || ('' as EntityId), // Party may not have realmId in schema
    entityType: party.type,
    name: party.identity.name,
    createdAt: party.createdAt,
    identifiers: party.identity.identifiers || [],
  };
}

/**
 * List entities from Event Store (following ORIGINAL philosophy)
 * Note: This requires iterating all events - use projections for production
 */
export async function listEntities(
  realmId?: EntityId,
  eventStore?: any,
  aggregates?: any
): Promise<any[]> {
  if (!eventStore || !aggregates) {
    return [];
  }
  
  const entities: any[] = [];
  const seenEntityIds = new Set<EntityId>();
  
  // Iterate through all events to find PartyRegistered/EntityCreated events
  // Note: This is not efficient for large event streams, but follows ORIGINAL philosophy
  // In production, use projections for better performance
  for await (const event of eventStore.getBySequence(1n)) {
    if ((event.type === 'PartyRegistered' || event.type === 'EntityCreated') && 
        !seenEntityIds.has(event.aggregateId)) {
      
      // Filter by realmId if provided
      if (realmId) {
        const payload = event.payload as any;
        const eventRealmId = payload.realmId || (event as any).realmId;
        if (eventRealmId !== realmId) {
          continue;
        }
      }
      
      // Reconstruct entity state
      const party = await aggregates.getParty(event.aggregateId);
      if (party) {
        entities.push({
          id: party.id,
          realmId: party.realmId || ('' as EntityId),
          entityType: party.type,
          name: party.identity.name,
          createdAt: party.createdAt,
          identifiers: party.identity.identifiers || [],
        });
        seenEntityIds.add(event.aggregateId);
      }
    }
  }
  
  return entities;
}

/**
 * Criar usuário - sempre requer realmId
 * Se createRealmIfNotExists=true e realm não existe, cria o realm primeiro
 */
export async function createUser(
  request: CreateUserRequest,
  intentHandler?: IntentHandler
): Promise<{ user: any; entityId: EntityId; apiKey: string; credentials: { email: string; password: string } }> {
  // Get eventStore from context for realm lookup
  const context = intentHandler ? (intentHandler as any).context : undefined;
  const eventStore = context?.eventStore;
  
  // Verificar se realm existe
  let realm = eventStore ? await getRealm(request.realmId, eventStore) : null;
  
  // Se realm não existe e createRealmIfNotExists=true, criar realm
  if (!realm && request.createRealmIfNotExists) {
    const realmData = await createRealm({
      name: `${request.name}'s Realm`,
      config: { isolation: 'Full' }
    }, intentHandler);
    realm = realmData.realm;
  }
  
  if (!realm) {
    throw new Error(`Realm ${request.realmId} não existe. Use createRealmIfNotExists=true para criar automaticamente.`);
  }
  
  // Criar entidade do usuário
  let entityId = generateId('entity');
  let userEntity = {
    id: entityId,
    realmId: realm.id,
    entityType: 'Person',
    name: request.name,
    email: request.email,
    createdAt: Date.now(),
    identifiers: [
      { scheme: 'email', value: request.email, verified: false }
    ],
    isAdmin: request.isAdmin || false,
  };
  
  // Criar via intent handler (following ORIGINAL philosophy: everything via intents)
  if (!intentHandler) {
    throw new Error('Intent handler required to create user');
  }
  
  try {
    const result = await intentHandler.handle({
      intent: 'register',
      realm: realm.id,
      actor: { type: 'System', systemId: 'admin' } as ActorReference,
      timestamp: Date.now(),
      payload: {
        entityType: 'Person',
        identity: {
          name: request.name,
          identifiers: [
            { scheme: 'email', value: request.email }
          ],
        },
      },
    });
    
    if (result.success && result.outcome.type === 'Created') {
      entityId = result.outcome.id;
      // Get entity from aggregates
      const aggregates = context?.aggregates;
      if (aggregates) {
        const createdEntity = await aggregates.getParty(entityId);
        if (createdEntity) {
          userEntity = {
            id: createdEntity.id,
            realmId: createdEntity.realmId || realm.id,
            entityType: createdEntity.type,
            name: createdEntity.identity.name,
            email: request.email,
            createdAt: createdEntity.createdAt,
            identifiers: createdEntity.identity.identifiers || [],
            isAdmin: request.isAdmin || false,
          };
        }
      }
    }
  } catch (e) {
    console.error('Could not create user entity via intent handler:', e);
    throw e;
  }
  
  // Gerar senha se não fornecida
  const password = request.password || generateTemporaryPassword();
  
  // Criar credenciais (em produção, hash da senha)
  const credentials = {
    entityId,
    email: request.email,
    passwordHash: btoa(password), // Em produção: usar bcrypt/argon2
    createdAt: Date.now(),
  };
  
  // Criar API key para o usuário (via Event Store)
  const apiKeyData = await createApiKey({
    realmId: realm.id,
    entityId,
    name: `${request.name} - Personal Key`,
    scopes: request.isAdmin ? ['read', 'write', 'admin'] : ['read', 'write'],
  }, eventStore);
  
  return {
    user: userEntity,
    entityId,
    apiKey: apiKeyData.key,
    credentials: {
      email: request.email,
      password, // Retornar apenas na criação
    },
  };
}

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Create API key via Event Store (following ORIGINAL philosophy)
 * Creates ApiKeyCreated event instead of in-memory storage
 */
export async function createApiKey(
  request: CreateApiKeyRequest,
  eventStore?: any
): Promise<{
  key: string;
  apiKey: any;
}> {
  if (!eventStore) {
    throw new Error('Event store required to create API key');
  }
  
  const key = generateApiKey();
  const keyId = generateId('apikey');
  const expiresAt = request.expiresInDays
    ? Date.now() + (request.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;
  
  // Get current aggregate version
  const latestEvent = await eventStore.getLatest('ApiKey' as any, keyId);
  const nextVersion = latestEvent ? latestEvent.aggregateVersion + 1 : 1;
  
  // Create ApiKeyCreated event (following ORIGINAL philosophy)
  await eventStore.append({
    type: 'ApiKeyCreated',
    aggregateType: 'ApiKey' as any,
    aggregateId: keyId,
    aggregateVersion: nextVersion,
    actor: { type: 'Entity', entityId: request.entityId } as ActorReference,
    timestamp: Date.now(),
    payload: {
      type: 'ApiKeyCreated',
      realmId: request.realmId,
      entityId: request.entityId,
      name: request.name,
      scopes: request.scopes || ['read', 'write'],
      keyHash: Buffer.from(key).toString('base64'), // Store hash, not raw key
      expiresAt,
      revoked: false,
    },
  });
  
  return {
    key, // Return raw key only once (not stored in event)
    apiKey: {
      id: keyId,
      realmId: request.realmId,
      entityId: request.entityId,
      name: request.name,
      scopes: request.scopes || ['read', 'write'],
      createdAt: Date.now(),
      expiresAt,
      revoked: false,
      keyPrefix: key.slice(0, 12), // For identification
    },
  };
}

/**
 * List API keys from Event Store (following ORIGINAL philosophy)
 * Reads ApiKeyCreated events
 */
export async function listApiKeys(
  realmId?: EntityId,
  entityId?: EntityId,
  eventStore?: any
): Promise<any[]> {
  if (!eventStore) {
    return [];
  }
  
  const apiKeys: any[] = [];
  const seenKeyIds = new Set<EntityId>();
  
  // Iterate through all events to find ApiKeyCreated events
  // Note: This is not efficient for large event streams, but follows ORIGINAL philosophy
  // In production, use projections for better performance
  for await (const event of eventStore.getBySequence(1n)) {
    if (event.type === 'ApiKeyCreated' && !seenKeyIds.has(event.aggregateId)) {
      const payload = event.payload as any;
      
      // Filter by realmId if provided
      if (realmId && payload.realmId !== realmId) {
        continue;
      }
      
      // Filter by entityId if provided
      if (entityId && payload.entityId !== entityId) {
        continue;
      }
      
      // Check if revoked (would need ApiKeyRevoked events)
      const isRevoked = payload.revoked || false;
      
      apiKeys.push({
        id: event.aggregateId,
        realmId: payload.realmId,
        entityId: payload.entityId,
        name: payload.name,
        scopes: payload.scopes || [],
        createdAt: event.timestamp,
        expiresAt: payload.expiresAt,
        revoked: isRevoked,
        keyPrefix: payload.keyHash ? Buffer.from(payload.keyHash, 'base64').toString().slice(0, 12) : 'unknown',
      });
      seenKeyIds.add(event.aggregateId);
    }
    
    // Also check for ApiKeyRevoked events
    if (event.type === 'ApiKeyRevoked') {
      const payload = event.payload as any;
      const keyIndex = apiKeys.findIndex(k => k.id === payload.apiKeyId);
      if (keyIndex >= 0) {
        apiKeys[keyIndex].revoked = true;
      }
    }
  }
  
  return apiKeys;
}

/**
 * Revoke API key via Event Store (following ORIGINAL philosophy)
 * Creates ApiKeyRevoked event
 */
export async function revokeApiKey(
  keyId: string,
  eventStore?: any,
  actor?: ActorReference
): Promise<boolean> {
  if (!eventStore) {
    return false;
  }
  
  // Check if key exists
  const latestEvent = await eventStore.getLatest('ApiKey' as any, keyId as EntityId);
  if (!latestEvent || latestEvent.type !== 'ApiKeyCreated') {
    return false;
  }
  
  // Get current aggregate version
  const nextVersion = latestEvent.aggregateVersion + 1;
  
  // Create ApiKeyRevoked event
  await eventStore.append({
    type: 'ApiKeyRevoked',
    aggregateType: 'ApiKey' as any,
    aggregateId: keyId as EntityId,
    aggregateVersion: nextVersion,
    actor: actor || { type: 'System', systemId: 'admin' } as ActorReference,
    timestamp: Date.now(),
    payload: {
      type: 'ApiKeyRevoked',
      apiKeyId: keyId,
      revokedAt: Date.now(),
      reason: 'Revoked by admin',
    },
  });
  
  return true;
}

/**
 * Verify API key from Event Store (following ORIGINAL philosophy)
 * Reads ApiKeyCreated and ApiKeyRevoked events
 */
export async function verifyApiKey(
  key: string,
  eventStore?: any
): Promise<any | null> {
  if (!eventStore) {
    return null;
  }
  
  const keyHash = Buffer.from(key).toString('base64');
  
  // Find ApiKeyCreated event with matching hash
  for await (const event of eventStore.getBySequence(1n)) {
    if (event.type === 'ApiKeyCreated') {
      const payload = event.payload as any;
      if (payload.keyHash === keyHash) {
        const keyId = event.aggregateId;
        
        // Check if revoked
        let isRevoked = false;
        for await (const revokeEvent of eventStore.getByAggregate('ApiKey' as any, keyId)) {
          if (revokeEvent.type === 'ApiKeyRevoked') {
            isRevoked = true;
            break;
          }
        }
        
        if (isRevoked) return null;
        
        // Check expiration
        if (payload.expiresAt && Date.now() > payload.expiresAt) {
          return null;
        }
        
        return {
          realmId: payload.realmId,
          entityId: payload.entityId,
          scopes: payload.scopes || [],
        };
      }
    }
  }
  
  return null;
}

