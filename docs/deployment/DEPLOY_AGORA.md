# 🚀 DEPLOY NO RENDER - AGORA!

## ⚡ Método Mais Rápido (Dashboard)

### 1. Acesse o Dashboard
👉 **https://dashboard.render.com**

Login: `dvoulez@gmail.com`  
API Key: `rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o`

### 2. Criar Blueprint

1. Clique em **"New +"** (canto superior direito)
2. Selecione **"Blueprint"**
3. Escolha uma opção:

#### ✅ Opção A: GitHub (Recomendado)
- Conecte seu repositório GitHub
- Render detecta `render.yaml` automaticamente
- Clique **"Apply"**

#### ✅ Opção B: YAML Manual
- Escolha **"Create from YAML"**
- Cole o conteúdo do arquivo `render.yaml`
- Clique **"Apply"**

### 3. Adicionar API Keys

Depois que os serviços forem criados, adicione as variáveis de ambiente:

#### Para o serviço "antenna":
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

#### Para o serviço "workspace-worker":
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 4. Deploy Automático! 🎉

Render fará:
- ✅ Build do código
- ✅ Criação do PostgreSQL
- ✅ Criação do Redis
- ✅ Deploy dos serviços
- ✅ Health checks

---

## 📋 O que será criado:

1. **Web Service** (`antenna`)
   - URL: `https://antenna.onrender.com`
   - Health: `https://antenna.onrender.com/health`
   - WebSocket: `wss://antenna.onrender.com/subscribe`

2. **Background Worker** (`workspace-worker`)
   - Roda em background
   - Processa jobs longos

3. **PostgreSQL Database** (`ledger-db`)
   - Event store
   - Conectado automaticamente

4. **Redis** (`ledger-redis`)
   - Cache e job queue
   - Conectado automaticamente

---

## ⚠️ Importante: Migrações

Depois do deploy, você precisa rodar as migrações:

1. Pegue o `DATABASE_URL` do dashboard (serviço `ledger-db`)
2. Execute localmente ou via Render Shell:

```bash
export DATABASE_URL=postgresql://...
npm run migrate
```

Ou adicione no `buildCommand` do `render.yaml`:
```yaml
buildCommand: npm install && npm run build && npm run migrate
```

---

## ✅ Checklist

- [ ] Acessar dashboard.render.com
- [ ] Criar Blueprint
- [ ] Aplicar render.yaml
- [ ] Adicionar API keys nos serviços
- [ ] Aguardar deploy completo
- [ ] Rodar migrações no database
- [ ] Testar endpoint `/health`
- [ ] Testar WebSocket

---

## 🎯 Pronto!

Seus serviços estarão rodando em produção! 🚀

**Custo estimado:** ~$21-28/mês (Starter plans)

---

## 🔗 Links Úteis

- **Dashboard:** https://dashboard.render.com
- **Documentação:** https://render.com/docs
- **Status:** https://status.render.com

---

## 🆘 Problemas?

1. **Build falha:** Ver logs no dashboard → Logs
2. **Serviço não inicia:** Verificar variáveis de ambiente
3. **Database não conecta:** Verificar `DATABASE_URL`
4. **WebSocket não funciona:** Verificar CORS e SSL

---

**Vá para:** https://dashboard.render.com **agora!** 🚀

