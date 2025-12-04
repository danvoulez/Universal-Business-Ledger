/**
 * ADMIN API - Management Endpoints
 * 
 * Endpoints for managing realms, entities, and API keys.
 * These are public endpoints for self-service setup.
 */

import type { EntityId, ActorReference } from '../core/shared/types';
import type { IntentHandler } from '../core/api/intent-api';

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
// IN-MEMORY STORAGE (for development)
// ============================================================================

const realms = new Map<EntityId, {
  id: EntityId;
  name: string;
  createdAt: number;
  config: any;
}>();

const entities = new Map<EntityId, {
  id: EntityId;
  realmId: EntityId;
  entityType: string;
  name: string;
  createdAt: number;
  identifiers?: any[];
}>();

const apiKeys = new Map<string, {
  id: string;
  key: string;
  realmId: EntityId;
  entityId: EntityId;
  name: string;
  scopes: string[];
  createdAt: number;
  expiresAt?: number;
  revoked: boolean;
}>();

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
  const realmId = generateId('realm');
  const systemEntityId = generateId('entity');
  
  const realm = {
    id: realmId,
    name: request.name,
    createdAt: Date.now(),
    config: {
      isolation: request.config?.isolation || 'Full',
      crossRealmAllowed: request.config?.crossRealmAllowed || false,
      allowedEntityTypes: request.config?.allowedEntityTypes,
      allowedAgreementTypes: request.config?.allowedAgreementTypes,
    },
  };
  
  realms.set(realmId, realm);
  
  // Create system entity for this realm via intent handler if available
  if (intentHandler) {
    try {
      await intentHandler.handle({
        intent: 'register',
        realm: realmId,
        actor: { type: 'System', systemId: 'admin' } as ActorReference,
        timestamp: Date.now(),
        payload: {
          entityType: 'System',
          identity: {
            name: `${request.name} System`,
            identifiers: [{ scheme: 'realm', value: realmId, verified: true }],
          },
        },
      });
    } catch (e) {
      console.warn('Could not create system entity via intent handler:', e);
    }
  }
  
  // Automatically create API key for the realm
  const apiKeyData = await createApiKey({
    realmId,
    entityId: systemEntityId,
    name: `${request.name} - Master Key`,
    scopes: ['read', 'write', 'admin'],
  });
  
  return { 
    realm, 
    entityId: systemEntityId,
    apiKey: apiKeyData.key 
  };
}

export async function getRealm(realmId: EntityId): Promise<any | null> {
  return realms.get(realmId) || null;
}

export async function listRealms(): Promise<any[]> {
  return Array.from(realms.values());
}

export async function createEntity(
  request: CreateEntityRequest,
  intentHandler?: IntentHandler
): Promise<{ entity: any }> {
  const entityId = generateId('entity');
  
  const entity = {
    id: entityId,
    realmId: request.realmId,
    entityType: request.entityType,
    name: request.name,
    createdAt: Date.now(),
    identifiers: request.identifiers || [],
  };
  
  entities.set(entityId, entity);
  
  // Create entity via intent handler if available
  if (intentHandler) {
    try {
      await intentHandler.handle({
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
    } catch (e) {
      console.warn('Could not create entity via intent handler:', e);
    }
  }
  
  return { entity };
}

export async function getEntity(entityId: EntityId): Promise<any | null> {
  return entities.get(entityId) || null;
}

export async function listEntities(realmId?: EntityId): Promise<any[]> {
  const all = Array.from(entities.values());
  if (realmId) {
    return all.filter(e => e.realmId === realmId);
  }
  return all;
}

/**
 * Criar usuário - sempre requer realmId
 * Se createRealmIfNotExists=true e realm não existe, cria o realm primeiro
 */
export async function createUser(
  request: CreateUserRequest,
  intentHandler?: IntentHandler
): Promise<{ user: any; entityId: EntityId; apiKey: string; credentials: { email: string; password: string } }> {
  // Verificar se realm existe
  let realm = await getRealm(request.realmId);
  
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
  const entityId = generateId('entity');
  const userEntity = {
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
  
  entities.set(entityId, userEntity);
  
  // Criar via intent handler se disponível
  if (intentHandler) {
    try {
      await intentHandler.handle({
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
    } catch (e) {
      console.warn('Could not create user entity via intent handler:', e);
    }
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
  
  // Criar API key para o usuário
  const apiKeyData = await createApiKey({
    realmId: realm.id,
    entityId,
    name: `${request.name} - Personal Key`,
    scopes: request.isAdmin ? ['read', 'write', 'admin'] : ['read', 'write'],
  });
  
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

export async function createApiKey(request: CreateApiKeyRequest): Promise<{
  key: string;
  apiKey: any;
}> {
  const key = generateApiKey();
  const keyId = `key-${Date.now()}`;
  const expiresAt = request.expiresInDays
    ? Date.now() + (request.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;
  
  const apiKey = {
    id: keyId,
    key: key, // Only returned once
    realmId: request.realmId,
    entityId: request.entityId,
    name: request.name,
    scopes: request.scopes || ['read', 'write'],
    createdAt: Date.now(),
    expiresAt,
    revoked: false,
  };
  
  // Store by key hash (simple implementation)
  const keyHash = Buffer.from(key).toString('base64');
  apiKeys.set(keyHash, apiKey);
  
  return {
    key, // Return raw key only once
    apiKey: {
      id: apiKey.id,
      realmId: apiKey.realmId,
      entityId: apiKey.entityId,
      name: apiKey.name,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      revoked: apiKey.revoked,
      keyPrefix: key.slice(0, 12), // For identification
    },
  };
}

export async function listApiKeys(realmId?: EntityId, entityId?: EntityId): Promise<any[]> {
  const all = Array.from(apiKeys.values());
  let filtered = all;
  
  if (realmId) {
    filtered = filtered.filter(k => k.realmId === realmId);
  }
  
  if (entityId) {
    filtered = filtered.filter(k => k.entityId === entityId);
  }
  
  // Don't return the raw key, only metadata
  return filtered.map(k => ({
    id: k.id,
    realmId: k.realmId,
    entityId: k.entityId,
    name: k.name,
    scopes: k.scopes,
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
    revoked: k.revoked,
    keyPrefix: k.key.slice(0, 12),
  }));
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  for (const [hash, key] of apiKeys.entries()) {
    if (key.id === keyId) {
      apiKeys.set(hash, { ...key, revoked: true });
      return true;
    }
  }
  return false;
}

export async function verifyApiKey(key: string): Promise<any | null> {
  const keyHash = Buffer.from(key).toString('base64');
  const apiKey = apiKeys.get(keyHash);
  
  if (!apiKey) return null;
  if (apiKey.revoked) return null;
  if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) return null;
  
  return {
    realmId: apiKey.realmId,
    entityId: apiKey.entityId,
    scopes: apiKey.scopes,
  };
}

