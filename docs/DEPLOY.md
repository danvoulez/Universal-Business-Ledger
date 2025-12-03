# 🚀 Guia de Deploy

## Opções de Deploy

### 1. Railway (Recomendado - Mais Fácil) ⭐

**Por quê:** Upload direto, sem precisar de GitHub ou Docker.

**Como:**
1. Acesse: https://railway.app
2. New Project → Empty Project
3. Upload código → Configure variáveis → Pronto!

**Detalhes:** Ver `docs/deployment/DEPLOY_RAILWAY_SIMPLES.md`

---

### 2. Render (Via GitLab)

**Por quê:** Render exige Git ou Docker.

**Como:**
1. Crie conta no GitLab: https://gitlab.com
2. Upload código no GitLab
3. Render → Connect GitLab repo
4. Configure variáveis → Deploy

**Detalhes:** Ver `docs/deployment/` para mais opções

---

### 3. Docker

**Como:**
1. Build: `docker build -t seu-usuario/ledger .`
2. Push: `docker push seu-usuario/ledger`
3. Deploy em qualquer plataforma que aceite Docker

---

## Variáveis de Ambiente Necessárias

```bash
PORT=10000
NODE_ENV=production
DATABASE_URL=<fornecido pela plataforma>
OPENAI_API_KEY=<sua-chave>
ANTHROPIC_API_KEY=<sua-chave>
GEMINI_API_KEY=<sua-chave>
```

---

## Scripts de Deploy

Scripts disponíveis em `scripts/deploy/` (alguns podem não funcionar devido a limitações das APIs).

---

## Documentação Completa

- **Railway:** `docs/deployment/DEPLOY_RAILWAY_SIMPLES.md`
- **Render:** `docs/deployment/RENDER_DEPLOY.md`
- **Alternativas:** `docs/deployment/ALTERNATIVAS_DEPLOY.md`
- **AWS:** `docs/deployment/AWS_DEPLOYMENT.md`

