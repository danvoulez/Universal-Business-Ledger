# 🚀 Instruções para Push no GitHub

## Repositório
**URL:** https://github.com/danvoulez/Universal-Business-Ledger

## Comandos para Fazer Push

### 1. Verificar Status
```bash
cd /Users/voulezvous/correcao/Universal-Business-Ledger
git status
```

### 2. Adicionar Todos os Arquivos
```bash
git add .
```

### 3. Fazer Commit
```bash
git commit -m "Initial commit: Universal Business Ledger

- Core ledger with event sourcing
- Agreement-based relationship model
- Antenna HTTP server (BFF)
- SDK for external services
- CLI tools and migrations
- Complete documentation"
```

### 4. Conectar ao GitHub (se ainda não conectado)
```bash
git remote add origin https://github.com/danvoulez/Universal-Business-Ledger.git
```

### 5. Fazer Push
```bash
# Primeira vez (criar branch main)
git push -u origin main

# Ou se já existe
git push origin main
```

## ⚠️ Importante

- ✅ `.env` está no `.gitignore` (não será commitado)
- ✅ `dist/` está no `.gitignore` (build não será commitado)
- ✅ `node_modules/` está no `.gitignore`

## 📝 Próximos Passos Após Push

1. Verificar no GitHub se tudo foi enviado
2. Configurar README no GitHub (já está no repo)
3. Adicionar tags/releases se necessário
4. Frontend vai para repositório separado

---

**Repositório:** https://github.com/danvoulez/Universal-Business-Ledger

