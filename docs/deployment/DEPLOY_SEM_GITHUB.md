# 🚀 Deploy no Render SEM GITHUB

## ✅ Solução: Render CLI com `render up`

O Render CLI permite fazer deploy **direto do código local** sem precisar de GitHub!

---

## 📋 Passo a Passo

### 1. Instalar Render CLI

```bash
npm install -g render-cli
```

### 2. Autenticar

```bash
export RENDER_API_KEY=rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o
render auth login --api-key "$RENDER_API_KEY"
```

### 3. Fazer Deploy!

```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger
render up
```

O comando `render up` vai:
- ✅ Ler o `render.yaml`
- ✅ Criar todos os serviços automaticamente
- ✅ Fazer upload do código local
- ✅ Fazer build e deploy

---

## 🎯 Ou Use o Script Automático

```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger
bash deploy-render-cli.sh
```

---

## ⚙️ Configurar Variáveis de Ambiente

Depois do deploy, vá no dashboard e adicione:

**Para o serviço "antenna":**
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

**Para o serviço "workspace-worker":**
```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

---

## ✅ Pronto!

Depois do deploy:
- **Antenna:** `https://antenna.onrender.com`
- **Health:** `https://antenna.onrender.com/health`

---

## 🚀 Vamos Fazer Agora?

Execute:

```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger
npm install -g render-cli
export RENDER_API_KEY=rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o
render auth login --api-key "$RENDER_API_KEY"
render up
```

**OU simplesmente:**

```bash
bash deploy-render-cli.sh
```

---

## 📚 Referências

- [Render CLI Docs](https://render.com/docs/cli)
- [Your First Render Deploy](https://render.com/docs/your-first-deploy)

