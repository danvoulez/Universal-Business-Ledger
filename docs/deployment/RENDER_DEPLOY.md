# 🚀 Deploy no Render - Guia Completo

## Credenciais

- **Email:** dvoulez@gmail.com
- **API Key:** `rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o`

---

## 📋 Pré-requisitos

1. ✅ Conta Render criada
2. ✅ Repositório GitHub conectado
3. ✅ `render.yaml` configurado (já está!)

---

## 🎯 Opção 1: Deploy via Dashboard (Recomendado)

### Passo 1: Acessar Render

1. Acesse [render.com](https://render.com)
2. Faça login com `dvoulez@gmail.com`

### Passo 2: Criar Blueprint

1. Clique em **"New +"** → **"Blueprint"**
2. Conecte seu repositório GitHub
3. Render detectará automaticamente o `render.yaml`
4. Clique em **"Apply"**

### Passo 3: Configurar Variáveis de Ambiente

No dashboard, para cada serviço, adicione:

**Antenna Service:**
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

**Worker Service:**
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### Passo 4: Deploy!

Render criará automaticamente:
- ✅ Web Service (Antenna)
- ✅ Background Worker
- ✅ PostgreSQL Database
- ✅ Redis (opcional)

---

## 🛠️ Opção 2: Deploy via CLI

### Instalar Render CLI

```bash
npm install -g render-cli
```

### Autenticar

```bash
render auth login
# Use: dvoulez@gmail.com
# API Key: rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o
```

### Deploy

```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger
render deploy
```

---

## 🔧 Opção 3: Deploy via API

### Usar API Key diretamente

```bash
export RENDER_API_KEY=rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o

# Criar serviços via API
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d @render.yaml
```

---

## 📝 Configuração Manual (Se necessário)

Se o `render.yaml` não funcionar automaticamente:

### 1. Web Service (Antenna)

**Settings:**
- **Name:** `antenna`
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Plan:** `Starter` ($7/mês)

**Environment Variables:**
```
PORT=10000
NODE_ENV=production
OPENAI_API_KEY=YOUR_OPENAI_API_KEY...
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY...
GEMINI_API_KEY=YOUR_GEMINI_API_KEY...
```

### 2. Background Worker

**Settings:**
- **Name:** `workspace-worker`
- **Environment:** `Node`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run worker`
- **Plan:** `Starter` ($7/mês)

### 3. PostgreSQL Database

**Settings:**
- **Name:** `ledger-db`
- **Database:** `ledger`
- **User:** `ledger_user`
- **Plan:** `Starter` ($7/mês)

### 4. Redis (Opcional)

**Settings:**
- **Name:** `ledger-redis`
- **Plan:** `Starter` ($7/mês)

---

## 🔐 Variáveis de Ambiente no Render

### Como Adicionar

1. Vá para o serviço no dashboard
2. Clique em **"Environment"**
3. Adicione cada variável:
   - `OPENAI_API_KEY` = `YOUR_OPENAI_API_KEY...`
   - `ANTHROPIC_API_KEY` = `YOUR_ANTHROPIC_API_KEY...`
   - `GEMINI_API_KEY` = `YOUR_GEMINI_API_KEY...`

### Variáveis Automáticas

Render cria automaticamente:
- `DATABASE_URL` (do PostgreSQL)
- `REDIS_URL` (do Redis)
- `PORT` (auto-set)

---

## ✅ Checklist de Deploy

- [ ] Repositório GitHub conectado
- [ ] `render.yaml` no repositório
- [ ] Variáveis de ambiente configuradas
- [ ] Build passando
- [ ] Health check funcionando
- [ ] WebSocket testado
- [ ] Database conectado

---

## 🧪 Testar Deploy

### 1. Health Check

```bash
curl https://antenna.onrender.com/health
```

Deve retornar:
```json
{
  "status": "ok",
  "service": "antenna",
  "timestamp": 1234567890
}
```

### 2. WebSocket

```javascript
const ws = new WebSocket('wss://antenna.onrender.com/subscribe');
ws.onopen = () => console.log('Connected!');
```

### 3. Chat

```bash
curl -X POST https://antenna.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": {"text": "Hello!"},
    "startSession": {
      "realmId": "default",
      "actor": {"type": "Anonymous"}
    }
  }'
```

---

## 📊 Monitoramento

### Logs

No dashboard Render:
- **Logs** → Ver logs em tempo real
- **Metrics** → CPU, memória, requests

### Alertas

Configure alertas para:
- Build failures
- Service crashes
- High memory usage

---

## 💰 Custos

### Setup Inicial (Starter Plans)

- Web Service: $7/mês
- Background Worker: $7/mês
- PostgreSQL: $7/mês
- Redis: $7/mês (opcional)
- **Total: $21-28/mês**

### Upgrade para Standard (se necessário)

- Web Service: $25/mês
- Background Worker: $25/mês
- PostgreSQL: $25/mês
- **Total: $75/mês**

---

## 🔄 Atualizações

### Auto-Deploy

Render faz deploy automático quando você faz push para:
- `main` branch (produção)
- Outras branches (preview)

### Deploy Manual

No dashboard:
1. Vá para o serviço
2. Clique em **"Manual Deploy"**
3. Escolha branch/commit

---

## 🐛 Troubleshooting

### Build Fails

**Problema:** `npm install` falha
**Solução:** Verificar `package.json` e dependências

### Service Crashes

**Problema:** Serviço não inicia
**Solução:** Verificar logs, variáveis de ambiente

### WebSocket Não Funciona

**Problema:** Conexão WebSocket falha
**Solução:** Verificar CORS, porta, SSL

### Database Connection

**Problema:** Não conecta ao banco
**Solução:** Verificar `DATABASE_URL`, credenciais

---

## 📚 Recursos

- [Render Docs](https://render.com/docs)
- [Render Dashboard](https://dashboard.render.com)
- [Render Status](https://status.render.com)

---

## 🎉 Próximos Passos

1. ✅ Fazer deploy
2. ✅ Testar endpoints
3. ✅ Configurar domínio customizado (opcional)
4. ✅ Configurar CI/CD (opcional)
5. ✅ Monitorar performance

---

## 🚀 Deploy Agora!

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Login com `dvoulez@gmail.com`
3. **New +** → **Blueprint**
4. Conecte repositório
5. **Apply** → Pronto! 🎉

**Tempo estimado:** 10-15 minutos

