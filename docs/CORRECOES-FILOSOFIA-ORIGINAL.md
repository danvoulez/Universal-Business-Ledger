# 🔧 Correções para Obedecer Filosofia ORIGINAL

**Objetivo:** Fazer versão Dezembro obedecer completamente as regras do ORIGINAL

---

## ✅ CORREÇÕES APLICADAS

### **1. Auto-Consent Explícito no Agreement Type** ✅
**Localização:** `core/universal/agreement-types.ts`

**Correção:**
- Adicionado `consentMethods: ['Implicit']` para WorkspaceOwner
- Agora está explícito no Agreement Type que permite consent implícito
- Segue ORIGINAL: consent pode ser "Implied" quando explicitamente definido no agreement type

**Antes:**
```typescript
requiresConsent: false, // Implícito, não documentado
```

**Depois:**
```typescript
requiresConsent: false, // Owner auto-consents when creating workspace (explicit in agreement type)
consentMethods: ['Implicit'], // Explicitly allow implicit consent for owner
```

---

### **2. Actor de Consent e Activation Corrigido** ✅
**Localização:** `core/api/intent-handlers/asset-intents.ts`

**Correção:**
- Consent: Actor agora é a entidade owner (não intent.actor)
- Activation: Actor agora é a entidade owner (não System)
- Segue ORIGINAL: actor é a entidade que realiza a ação

**Antes:**
```typescript
actor: intent.actor, // Pode não ser a parte correta
actor: { type: 'System' }, // Sistema ativa
```

**Depois:**
```typescript
actor: { type: 'Entity', entityId: ownerId }, // Owner é a parte que consente
actor: { type: 'Entity', entityId: ownerId }, // Owner completa o consent, ativa agreement
```

---

### **3. Actor de Roles Corrigido** ✅
**Localização:** `core/universal/agreement-hooks-processor.ts`

**Correção:**
- Actor agora é a entidade que recebe o role (holderId)
- Não é mais "System"
- Segue ORIGINAL: roles são estabelecidos por agreements, mas a ação (receber role) é feita pela entidade

**Antes:**
```typescript
actor: { type: 'System', systemId: 'agreement-hooks' },
```

**Depois:**
```typescript
actor: { type: 'Entity', entityId: holderId }, // A entidade que recebe o role
```

**Também corrigido:**
- Aggregate version agora calcula corretamente (não mais hardcoded 1)

---

## ⚠️ CORREÇÕES PENDENTES

### **4. Admin API com Storage In-Memory** ⚠️
**Localização:** `antenna/admin.ts`

**Problema:** Usa Maps in-memory ao invés de Event Store

**Solução necessária:**
- Migrar `createRealm`, `createEntity`, `createApiKey` para usar Event Store
- Criar eventos: `RealmCreated`, `EntityCreated`, `ApiKeyCreated`
- Remover Maps in-memory

**Status:** ⚠️ PENDENTE

---

### **5. Endpoint Fixo `/auth/delegate`** ⚠️
**Localização:** `antenna/server.ts`

**Problema:** Endpoint fixo fora de `/intent`

**Soluções possíveis:**
1. **Mover para intent** - Criar intent `delegate:auth` ou `create:apiKey`
2. **Documentar exceção** - Se for necessário para bootstrap, documentar como exceção filosófica

**Status:** ⚠️ PENDENTE - Decisão necessária

---

## 📋 PRÓXIMOS PASSOS

1. ✅ Corrigir auto-consent (FEITO)
2. ✅ Corrigir actors (FEITO)
3. ⚠️ Migrar Admin API para Event Store
4. ⚠️ Mover /auth/delegate para intent ou documentar
5. ⚠️ Validar todas as correções

---

**Status:** 3/5 correções aplicadas. 2 pendentes.

