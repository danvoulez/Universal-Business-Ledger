# ⚠️ Desvios da Filosofia - Análise Crítica

**Foco:** Identificar código ERRADO ou que DESVIA da filosofia original do UBL

**Referência:** `Universal Ledger System ORIGINAL/PHILOSOPHY.md` e `ARCHITECTURE.md` - estes são os documentos corretos.

**⚠️ IMPORTANTE:** versão Dezembro tentou fazer docs "LLM-friendly" mas destruiu a essência. Sempre usar ORIGINAL como referência.

---

## 🎯 Princípios Fundamentais (ORIGINAL - Referência)

1. **Agreement-Based**: Tudo via Agreements - "Every relationship is an Agreement"
2. **Event Sourcing**: Eventos imutáveis - "The past is immutable"
3. **Intent-Driven**: Tudo via intents, não endpoints fixos
4. **ABAC**: Permissões via Agreements, não RBAC estático
5. **Roles como Relationships**: Roles são estabelecidos por Agreements, não atributos
6. **Universal**: Pode modelar QUALQUER domínio de negócio

---

## 🔍 O Que Verificar (Desvios)

### **1. Violações de Agreement-Based**

**❌ Código ERRADO:**
- Criar roles sem Agreement
- Atribuir permissões diretamente (sem Agreement)
- Criar relações sem Agreement
- Bypass do sistema de Agreements

**✅ Correto:**
- Tudo via Agreements
- Roles estabelecidos por Agreements
- Permissões via `grantsRoles` em Agreement Types

---

### **2. Violações de Event Sourcing**

**❌ Código ERRADO:**
- Modificar eventos existentes
- Deletar eventos
- Atualizar estado diretamente (sem evento)
- Bypass do Event Store

**✅ Correto:**
- Apenas append de eventos
- Estado derivado de eventos
- Hash chain intacta
- Imutabilidade garantida

---

### **3. Violações de Intent-Driven**

**❌ Código ERRADO:**
- Endpoints REST fixos (fora de /intent)
- Lógica de negócio em rotas HTTP
- Bypass do sistema de intents

**✅ Correto:**
- Tudo via `/intent`
- Handlers processam intents
- Affordances retornadas

---

### **4. Violações de ABAC**

**❌ Código ERRADO:**
- Verificar roles diretamente (sem Agreement)
- RBAC estático
- Permissões hardcoded
- Bypass do sistema de autorização

**✅ Correto:**
- Autorização via Agreements
- Roles derivados de Agreements
- Permissões via `grantsRoles`

---

### **5. Violações de Universalidade**

**❌ Código ERRADO:**
- Lógica específica de domínio no core
- Assumptions sobre domínios
- Código que só funciona para um caso específico

**✅ Correto:**
- Core universal
- Domínios específicos via Agreement Types
- Extensível sem modificar core

---

## 🔍 Verificações Necessárias

### **1. Verificar Handlers de Intent**
- ✅ Estão criando Agreements corretamente?
- ✅ Estão usando Event Store corretamente?
- ✅ Estão verificando autorização via ABAC?
- ❌ Estão fazendo bypass de Agreements?

### **2. Verificar Sistema de Autorização**
- ✅ Deriva roles de Agreements?
- ✅ Verifica permissões via Agreements?
- ❌ Tem RBAC estático?
- ❌ Tem permissões hardcoded?

### **3. Verificar Event Store**
- ✅ Apenas append?
- ✅ Hash chain intacta?
- ✅ Imutabilidade garantida?
- ❌ Modificações ou deletes?

### **4. Verificar Agreement Types**
- ✅ Seguem padrão universal?
- ✅ `grantsRoles` correto?
- ❌ Lógica específica de domínio?

---

## 📋 Próxima Ação

**Ler código versão Dezembro e identificar:**
1. Onde viola Agreement-Based?
2. Onde viola Event Sourcing?
3. Onde viola Intent-Driven?
4. Onde viola ABAC?
5. Onde viola Universalidade?

**Focar em CÓDIGO ERRADO, não em "features demais".**

---

**Adapters não são problema - são parte da universalidade. O problema é código que desvia da filosofia.**

