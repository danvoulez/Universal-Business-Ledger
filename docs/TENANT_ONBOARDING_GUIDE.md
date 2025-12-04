# 🚀 Guia de Onboarding para Novos Tenants

Bem-vindo ao Universal Business Ledger! Este guia vai te ajudar a começar rapidamente.

---

## 📋 Índice

1. [Criar seu Realm](#1-criar-seu-realm)
2. [Sua API Key](#2-sua-api-key)
3. [Primeiros Passos](#3-primeiros-passos)
4. [Exemplos Práticos](#4-exemplos-práticos)
5. [Referência Rápida](#5-referência-rápida)

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

### Opção A: Criar usuário em realm existente

```bash
POST /intent
Authorization: Bearer ubl_xxxxxxxxxxxx_yyyyyyyyyyyy

{
  "intent": "createUser",
  "realm": "realm-abc123xyz",
  "payload": {
    "realmId": "realm-abc123xyz",
    "email": "joao@example.com",
    "name": "João Silva",
    "isAdmin": false
  }
}
```

**Resposta inclui:**
- ✅ `userId` - ID do usuário criado
- ✅ `apiKey` - Chave API pessoal do usuário
- ✅ `credentials` - Email e senha temporária

### Opção B: Criar realm + usuário admin em uma chamada

```bash
POST /intent

{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-novo",
    "email": "admin@example.com",
    "name": "Admin User",
    "isAdmin": true,
    "createRealmIfNotExists": true
  }
}
```

📚 **Guia completo**: Veja `CREATE_USER_GUIDE.md`

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

## 4. Exemplos Práticos

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

## 5. Referência Rápida

### Intents Disponíveis

| Intent | Descrição | Payload Principal |
|--------|-----------|-------------------|
| `createRealm` | Criar novo realm | `name`, `config` |
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

- `200` - Sucesso
- `400` - Erro de validação
- `401` - Não autenticado
- `403` - Sem permissão
- `404` - Não encontrado
- `429` - Rate limit excedido
- `500` - Erro interno

---

## 🎯 Próximos Passos

1. ✅ **Crie seu realm** e salve as credenciais
2. ✅ **Crie suas primeiras entidades** (pessoas/organizações)
3. ✅ **Crie acordos** para estabelecer relacionamentos
4. ✅ **Explore as affordances** para descobrir o que pode fazer
5. ✅ **Consulte a documentação completa** em `/docs`

---

## 📚 Recursos Adicionais

- **API Completa**: Veja `ADMIN_INTENTS_GUIDE.md`
- **Arquitetura**: Veja `ARCHITECTURE.md`
- **Exemplos**: Veja `docs/` para mais exemplos

---

## 🆘 Suporte

Se precisar de ajuda:
- Consulte a documentação completa
- Verifique os exemplos em `docs/`
- Use o endpoint `/affordances` para descobrir ações disponíveis

**Bem-vindo ao Universal Business Ledger! 🎉**

