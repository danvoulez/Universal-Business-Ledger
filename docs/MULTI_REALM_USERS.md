# 🌐 Usuários Multi-Realm

## 🎯 Conceito

Um usuário pode pertencer a **múltiplos realms** simultaneamente. Cada realm é isolado e requer sua própria API key.

---

## 🔑 Como Funciona

### Um Usuário, Múltiplas API Keys

Cada API key é **realm-scoped** (pertence a um único realm). Para acessar múltiplos realms, o usuário precisa de **uma API key por realm**.

```json
{
  "userId": "entity-joao-123",
  "apiKeys": [
    {
      "key": "ubl_realm1_xxxxx",
      "realmId": "realm-empresa-a",
      "scopes": ["read", "write"]
    },
    {
      "key": "ubl_realm2_yyyyy",
      "realmId": "realm-empresa-b",
      "scopes": ["read", "write", "admin"]
    },
    {
      "key": "ubl_realm3_zzzzz",
      "realmId": "realm-pessoal",
      "scopes": ["read"]
    }
  ]
}
```

---

## 📝 Exemplos de Uso

### Cenário 1: João trabalha em duas empresas

```bash
# 1. Criar usuário no Realm da Empresa A
POST /intent
{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-empresa-a",
    "email": "joao@empresa-a.com",
    "name": "João Silva",
    "isAdmin": false
  }
}

# Resposta: { userId: "entity-joao", apiKey: "ubl_realm_a_xxxxx", ... }

# 2. Criar o mesmo usuário no Realm da Empresa B
POST /intent
{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-empresa-b",
    "email": "joao@empresa-b.com",  // Pode ser email diferente ou mesmo
    "name": "João Silva",
    "isAdmin": true  // Admin na empresa B
  }
}

# Resposta: { userId: "entity-joao-b", apiKey: "ubl_realm_b_yyyyy", ... }
```

### Cenário 2: Usar API keys diferentes para acessar realms diferentes

```bash
# Acessar Realm da Empresa A
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "query",
  "payload": { "queryType": "Agreement" }
  // realmId vem automaticamente da API key (realm-empresa-a)
}

# Acessar Realm da Empresa B
POST /intent
Authorization: Bearer ubl_realm_b_yyyyy
{
  "intent": "query",
  "payload": { "queryType": "Agreement" }
  // realmId vem automaticamente da API key (realm-empresa-b)
}
```

---

## 🔐 Segurança e Isolamento

### Isolamento Total Entre Realms

- ✅ **Cada API key só funciona no seu realm**
- ✅ **Dados são completamente isolados** entre realms
- ✅ **Não há vazamento de informações** entre realms
- ✅ **Permissões são independentes** por realm

### Validação Automática

```bash
# Tentar usar API key do Realm A no Realm B
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "query",
  "realm": "realm-empresa-b"  # ← Tentando acessar realm diferente
}

# Resposta: Erro 403
{
  "error": "Realm ID mismatch: API key belongs to a different realm",
  "apiKeyRealm": "realm-empresa-a",
  "requestedRealm": "realm-empresa-b"
}
```

---

## 🎯 Casos de Uso Comuns

### 1. Consultor que trabalha com múltiplos clientes

```json
{
  "userId": "entity-consultor",
  "realms": [
    { "realmId": "realm-cliente-1", "role": "consultant", "apiKey": "..." },
    { "realmId": "realm-cliente-2", "role": "consultant", "apiKey": "..." },
    { "realmId": "realm-cliente-3", "role": "admin", "apiKey": "..." }
  ]
}
```

### 2. Empresa com múltiplas subsidiárias

```json
{
  "userId": "entity-empresa",
  "realms": [
    { "realmId": "realm-subsidiaria-brasil", "apiKey": "..." },
    { "realmId": "realm-subsidiaria-eua", "apiKey": "..." },
    { "realmId": "realm-subsidiaria-europa", "apiKey": "..." }
  ]
}
```

### 3. Pessoa física com realm pessoal e profissional

```json
{
  "userId": "entity-pessoa",
  "realms": [
    { "realmId": "realm-pessoal", "apiKey": "...", "scopes": ["read", "write"] },
    { "realmId": "realm-trabalho", "apiKey": "...", "scopes": ["read", "write", "admin"] }
  ]
}
```

---

## 📋 Gerenciamento de API Keys

### Criar API Key Adicional para um Realm

```bash
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "createApiKey",
  "payload": {
    "realmId": "realm-empresa-a",
    "entityId": "entity-joao",
    "name": "Chave para App Mobile",
    "scopes": ["read", "write"]
  }
}
```

### Listar Todas as API Keys de um Usuário

```bash
# Listar API keys do Realm A
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "query",
  "payload": {
    "queryType": "ApiKey",
    "filters": {
      "entityId": "entity-joao"
    }
  }
}
```

### Revogar API Key

```bash
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "revokeApiKey",
  "payload": {
    "keyId": "key-123"
  }
}
```

---

## 🎨 Boas Práticas

### 1. Nomear API Keys Claramente

```json
{
  "name": "João - Empresa A - Desktop",
  "name": "João - Empresa A - Mobile",
  "name": "João - Empresa B - Admin"
}
```

### 2. Usar Scopes Apropriados

- **Read-only** para visualização
- **Read + Write** para operações normais
- **Admin** apenas quando necessário

### 3. Rotacionar API Keys Regularmente

- Revogar chaves antigas
- Criar novas chaves
- Atualizar aplicações

### 4. Armazenar API Keys com Segurança

```javascript
// ✅ BOM: Variáveis de ambiente por realm
const API_KEYS = {
  empresaA: process.env.UBL_API_KEY_EMPRESA_A,
  empresaB: process.env.UBL_API_KEY_EMPRESA_B,
};

// ❌ RUIM: Hardcoded
const apiKey = "ubl_realm_a_xxxxx";
```

---

## 🔄 Migração Entre Realms

### Adicionar Usuário a um Novo Realm

```bash
# 1. Criar usuário no novo realm
POST /intent
{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-novo",
    "email": "joao@example.com",
    "name": "João Silva"
  }
}

# 2. Receber nova API key
# 3. Adicionar à lista de API keys do usuário
```

### Remover Usuário de um Realm

```bash
# Revogar todas as API keys do realm
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "revokeApiKey",
  "payload": { "keyId": "..." }
}
```

---

## 🔐 Roles e API Keys

### Múltiplos Roles no Mesmo Realm

**1 chave por realm**, independente de quantos roles o usuário tem naquele realm.

Os roles são verificados **dinamicamente via ABAC** quando a requisição é feita:

```bash
# João tem 2 roles no Realm A:
# - Employee (via Agreement de Trabalho)
# - Manager (via Agreement de Promoção)

# Mas usa apenas 1 API key:
Authorization: Bearer ubl_realm_a_xxxxx

# Sistema verifica TODOS os roles automaticamente:
# → Busca roles ativos do usuário no realm
# → Combina permissões de todos os roles
# → Autoriza se qualquer role tiver permissão
```

📚 **Guia completo**: Veja `ABAC_ROLES_API_KEYS.md`

---

## 📊 Resumo

| Aspecto | Descrição |
|--------|-----------|
| **Multi-realm** | ✅ Suportado nativamente |
| **API Keys** | Uma por realm (não por role) |
| **Roles** | Verificados dinamicamente via ABAC |
| **Múltiplos roles no mesmo realm** | ✅ 1 chave, todos roles verificados |
| **Isolamento** | Total entre realms |
| **Segurança** | Validação automática de realmId |
| **Flexibilidade** | Usuário pode ter diferentes permissões em cada realm |

---

## 🎯 Conclusão

A arquitetura do UBL foi projetada para suportar **usuários multi-realm** desde o início:

- ✅ **Uma API key por realm** - simples e seguro
- ✅ **Isolamento total** - dados nunca vazam entre realms
- ✅ **Flexibilidade** - diferentes permissões em cada realm
- ✅ **Validação automática** - sistema garante que API key corresponde ao realm

**Perfeito para:**
- Consultores com múltiplos clientes
- Empresas com múltiplas subsidiárias
- Pessoas com contas pessoais e profissionais
- Qualquer cenário que requer isolamento de dados

