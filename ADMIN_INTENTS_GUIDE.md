# 🔧 Guia: Admin Intents - Criar Realms, Entidades e Chaves API

## ✅ Tudo via Intents!

No UBL, **tudo é feito através de intents**. Não há endpoints administrativos separados - tudo flui pelo endpoint `/intent` seguindo a filosofia do sistema.

---

## 🎯 Intents Disponíveis para Admin

### 1. **createRealm** - Criar um Novo Realm

```bash
POST /intent
Content-Type: application/json

{
  "intent": "createRealm",
  "realm": "default-realm",  // Realm pai (ou primordial)
  "actor": { "type": "Anonymous" },
  "payload": {
    "name": "Minha Empresa",
    "config": {
      "isolation": "Full",
      "crossRealmAllowed": false,
      "allowedEntityTypes": ["Person", "Organization"],
      "allowedAgreementTypes": ["Employment", "Sale"]
    }
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "outcome": {
    "type": "Created",
    "realm": {
      "id": "realm-abc123...",
      "name": "Minha Empresa",
      "createdAt": 1234567890,
      "config": { ... }
    },
    "id": "realm-abc123..."
  },
  "affordances": [
    {
      "intent": "register",
      "description": "Create an entity in this realm",
      "required": ["entityType", "identity"]
    },
    {
      "intent": "createApiKey",
      "description": "Create API key for this realm",
      "required": ["entityId"]
    }
  ]
}
```

---

### 2. **register** - Criar Entidade/Usuário

```bash
POST /intent
Content-Type: application/json

{
  "intent": "register",
  "realm": "realm-abc123...",  // ID do realm criado
  "actor": { "type": "Anonymous" },
  "payload": {
    "entityType": "Person",  // ou "Organization", "System"
    "identity": {
      "name": "João Silva",
      "identifiers": [
        { "scheme": "email", "value": "joao@example.com" }
      ]
    }
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "outcome": {
    "type": "Created",
    "entity": {
      "id": "entity-xyz789...",
      "realmId": "realm-abc123...",
      "entityType": "Person",
      "name": "João Silva",
      "createdAt": 1234567890
    },
    "id": "entity-xyz789..."
  },
  "affordances": [
    {
      "intent": "createApiKey",
      "description": "Create API key for this entity",
      "required": ["entityId"]
    }
  ]
}
```

---

### 3. **createApiKey** - Criar Chave API

```bash
POST /intent
Content-Type: application/json

{
  "intent": "createApiKey",
  "realm": "realm-abc123...",
  "actor": { "type": "Anonymous" },
  "payload": {
    "realmId": "realm-abc123...",
    "entityId": "entity-xyz789...",  // ID da entidade criada
    "name": "Frontend API Key",
    "scopes": ["read", "write"],
    "expiresInDays": 365  // Opcional
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "outcome": {
    "type": "Created",
    "apiKey": {
      "id": "key-123456",
      "realmId": "realm-abc123...",
      "entityId": "entity-xyz789...",
      "name": "Frontend API Key",
      "scopes": ["read", "write"],
      "createdAt": 1234567890,
      "keyPrefix": "ubl_abc123..."
    },
    "key": "ubl_abc123def456..."  // ⚠️ SALVE ESTA CHAVE! Não será mostrada novamente
  }
}
```

⚠️ **IMPORTANTE:** A chave completa (`key`) só é retornada uma vez. Salve imediatamente!

---

### 4. **query** - Listar/Obter Realms, Entidades ou Chaves

#### Listar Todos os Realms

```bash
POST /intent
Content-Type: application/json

{
  "intent": "query",
  "realm": "default-realm",
  "actor": { "type": "Anonymous" },
  "payload": {
    "queryType": "Realm"
  }
}
```

#### Obter Realm Específico

```bash
POST /intent
Content-Type: application/json

{
  "intent": "query",
  "realm": "default-realm",
  "actor": { "type": "Anonymous" },
  "payload": {
    "queryType": "Realm",
    "filters": {
      "realmId": "realm-abc123..."
    }
  }
}
```

#### Listar Entidades de um Realm

```bash
POST /intent
Content-Type: application/json

{
  "intent": "query",
  "realm": "realm-abc123...",
  "actor": { "type": "Anonymous" },
  "payload": {
    "queryType": "Entity",
    "filters": {
      "realmId": "realm-abc123..."
    }
  }
}
```

#### Listar Chaves API

```bash
POST /intent
Content-Type: application/json

{
  "intent": "query",
  "realm": "realm-abc123...",
  "actor": { "type": "Anonymous" },
  "payload": {
    "queryType": "ApiKey",
    "filters": {
      "realmId": "realm-abc123...",  // Opcional
      "entityId": "entity-xyz789..."  // Opcional
    }
  }
}
```

---

### 5. **revokeApiKey** - Revogar Chave API

```bash
POST /intent
Content-Type: application/json

{
  "intent": "revokeApiKey",
  "realm": "realm-abc123...",
  "actor": { "type": "Anonymous" },
  "payload": {
    "keyId": "key-123456"
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "outcome": {
    "type": "Revoked"
  }
}
```

---

## 🚀 Fluxo Completo: Setup Inicial

### Passo 1: Criar Realm

```bash
curl -X POST https://seu-projeto.up.railway.app/intent \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "createRealm",
    "realm": "default-realm",
    "actor": { "type": "Anonymous" },
    "payload": {
      "name": "Minha Empresa"
    }
  }'
```

**Salve o `realm.id` da resposta!**

### Passo 2: Criar Entidade/Usuário

```bash
curl -X POST https://seu-projeto.up.railway.app/intent \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "register",
    "realm": "realm-abc123...",
    "actor": { "type": "Anonymous" },
    "payload": {
      "entityType": "Person",
      "identity": {
        "name": "João Silva",
        "identifiers": [
          { "scheme": "email", "value": "joao@example.com" }
        ]
      }
    }
  }'
```

**Salve o `entity.id` da resposta!**

### Passo 3: Criar Chave API

```bash
curl -X POST https://seu-projeto.up.railway.app/intent \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "createApiKey",
    "realm": "realm-abc123...",
    "actor": { "type": "Anonymous" },
    "payload": {
      "realmId": "realm-abc123...",
      "entityId": "entity-xyz789...",
      "name": "Frontend Key"
    }
  }'
```

**Salve o `key` da resposta! Use esta chave no frontend.**

---

## 📝 Exemplo JavaScript/TypeScript

```javascript
class UBLAdmin {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async createRealm(name, config = {}) {
    const response = await fetch(`${this.baseUrl}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'createRealm',
        realm: 'default-realm',
        actor: { type: 'Anonymous' },
        payload: { name, config }
      })
    });
    const data = await response.json();
    return data.outcome.realm;
  }

  async createEntity(realmId, entityType, name, identifiers = []) {
    const response = await fetch(`${this.baseUrl}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'register',
        realm: realmId,
        actor: { type: 'Anonymous' },
        payload: {
          entityType,
          identity: { name, identifiers }
        }
      })
    });
    const data = await response.json();
    return data.outcome.entity;
  }

  async createApiKey(realmId, entityId, name) {
    const response = await fetch(`${this.baseUrl}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'createApiKey',
        realm: realmId,
        actor: { type: 'Anonymous' },
        payload: { realmId, entityId, name }
      })
    });
    const data = await response.json();
    return {
      key: data.outcome.key,  // ⚠️ Salve esta chave!
      apiKey: data.outcome.apiKey
    };
  }

  async queryRealms() {
    const response = await fetch(`${this.baseUrl}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'query',
        realm: 'default-realm',
        actor: { type: 'Anonymous' },
        payload: { queryType: 'Realm' }
      })
    });
    const data = await response.json();
    return data.outcome.results;
  }

  async queryEntities(realmId) {
    const response = await fetch(`${this.baseUrl}/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'query',
        realm: realmId,
        actor: { type: 'Anonymous' },
        payload: {
          queryType: 'Entity',
          filters: { realmId }
        }
      })
    });
    const data = await response.json();
    return data.outcome.results;
  }
}

// Uso
const admin = new UBLAdmin('https://seu-projeto.up.railway.app');

// Setup completo
const realm = await admin.createRealm('Minha Empresa');
const entity = await admin.createEntity(realm.id, 'Person', 'João Silva');
const { key } = await admin.createApiKey(realm.id, entity.id, 'Frontend Key');

console.log('Realm ID:', realm.id);
console.log('Entity ID:', entity.id);
console.log('API Key:', key);  // Salve esta chave!
```

---

## ✅ Resumo dos Intents

| Intent | Descrição | Payload Principal |
|--------|-----------|-------------------|
| `createRealm` | Criar novo realm | `name`, `config` |
| `register` | Criar entidade/usuário | `entityType`, `identity` |
| `createApiKey` | Criar chave API | `realmId`, `entityId`, `name` |
| `query` | Listar/obter recursos | `queryType` (`Realm`, `Entity`, `ApiKey`), `filters` |
| `revokeApiKey` | Revogar chave API | `keyId` |

---

## 🎯 Tudo via `/intent`!

Não há endpoints separados - tudo segue a filosofia de intents do UBL. Isso mantém:
- ✅ Consistência com o sistema
- ✅ Auditoria completa
- ✅ Validação uniforme
- ✅ Flexibilidade para extensões

**Pronto para usar no Railway!** 🚀

