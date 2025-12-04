# ⚡ Quickstart: Criar seu Realm em 2 minutos

## 1. Criar Realm e Receber Credenciais

```bash
curl -X POST https://seu-ubl.com/intent \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "createRealm",
    "payload": {
      "name": "Minha Empresa",
      "config": {
        "isolation": "Full",
        "crossRealmAllowed": false
      }
    }
  }'
```

### Resposta (salve isso!):

```json
{
  "success": true,
  "outcome": {
    "type": "Created",
    "entity": {
      "id": "realm-abc123xyz",
      "name": "Minha Empresa",
      "apiKey": "ubl_xxxxxxxxxxxx_yyyyyyyyyyyy",
      "entityId": "entity-abc123xyz"
    },
    "id": "realm-abc123xyz"
  }
}
```

### ⚠️ Salve suas credenciais:

```bash
export UBL_REALM_ID="realm-abc123xyz"
export UBL_API_KEY="ubl_xxxxxxxxxxxx_yyyyyyyyyyyy"
export UBL_ENTITY_ID="entity-abc123xyz"
```

---

## 2. Criar Primeira Entidade

```bash
curl -X POST https://seu-ubl.com/intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $UBL_API_KEY" \
  -d '{
    "intent": "register",
    "realm": "'"$UBL_REALM_ID"'",
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

---

## 3. Pronto! 🎉

Agora você pode:
- ✅ Criar mais entidades
- ✅ Criar acordos entre entidades
- ✅ Consultar dados do seu realm
- ✅ Usar a API key para autenticar todas as requisições

Veja o guia completo: `TENANT_ONBOARDING_GUIDE.md`

