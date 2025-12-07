# 🧪 Testes - Universal Business Ledger

**Status:** 📋 **ESTRUTURA PROPOSTA**  
**Data:** 2025-12-07

---

## 📁 Estrutura

```
tests/
├── philosophical/ ⭐  # Testes Filosóficos (5 princípios fundamentais)
│   ├── traceability.test.ts      # Radical Transparency
│   ├── immutability.test.ts      # Temporal Integrity
│   ├── relationships.test.ts     # Relational Ontology
│   ├── agreements.test.ts        # Contractualism
│   ├── accountability.test.ts    # Accountability
│   └── time-travel.test.ts       # Arrow of Time
├── unit/              # Testes unitários (funções isoladas)
│   └── core/          # Testes dos módulos core
├── integration/       # Testes de integração (fluxos completos)
├── fixtures/          # Dados de teste (eventos, estados)
├── helpers/           # Funções utilitárias de teste
└── config/            # Configuração de testes
```

---

## 🚀 Como Executar

### **Todos os Testes:**
```bash
npm test
```

### **Apenas Unitários:**
```bash
npm run test:unit
```

### **Apenas Integração:**
```bash
npm run test:integration
```

### **Apenas Filosóficos:** ⭐
```bash
npm run test:philosophical
```

### **Watch Mode:**
```bash
npm run test:watch
```

### **Com Coverage:**
```bash
npm run test:coverage
```

---

## 📋 Testes Implementados

### **Filosóficos** ⭐ (PRIORIDADE MÁXIMA):
- [ ] `philosophical/traceability.test.ts` - Radical Transparency (Rastreabilidade)
- [ ] `philosophical/immutability.test.ts` - Temporal Integrity (Imutabilidade)
- [ ] `philosophical/relationships.test.ts` - Relational Ontology (Relacionamentos)
- [ ] `philosophical/agreements.test.ts` - Contractualism (Agreements)
- [ ] `philosophical/accountability.test.ts` - Accountability (Responsabilidade)
- [ ] `philosophical/time-travel.test.ts` - Arrow of Time (Time-Travel)

> **Ver:** [`docs/FILOSOFIA-E-TESTES.md`](../docs/FILOSOFIA-E-TESTES.md) para entender os princípios filosóficos.

### **Unitários:**
- [ ] `core/shared/types.test.ts` - Primitivos (IDs, timestamps, validity)
- [ ] `core/enforcement/invariants.test.ts` - Hash chain, temporal validation
- [ ] `core/aggregates/rehydrators.test.ts` - Re-hidratação de estado
- [ ] `core/engine/workflow-engine.test.ts` - Workflow transitions
- [ ] `core/security/authorization.test.ts` - ABAC authorization
- [ ] `core/api/intent-api.test.ts` - Intent handlers
- [ ] `core/store/event-store.test.ts` - Event store operations

### **Integração:**
- [ ] `realm-creation.test.ts` - Fluxo completo de criação de realm
- [ ] `agreement-flow.test.ts` - Ciclo de vida de agreement
- [ ] `asset-management.test.ts` - Criação e transferência de assets
- [ ] `api.test.ts` - Endpoints HTTP
- [ ] `time-travel.test.ts` - Time-travel testing
- [ ] `performance.test.ts` - Testes de performance

---

## 📚 Documentação

Ver `docs/ESTRATEGIA-TESTES.md` para estratégia completa.

---

## 🔧 Configuração

### **Variáveis de Ambiente para Testes:**

```bash
# Para testes de integração com PostgreSQL
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/ubl_test

# Para testes de API
TEST_API_URL=http://localhost:3000
```

---

## 📊 Cobertura Alvo

- **Unitários:** 80-95%
- **Integração:** 85-100% (fluxos críticos)

---

**Status:** 📋 **ESTRUTURA CRIADA - AGUARDANDO IMPLEMENTAÇÃO**  
**Última atualização:** 2025-12-07

