# 🚂 Deploy no Railway - SUPER SIMPLES

## 3 Passos (5 minutos)

### 1. Acesse Railway
👉 **https://railway.app**
- Login com GitHub (só para autenticação, não precisa do código lá)

### 2. Criar Projeto
1. Clique **"New Project"**
2. Escolha **"Deploy from GitHub repo"** (mesmo sem ter código lá, você pode criar repo depois)
   - OU escolha **"Empty Project"** e faça upload depois

### 3. Configurar
1. **Add Service** → **GitHub Repo** (ou **Empty**)
2. Se Empty: **Settings** → **Source** → Upload seu código
3. **Variables** → Adicione:
   ```
   PORT=10000
   NODE_ENV=production
   OPENAI_API_KEY=YOUR_OPENAI_API_KEY
   ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY
   ```
4. **Add Database** → **PostgreSQL** (gratuito)
5. Railway conecta automaticamente o `DATABASE_URL`

### 4. Pronto! 🎉
Railway faz build e deploy automaticamente.

**URL:** Vai aparecer no dashboard (tipo: `seu-projeto.up.railway.app`)

---

## ✅ É SÓ ISSO!

Railway é mais fácil que Render para seu caso.

**Vá para:** https://railway.app **agora!**

---

## 💤 Ou deixe para amanhã

Tudo está pronto. Quando quiser, é só seguir os 3 passos acima.

**Descanse!** 😴

