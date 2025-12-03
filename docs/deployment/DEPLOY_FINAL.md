# 🚀 Deploy no Render - MÉTODO FINAL (SEM GITHUB)

## ✅ Solução: Docker + Dashboard

A forma mais simples de fazer deploy sem GitHub é usando **Docker**!

---

## 📋 Passo a Passo

### 1. Criar Dockerfile (✅ JÁ CRIADO!)

O arquivo `Dockerfile` já está pronto no projeto.

### 2. Build e Push para Docker Hub

```bash
# Login no Docker Hub (crie conta em dockerhub.com se não tiver)
docker login

# Build da imagem
cd /Users/voulezvous/correcao/Universal-Business-Ledger
docker build -t seu-usuario/universal-business-ledger:latest .

# Push para Docker Hub
docker push seu-usuario/universal-business-ledger:latest
```

### 3. Deploy no Render

1. **Acesse:** https://dashboard.render.com
2. **Clique:** "New +" → "Web Service"
3. **Escolha:** "Deploy an existing image from a registry"
4. **Image URL:** `seu-usuario/universal-business-ledger:latest`
5. **Nome:** `antenna`
6. **Port:** `10000`

### 4. Configurar Variáveis de Ambiente

No dashboard, adicione:

```
PORT=10000
NODE_ENV=production
DATABASE_URL=<será preenchido depois>
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 5. Criar PostgreSQL

1. **Clique:** "New +" → "PostgreSQL"
2. **Nome:** `ledger-db`
3. **Plan:** Starter
4. **Copie o `DATABASE_URL`**
5. **Volte no Web Service** e adicione o `DATABASE_URL` nas variáveis

### 6. Criar Redis (Opcional)

1. **Clique:** "New +" → "Redis"
2. **Nome:** `ledger-redis`
3. **Plan:** Starter

---

## 🎯 OU: Deploy Direto com ZIP

### Alternativa Simples:

1. **Compacte o projeto:**
   ```bash
   cd /Users/voulezvous/correcao
   zip -r universal-business-ledger.zip Universal-Business-Ledger -x "*.git*" -x "node_modules/*" -x ".env"
   ```

2. **No Render Dashboard:**
   - "New +" → "Web Service"
   - "Create from a Dockerfile or buildpack"
   - **Upload:** Faça upload do ZIP
   - Configure como acima

---

## ✅ Pronto!

Depois do deploy:
- **URL:** `https://antenna.onrender.com`
- **Health:** `https://antenna.onrender.com/health`

---

## 🚀 Qual método você prefere?

1. **Docker** (recomendado) - mais profissional
2. **ZIP upload** - mais rápido

**Vou preparar o que você escolher!** 🎯

