#!/bin/bash

# Script para testar CORS

echo "🧪 Testando CORS no UBL"
echo "========================"
echo ""

# URL base (ajustar conforme necessário)
BASE_URL="${UBL_URL:-http://localhost:3000}"

echo "📡 Testando OPTIONS (preflight)..."
echo ""

curl -X OPTIONS "$BASE_URL/intent" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v 2>&1 | grep -i "access-control"

echo ""
echo "📡 Testando POST com Origin..."
echo ""

curl -X POST "$BASE_URL/intent" \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "intent": "query",
    "payload": {
      "queryType": "Realm"
    }
  }' \
  -v 2>&1 | grep -i "access-control"

echo ""
echo "✅ Teste completo!"
echo ""
echo "💡 Se não ver headers Access-Control-*, CORS não está funcionando"

