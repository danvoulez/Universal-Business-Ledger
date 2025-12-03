# 🚀 Deploy no Render - Agora!

## Passo a Passo Rápido

### 1. Via Dashboard (Mais Fácil) ⭐

1. **Acesse:** [dashboard.render.com](https://dashboard.render.com)
2. **Login:** `dvoulez@gmail.com`
3. **Clique:** "New +" → "Blueprint"
4. **Conecte:** Seu repositório GitHub (ou faça upload manual)
5. **Render detecta:** `render.yaml` automaticamente
6. **Clique:** "Apply"

### 2. Configure Variáveis de Ambiente

No dashboard, para cada serviço (Antenna e Worker), adicione:

```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### 3. Deploy!

Render criará automaticamente:
- ✅ Web Service (Antenna)
- ✅ Background Worker
- ✅ PostgreSQL Database
- ✅ Redis

**URLs:**
- Antenna: `https://antenna.onrender.com`
- Health: `https://antenna.onrender.com/health`

---

## Ou Via CLI

```bash
# 1. Instalar CLI (se não tiver)
npm install -g render-cli

# 2. Autenticar
export RENDER_API_KEY=rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o
render auth login

# 3. Criar blueprint
cd /Users/voulezvous/correcao/Universal-Business-Ledger
render blueprint create --file render.yaml

# 4. Aplicar no dashboard
# Acesse dashboard.render.com → Blueprints → Apply
```

---

## ⚠️ Importante

### Antes do Deploy:

1. **Migrar Database:**
   - Depois que o PostgreSQL for criado
   - Pegue o `DATABASE_URL` do dashboard
   - Execute: `npm run migrate`

2. **Ou adicionar migração no build:**
   - Adicionar `npm run migrate` no `buildCommand`

---

## 📝 Checklist

- [ ] Repositório no GitHub (ou código pronto para upload)
- [ ] `render.yaml` no repositório
- [ ] API keys prontas para adicionar
- [ ] Build testado localmente ✅
- [ ] Pronto para deploy!

---

## 🎯 Próximos Passos Após Deploy

1. ✅ Serviços criados
2. ⏳ Adicionar variáveis de ambiente
3. ⏳ Rodar migrações no database
4. ⏳ Testar endpoints
5. ⏳ Conectar frontend

---

## 🚀 Vamos Fazer Deploy!

**Opção mais rápida:** Dashboard → Blueprint → Apply

Quer que eu te guie passo a passo?

