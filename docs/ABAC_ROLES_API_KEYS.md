# 🔐 ABAC: Roles e API Keys

## 🎯 Resposta Rápida

**1 chave por realm**, independente de quantos roles o usuário tem naquele realm.

Os roles são verificados **dinamicamente via ABAC** quando a requisição é feita.

---

## 📋 Como Funciona

### API Key = Realm-Scoped

- ✅ **Uma API key pertence a um único realm**
- ✅ **API key não é role-scoped** - ela apenas identifica o usuário no realm
- ✅ **Roles são verificados dinamicamente** via sistema ABAC

### Roles = Verificados Dinamicamente

Quando uma requisição é feita:

1. ✅ Sistema identifica o usuário via API key
2. ✅ Sistema busca **TODOS os roles ativos** do usuário naquele realm
3. ✅ Sistema verifica permissões de **TODOS os roles** combinados
4. ✅ Decisão de autorização considera **todos os roles**

---

## 🔍 Exemplo Prático

### Cenário: João tem 2 roles no mesmo realm

```bash
# Realm: realm-empresa-a
# Usuário: entity-joao
# Roles:
#   1. Employee (via Agreement de Trabalho)
#   2. Manager (via Agreement de Promoção)
```

### API Key

```json
{
  "apiKey": "ubl_realm_a_xxxxx",
  "realmId": "realm-empresa-a",
  "entityId": "entity-joao",
  "scopes": ["read", "write"]  // Scopes básicos da API key
}
```

**Apenas 1 chave**, mesmo tendo 2 roles!

### Quando João faz uma requisição:

```bash
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "approve",
  "payload": { "agreementId": "agreement-123" }
}
```

### O que acontece internamente:

```typescript
// 1. Verificar API key
const apiKey = await verifyApiKey("ubl_realm_a_xxxxx");
// → { realmId: "realm-empresa-a", entityId: "entity-joao" }

// 2. Buscar TODOS os roles ativos do usuário no realm
const roles = await roleStore.getActiveRoles(
  { type: 'Entity', entityId: 'entity-joao' },
  'realm-empresa-a',
  Date.now()
);
// → [
//     { roleType: 'Employee', permissions: [...], establishedBy: 'agreement-1' },
//     { roleType: 'Manager', permissions: [...], establishedBy: 'agreement-2' }
//   ]

// 3. Verificar autorização considerando TODOS os roles
const decision = await authorizationEngine.authorize({
  actor: { type: 'Entity', entityId: 'entity-joao' },
  action: { type: 'approve' },
  resource: { type: 'Agreement', id: 'agreement-123' },
  context: { realm: 'realm-empresa-a', ... }
});
// → Verifica se Employee OU Manager tem permissão de 'approve'
// → Se qualquer role tiver a permissão, autoriza!
```

---

## 🎯 Casos de Uso

### Caso 1: Usuário com múltiplos roles no mesmo realm

```json
{
  "userId": "entity-joao",
  "realmId": "realm-empresa-a",
  "apiKey": "ubl_realm_a_xxxxx",  // ← 1 chave apenas
  "roles": [
    {
      "roleType": "Employee",
      "establishedBy": "agreement-emprego-123",
      "permissions": ["read", "create"]
    },
    {
      "roleType": "Manager",
      "establishedBy": "agreement-promocao-456",
      "permissions": ["read", "create", "approve", "delete"]
    }
  ]
}
```

**Resultado:** João tem acesso combinado de ambos os roles usando a mesma API key.

### Caso 2: Usuário com roles em realms diferentes

```json
{
  "userId": "entity-joao",
  "realms": [
    {
      "realmId": "realm-empresa-a",
      "apiKey": "ubl_realm_a_xxxxx",  // ← Chave 1
      "roles": ["Employee", "Manager"]
    },
    {
      "realmId": "realm-empresa-b",
      "apiKey": "ubl_realm_b_yyyyy",  // ← Chave 2 (realm diferente)
      "roles": ["Consultant"]
    }
  ]
}
```

**Resultado:** 
- ✅ 1 chave por realm
- ✅ Múltiplos roles no mesmo realm = mesma chave
- ✅ Roles em realms diferentes = chaves diferentes

---

## 🔐 Arquitetura ABAC

### Fluxo Completo

```
1. Requisição com API Key
   ↓
2. Verificar API Key → Extrair (realmId, entityId)
   ↓
3. Buscar TODOS os roles ativos do entityId no realmId
   ↓
4. Para cada role, verificar permissões
   ↓
5. Combinar permissões de TODOS os roles
   ↓
6. Decisão de autorização (Allow/Deny)
   ↓
7. Audit log (qual role concedeu a permissão)
```

### Código de Autorização

```typescript
// core/security/authorization.ts

async authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
  // 1. Buscar TODOS os roles ativos do actor no realm
  const roles = await roleStore.getActiveRoles(
    request.actor,
    request.context.realm,  // ← Realm vem da API key
    request.context.timestamp
  );
  
  const grantedBy: PermissionGrant[] = [];
  
  // 2. Para CADA role, verificar se concede a permissão
  for (const role of roles) {
    for (const permission of role.permissions) {
      if (permissionMatches(permission, request.action, request.resource)) {
        grantedBy.push({
          roleId: role.id,
          roleType: role.roleType,
          permission,
          agreementId: role.establishedBy,  // ← Rastreável ao Agreement
          scope: role.scope,
        });
      }
    }
  }
  
  // 3. Se QUALQUER role concedeu permissão, autoriza
  const allowed = grantedBy.length > 0;
  
  return {
    allowed,
    grantedBy,  // ← Lista de TODOS os roles que concederam
    evaluatedRoles: roles,  // ← Todos os roles avaliados
  };
}
```

---

## 📊 Tabela Comparativa

| Situação | API Keys Necessárias | Como Funciona |
|----------|---------------------|---------------|
| **1 role em 1 realm** | 1 | API key identifica usuário, role verificado via ABAC |
| **2 roles no mesmo realm** | **1** | **Mesma API key, ambos roles verificados** |
| **3 roles no mesmo realm** | **1** | **Mesma API key, todos roles verificados** |
| **1 role em 2 realms** | 2 | 1 chave por realm |
| **2 roles em 2 realms** | 2 | 1 chave por realm, roles verificados separadamente |

---

## ✅ Regras Importantes

### 1. API Key é Realm-Scoped, não Role-Scoped

```typescript
// ❌ ERRADO: Pensar que precisa de chave por role
{
  "apiKeyEmployee": "ubl_employee_xxxxx",
  "apiKeyManager": "ubl_manager_yyyyy"
}

// ✅ CORRETO: Uma chave por realm
{
  "apiKey": "ubl_realm_a_xxxxx"  // Verifica TODOS os roles
}
```

### 2. Roles são Combinados (Union)

Se o usuário tem:
- Role A: permissões `['read', 'create']`
- Role B: permissões `['read', 'approve', 'delete']`

**Resultado:** Usuário tem acesso a `['read', 'create', 'approve', 'delete']`

### 3. Roles são Rastreáveis

Cada permissão concedida é rastreável ao Agreement que estabeleceu o role:

```json
{
  "allowed": true,
  "grantedBy": [
    {
      "roleType": "Manager",
      "permission": { "action": "approve", "resource": "Agreement:*" },
      "agreementId": "agreement-promocao-456"  // ← Rastreável!
    }
  ]
}
```

---

## 🎨 Exemplo Completo

### Setup: João tem 2 roles no Realm A

```bash
# 1. Criar usuário (gera 1 API key)
POST /intent
{
  "intent": "createUser",
  "payload": {
    "realmId": "realm-empresa-a",
    "email": "joao@example.com",
    "name": "João Silva"
  }
}
# → apiKey: "ubl_realm_a_xxxxx"

# 2. Criar Agreement de Trabalho (estabelece Role Employee)
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "propose:agreement",
  "payload": {
    "agreementType": "Employment",
    "parties": [
      { "entityId": "entity-empresa", "role": "Employer" },
      { "entityId": "entity-joao", "role": "Employee" }
    ]
  }
}
# → Estabelece Role "Employee" para entity-joao

# 3. Criar Agreement de Promoção (estabelece Role Manager)
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx
{
  "intent": "propose:agreement",
  "payload": {
    "agreementType": "Promotion",
    "parties": [
      { "entityId": "entity-empresa", "role": "Company" },
      { "entityId": "entity-joao", "role": "Manager" }
    ]
  }
}
# → Estabelece Role "Manager" para entity-joao
```

### Uso: João usa a MESMA API key

```bash
# João faz requisição usando a mesma API key
POST /intent
Authorization: Bearer ubl_realm_a_xxxxx  # ← Mesma chave!
{
  "intent": "approve",
  "payload": { "agreementId": "agreement-123" }
}

# Sistema verifica:
# 1. API key → realm-empresa-a, entity-joao
# 2. Busca roles → Employee, Manager
# 3. Verifica permissões → Manager tem 'approve' ✅
# 4. Autoriza!
```

---

## 🔒 Segurança

### Validações

- ✅ **API key valida realm** - não pode usar chave de outro realm
- ✅ **Roles são verificados dinamicamente** - sempre busca roles atuais
- ✅ **Permissões são combinadas** - union de todos os roles
- ✅ **Tudo é auditável** - cada decisão registra qual role concedeu

### Boas Práticas

1. ✅ **Use 1 API key por realm** - não crie múltiplas chaves desnecessariamente
2. ✅ **Roles são gerenciados via Agreements** - não via API keys
3. ✅ **Revogue roles via Agreements** - não precisa revogar API key
4. ✅ **Monitore permissões** - use audit log para ver quais roles concederam acesso

---

## 📚 Resumo

| Pergunta | Resposta |
|----------|----------|
| **Quantas chaves para 2 roles no mesmo realm?** | **1 chave** |
| **Como os roles são verificados?** | **Dinamicamente via ABAC** |
| **Roles são combinados?** | **Sim, union de permissões** |
| **É rastreável?** | **Sim, cada permissão rastreável ao Agreement** |
| **Precisa criar nova chave ao ganhar role?** | **Não, roles são verificados automaticamente** |

---

## 🎯 Conclusão

**1 chave por realm**, independente de quantos roles o usuário tem.

Os roles são verificados **dinamicamente via ABAC** quando a requisição é feita, combinando todas as permissões de todos os roles ativos do usuário naquele realm.

**Arquitetura perfeita para:**
- ✅ Múltiplos roles no mesmo realm
- ✅ Roles que mudam ao longo do tempo (via Agreements)
- ✅ Auditoria completa (qual role concedeu qual permissão)
- ✅ Flexibilidade sem precisar rotacionar API keys

