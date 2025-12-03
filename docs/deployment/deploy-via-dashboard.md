# 🚀 Deploy no Render - Via Dashboard (Mais Simples)

## Método Recomendado: Dashboard

Como a API do Render tem endpoints específicos, o **dashboard é mais simples e confiável**.

---

## Passo a Passo

### 1. Acessar Render Dashboard

1. Vá para [dashboard.render.com](https://dashboard.render.com)
2. Faça login com: `dvoulez@gmail.com`
3. Use a API key se pedir: `rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o`

### 2. Criar Blueprint

1. Clique em **"New +"** no canto superior direito
2. Selecione **"Blueprint"**
3. Você tem 2 opções:

#### Opção A: Conectar GitHub (Recomendado)
- Conecte seu repositório GitHub
- Render detecta `render.yaml` automaticamente
- Clique em **"Apply"**

#### Opção B: Upload Manual
- Escolha **"Create from YAML"**
- Cole o conteúdo do `render.yaml`
- Clique em **"Apply"**

### 3. Configurar Variáveis de Ambiente

Depois que os serviços forem criados, para cada serviço:

#### Antenna Service:
1. Vá para o serviço "antenna"
2. Clique em **"Environment"**
3. Adicione:

```
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

#### Worker Service:
1. Vá para o serviço "workspace-worker"
2. Clique em **"Environment"**
3. Adicione as mesmas keys acima

### 4. Deploy!

Render fará:
- ✅ Build automático
- ✅ Deploy dos serviços
- ✅ Health checks
- ✅ URLs geradas

---

## URLs Geradas

Depois do deploy:
- **Antenna:** `https://antenna.onrender.com`
- **Health Check:** `https://antenna.onrender.com/health`
- **WebSocket:** `wss://antenna.onrender.com/subscribe`

---

## ⚠️ Importante: Migrações

Depois que o PostgreSQL for criado:

1. Pegue o `DATABASE_URL` do dashboard
2. Adicione como variável de ambiente temporária
3. Execute migrações:

```bash
export DATABASE_URL=postgresql://...
npm run migrate
```

Ou adicione no build command:
```yaml
buildCommand: npm install && npm run build && npm run migrate
```

---

## 📋 Checklist

- [ ] Login no Render dashboard
- [ ] Criar Blueprint (GitHub ou YAML)
- [ ] Aplicar Blueprint
- [ ] Adicionar API keys em cada serviço
- [ ] Aguardar deploy
- [ ] Rodar migrações no database
- [ ] Testar endpoints

---

## 🎯 Pronto!

Seus serviços estarão rodando em:
- Web Service: `https://antenna.onrender.com`
- Worker: rodando em background
- Database: conectado automaticamente
- Redis: conectado automaticamente

**Custo:** ~$21-28/mês (Starter plans)

---

## 🆘 Problemas?

1. **Build falha:** Verificar logs no dashboard
2. **Serviço não inicia:** Verificar variáveis de ambiente
3. **Database não conecta:** Verificar `DATABASE_URL`
4. **WebSocket não funciona:** Verificar CORS e SSL

---

## ✅ Próximo Passo

**Acesse:** [dashboard.render.com](https://dashboard.render.com)

**E siga os passos acima!** 🚀

