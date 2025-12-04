# 🚂 Deploy no Railway - Guia Completo

## ✅ Sim! O UBL pode ser deployado no Railway

O Universal Business Ledger está **100% pronto** para deploy no Railway. Este guia mostra como fazer isso em poucos minutos.

---

## 📋 Pré-requisitos

- Conta no Railway (gratuita): https://railway.app
- Código do projeto (local ou GitHub)
- Chaves de API LLM (opcional, mas recomendado):
  - OpenAI API Key
  - Anthropic API Key  
  - Gemini API Key

---

## 🚀 Deploy Rápido (5 minutos)

### Opção 1: Deploy via GitHub (Recomendado)

1. **Acesse Railway**
   - Vá para https://railway.app
   - Faça login com GitHub

2. **Criar Novo Projeto**
   - Clique em **"New Project"**
   - Escolha **"Deploy from GitHub repo"**
   - Selecione o repositório `Universal-Business-Ledger`

3. **Adicionar PostgreSQL**
   - No projeto, clique em **"+ New"**
   - Escolha **"Database"** → **"PostgreSQL"**
   - O Railway cria automaticamente e conecta via `DATABASE_URL`

4. **Configurar Variáveis de Ambiente**
   - No serviço principal, vá em **"Variables"**
   - Adicione as seguintes variáveis:
     ```bash
     NODE_ENV=production
     PORT=3000
     # Railway define PORT automaticamente, mas é bom ter como fallback
     
     # LLM Providers (opcional)
     OPENAI_API_KEY=sk-...
     ANTHROPIC_API_KEY=sk-ant-...
     GEMINI_API_KEY=...
     
     # Redis (opcional - para rate limiting)
     REDIS_URL=redis://...  # Se usar Redis no Railway
     ```

5. **Rodar Migrações do Banco**
   - No Railway, vá em **"Deployments"**
   - Clique nos **"..."** do último deployment
   - Escolha **"View Logs"**
   - Ou use o **Railway CLI**:
     ```bash
     # Instalar Railway CLI
     npm i -g @railway/cli
     
     # Login
     railway login
     
     # Link ao projeto
     railway link
     
     # Rodar migrações
     railway run npm run migrate:full
     ```

6. **Pronto! 🎉**
   - O Railway faz build e deploy automaticamente
   - A URL aparecerá no dashboard (ex: `seu-projeto.up.railway.app`)
   - Teste: `curl https://seu-projeto.up.railway.app/health`

---

### Opção 2: Deploy via Upload Direto

1. **Criar Projeto Vazio**
   - Railway → **"New Project"** → **"Empty Project"**

2. **Upload do Código**
   - Clique em **"Settings"** → **"Source"**
   - Faça upload do diretório `Universal-Business-Ledger`
   - Ou use Railway CLI:
     ```bash
     railway init
     railway up
     ```

3. **Seguir passos 3-6 da Opção 1**

---

## 🔧 Configuração Detalhada

### Variáveis de Ambiente Necessárias

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | ✅ Sim | Conectado automaticamente pelo Railway quando você adiciona PostgreSQL |
| `NODE_ENV` | ✅ Sim | Deve ser `production` |
| `PORT` | ⚠️ Opcional | Railway define automaticamente, mas o código usa `3000` como fallback |
| `OPENAI_API_KEY` | ❌ Não | Necessário apenas se usar OpenAI |
| `ANTHROPIC_API_KEY` | ❌ Não | Necessário apenas se usar Anthropic |
| `GEMINI_API_KEY` | ❌ Não | Necessário apenas se usar Gemini |
| `REDIS_URL` | ❌ Não | Necessário apenas para rate limiting |

### Scripts Disponíveis

O projeto já tem os scripts necessários no `package.json`:

- `npm run build` - Compila TypeScript para JavaScript
- `npm run start` - Inicia o servidor (usado pelo Railway)
- `npm run migrate` - Roda migrações incrementais
- `npm run migrate:full` - Roda schema completo (recomendado na primeira vez)

### Arquivo railway.json

O projeto inclui `railway.json` que configura:
- Build command: `npm run build`
- Start command: `npm run start`
- Restart policy: reinicia automaticamente em caso de falha

---

## 🗄️ Migrações do Banco de Dados

### Primeira Deploy

Na primeira vez, você precisa rodar as migrações:

**Opção A: Via Railway CLI (Recomendado)**
```bash
railway run npm run migrate:full
```

**Opção B: Via Railway Dashboard**
1. Vá em **"Deployments"**
2. Clique nos **"..."** do deployment
3. Escolha **"Open Shell"**
4. Execute: `npm run migrate:full`

**Opção C: Via Script de Deploy**
Crie um script que roda migrações antes do start (veja seção abaixo).

### Migrações Automáticas

Para rodar migrações automaticamente antes do start, você pode modificar o `package.json`:

```json
{
  "scripts": {
    "postbuild": "npm run migrate:full || true",
    "start": "node dist/antenna/server.js"
  }
}
```

⚠️ **Nota:** O `|| true` evita que o deploy falhe se as migrações já foram aplicadas.

---

## 🐳 Deploy via Docker

O projeto já tem um `Dockerfile` pronto. Railway detecta automaticamente e usa Docker se disponível.

### Build Local (opcional)
```bash
docker build -t ubl:latest .
docker run -p 3000:3000 -e DATABASE_URL=... ubl:latest
```

---

## ✅ Verificação Pós-Deploy

Após o deploy, verifique:

1. **Health Check**
   ```bash
   curl https://seu-projeto.up.railway.app/health
   ```
   Deve retornar: `{"status":"ok"}`

2. **Logs**
   - Railway Dashboard → **"Deployments"** → **"View Logs"**
   - Procure por: `✅ Antenna started on port 3000`

3. **Database**
   - Verifique se as tabelas foram criadas:
   ```bash
   railway run psql $DATABASE_URL -c "\dt"
   ```

---

## 🔍 Troubleshooting

### Problema: Build falha
- **Solução:** Verifique se `Node.js >= 18` está configurado
- Railway detecta automaticamente, mas você pode forçar em `railway.json`:
  ```json
  {
    "build": {
      "builder": "NIXPACKS",
      "buildCommand": "npm run build"
    }
  }
  ```

### Problema: Servidor não inicia
- **Solução:** Verifique logs no Railway Dashboard
- Certifique-se que `DATABASE_URL` está configurado
- Verifique se a porta está correta (Railway usa variável `PORT`)

### Problema: Database connection failed
- **Solução:** 
  1. Verifique se PostgreSQL foi adicionado ao projeto
  2. Confirme que `DATABASE_URL` está nas variáveis
  3. Teste conexão: `railway run psql $DATABASE_URL -c "SELECT 1"`

### Problema: Migrações não rodaram
- **Solução:** Execute manualmente:
  ```bash
  railway run npm run migrate:full
  ```

---

## 📚 Recursos Adicionais

- [Documentação Railway](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Guia de Deploy Alternativo](./ALTERNATIVAS_DEPLOY.md)
- [Documentação Completa do UBL](../README.md)

---

## 🎯 Resumo Rápido

1. ✅ Railway → New Project → GitHub Repo
2. ✅ Add PostgreSQL Database
3. ✅ Configure Variables (NODE_ENV, API keys)
4. ✅ Run migrations: `railway run npm run migrate:full`
5. ✅ Pronto! URL disponível no dashboard

**Tempo estimado:** 5-10 minutos

---

## 💡 Dicas

- Railway oferece **$5 grátis** por mês (suficiente para desenvolvimento)
- PostgreSQL no Railway é **gratuito** no plano básico
- Railway detecta automaticamente Node.js e TypeScript
- O projeto já está configurado com `railway.json`
- Use Railway CLI para facilitar operações

---

**Pronto para deploy! 🚀**

