#!/bin/bash

# Deploy Universal Business Ledger to Render
# Via Blueprint + API, sem GitHub
# Usa Render CLI para deploy direto

set -e

echo "🚀 Deploying Universal Business Ledger to Render..."
echo ""

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
  echo "📦 Installing Render CLI..."
  npm install -g render-cli
fi

# Set API key
export RENDER_API_KEY="rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o"

# Authenticate
echo "🔐 Authenticating..."
render auth login --api-key "$RENDER_API_KEY" || true

# Create blueprint from render.yaml
echo "📋 Creating Blueprint from render.yaml..."
render blueprint create --file render.yaml --name "universal-business-ledger"

echo ""
echo "✅ Blueprint created!"
echo ""
echo "📝 Next steps:"
echo "   1. Go to https://dashboard.render.com"
echo "   2. Find your blueprint"
echo "   3. Apply it to create services"
echo "   4. Deploy code using: render deploy --service antenna --dir ."
echo ""

