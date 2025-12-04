# 🎨 Guia: Frontend Multitenant no UBL

## ✅ Sim, o UBL é Multitenant!

O Universal Business Ledger é **100% multitenant** através do sistema de **Realms**. Cada realm é um universo isolado com seus próprios:
- Entidades
- Acordos (Agreements)
- Assets
- Workflows
- Configurações

---

## 🏗️ Como Funciona

### Realms = Tenants

Cada **Realm** representa um tenant isolado:
- `realm-abc-123` = Empresa A
- `realm-xyz-789` = Empresa B
- `default-realm` = Realm padrão (para desenvolvimento)

**Isolamento completo:** Dados de um realm não são visíveis para outro (a menos que explicitamente permitido).

---

## 📋 Respostas às Suas Perguntas

### 1. **Preciso criar um Realm?**

**Resposta:** Depende do seu caso de uso.

#### Opção A: Usar Realm Padrão (Desenvolvimento/Teste)
```javascript
// O servidor já tem um realm padrão configurado
const realmId = 'default-realm';
```

**Quando usar:**
- ✅ Desenvolvimento local
- ✅ Testes
- ✅ Protótipos
- ✅ Aplicação single-tenant

#### Opção B: Criar Realm Personalizado (Produção Multitenant)
```javascript
// Criar realm via API (requer acesso administrativo)
POST /intent
{
  "intent": "createRealm",
  "realm": "primordial-realm", // Realm pai
  "payload": {
    "name": "Minha Empresa",
    "config": {
      "isolation": "Full",
      "crossRealmAllowed": false
    }
  }
}
```

**Quando usar:**
- ✅ Produção multitenant
- ✅ Cada cliente precisa de isolamento
- ✅ Diferentes organizações/departamentos

---

### 2. **Preciso criar uma Chave API?**

**Resposta:** **Não é obrigatório, mas altamente recomendado.**

#### Opção A: Sem Autenticação (Desenvolvimento)
```javascript
// Funciona sem chave, mas com limitações
fetch('/chat', {
  method: 'POST',
  body: JSON.stringify({
    startSession: {
      realmId: 'default-realm',
      actor: { type: 'Anonymous' } // Sem autenticação
    }
  })
});
```

**Limitações:**
- ⚠️ Actor será `Anonymous`
- ⚠️ Sem rastreamento de quem fez a ação
- ⚠️ Sem controle de permissões

#### Opção B: Com Chave API Realm-Scoped (Recomendado)
```javascript
// 1. Obter chave API para o realm
POST /auth/delegate
Headers: {
  Authorization: 'Bearer MASTER_API_KEY'
}
Body: {
  realmId: 'meu-realm-123'
}

// Resposta:
{
  "token": "ubl_sk_realm_eyJ...",
  "realmId": "meu-realm-123",
  "expiresAt": 1234567890,
  "scope": "realm",
  "permissions": ["read", "write"]
}

// 2. Usar a chave nas requisições
fetch('/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ubl_sk_realm_eyJ...',
    'X-Realm-Id': 'meu-realm-123' // Opcional se já está no token
  },
  body: JSON.stringify({
    startSession: {
      realmId: 'meu-realm-123',
      actor: { type: 'Entity', entityId: 'user-123' }
    }
  })
});
```

**Vantagens:**
- ✅ Autenticação e autorização
- ✅ Rastreamento de ações
- ✅ Controle de permissões
- ✅ Rate limiting por realm
- ✅ Auditoria completa

---

### 3. **As Chamadas Precisam Ter Realm ID?**

**Resposta:** **Sim, mas tem fallback automático.**

#### Como Funciona

**POST /chat:**
```javascript
// ✅ OBRIGATÓRIO na primeira mensagem (startSession)
POST /chat
{
  "message": { "text": "Olá" },
  "startSession": {
    "realmId": "meu-realm-123", // ← OBRIGATÓRIO aqui
    "actor": { type: "Entity", entityId: "user-123" }
  }
}

// ✅ OPCIONAL nas mensagens seguintes (usa realm da sessão)
POST /chat
{
  "sessionId": "session-abc",
  "message": { "text": "Como criar um acordo?" }
  // realmId vem da sessão automaticamente
}
```

**POST /intent:**
```javascript
// ✅ OPCIONAL (usa defaultRealmId se não fornecido)
POST /intent
{
  "intent": "query",
  "realm": "meu-realm-123", // ← Opcional, mas recomendado
  "actor": { type: "Entity", entityId: "user-123" },
  "payload": {}
}

// Se não fornecer, usa 'default-realm'
```

**GET /affordances:**
```javascript
// ✅ OPCIONAL (query param)
GET /affordances?realm=meu-realm-123
// Se não fornecer, usa 'default-realm'
```

---

## 🚀 Guia Prático: Criando um Frontend

### Passo 1: Escolher Realm

```javascript
// Para desenvolvimento rápido
const REALM_ID = 'default-realm';

// Para produção multitenant
const REALM_ID = 'meu-realm-123'; // Criado via API administrativa
```

### Passo 2: Configurar Autenticação (Opcional mas Recomendado)

```javascript
// Obter chave API (uma vez, guardar no localStorage)
async function getApiKey(realmId) {
  const response = await fetch('/auth/delegate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MASTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ realmId })
  });
  
  const { token } = await response.json();
  localStorage.setItem('apiKey', token);
  return token;
}

// Usar chave nas requisições
const apiKey = localStorage.getItem('apiKey');
```

### Passo 3: Criar Cliente Frontend

```javascript
// cliente.js
class UBLClient {
  constructor(realmId, apiKey = null) {
    this.realmId = realmId;
    this.apiKey = apiKey;
    this.sessionId = null;
  }

  async chat(message) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const body = {
      message: { text: message },
    };

    // Se primeira mensagem, iniciar sessão
    if (!this.sessionId) {
      body.startSession = {
        realmId: this.realmId,
        actor: { type: 'Anonymous' } // Ou autenticado se tiver API key
      };
    } else {
      body.sessionId = this.sessionId;
    }

    const response = await fetch('/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    this.sessionId = data.sessionId;
    return data.response;
  }

  async intent(intent, payload) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch('/intent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        intent,
        realm: this.realmId, // ← Sempre incluir realm
        actor: { type: 'Anonymous' },
        payload
      })
    });

    return response.json();
  }
}

// Uso
const client = new UBLClient('meu-realm-123', apiKey);
const response = await client.chat('Criar um acordo de emprego');
```

### Passo 4: Exemplo React Hook

```typescript
// useUBL.ts
import { useState, useCallback } from 'react';

export function useUBL(realmId: string, apiKey?: string) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const chat = useCallback(async (text: string) => {
    setLoading(true);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body: any = {
      message: { text }
    };

    if (!sessionId) {
      body.startSession = {
        realmId,
        actor: { type: 'Anonymous' }
      };
    } else {
      body.sessionId = sessionId;
    }

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await response.json();
      
      if (!sessionId) {
        setSessionId(data.sessionId);
      }

      setMessages(prev => [
        ...prev,
        { user: text, agent: data.response }
      ]);

      return data.response;
    } finally {
      setLoading(false);
    }
  }, [realmId, apiKey, sessionId]);

  const executeIntent = useCallback(async (intent: string, payload: any) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch('/intent', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        intent,
        realm: realmId, // ← Sempre incluir realm
        actor: { type: 'Anonymous' },
        payload
      })
    });

    return response.json();
  }, [realmId, apiKey]);

  return { chat, executeIntent, messages, loading, sessionId };
}

// Uso no componente
function ChatComponent() {
  const realmId = 'meu-realm-123';
  const apiKey = localStorage.getItem('apiKey') || undefined;
  const { chat, messages, loading } = useUBL(realmId, apiKey);

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <div>User: {msg.user}</div>
          <div>Agent: {msg.agent.content.markdown}</div>
        </div>
      ))}
      <button onClick={() => chat('Olá!')} disabled={loading}>
        Enviar
      </button>
    </div>
  );
}
```

---

## 📝 Resumo: Checklist para Frontend

### ✅ Configuração Mínima (Desenvolvimento)

```javascript
// 1. Escolher realm
const REALM_ID = 'default-realm';

// 2. Criar cliente (sem autenticação)
const client = new UBLClient(REALM_ID);

// 3. Usar
await client.chat('Olá!');
```

### ✅ Configuração Completa (Produção)

```javascript
// 1. Criar realm (via API administrativa)
const realmId = await createRealm('Minha Empresa');

// 2. Obter chave API
const apiKey = await getApiKey(realmId);

// 3. Criar cliente (com autenticação)
const client = new UBLClient(realmId, apiKey);

// 4. Usar
await client.chat('Olá!');
await client.intent('query', { query: 'agreements' });
```

---

## 🔐 Segurança e Boas Práticas

### 1. **Sempre Inclua Realm ID**

```javascript
// ✅ BOM
POST /intent
{
  "intent": "query",
  "realm": "meu-realm-123", // Explícito
  "payload": {}
}

// ⚠️ EVITAR (usa default)
POST /intent
{
  "intent": "query",
  "payload": {}
}
```

### 2. **Use Chaves API Realm-Scoped**

```javascript
// ✅ BOM: Chave específica para o realm
const apiKey = await getRealmScopedKey('meu-realm-123');

// ⚠️ EVITAR: Master key no frontend
const apiKey = MASTER_API_KEY; // Nunca!
```

### 3. **Guarde Realm ID no Cliente**

```javascript
// ✅ BOM: Realm ID como configuração
class UBLClient {
  constructor(realmId) {
    this.realmId = realmId; // Fixo para este tenant
  }
  
  async intent(intent, payload) {
    return fetch('/intent', {
      body: JSON.stringify({
        intent,
        realm: this.realmId, // Sempre usa o mesmo realm
        payload
      })
    });
  }
}
```

---

## 🎯 Exemplos Práticos

### Exemplo 1: Frontend Single-Tenant

```javascript
// Uma empresa, um realm
const REALM_ID = 'empresa-abc-123';
const client = new UBLClient(REALM_ID);

// Todas as requisições usam o mesmo realm
await client.chat('Criar acordo');
await client.intent('query', {});
```

### Exemplo 2: Frontend Multi-Tenant

```javascript
// Múltiplos tenants, realm dinâmico
class MultiTenantClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async chat(realmId, message) {
    return fetch('/chat', {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Realm-Id': realmId // Realm no header
      },
      body: JSON.stringify({
        startSession: { realmId, actor: {...} },
        message: { text: message }
      })
    });
  }
}

// Uso
const client = new MultiTenantClient(apiKey);
await client.chat('tenant-1', 'Olá tenant 1');
await client.chat('tenant-2', 'Olá tenant 2');
```

---

## 📚 Endpoints e Realm ID

| Endpoint | Realm ID Obrigatório? | Onde? |
|----------|----------------------|-------|
| `POST /chat` | ✅ Sim (primeira vez) | `startSession.realmId` |
| `POST /intent` | ⚠️ Opcional | `body.realm` (fallback: `default-realm`) |
| `GET /affordances` | ⚠️ Opcional | Query param `?realm=...` |
| `POST /session/start` | ✅ Sim | `body.realmId` |
| `GET /session/:id` | ❌ Não | Vem da sessão |

---

## ✅ Conclusão

### Para Criar um Frontend:

1. **Realm:** 
   - ✅ Use `default-realm` para desenvolvimento
   - ✅ Crie realm personalizado para produção multitenant

2. **Chave API:**
   - ✅ Não obrigatória, mas recomendada
   - ✅ Use `/auth/delegate` para obter chave realm-scoped

3. **Realm ID nas Chamadas:**
   - ✅ **Sempre inclua** em `/intent` e `/chat` (primeira vez)
   - ✅ Use fallback `default-realm` apenas para desenvolvimento

**Pronto para criar seu frontend!** 🚀

