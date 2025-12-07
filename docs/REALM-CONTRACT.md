# Realm Contract - Universal Business Ledger

**Data:** 2025-12-07  
**Status:** ✅ **CONTRATO OFICIAL**  
**Objetivo:** Definir contrato completo e invariantes de Realm

---

## 📋 Definição de Realm

Um **Realm** é um universo auto-contido dentro do ledger. Representa:

- Um tenant em um sistema multi-tenant
- Um departamento dentro de uma organização
- Um projeto, país, jurisdição
- Qualquer contexto delimitado que precisa de isolamento

### Interface TypeScript

```typescript
interface Realm {
  readonly id: EntityId;
  readonly name: string;
  readonly parentRealmId?: EntityId; // Para realms hierárquicos
  readonly createdAt: Timestamp;
  
  /** O agreement que estabeleceu este realm */
  readonly establishedBy: EntityId;
  
  /** Configuração para este realm */
  readonly config: RealmConfig;
}

interface RealmConfig {
  /** Tipos de entidade permitidos neste realm */
  readonly allowedEntityTypes?: readonly string[];
  
  /** Tipos de agreement permitidos neste realm */
  readonly allowedAgreementTypes?: readonly string[];
  
  /** Workflows customizados para este realm */
  readonly customWorkflows?: readonly EntityId[];
  
  /** Nível de isolamento */
  readonly isolation: 'Full' | 'Shared' | 'Hierarchical';
  
  /** Entidades deste realm podem interagir com outros realms? */
  readonly crossRealmAllowed: boolean;
}
```

---

## 🔒 Invariantes

### 1. Realm é Estabelecido por Agreement

**Invariante:** Todo Realm **deve** ter um `establishedBy` que aponta para um Agreement.

- Não existe Realm sem Agreement que o estabeleceu
- O Agreement que estabelece um Realm é tipicamente um "Tenant License" ou "License Agreement"
- O Agreement estabelece os termos sob os quais o Realm existe

**Validação:**
```typescript
assert(realm.establishedBy, 'Realm must have establishedBy agreement');
const agreement = await getAgreement(realm.establishedBy);
assert(agreement, 'Establishing agreement must exist');
```

### 2. Primordial Realm

**Invariante:** Existe exatamente um Realm primordial.

**Definição:**
```typescript
const PRIMORDIAL_REALM_ID = '00000000-0000-0000-0000-000000000000';
const GENESIS_AGREEMENT_ID = '00000000-0000-0000-0000-000000000002';
```

**Propriedades do Primordial Realm:**
- `name = "Primordial Realm"`
- `establishedBy = GENESIS_AGREEMENT_ID`
- `config.isolation = "Full"`
- `config.crossRealmAllowed = true`

**Validação:**
```typescript
const primordial = await getRealm(PRIMORDIAL_REALM_ID);
assert(primordial, 'Primordial realm must exist');
assert.equal(primordial.name, 'Primordial Realm');
assert.equal(primordial.establishedBy, GENESIS_AGREEMENT_ID);
assert.equal(primordial.config.isolation, 'Full');
assert.equal(primordial.config.crossRealmAllowed, true);
```

### 3. Realm Existe Apenas Após Evento RealmCreated

**Invariante:** Um Realm só existe no sistema após um evento `RealmCreated` ser registrado no Event Store.

**Estrutura do Evento:**
```typescript
{
  type: "RealmCreated",
  aggregateId: realmId,
  aggregateType: "Realm", // SEMPRE "Realm" (padrão canônico)
  aggregateVersion: 1,
  payload: {
    type: "Realm",
    name: string,
    establishedBy: EntityId,
    config: RealmConfig,
  },
  actor: ActorReference,
  timestamp: Timestamp,
  hash: Hash,
}
```

**Validação:**
```typescript
// Criar realm via intent ou manager
const realm = await createRealm({ name: "Test Realm", ... });

// Confirmar que o event store tem esse evento
const events = await eventStore.read({
  aggregateType: 'Realm',
  aggregateId: realm.id
});

const realmCreatedEvent = events.find(e => e.type === 'RealmCreated');
assert(realmCreatedEvent, 'RealmCreated event must exist');
assert.equal(realmCreatedEvent.aggregateId, realm.id);
assert.equal(realmCreatedEvent.payload.name, realm.name);
```

---

## 🔄 Relação com Event Store

### Sem RealmCreated, Não Existe Realm

**Regra:** Um Realm só pode ser consultado se houver pelo menos um evento `RealmCreated` no Event Store para esse `aggregateId`.

**Implicação:**
- Não há "criação direta" de Realm sem evento
- O estado do Realm é **derivado** dos eventos, não armazenado diretamente
- Qualquer ponto no tempo pode ser reconstruído replaying eventos

**Validação:**
```typescript
// Antes de criar evento
let realm = await getRealm(realmId);
assert(!realm, 'Realm should not exist before RealmCreated event');

// Após criar evento
await eventStore.append({
  type: 'RealmCreated',
  aggregateId: realmId,
  aggregateType: 'Realm',
  aggregateVersion: 1,
  payload: { name: 'Test Realm', ... },
  ...
});

realm = await getRealm(realmId);
assert(realm, 'Realm should exist after RealmCreated event');
```

---

## 🎯 Uso no Sistema

### Criação de Realm

**Via Intent:**
```typescript
POST /intent
{
  "intent": "createRealm",
  "realm": PRIMORDIAL_REALM_ID,
  "actor": { "type": "System", "systemId": "genesis" },
  "payload": {
    "name": "My Company",
    "config": {
      "isolation": "Full",
      "crossRealmAllowed": false
    }
  }
}
```

**Resposta:**
```typescript
{
  "success": true,
  "outcome": {
    "id": "realm-abc123",
    "entity": {
      "id": "realm-abc123",
      "name": "My Company",
      "apiKey": "ubl_sk_...",
      "entityId": "ent-xyz789"
    }
  },
  "events": [
    {
      "type": "RealmCreated",
      "aggregateId": "realm-abc123",
      "aggregateType": "Realm",
      "aggregateVersion": 1,
      "payload": { ... }
    }
  ]
}
```

### Consulta de Realm

**Via Intent:**
```typescript
POST /intent
{
  "intent": "query",
  "realm": realmId,
  "payload": {
    "queryType": "Realm",
    "filters": {
      "realmId": realmId
    }
  }
}
```

---

## 📚 Referências

- **Filosofia:** `PHILOSOPHY.md` - "Every relationship is an Agreement"
- **Arquitetura:** `ARCHITECTURE.md` - Estrutura do sistema
- **Primitivos:** `core/universal/primitives.ts` - Definição TypeScript
- **Realm Manager:** `core/universal/realm-manager.ts` - Gerenciamento de realms

---

**Status:** ✅ **CONTRATO ESTABELECIDO**  
**Última atualização:** 2025-12-07

