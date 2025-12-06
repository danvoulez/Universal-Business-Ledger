# ⚠️ Desvios da Filosofia Encontrados - Análise do Código versão Dezembro

**Comparado com:** `Universal Ledger System ORIGINAL/PHILOSOPHY.md` e `ARCHITECTURE.md`

---

## ✅ O Que Está CORRETO (Segue a Filosofia)

### **1. Event Sourcing PostgreSQL - ✅ AVANÇO CORRETO**
**Localização:** `core/store/postgres-event-store.ts` e `postgres-schema.sql`

**Implementação segue a filosofia original:**
- ✅ **Append-only enforcement** - Triggers SQL impedem UPDATE/DELETE (linhas 77-101)
- ✅ **Hash chain integrity** - Trigger verifica hash chain no INSERT (linhas 108-162)
- ✅ **Aggregate version enforcement** - Trigger verifica versão sequencial (linhas 169-192)
- ✅ **Mesma interface EventStore** - Compatível com `ORIGINAL/core/store/event-store.ts`
- ✅ **Usa enforcement layer** - Usa `createHashChain()` do `core/enforcement/invariants.ts`
- ✅ **Sequence monotônico** - BIGSERIAL garante sequência crescente
- ✅ **Temporal queries** - Funções SQL para queries point-in-time (linhas 348-381)
- ✅ **Integrity verification** - Função `verify_chain_integrity()` (linhas 466-505)

**Comparação com ORIGINAL:**
- ✅ ORIGINAL tem apenas in-memory (`createInMemoryEventStore()`)
- ✅ versão Dezembro adiciona PostgreSQL mantendo mesma interface e filosofia
- ✅ Ambos usam `createHashChain()` e `createTemporalEnforcer()` do enforcement layer
- ✅ PostgreSQL adiciona proteções no nível do banco (triggers) além das validações em código

**Decisão:** ✅ **AVANÇO CORRETO** - Implementação PostgreSQL segue perfeitamente a filosofia original, adicionando persistência sem violar princípios.

---

### **2. Agreement-Based - ✅ PARCIALMENTE CORRETO**
- ✅ `asset-intents.ts` cria workspace-membership agreement automaticamente
- ✅ `agreement-hooks-processor.ts` cria roles via `processGrantsRoles` quando agreement é ativado
- ✅ Roles são criados via eventos `RoleGranted` com `grantedBy: agreementId`
- ✅ `authorization.ts` menciona "Agreement-Based Access Control"

**Localização:** 
- `core/api/intent-handlers/asset-intents.ts` (linhas 131-183)
- `core/universal/agreement-hooks-processor.ts` (linhas 155-232)

---

### **3. Intent-Driven - ✅ CORRETO**
- ✅ Handlers processam intents
- ✅ Retornam affordances
- ✅ Tudo via `/intent` endpoint

**Localização:** `antenna/server.ts`, `core/api/intent-handlers/`

---

## ⚠️ DESVIOS ENCONTRADOS

### **1. Auto-Consent e Auto-Activation** ⚠️ DESVIO
**Localização:** `core/api/intent-handlers/asset-intents.ts` (linhas 158-183)

**Problema:**
```typescript
// Auto-consent for owner
const consentEvent = await eventStore.append({
  type: 'PartyConsented',
  // ...
  payload: {
    method: 'Implicit',  // ⚠️ Consent implícito
  }
});

// Activate agreement
const activateEvent = await eventStore.append({
  type: 'AgreementActivated',
  actor: { type: 'System' },  // ⚠️ Sistema ativa automaticamente
  // ...
});
```

**Filosofia ORIGINAL:** Agreements devem ter consent explícito de todas as partes. Auto-consent e auto-activation podem violar o princípio de "explicit agreements".

**Decisão:** ⚠️ **AVALIAR** - Pode ser aceitável para casos específicos (owner do workspace), mas deve ser explícito no Agreement Type.

---

### **2. Aggregate Version Sempre 1** ⚠️ BUG/DESVIO
**Localização:** `core/api/intent-handlers/workspace-intents.ts` (linha 443)

**Problema:**
```typescript
const event = await eventStore.append({
  type: 'FileModified',
  aggregateType: 'File' as any,
  aggregateId: intent.payload.fileId,
  aggregateVersion: 1,  // ⚠️ SEMPRE 1, mesmo para modificações
  // ...
});
```

**Filosofia ORIGINAL:** Aggregate version deve incrementar a cada evento do mesmo aggregate.

**Decisão:** ❌ **BUG** - Deve calcular versão correta baseada em eventos anteriores.

---

### **3. FileDeleted como "Update"** ⚠️ DESVIO CONCEITUAL
**Localização:** `core/api/intent-handlers/workspace-intents.ts` (linhas 555-582)

**Problema:**
```typescript
// 3. Criar evento FileDeleted
const event = await eventStore.append({
  type: 'FileDeleted',
  // ...
});

return {
  success: true,
  outcome: {
    type: 'Updated',  // ⚠️ "Updated" para um delete?
    entity: { id: intent.payload.fileId, deleted: true },
    changes: ['deleted']
  },
  // ...
};
```

**Filosofia ORIGINAL:** Delete não é "update". É um evento de estado (deleted=true), mas o outcome type deveria ser diferente.

**Decisão:** ⚠️ **DESVIO MENOR** - Funciona, mas semanticamente confuso.

---

### **4. Verificação de Autorização ANTES de Criar Asset** ⚠️ ORDEM
**Localização:** `core/api/intent-handlers/workspace-intents.ts` (linhas 37-59)

**Problema:**
```typescript
// 1. Verificar permissão via ABAC
const authorization = context.authorization as any;
const auth = await authorization.authorize({
  actor: intent.actor,
  action: { type: 'create' as const },
  resource: { type: 'Workspace' as const, id: intent.payload.workspaceId },
  // ...
});
```

**Filosofia ORIGINAL:** Autorização deve verificar se o actor tem permissão via Agreements. Mas aqui está verificando permissão em um workspace que ainda não existe (id vem do payload, mas pode não existir ainda).

**Decisão:** ⚠️ **AVALIAR** - Pode estar correto se verifica permissão no realm, não no workspace específico.

---

### **5. Roles Criados por Sistema, Não por Agreement Explicitamente** ⚠️ DESVIO
**Localização:** `core/universal/agreement-hooks-processor.ts` (linhas 210-228)

**Problema:**
```typescript
// Create RoleGranted event
const roleId = generateId('role');
await services.eventStore.append({
  type: 'RoleGranted',
  // ...
  actor: { type: 'System', systemId: 'agreement-hooks' },  // ⚠️ Sistema cria role
  // ...
  payload: {
    grantedBy: agreementId,  // ✅ Mas referencia o agreement
    // ...
  },
});
```

**Filosofia ORIGINAL:** Roles devem ser estabelecidos por Agreements. Aqui o sistema cria o role automaticamente quando agreement é ativado, mas o `grantedBy` referencia o agreement. Isso está correto conceitualmente, mas o actor é "System" ao invés de ser o agreement ou as partes.

**Decisão:** ⚠️ **AVALIAR** - Pode ser aceitável se o `grantedBy` sempre referencia o agreement. Mas o actor deveria ser as partes do agreement, não "System".

---

## 🔍 Verificações Completadas

### **1. RBAC Estático - ✅ NÃO ENCONTRADO**
- ✅ `authorization.ts` deriva roles de Agreements via `role.establishedBy` (linha 326)
- ✅ `roleStore.getActiveRoles()` busca roles de agreements via aggregates
- ✅ `ROLE_TEMPLATES` são apenas templates, não roles estáticos
- ✅ Roles são criados via `RoleGranted` events com `grantedBy: agreementId`

**Decisão:** ✅ **CORRETO** - Sistema usa ABAC corretamente, roles vêm de Agreements.

---

### **2. Endpoints Fixos - ⚠️ ENCONTRADO**
**Localização:** `antenna/server.ts`

**Endpoints encontrados:**
- ✅ `/intent` - ✅ CORRETO (intent-driven)
- ✅ `/chat` - ✅ CORRETO (agent API)
- ✅ `/affordances` - ✅ CORRETO (retorna intents disponíveis)
- ✅ `/session/*` - ✅ CORRETO (gerenciamento de sessão)
- ✅ `/health` - ✅ CORRETO (health check)
- ⚠️ `/auth/delegate` - ⚠️ Endpoint fixo (linha 638)

**Problema:**
```typescript
else if (path === '/auth/delegate' && req.method === 'POST') {
  // Endpoint fixo para delegação de autenticação
}
```

**Filosofia ORIGINAL:** Tudo deveria ser via `/intent`. Endpoints fixos violam Intent-Driven.

**Decisão:** ⚠️ **DESVIO MENOR** - Endpoint de autenticação pode ser aceitável, mas idealmente seria via intent.

---

### **3. Aggregate Versions - ❌ BUG ENCONTRADO**
**Localização:** `core/api/intent-handlers/workspace-intents.ts` (linha 443)

**Problema:**
```typescript
const event = await eventStore.append({
  type: 'FileModified',
  aggregateType: 'File' as any,
  aggregateId: intent.payload.fileId,
  aggregateVersion: 1,  // ❌ SEMPRE 1, mesmo para modificações
  // ...
});
```

**Filosofia ORIGINAL:** Aggregate version deve incrementar a cada evento do mesmo aggregate.

**Outros lugares com mesmo problema:**
- `FileDeleted` (linha 560) - `aggregateVersion: 1`
- `FileUploaded` (linha 88) - `aggregateVersion: 1` (OK para primeiro evento)

**Decisão:** ❌ **BUG CRÍTICO** - Deve calcular versão correta baseada em eventos anteriores.

---

### **4. Auto-Consent e Auto-Activation - ⚠️ DESVIO**
**Localização:** 
- `core/api/intent-handlers/asset-intents.ts` (linhas 158-183)
- `antenna/admin.ts` (linhas 209-234)

**Problema:**
```typescript
// Auto-consent for owner
const consentEvent = await eventStore.append({
  type: 'PartyConsented',
  payload: {
    method: 'Implicit',  // ⚠️ Consent implícito
  }
});

// Activate agreement
const activateEvent = await eventStore.append({
  type: 'AgreementActivated',
  actor: { type: 'System' },  // ⚠️ Sistema ativa automaticamente
});
```

**Filosofia ORIGINAL:** Agreements devem ter consent explícito de todas as partes. Auto-consent pode violar o princípio de "explicit agreements".

**Decisão:** ⚠️ **DESVIO** - Pode ser aceitável para casos específicos (owner do workspace, tenant-license), mas deve ser explícito no Agreement Type que permite auto-consent.

---

### **5. Admin API com Storage In-Memory - ⚠️ DESVIO**
**Localização:** `antenna/admin.ts` (linhas 53-79)

**Problema:**
```typescript
const realms = new Map<EntityId, {...}>();
const entities = new Map<EntityId, {...}>();
const apiKeys = new Map<string, {...}>();
```

**Filosofia ORIGINAL:** Tudo deve estar no Event Store. Storage in-memory separado viola Event Sourcing.

**Decisão:** ⚠️ **DESVIO** - Admin API usa storage in-memory ao invés de Event Store. Deveria criar eventos para realms, entities, apiKeys.

---

### **6. Roles Criados por Sistema - ⚠️ AVALIAR**
**Localização:** `core/universal/agreement-hooks-processor.ts` (linhas 210-228)

**Problema:**
```typescript
await services.eventStore.append({
  type: 'RoleGranted',
  actor: { type: 'System', systemId: 'agreement-hooks' },  // ⚠️ Sistema cria role
  payload: {
    grantedBy: agreementId,  // ✅ Mas referencia o agreement
  },
});
```

**Filosofia ORIGINAL:** Roles devem ser estabelecidos por Agreements. Aqui o sistema cria automaticamente quando agreement é ativado.

**Decisão:** ⚠️ **ACEITÁVEL** - O `grantedBy` referencia o agreement, então está correto conceitualmente. Mas o actor deveria ser as partes do agreement, não "System".

---

## 📋 Resumo dos Desvios

### **❌ BUGS (Corrigir):**
1. ❌ **Aggregate version sempre 1** - Deve calcular versão correta

### **⚠️ DESVIOS (Avaliar/Corrigir):**
1. ⚠️ **Auto-consent implícito** - Deve ser explícito no Agreement Type
2. ⚠️ **Admin API com storage in-memory** - Deveria usar Event Store
3. ⚠️ **Endpoint fixo `/auth/delegate`** - Idealmente via intent
4. ⚠️ **Roles criados por "System"** - Actor deveria ser partes do agreement

### **✅ CORRETO:**
1. ✅ Event Sourcing (apenas append, hash chain protegida)
2. ✅ ABAC (roles derivados de Agreements)
3. ✅ Intent-Driven (tudo via /intent, exceto /auth/delegate)
4. ✅ Agreement-Based (handlers criam Agreements)

---

## 🎯 Próximas Ações

1. **Corrigir aggregate versions** - Calcular versão correta em todos os handlers
2. **Avaliar auto-consent** - Tornar explícito no Agreement Type
3. **Migrar Admin API para Event Store** - Remover storage in-memory
4. **Mover /auth/delegate para intent** - Ou documentar por que é exceção

---

**Status:** Análise completa. Encontrados 1 bug crítico e 4 desvios menores. Sistema está majoritariamente alinhado com a filosofia.

