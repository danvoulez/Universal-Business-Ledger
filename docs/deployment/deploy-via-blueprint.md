# 🚀 Deploy via Blueprint + API (Sem GitHub)

## Método 1: Blueprint via Dashboard (Mais Fácil)

### Passo 1: Criar Blueprint Manualmente

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Login com `dvoulez@gmail.com`
3. Clique em **"New +"** → **"Blueprint"**
4. Em vez de conectar GitHub, escolha **"Create from YAML"**
5. Cole o conteúdo do `render.yaml`
6. Clique em **"Apply"**

### Passo 2: Upload do Código

Depois de criar os serviços:

1. Vá para cada serviço no dashboard
2. Clique em **"Manual Deploy"**
3. Faça upload do código (zip do diretório)

---

## Método 2: API Direta (Script)

### Usar o Script Node.js

```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger
node deploy-render-api.js
```

### Ou usar o Script Bash

```bash
chmod +x deploy-render.sh
./deploy-render.sh
```

---

## Método 3: Render CLI (Recomendado)

### Instalar Render CLI

```bash
npm install -g render-cli
```

### Autenticar

```bash
export RENDER_API_KEY=rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o
render auth login
```

### Criar Blueprint

```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger

# Criar blueprint do render.yaml
render blueprint create --file render.yaml
```

### Deploy Local

```bash
# Deploy código local para o serviço
render deploy --service antenna --dir .
```

---

## Método 4: API REST Direta

### 1. Criar Database

```bash
curl -X POST https://api.render.com/v1/databases \
  -H "Authorization: Bearer rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ledger-db",
    "databaseName": "ledger",
    "user": "ledger_user",
    "planId": "starter",
    "region": "oregon"
  }'
```

### 2. Criar Redis

```bash
curl -X POST https://api.render.com/v1/redis \
  -H "Authorization: Bearer rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ledger-redis",
    "planId": "starter",
    "region": "oregon"
  }'
```

### 3. Criar Web Service

```bash
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web_service",
    "name": "antenna",
    "runtime": "node",
    "buildCommand": "npm install && npm run build",
    "startCommand": "npm start",
    "planId": "starter",
    "region": "oregon",
    "envVars": [
      {"key": "PORT", "value": "10000"},
      {"key": "NODE_ENV", "value": "production"},
      {"key": "OPENAI_API_KEY", "value": "YOUR_OPENAI_API_KEY..."},
      {"key": "ANTHROPIC_API_KEY", "value": "YOUR_ANTHROPIC_API_KEY..."},
      {"key": "GEMINI_API_KEY", "value": "YOUR_GEMINI_API_KEY..."}
    ],
    "healthCheckPath": "/health"
  }'
```

### 4. Deploy Código

Depois de criar o serviço, faça upload do código:

```bash
# Zip do diretório
cd /Users/voulezvous/correcao/Universal-Business-Ledger
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log"

# Upload via API (precisa do service ID)
curl -X POST https://api.render.com/v1/services/{SERVICE_ID}/deploys \
  -H "Authorization: Bearer rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o" \
  -F "file=@deploy.zip"
```

---

## 🎯 Método Mais Simples (Recomendado)

### 1. Render CLI + Blueprint

```bash
# Instalar CLI
npm install -g render-cli

# Autenticar
export RENDER_API_KEY=rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o
render auth login

# Criar blueprint
render blueprint create --file render.yaml

# Deploy código
render deploy --service antenna --dir .
```

### 2. Ou via Dashboard

1. Dashboard → New → Blueprint
2. "Create from YAML" → Cole `render.yaml`
3. Apply
4. Manual Deploy → Upload código

---

## 📝 Checklist

- [ ] Serviços criados (Database, Redis, Web, Worker)
- [ ] Variáveis de ambiente configuradas
- [ ] Código deployado
- [ ] Health check funcionando
- [ ] WebSocket testado

---

## ⚠️ Nota Importante

**Render requer código em um repositório Git** para auto-deploy.

**Sem GitHub, você precisa:**
1. Criar serviços via API/Blueprint
2. Fazer deploy manual via:
   - Render CLI (`render deploy`)
   - Dashboard (Manual Deploy)
   - API (upload zip)

**Alternativa:** Criar um repositório Git local e usar Render CLI.

