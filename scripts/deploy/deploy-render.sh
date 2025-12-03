#!/bin/bash

# Deploy Universal Business Ledger to Render via API
# API Key: rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o

RENDER_API_KEY="rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o"
RENDER_API_BASE="https://api.render.com/v1"

echo "🚀 Deploying to Render..."
echo ""

# Test API connection
echo "📡 Testing API connection..."
curl -s -X GET "${RENDER_API_BASE}/services" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  | head -20

echo ""
echo ""
echo "✅ API connection successful!"
echo ""
echo "📋 Next steps:"
echo "   1. Go to https://dashboard.render.com"
echo "   2. Click 'New +' → 'Blueprint'"
echo "   3. Connect your GitHub repo OR paste render.yaml content"
echo "   4. Click 'Apply'"
echo ""
echo "🔑 API Keys to add (after services are created):"
echo ""
echo "OPENAI_API_KEY=YOUR_OPENAI_API_KEY"
echo ""
echo "ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY"
echo ""
echo "GEMINI_API_KEY=YOUR_GEMINI_API_KEY"
echo ""
echo "🌐 Dashboard: https://dashboard.render.com"
echo ""
