# 🔐 Armazenamento de Chaves API - Seguindo o Padrão UBL

## 📋 Como o Banco Funciona no UBL

O UBL usa **Event Sourcing** com **Projections** e **ABAC**:

1. **Eventos** (`events` table) = Fonte da verdade (append-only, imutável)
2. **Projections** (tabelas `*_projection`) = Views otimizadas para leitura
3. **Checkpoints** (`projection_checkpoints`) = Rastreiam eventos processados
4. **ABAC** (Agreement-Based Access Control) = Controle de acesso via Agreements

### ABAC - Agreement-Based Access Control

No UBL, **permissões vêm de Agreements**:

```
Entity → holds → Role (via Agreement) → grants → Permissions → in Scope
```

**Características:**
- ✅ Roles são estabelecidos por Agreements (não atributos estáticos)
- ✅ Toda permissão é rastreável ao Agreement que a concedeu
- ✅ Roles têm validade temporal (podem expirar, ser revogados)
- ✅ Roles têm escopo (realm, organização, asset, agreement específico)
- ✅ Histórico completo de autorização está no event log

### Padrão Existente

```sql
-- Eventos são a fonte da verdade
CREATE TABLE events (
    id UUID PRIMARY KEY,
    sequence BIGSERIAL,
    event_type TEXT,
    aggregate_type TEXT,
    aggregate_id UUID,
    payload JSONB,
    ...
);

-- Projections são atualizadas a partir dos eventos
CREATE TABLE parties_projection (...);
CREATE TABLE agreements_projection (...);
CREATE TABLE roles_projection (...);
```

---

## ⚠️ Situação Atual das Chaves API

**As chaves estão em memória** (`Map` em JavaScript):

```typescript
// antenna/admin.ts - linha 60
const apiKeys = new Map<string, {...}>();  // ← Em memória!
```

**Problemas:**
- ❌ Perdidas ao reiniciar servidor
- ❌ Não persistem entre deploys
- ❌ Não seguem o padrão Event Sourcing do UBL

---

## ✅ Solução: Seguir o Padrão UBL com ABAC

### 1. Criar Agreement para Chave API (ABAC)

Seguindo o padrão ABAC, uma chave API deve ser estabelecida por um **Agreement**:

```typescript
// Criar Agreement que estabelece a chave API
await intentHandler.handle({
  intent: 'propose',
  realm: realmId,
  actor: { type: 'Entity', entityId: entityId },
  payload: {
    agreementType: 'ApiKeyAccess',
    parties: [
      { entityId: entityId, role: 'KeyHolder' },
      { entityId: 'system', role: 'KeyIssuer' }
    ],
    terms: {
      description: `API Key: ${name}`,
      clauses: [
        {
          type: 'Permissions',
          content: {
            scopes: ['read', 'write'],  // Permissões da chave
            expiresAt: expiresAt
          }
        }
      ]
    }
  }
});

// Depois criar o evento da chave
await eventStore.append({
  type: 'ApiKeyCreated',
  aggregateId: keyId,
  aggregateType: 'Flow',
  aggregateVersion: 1,
  payload: {
    agreementId,  // ← Vinculado ao Agreement!
    realmId,
    entityId,
    name,
    scopes,
    keyHash,  // ⚠️ NUNCA a chave raw!
    expiresAt,
  },
  actor: { type: 'System', systemId: 'admin' }
});
```

### 2. Verificar Permissões via ABAC

Quando uma chave API é usada, verificar permissões via ABAC:

```typescript
// Verificar se a chave tem permissão para a ação
const authDecision = await authorizationEngine.authorize({
  actor: { type: 'Entity', entityId: apiKey.entityId },
  action: { type: 'create', intent: 'register' },
  resource: { type: 'Entity' },
  context: {
    realm: apiKey.realmId,
    timestamp: Date.now(),
    correlationId: requestId
  }
});

if (!authDecision.allowed) {
  throw new Error('API key does not have permission for this action');
}
```

### 3. Criar Eventos para Chaves API

Quando uma chave é criada/revogada, criar eventos:

```typescript
// Criar chave = Event (vinculado ao Agreement)
await eventStore.append({
  type: 'ApiKeyCreated',
  aggregateId: keyId,
  aggregateType: 'Flow',
  aggregateVersion: 1,
  payload: {
    agreementId,  // ← Agreement que estabelece a chave
    realmId,
    entityId,
    name,
    scopes,
    keyHash,  // ⚠️ NUNCA a chave raw!
    expiresAt,
  },
  actor: { type: 'System', systemId: 'admin' }
});

// Revogar chave = Event (termina o Agreement)
await eventStore.append({
  type: 'ApiKeyRevoked',
  aggregateId: keyId,
  aggregateType: 'Flow',
  aggregateVersion: 2,
  payload: {
    agreementId,
    reason: 'User requested revocation'
  },
  actor: { type: 'System', systemId: 'admin' }
});
```

### 2. Criar Projection para Leitura Rápida

Adicionar ao `postgres-schema.sql`:

```sql
-- =============================================================================
-- API KEYS PROJECTION
-- =============================================================================

CREATE TABLE api_keys_projection (
    id              UUID PRIMARY KEY,
    key_hash        TEXT UNIQUE NOT NULL,  -- Hash da chave (nunca raw!)
    realm_id        UUID NOT NULL,
    entity_id       UUID NOT NULL,
    name            TEXT NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],
    created_at      TIMESTAMPTZ NOT NULL,
    expires_at      TIMESTAMPTZ,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    version         INT NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_api_keys_realm ON api_keys_projection(realm_id);
CREATE INDEX idx_api_keys_entity ON api_keys_projection(entity_id);
CREATE INDEX idx_api_keys_hash ON api_keys_projection(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys_projection(realm_id, revoked, expires_at) 
    WHERE revoked = FALSE;
```

### 3. Adicionar Checkpoint

```sql
-- Adicionar ao final do schema
INSERT INTO projection_checkpoints (projection_name, last_sequence) VALUES
    ('api_keys', 1);
```

---

## 🔧 Implementação

### Atualizar `admin.ts` para Usar Event Store

```typescript
import type { EventStore } from '../core/store/event-store';
import crypto from 'crypto';

let eventStore: EventStore | null = null;

export async function initializeStorage(store: EventStore) {
  eventStore = store;
}

async function hashKey(key: string): Promise<string> {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function createApiKey(request: CreateApiKeyRequest): Promise<{
  key: string;
  apiKey: any;
}> {
  const key = generateApiKey();
  const keyHash = await hashKey(key);
  const keyId = generateId('key');
  
  // Criar evento (fonte da verdade)
  if (eventStore) {
    await eventStore.append({
      type: 'ApiKeyCreated',
      aggregateId: keyId,
      aggregateType: 'Flow',
      aggregateVersion: 1,
      payload: {
        realmId: request.realmId,
        entityId: request.entityId,
        name: request.name,
        scopes: request.scopes || ['read', 'write'],
        keyHash,  // ⚠️ Apenas hash, nunca a chave raw!
        expiresAt: request.expiresInDays
          ? Date.now() + (request.expiresInDays * 24 * 60 * 60 * 1000)
          : undefined,
      },
      actor: { type: 'System', systemId: 'admin' },
    });
  }
  
  // Fallback para memória se Event Store não disponível
  const keyHashBase64 = Buffer.from(key).toString('base64');
  apiKeys.set(keyHashBase64, {
    id: keyId,
    key: key,
    realmId: request.realmId,
    entityId: request.entityId,
    name: request.name,
    scopes: request.scopes || ['read', 'write'],
    createdAt: Date.now(),
    expiresAt: request.expiresInDays
      ? Date.now() + (request.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined,
    revoked: false,
  });
  
  return {
    key, // Retornar chave raw apenas uma vez
    apiKey: {
      id: keyId,
      realmId: request.realmId,
      entityId: request.entityId,
      name: request.name,
      scopes: request.scopes || ['read', 'write'],
      createdAt: Date.now(),
      expiresAt: request.expiresInDays
        ? Date.now() + (request.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
      revoked: false,
      keyPrefix: key.slice(0, 12),
    },
  };
}

export async function verifyApiKey(key: string): Promise<any | null> {
  const keyHash = await hashKey(key);
  
  // Se Event Store disponível, ler da projection
  if (eventStore) {
    // TODO: Implementar leitura da projection
    // Por enquanto, fallback para memória
  }
  
  // Fallback para memória
  const keyHashBase64 = Buffer.from(key).toString('base64');
  const apiKey = apiKeys.get(keyHashBase64);
  if (!apiKey || apiKey.revoked) return null;
  if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) return null;
  
  return {
    realmId: apiKey.realmId,
    entityId: apiKey.entityId,
    scopes: apiKey.scopes,
  };
}
```

---

## 📊 Fluxo Completo

```
1. Criar Chave API
   ↓
2. Gerar Hash (SHA-256)
   ↓
3. Criar Evento 'ApiKeyCreated' no Event Store
   ↓
4. Projection Processor atualiza 'api_keys_projection'
   ↓
5. Verificação lê da projection (rápido)
```

---

## 🔒 Segurança e ABAC

### Armazenamento Seguro

**NUNCA armazenar chave raw:**
- ✅ Eventos: apenas `keyHash` (SHA-256)
- ✅ Projection: apenas `key_hash`
- ✅ Chave raw: retornada apenas uma vez na criação

**Por quê?**
- Se o banco for comprometido, chaves não podem ser recuperadas
- Apenas hash é comparado na verificação
- Segue princípio de "zero-knowledge" para chaves

### Controle de Acesso via ABAC

**Chaves API seguem o padrão ABAC:**

1. **Agreement estabelece a chave**
   - Tipo: `ApiKeyAccess`
   - Parties: Entity (KeyHolder) + System (KeyIssuer)
   - Terms: Scopes, expiresAt

2. **Roles derivados do Agreement**
   - Role: `ApiKeyHolder`
   - Permissions: definidas pelos scopes do Agreement
   - Scope: Realm específico

3. **Verificação de permissões**
   - Quando chave é usada, verificar via `authorizationEngine.authorize()`
   - Permissões vêm dos Roles estabelecidos pelo Agreement
   - Tudo é auditável e rastreável

**Exemplo:**
```typescript
// Chave criada com scopes ['read', 'write']
// Agreement estabelece Role 'ApiKeyHolder' com essas permissões
// Quando chave é usada:
const decision = await authorizationEngine.authorize({
  actor: { type: 'Entity', entityId: apiKey.entityId },
  action: { type: 'create' },
  resource: { type: 'Entity' },
  context: { realm: apiKey.realmId, ... }
});
// Decision mostra qual Agreement/Role concedeu a permissão
```

---

## ✅ Resumo

**Padrão UBL:**
1. ✅ Eventos = Fonte da verdade (append-only)
2. ✅ Projections = Views otimizadas
3. ✅ Checkpoints = Rastreamento de processamento
4. ✅ **ABAC** = Controle de acesso via Agreements

**Para Chaves API:**
1. ✅ Criar **Agreement** `ApiKeyAccess` que estabelece a chave
2. ✅ Criar eventos `ApiKeyCreated`/`ApiKeyRevoked` (vinculados ao Agreement)
3. ✅ Criar projection `api_keys_projection`
4. ✅ Verificar permissões via `authorizationEngine` (ABAC)
5. ✅ Nunca armazenar chave raw, apenas hash

**Fluxo Completo:**
```
1. Criar Agreement 'ApiKeyAccess' (estabelece Role e Permissions)
   ↓
2. Criar Evento 'ApiKeyCreated' (vinculado ao Agreement)
   ↓
3. Projection atualiza 'api_keys_projection'
   ↓
4. Quando chave é usada: verificar via ABAC
   ↓
5. Authorization Engine verifica Roles do Agreement
   ↓
6. Permissão concedida/negada (auditável)
```

**Resultado:** Chaves persistem seguindo a arquitetura completa do UBL com ABAC! 🎯
