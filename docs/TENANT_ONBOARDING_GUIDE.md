# 🚀 Guia de Onboarding para Novos Tenants

Bem-vindo ao Universal Business Ledger! Este guia vai te ajudar a começar rapidamente.

---

## 📋 Índice

1. [Criar seu Realm](#1-criar-seu-realm)
2. [Sua API Key](#2-sua-api-key)
3. [Criar seu Primeiro Usuário](#3-criar-seu-primeiro-usuário)
4. [Primeiros Passos](#4-primeiros-passos)
5. [Exemplos Práticos](#5-exemplos-práticos)
6. [Como Fazer Requisições](#6-como-fazer-requisições)
7. [Referência Rápida](#7-referência-rápida)

---

## 1. Criar seu Realm

Tudo começa criando seu **Realm** (seu espaço isolado no sistema).

### Requisição

```bash
POST https://seu-ubl.com/intent
Content-Type: application/json

{
  "intent": "createRealm",
  "payload": {
    "name": "Minha Empresa",
    "config": {
      "isolation": "Full",
      "crossRealmAllowed": false,
      "allowedEntityTypes": ["Person", "Organization"],
      "allowedAgreementTypes": ["Employment", "Sale", "Service"]
    }
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
      "id": "realm-abc123xyz",
      "name": "Minha Empresa",
      "createdAt": 1234567890,
      "config": { ... },
      "apiKey": "ubl_xxxxxxxxxxxx_yyyyyyyyyyyy",
      "entityId": "entity-abc123xyz"
    },
    "id": "realm-abc123xyz"
  },
  "affordances": [
    {
      "intent": "register",
      "description": "Create an entity in this realm",
      "required": ["entityType", "identity"]
    }
  ],
  "meta": {
    "processedAt": 1234567890,
    "processingTime": 45
  }
}
```

### ⚠️ IMPORTANTE: Salve suas credenciais!

```json
{
  "realmId": "realm-abc123xyz",
  "apiKey": "ubl_xxxxxxxxxxxx_yyyyyyyyyyyy",
  "entityId": "entity-abc123xyz"
}
```

**⚠️ A API key só é retornada UMA VEZ na criação. Salve imediatamente!**

---

## 2. Sua API Key

A API key retornada é sua **chave mestra** para acessar seu realm.

### Como usar

```bash
POST https://seu-ubl.com/intent
Content-Type: application/json
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "register",
  "realm": "realm-abc123xyz",
  "payload": {
    "entityType": "Person",
    "identity": {
      "name": "João Silva",
      "identifiers": [
        { "scheme": "email", "value": "joao@example.com" }
      ]
    }
  }
}
```

### Segurança

- ✅ **Nunca compartilhe** sua API key publicamente
- ✅ **Use variáveis de ambiente** para armazenar
- ✅ **Revogue** chaves comprometidas imediatamente
- ✅ **Crie chaves específicas** para diferentes aplicações

---

## 3. Criar seu Primeiro Usuário

### 📋 Regras Importantes

1. **Usuário sempre pertence a um realm** - Não existe usuário sem realm
2. **realmId é OBRIGATÓRIO** na criação de usuário
3. **Em outros logins, realmId vem automaticamente** da API key (não precisa informar)
4. **Pode criar realm + usuário admin** em uma chamada usando `createRealmIfNotExists=true`

---

### Opção A: Criar usuário em realm existente

Se você já tem um realm criado (seção 1), pode criar usuários nele:

#### Requisição

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy
Content-Type: application/json

{
  "intent": "createUser",
  "realm": "realm-abc123xyz",
  "payload": {
    "realmId": "realm-abc123xyz",  // OBRIGATÓRIO
    "email": "joao@example.com",
    "name": "João Silva",
    "password": "senha123",  // Opcional - se não fornecido, gera senha temporária
    "isAdmin": false  // Se true, cria como admin do realm
  }
}
```

#### Resposta

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
      "apiKey": "ubl_user_xxxxxxxxxxxx_yyyyyyyyyyyy",
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
    },
    {
      "intent": "createApiKey",
      "description": "Create additional API keys",
      "required": ["realmId", "entityId", "name"]
    }
  ]
}
```

#### ⚠️ IMPORTANTE: Salve as credenciais!

```json
{
  "userId": "entity-xyz789",
  "realmId": "realm-abc123xyz",
  "apiKey": "ubl_user_xxxxxxxxxxxx_yyyyyyyyyyyy",
  "email": "joao@example.com",
  "password": "TempPass123"
}
```

**⚠️ A senha só é retornada UMA VEZ na criação. Salve imediatamente!**

---

### Opção B: Criar realm + usuário admin em uma chamada

Se você não tem um realm ainda, pode criar realm + usuário admin em uma chamada:

#### Requisição

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

#### O que acontece:

1. ✅ Verifica se realm existe
2. ✅ Se não existe e `createRealmIfNotExists=true`, cria o realm primeiro
3. ✅ Cria o usuário no realm
4. ✅ Gera API key para o usuário
5. ✅ Retorna tudo (realmId, userId, apiKey, credentials)

#### Resposta

```json
{
  "success": true,
  "outcome": {
    "type": "Created",
    "entity": {
      "id": "entity-admin-123",
      "realmId": "realm-novo-123",
      "name": "Admin User",
      "email": "admin@example.com",
      "isAdmin": true,
      "apiKey": "ubl_admin_xxxxxxxxxxxx_yyyyyyyyyyyy",
      "credentials": {
        "email": "admin@example.com",
        "password": "TempAdminPass456"
      }
    },
    "id": "entity-admin-123"
  }
}
```

---

### 🔐 Login com API Key (realmId automático)

Depois de criar o usuário, você recebe uma API key. Use ela para autenticar:

#### Requisição (realmId vem automaticamente da API key)

```bash
POST /intent
Authorization: Bearer ubl_user_xxxxxxxxxxxx_yyyyyyyyyyyy
Content-Type: application/json

{
  "intent": "query",
  // realmId NÃO precisa ser informado - vem da API key automaticamente!
  "payload": {
    "queryType": "Entity"
  }
}
```

#### Como funciona:

1. ✅ API key contém o `realmId`
2. ✅ Sistema extrai `realmId` automaticamente da API key
3. ✅ Você não precisa informar `realm` na requisição
4. ✅ Se informar `realm` diferente, retorna erro 403

---

### 🌐 Usuários Multi-Realm

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

📚 **Guia completo**: Veja `MULTI_REALM_USERS.md` e `CREATE_USER_GUIDE.md`

---

### 🔑 Roles e API Keys

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

## 4. Primeiros Passos

### Passo 1: Criar mais entidades

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "register",
  "realm": "realm-abc123xyz",
  "payload": {
    "entityType": "Person",
    "identity": {
      "name": "João Silva",
      "identifiers": [
        { "scheme": "email", "value": "joao@example.com" },
        { "scheme": "phone", "value": "+5511999999999" }
      ],
      "contacts": [
        { "type": "email", "value": "joao@example.com" }
      ]
    }
  }
}
```

### Passo 2: Criar uma organização

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "register",
  "realm": "realm-abc123xyz",
  "payload": {
    "entityType": "Organization",
    "identity": {
      "name": "Minha Empresa LTDA",
      "identifiers": [
        { "scheme": "cnpj", "value": "12.345.678/0001-90" }
      ]
    }
  }
}
```

### Passo 3: Criar seu primeiro acordo (ex: contrato de trabalho)

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "propose:agreement",
  "realm": "realm-abc123xyz",
  "payload": {
    "agreementType": "Employment",
    "parties": [
      {
        "entityId": "entity-empresa-id",
        "role": "Employer",
        "obligations": [
          { "id": "pay-salary", "description": "Pagar salário mensal" }
        ]
      },
      {
        "entityId": "entity-joao-id",
        "role": "Employee",
        "obligations": [
          { "id": "work-hours", "description": "Trabalhar 40h/semana" }
        ]
      }
    ],
    "terms": {
      "description": "Contrato de trabalho CLT",
      "consideration": {
        "description": "Salário mensal",
        "value": { "amount": 5000, "currency": "BRL" }
      }
    },
    "validity": {
      "effectiveFrom": 1234567890
    }
  }
}
```

---

## 5. Exemplos Práticos

### Consultar entidades do seu realm

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "query",
  "realm": "realm-abc123xyz",
  "payload": {
    "queryType": "Entity",
    "filters": {
      "realmId": "realm-abc123xyz"
    }
  }
}
```

### Consultar acordos ativos

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "query",
  "realm": "realm-abc123xyz",
  "payload": {
    "queryType": "Agreement",
    "filters": {
      "status": "Active"
    }
  }
}
```

### Criar chaves API adicionais

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "createApiKey",
  "realm": "realm-abc123xyz",
  "payload": {
    "realmId": "realm-abc123xyz",
    "entityId": "entity-joao-id",
    "name": "Chave para App Mobile",
    "scopes": ["read", "write"],
    "expiresInDays": 365
  }
}
```

---

## 6. Como Fazer Requisições

### 📡 Endpoint Base

Todas as requisições são feitas para o endpoint `/intent`:

```
POST https://seu-ubl.com/intent
```

**⚠️ IMPORTANTE:** Use sempre `/intent` (com T). O endpoint `/intend` (com D) é legado e não deve ser usado.

---

### 🔐 Autenticação

#### Com API Key (Recomendado)

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy
Content-Type: application/json
```

**Vantagens:**
- ✅ `realmId` vem automaticamente da API key
- ✅ Não precisa informar `realm` na requisição
- ✅ Rate limiting por realm
- ✅ Auditoria completa

#### Sem Autenticação (Apenas para criar realm)

```bash
POST /intent
Content-Type: application/json

{
  "intent": "createRealm",
  "payload": { ... }
}
```

**Limitações:**
- ⚠️ Apenas para `createRealm` e `createUser` (com `createRealmIfNotExists=true`)
- ⚠️ Rate limiting mais restritivo
- ⚠️ Sem rastreamento de quem fez a ação

---

### 📝 Estrutura da Requisição

#### Formato Básico

```json
{
  "intent": "nome-do-intent",
  "realm": "realm-id",  // Opcional se usar API key
  "actor": {             // Opcional, padrão: { "type": "Anonymous" }
    "type": "Entity",
    "entityId": "entity-id"
  },
  "payload": {
    // Dados específicos do intent
  },
  "idempotencyKey": "opcional-key",  // Para garantir idempotência
  "timestamp": 1234567890  // Opcional, padrão: agora
}
```

#### Campos Obrigatórios

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `intent` | ✅ Sim | Nome do intent a executar |
| `payload` | ✅ Sim | Dados específicos do intent |
| `realm` | ⚠️ Depende | Obrigatório se não usar API key |
| `actor` | ❌ Não | Padrão: `{ "type": "Anonymous" }` |

#### Exemplo Completo

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy
Content-Type: application/json

{
  "intent": "register",
  "realm": "realm-abc123xyz",  // Opcional se API key já tem realmId
  "actor": {
    "type": "Entity",
    "entityId": "entity-joao-id"
  },
  "payload": {
    "entityType": "Person",
    "identity": {
      "name": "João Silva",
      "identifiers": [
        { "scheme": "email", "value": "joao@example.com" }
      ]
    }
  },
  "idempotencyKey": "register-joao-2024-01-15"
}
```

---

### 📤 Headers HTTP

#### Headers Obrigatórios

```http
Content-Type: application/json
```

#### Headers Opcionais

```http
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy  # Para autenticação
X-Idempotency-Key: unique-key-123                    # Alternativa ao idempotencyKey no body
X-Request-ID: request-id-123                        # Para rastreamento
```

#### Exemplo com curl

```bash
curl -X POST https://seu-ubl.com/intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy" \
  -H "X-Idempotency-Key: my-unique-key-123" \
  -d '{
    "intent": "query",
    "payload": {
      "queryType": "Entity"
    }
  }'
```

---

### 📥 Estrutura da Resposta

Todas as respostas seguem este padrão:

```json
{
  "success": true,
  "outcome": {
    "type": "Created" | "Updated" | "Queried" | "Nothing",
    "entity": { ... },
    "id": "entity-id",
    "results": [ ... ],  // Para queries
    "changes": [ ... ]   // Para updates
  },
  "events": [
    {
      "type": "EntityCreated",
      "aggregateId": "entity-id",
      "payload": { ... }
    }
  ],
  "affordances": [
    {
      "intent": "register",
      "description": "Create an entity in this realm",
      "required": ["entityType", "identity"]
    }
  ],
  "errors": [],  // Array vazio se success=true
  "meta": {
    "processedAt": 1234567890,
    "processingTime": 45  // em milissegundos
  }
}
```

#### Tipos de Outcome

| Tipo | Quando Usado | Campos |
|------|--------------|--------|
| `Created` | Entidade criada | `entity`, `id` |
| `Updated` | Entidade atualizada | `entity`, `id`, `changes` |
| `Queried` | Consulta realizada | `results` |
| `Nothing` | Nenhuma ação realizada | `reason` |

---

### ⚡ Rate Limiting

O UBL implementa rate limiting por realm para proteger a API.

#### Limites Padrão

- **Por Realm:** 100 requisições/minuto
- **Por IP:** 200 requisições/minuto (sem autenticação)

#### Headers de Rate Limiting

Quando você se aproxima do limite, a resposta inclui:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

#### Resposta quando excede limite

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 30  // segundos até poder tentar novamente
}
```

**Status HTTP:** `429 Too Many Requests`

**Header:**
```http
Retry-After: 30
```

---

### ❌ Tratamento de Erros

#### Estrutura de Erro

```json
{
  "success": false,
  "error": "Mensagem de erro legível",
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Campo 'email' é obrigatório",
      "field": "payload.email"
    }
  ],
  "meta": {
    "processedAt": 1234567890,
    "processingTime": 12
  }
}
```

#### Códigos de Erro Comuns

| Código | Status HTTP | Descrição |
|--------|-------------|-----------|
| `VALIDATION_ERROR` | 400 | Dados inválidos no payload |
| `UNAUTHORIZED` | 401 | API key inválida ou ausente |
| `FORBIDDEN` | 403 | Sem permissão (realm diferente, etc) |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `RATE_LIMIT_EXCEEDED` | 429 | Muitas requisições |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |

#### Exemplos de Erros

**Erro de Validação:**
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "realmId is required for createUser intent",
      "field": "payload.realmId"
    }
  ]
}
```

**Erro de Autenticação:**
```json
{
  "success": false,
  "error": "Unauthorized - Invalid API key"
}
```

**Erro de Realm Mismatch:**
```json
{
  "success": false,
  "error": "Realm ID mismatch: API key belongs to a different realm",
  "apiKeyRealm": "realm-abc123",
  "requestedRealm": "realm-xyz789"
}
```

---

### 🔄 Idempotência

Para garantir que requisições não sejam processadas duas vezes, use `idempotencyKey`:

```json
{
  "intent": "register",
  "payload": { ... },
  "idempotencyKey": "register-joao-2024-01-15-001"
}
```

**Comportamento:**
- ✅ Primeira requisição: processa normalmente
- ✅ Requisições subsequentes com mesma key: retorna resultado da primeira
- ✅ Válido por 24 horas

---

### 📊 Endpoints Disponíveis

| Endpoint | Método | Descrição | Autenticação |
|----------|--------|-----------|--------------|
| `/intent` | POST | Executar intent | Opcional |
| `/chat` | POST | Chat com AI | Opcional |
| `/auth/delegate` | POST | Delegar tokens | Master key |
| `/health` | GET | Health check | Não |
| `/affordances` | GET | Ações disponíveis | Opcional |

---

### 💡 Boas Práticas

1. **Sempre use HTTPS** em produção
2. **Armazene API keys** em variáveis de ambiente
3. **Use idempotencyKey** para operações críticas
4. **Trate erros** adequadamente (não ignore `success: false`)
5. **Respeite rate limits** (implemente retry com backoff)
6. **Use affordances** para descobrir ações disponíveis
7. **Monitore `processingTime`** para identificar problemas

---

### 🔍 Descobrir Ações Disponíveis

Use o endpoint `/affordances` para descobrir o que pode fazer:

```bash
GET /affordances?realm=realm-abc123xyz
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy
```

**Resposta:**
```json
[
  {
    "intent": "register",
    "description": "Create an entity in this realm",
    "required": ["entityType", "identity"]
  },
  {
    "intent": "createApiKey",
    "description": "Create API key for this realm",
    "required": ["realmId", "entityId", "name"]
  }
]
```

---

## 7. Referência Rápida

### Intents Disponíveis

| Intent | Descrição | Payload Principal |
|--------|-----------|-------------------|
| `createRealm` | Criar novo realm | `name`, `config` |
| `createUser` | Criar usuário | `realmId`, `email`, `name` (OBRIGATÓRIO: realmId) |
| `register` | Criar entidade | `entityType`, `identity` |
| `propose:agreement` | Criar acordo | `agreementType`, `parties`, `terms` |
| `consent` | Dar consentimento | `agreementId`, `method` |
| `fulfill` | Cumprir obrigação | `agreementId`, `obligationId` |
| `query` | Consultar dados | `queryType`, `filters` |
| `createApiKey` | Criar chave API | `realmId`, `entityId`, `name` |
| `revokeApiKey` | Revogar chave | `keyId` |

### Estrutura de Resposta

Todas as respostas seguem este padrão:

```json
{
  "success": boolean,
  "outcome": {
    "type": "Created" | "Updated" | "Queried" | ...,
    "entity": {...},
    "id": "entity-id"
  },
  "events": [...],
  "affordances": [
    {
      "intent": "string",
      "description": "string",
      "required": ["field1", "field2"]
    }
  ],
  "errors": [...],
  "meta": {
    "processedAt": timestamp,
    "processingTime": milliseconds
  }
}
```

### Códigos de Status HTTP

| Código | Significado | Quando Ocorre |
|--------|-------------|---------------|
| `200` | Sucesso | Requisição processada com sucesso |
| `400` | Bad Request | Erro de validação no payload |
| `401` | Unauthorized | API key inválida ou ausente |
| `403` | Forbidden | Sem permissão (realm diferente, etc) |
| `404` | Not Found | Recurso não encontrado |
| `429` | Too Many Requests | Rate limit excedido |
| `500` | Internal Server Error | Erro interno do servidor |

### Resumo de Requisições

**Estrutura mínima:**
```json
{
  "intent": "nome-do-intent",
  "payload": { ... }
}
```

**Com autenticação:**
```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy
Content-Type: application/json
```

**Com realmId automático:**
- Se usar API key, `realmId` vem automaticamente
- Não precisa informar `realm` na requisição
- Se informar `realm` diferente, retorna erro 403

---

## 🎯 Próximos Passos

1. ✅ **Crie seu realm** e salve as credenciais (realmId, apiKey)
2. ✅ **Crie seu primeiro usuário** no realm (receberá userId, apiKey pessoal, credentials)
3. ✅ **Salve todas as credenciais** (realmId, userId, apiKeys, email, password)
4. ✅ **Use a API key** para autenticar requisições (realmId vem automaticamente)
5. ✅ **Crie mais entidades** (pessoas/organizações) usando `register` intent
6. ✅ **Crie acordos** para estabelecer relacionamentos usando `propose:agreement`
7. ✅ **Explore as affordances** para descobrir o que pode fazer
8. ✅ **Consulte a documentação completa** em `/docs`

---

## 📚 Recursos Adicionais

- **Criar Usuário**: Veja `CREATE_USER_GUIDE.md` - Guia completo sobre criação de usuários
- **Multi-Realm**: Veja `MULTI_REALM_USERS.md` - Como usuários podem pertencer a múltiplos realms
- **ABAC Roles**: Veja `ABAC_ROLES_API_KEYS.md` - Como roles funcionam com API keys
- **API Completa**: Veja `ADMIN_INTENTS_GUIDE.md` - Todos os intents administrativos
- **Quickstart**: Veja `QUICKSTART_TENANT.md` - Guia rápido de 2 minutos
- **Arquitetura**: Veja `ARCHITECTURE.md` - Arquitetura completa do sistema
- **Exemplos**: Veja `docs/` para mais exemplos

---

## 🆘 Suporte

Se precisar de ajuda:
- Consulte a documentação completa
- Verifique os exemplos em `docs/`
- Use o endpoint `/affordances` para descobrir ações disponíveis

**Bem-vindo ao Universal Business Ledger! 🎉**

