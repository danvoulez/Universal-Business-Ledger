#!/bin/bash

# Deploy no Render usando Render CLI (SEM GITHUB!)
# API Key: rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o

echo "🚀 Deploying to Render using CLI (no GitHub needed!)"
echo ""

# Autenticar
echo "🔐 Authenticating..."
export RENDER_API_KEY="rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o"
npx render-cli auth login --api-key "$RENDER_API_KEY" || echo "Auth may already be set"

# Fazer deploy
echo ""
echo "📤 Deploying services..."
echo ""

# O comando render up faz deploy direto do código local!
cd /Users/voulezvous/correcao/Universal-Business-Ledger
npx render-cli up

echo ""
echo "✅ Deploy iniciado!"
echo ""
echo "📋 Próximos passos:"
echo "   1. Vá para https://dashboard.render.com"
echo "   2. Configure as variáveis de ambiente"
echo "   3. Aguarde o deploy completar"
echo ""

