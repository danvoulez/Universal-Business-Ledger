# ✅ Correções Aplicadas - Bug Aggregate Version

**Data:** Agora  
**Status:** ✅ Corrigido

---

## 🐛 Bug Identificado

**Problema:** Handlers usavam `aggregateVersion: 1` hardcoded em todos os eventos, mesmo para modificações subsequentes.

**Impacto:** Violava Event Sourcing - aggregate version deve incrementar sequencialmente para cada evento do mesmo aggregate.

**Localização:** 
- `core/api/intent-handlers/workspace-intents.ts` (6 locais)
- `core/api/intent-handlers/asset-intents.ts` (6 locais)

---

## ✅ Correção Aplicada

**Solução:** Usar `eventStore.getLatest()` para obter a versão atual do aggregate e calcular a próxima versão.

**Padrão aplicado:**
```typescript
// Antes:
aggregateVersion: 1,  // ❌ Sempre 1

// Depois:
const latestEvent = await eventStore.getLatest(aggregateType, aggregateId);
const nextAggregateVersion = latestEvent ? latestEvent.aggregateVersion + 1 : 1;
aggregateVersion: nextAggregateVersion,  // ✅ Calculado corretamente
```

---

## 📋 Locais Corrigidos

### **workspace-intents.ts:**
1. ✅ `handleUploadFile` - FileUploaded (linha ~88)
2. ✅ `handleModifyFile` - FileModified (linha ~443)
3. ✅ `handleDeleteFile` - FileDeleted (linha ~560)
4. ✅ `handleRegisterFunction` - FunctionRegistered (linha ~659)
5. ✅ `handleExecuteFunction` - FunctionExecuted (linha ~851)
6. ✅ `handleExecuteScript` - FunctionExecuted (linha ~1026)

### **asset-intents.ts:**
1. ✅ `handleRegisterAsset` (default) - AssetRegistered (linha ~30)
2. ✅ `handleRegisterWorkspace` - AssetRegistered (linha ~100)
3. ✅ `handleRegisterWorkspace` - WorkspaceCreated (linha ~120)
4. ✅ `handleRegisterWorkspace` - AgreementProposed (linha ~141)
5. ✅ `handleRegisterWorkspace` - PartyConsented (linha ~180)
6. ✅ `handleRegisterWorkspace` - AgreementActivated (linha ~200)

---

## ✅ Validação

**PostgreSQL Schema:** Já tem trigger `verify_aggregate_version()` que garante versões sequenciais (linha 169-192 de `postgres-schema.sql`).

**Comportamento esperado:**
- Primeiro evento de um aggregate: `aggregateVersion: 1`
- Eventos subsequentes: `aggregateVersion: 2, 3, 4, ...`
- Se tentar pular versão: PostgreSQL trigger lança exceção

---

## 📝 Notas

- Correção mantém compatibilidade com filosofia original
- Usa interface `EventStore.getLatest()` que já existe
- Não requer mudanças no schema PostgreSQL
- Triggers PostgreSQL continuam validando versões

---

**Próximo passo:** Testar correções e validar que aggregate versions incrementam corretamente.

