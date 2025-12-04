# 🚂 Deploy no Railway - Guia Rápido

## ✅ Sim, o UBL pode ser deployado no Railway!

O projeto está **100% pronto** para Railway. Siga este guia rápido.

---

## 🚀 Deploy em 5 Passos

### 1. Criar Projeto no Railway
- Acesse: https://railway.app
- Login com GitHub
- **New Project** → **Deploy from GitHub repo**
- Selecione: `Universal-Business-Ledger`

### 2. Adicionar PostgreSQL
- No projeto: **+ New** → **Database** → **PostgreSQL**
- Railway conecta automaticamente via `DATABASE_URL`

### 3. Configurar Variáveis
No serviço principal → **Variables** → Adicione:

```bash
NODE_ENV=production
PORT=3000

# LLM (opcional)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

### 4. Rodar Migrações
Após o primeiro deploy, execute:

```bash
# Via Railway CLI (recomendado)
railway run npm run migrate:full

# Ou via Dashboard → Deployments → Open Shell
npm run migrate:full
```

### 5. Pronto! 🎉
- URL disponível no dashboard
- Teste: `curl https://seu-projeto.up.railway.app/health`

---

## 📋 Checklist

- [ ] Projeto criado no Railway
- [ ] PostgreSQL adicionado
- [ ] Variáveis configuradas (`NODE_ENV`, `PORT`)
- [ ] Migrações rodadas (`npm run migrate:full`)
- [ ] Health check funcionando (`/health`)

---

## 🔧 Configuração Avançada

### Usar Script com Auto-Migração

Se quiser rodar migrações automaticamente antes do start, altere o `startCommand` no Railway:

**Settings** → **Deploy** → **Start Command**:
```bash
./scripts/railway-start.sh
```

Ou via `railway.json`:
```json
{
  "deploy": {
    "startCommand": "./scripts/railway-start.sh"
  }
}
```

### Railway CLI

```bash
# Instalar
npm i -g @railway/cli

# Login
railway login

# Link ao projeto
railway link

# Ver logs
railway logs

# Rodar comandos
railway run npm run migrate:full
```

---

## 🐛 Troubleshooting

| Problema | Solução |
|----------|---------|
| Build falha | Verifique Node.js >= 18 |
| Servidor não inicia | Verifique `DATABASE_URL` nas variáveis |
| Database connection failed | Confirme PostgreSQL foi adicionado |
| Migrações não rodaram | Execute: `railway run npm run migrate:full` |

---

## 📚 Documentação Completa

- [Guia Detalhado](./docs/deployment/DEPLOY_RAILWAY_SIMPLES.md)
- [Alternativas de Deploy](./docs/deployment/ALTERNATIVAS_DEPLOY.md)
- [Railway Docs](https://docs.railway.app)

---

**Tempo estimado:** 5-10 minutos ⏱️

