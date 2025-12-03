# 🚀 Deploy no Render - SEM GITHUB

## Método: Dashboard Manual (5 minutos)

### 1. Acesse o Dashboard
👉 **https://dashboard.render.com**

### 2. Criar PostgreSQL Database

1. Clique **"New +"** → **"PostgreSQL"**
2. Nome: `ledger-db`
3. Database: `ledger`
4. User: `ledger_user`
5. Plan: **Starter**
6. Clique **"Create Database"**
7. **Copie o `DATABASE_URL`** (vai precisar depois)

### 3. Criar Redis

1. Clique **"New +"** → **"Redis"**
2. Nome: `ledger-redis`
3. Plan: **Starter**
4. Clique **"Create Redis"**
5. **Copie o `REDIS_URL`** (vai precisar depois)

### 4. Criar Web Service (Antenna)

1. Clique **"New +"** → **"Web Service"**
2. Escolha: **"Create from a Dockerfile or buildpack"**
3. Nome: `antenna`
4. Runtime: **Node**
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`
7. Plan: **Starter**

#### Variáveis de Ambiente:
Adicione estas variáveis:

```
PORT=10000
NODE_ENV=production
DATABASE_URL=<cole o DATABASE_URL do passo 2>
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

8. **Source:** Escolha **"Upload a ZIP file"** ou **"Public Git repository"**
   - Se ZIP: compacte a pasta `Universal-Business-Ledger` e faça upload
   - Se Git público: cole a URL do repositório

9. Clique **"Create Web Service"**

### 5. Criar Worker (Opcional)

1. Clique **"New +"** → **"Background Worker"**
2. Mesmo processo do Web Service
3. Nome: `workspace-worker`
4. Start Command: `npm run worker`
5. Mesmas variáveis de ambiente (incluindo `REDIS_URL`)

---

## ⚡ Alternativa: Render CLI com Upload

Se o Render CLI funcionar, podemos fazer upload direto do código.

---

## ✅ Pronto!

Depois do deploy:
- Antenna: `https://antenna.onrender.com`
- Health: `https://antenna.onrender.com/health`

---

**Vá para:** https://dashboard.render.com **agora!** 🚀

