# 👤 Guia: Criar Usuário

## 📋 Regras Importantes

1. **Usuário sempre pertence a um realm** - Não existe usuário sem realm
2. **realmId é OBRIGATÓRIO** na criação de usuário
3. **Em outros logins, realmId vem automaticamente** da API key (não precisa informar)
4. **Pode criar realm + usuário admin** em uma chamada usando `createRealmIfNotExists=true`

---

## 🎯 Criar Usuário em um Realm Existente

### Requisição

```bash
POST /intent
Content-Type: application/json

{
  "intent": "createUser",
  "realm": "realm-abc123xyz",  // OBRIGATÓRIO
  "payload": {
    "realmId": "realm-abc123xyz",  // OBRIGATÓRIO
    "email": "joao@example.com",
    "name": "João Silva",
    "password": "senha123",  // Opcional - se não fornecido, gera senha temporária
    "isAdmin": false  // Se true, cria como admin do realm
  }
}
```

### Resposta

```json
{
  "success": true,
  "outcome": {
    "type": "Created",
    "entity": {
      "id": "entity-xyz789",
      "realmId": "realm-abc123xyz",
      "entityType": "Person",
      "name": "João Silva",
      "email": "joao@example.com",
      "isAdmin": false,
      "apiKey": "ubl_xxxxxxxxxxxx_yyyyyyyyyyyy",
      "credentials": {
        "email": "joao@example.com",
        "password": "TempPass123"  // ⚠️ Retornado apenas na criação
      }
    },
    "id": "entity-xyz789"
  },
  "affordances": [
    {
      "intent": "register",
      "description": "Create more entities in this realm",
      "required": ["entityType", "identity"]
    }
  ]
}
```

### ⚠️ IMPORTANTE: Salve as credenciais!

```json
{
  "userId": "entity-xyz789",
  "realmId": "realm-abc123xyz",
  "apiKey": "ubl_xxxxxxxxxxxx_yyyyyyyyyyyy",
  "email": "joao@example.com",
  "password": "TempPass123"
}
```

---

## 🚀 Criar Realm + Usuário Admin em Uma Chamada

Se você não tem um realm ainda, pode criar realm + usuário admin em uma chamada:

### Requisição

```bash
POST /intent
Content-Type: application/json

{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-novo-123",  // Será criado se não existir
    "email": "admin@example.com",
    "name": "Admin User",
    "isAdmin": true,
    "createRealmIfNotExists": true  // ← Cria realm automaticamente
  }
}
```

### O que acontece:

1. ✅ Verifica se realm existe
2. ✅ Se não existe e `createRealmIfNotExists=true`, cria o realm primeiro
3. ✅ Cria o usuário no realm
4. ✅ Gera API key para o usuário
5. ✅ Retorna tudo (realmId, userId, apiKey, credentials)

---

## 🔐 Login com API Key (realmId automático)

Depois de criar o usuário, você recebe uma API key. Use ela para autenticar:

### Requisição (realmId vem automaticamente da API key)

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy
Content-Type: application/json

{
  "intent": "query",
  // realmId NÃO precisa ser informado - vem da API key automaticamente!
  "payload": {
    "queryType": "Entity"
  }
}
```

### Como funciona:

1. ✅ API key contém o `realmId`
2. ✅ Sistema extrai `realmId` automaticamente da API key
3. ✅ Você não precisa informar `realm` na requisição
4. ✅ Se informar `realm` diferente, retorna erro 403

---

## 📝 Exemplos Completos

### Exemplo 1: Criar usuário em realm existente

```bash
# 1. Criar realm (se ainda não existe)
POST /intent
{
  "intent": "createRealm",
  "payload": {
    "name": "Minha Empresa"
  }
}

# Resposta: { realmId: "realm-123", apiKey: "ubl_..." }

# 2. Criar usuário no realm
POST /intent
{
  "intent": "createUser",
  "realm": "realm-123",
  "payload": {
    "realmId": "realm-123",
    "email": "joao@example.com",
    "name": "João Silva"
  }
}

# Resposta: { userId: "entity-456", apiKey: "ubl_user_...", credentials: {...} }
```

### Exemplo 2: Criar realm + usuário admin em uma chamada

```bash
POST /intent
{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-novo",
    "email": "admin@example.com",
    "name": "Admin",
    "isAdmin": true,
    "createRealmIfNotExists": true
  }
}

# Resposta inclui:
# - realmId (criado)
# - userId (criado)
# - apiKey (para o usuário)
# - credentials (email + senha temporária)
```

### Exemplo 3: Usar API key (realmId automático)

```bash
# Usar a API key recebida na criação do usuário
POST /intent
Authorization: Bearer ubl_user_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "register",
  // realmId NÃO precisa - vem da API key!
  "payload": {
    "entityType": "Organization",
    "identity": {
      "name": "Minha Empresa LTDA"
    }
  }
}
```

---

## ⚠️ Validações e Erros

### Erro: realmId não fornecido

```json
{
  "error": "realmId is required for createUser intent",
  "hint": "Provide realmId in payload or use an API key that belongs to a realm"
}
```

**Solução:** Forneça `realmId` no payload ou use `createRealmIfNotExists=true`

### Erro: Realm não existe

```json
{
  "error": "Realm realm-xyz não existe. Use createRealmIfNotExists=true para criar automaticamente."
}
```

**Solução:** Use `createRealmIfNotExists=true` ou crie o realm primeiro

### Erro: Realm ID mismatch

```json
{
  "error": "Realm ID mismatch: API key belongs to a different realm",
  "apiKeyRealm": "realm-123",
  "requestedRealm": "realm-456"
}
```

**Solução:** Use o `realmId` correto que corresponde à sua API key

---

## 🔒 Segurança

- ✅ **Senhas são hasheadas** (em produção, use bcrypt/argon2)
- ✅ **API keys são realm-scoped** - só funcionam no realm correto
- ✅ **realmId é validado** contra a API key em todas as requisições
- ✅ **Credenciais são retornadas apenas uma vez** na criação

---

## 🌐 Usuários Multi-Realm

Um usuário pode pertencer a **múltiplos realms** simultaneamente. Cada realm requer sua própria API key:

```bash
# Usuário no Realm A
POST /intent { "intent": "createUser", "payload": { "realmId": "realm-a", ... } }
# Retorna: apiKey: "ubl_realm_a_xxxxx"

# Mesmo usuário no Realm B
POST /intent { "intent": "createUser", "payload": { "realmId": "realm-b", ... } }
# Retorna: apiKey: "ubl_realm_b_yyyyy"

# Usar API key apropriada para cada realm
Authorization: Bearer ubl_realm_a_xxxxx  # Para acessar Realm A
Authorization: Bearer ubl_realm_b_yyyyy  # Para acessar Realm B
```

📚 **Guia completo**: Veja `MULTI_REALM_USERS.md`

---

## 📚 Próximos Passos

Depois de criar o usuário:

1. ✅ **Salve as credenciais** (userId, realmId, apiKey, email, password)
2. ✅ **Use a API key** para autenticar requisições
3. ✅ **realmId vem automaticamente** da API key (não precisa informar)
4. ✅ **Crie mais entidades** no seu realm usando `register` intent
5. ✅ **Crie acordos** usando `propose:agreement` intent
6. ✅ **Adicione o usuário a outros realms** criando novas API keys

Veja também:
- `TENANT_ONBOARDING_GUIDE.md` - Guia completo de onboarding
- `MULTI_REALM_USERS.md` - Guia de usuários multi-realm
- `ADMIN_INTENTS_GUIDE.md` - Todos os intents administrativos

