# 📁 Estrutura do Projeto

```
Universal-Business-Ledger/
├── antenna/              # HTTP server & WebSocket (BFF)
│   ├── agent/            # AI conversational agent
│   ├── server.ts         # HTTP server
│   └── websocket.ts      # WebSocket server
│
├── core/                 # Core ledger logic (npm library)
│   ├── schema/           # Domain model
│   ├── store/            # Event store
│   ├── security/         # Auth & authorization
│   ├── trajectory/       # Audit trail
│   └── ...               # Other core modules
│
├── sdk/                  # External service clients
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── postgres.ts
│   └── ...
│
├── cli/                  # Command-line tools
│   ├── ledger.ts
│   └── migrate.ts
│
├── workers/              # Background workers
│   └── job-processor.ts
│
├── docs/                 # Documentation
│   ├── deployment/       # Deploy guides
│   └── ...
│
├── scripts/              # Utility scripts
│   └── deploy/           # Deploy scripts
│
├── dist/                 # Compiled output (gitignored)
├── node_modules/         # Dependencies (gitignored)
│
├── Dockerfile            # Docker configuration
├── render.yaml          # Render deployment config
├── package.json
├── tsconfig.json
└── README.md
```

## Principais Diretórios

- **`core/`** - Lógica principal do ledger (reutilizável como npm package)
- **`antenna/`** - Servidor HTTP opcional (BFF)
- **`sdk/`** - Clientes para serviços externos (LLMs, databases, etc)
- **`docs/`** - Toda a documentação
- **`scripts/`** - Scripts utilitários

## Build Output

- **`dist/`** - Código compilado (TypeScript → JavaScript)
- Gerado por: `npm run build`

