# Agent System Prompt

## ✅ Status: Configurado

O agente tem **system prompt configurado** e está sendo usado corretamente.

## 📍 Localização

### 1. Prompt do Agente
**Arquivo:** `antenna/agent/implementation.ts`
- **Constante:** `DEFAULT_SYSTEM_PROMPT` (linha 66)
- **Uso:** Passado para o LLM em cada chamada (linha 204)

### 2. Prompt do SDK Anthropic
**Arquivo:** `sdk/anthropic.ts`
- **Constante:** `LEDGER_SYSTEM_PROMPT` (linha 36)
- **Uso:** Fallback se não houver systemPrompt no request

## 🔄 Como Funciona

```typescript
// 1. Agente cria mensagens com system prompt
function buildMessages(session, message) {
  return [
    { role: 'system', content: systemPrompt }, // ← System prompt aqui
    ...history,
    { role: 'user', content: message.text },
  ];
}

// 2. Chama LLM com system prompt
const llmResponse = await deps.llm.complete({
  messages,
  systemPrompt: systemPrompt, // ← Passado explicitamente
  maxTokens: 2000,
  temperature: 0.7,
});
```

## 📝 Conteúdo do System Prompt

O prompt atual explica:
- ✅ Core concepts (Events, Entities, Agreements, Assets, Roles)
- ✅ Key principle: "All relationships are agreements"
- ✅ Available intents
- ✅ Response format (Markdown)
- ✅ Examples de uso

## 🔧 Customização

Você pode customizar o prompt:

```typescript
const agent = createConversationalAgent(
  { llm, intents },
  {
    systemPrompt: 'Seu prompt customizado aqui...',
  }
);
```

Ou via configuração na antenna:

```typescript
const antenna = createAntenna({
  // ... outras configs
  agentConfig: {
    systemPrompt: 'Prompt customizado...',
  },
});
```

## ✅ Verificação

- [x] System prompt definido
- [x] System prompt passado para LLM
- [x] Anthropic adapter recebe systemPrompt
- [x] OpenAI adapter pode receber systemPrompt
- [x] Prompt explica o Universal Business Ledger
- [x] Prompt lista intents disponíveis

## 🧪 Como Testar

1. **Verificar no código:**
   - `antenna/agent/implementation.ts` linha 117: `{ role: 'system', content: systemPrompt }`
   - `antenna/agent/implementation.ts` linha 204: `systemPrompt: systemPrompt`

2. **Verificar nos logs:**
   - Quando LLM é chamado, o system prompt está incluído
   - Respostas devem refletir o conhecimento do ledger

3. **Testar com chat:**
   ```bash
   curl -X POST http://localhost:3000/chat \
     -H "Content-Type: application/json" \
     -d '{
       "message": {"text": "What is the Universal Business Ledger?"},
       "startSession": {"realmId": "default", "actor": {"type": "Anonymous"}}
     }'
   ```
   
   A resposta deve mencionar Agreements, Entities, Events, etc.

---

## ✅ Conclusão

**O agente TEM system prompt configurado e está funcionando!**

O prompt:
- ✅ Está definido (`DEFAULT_SYSTEM_PROMPT`)
- ✅ É passado para o LLM
- ✅ Explica o Universal Business Ledger
- ✅ Lista intents disponíveis
- ✅ Pode ser customizado

Tudo certo! 🎯

