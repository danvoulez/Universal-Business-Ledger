<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Event_Sourcing-FF6B6B?style=for-the-badge" alt="Event Sourcing"/>
  <img src="https://img.shields.io/badge/MIT-green?style=for-the-badge" alt="MIT License"/>
</p>

<h1 align="center">
  📜 Universal Business Ledger
</h1>

<p align="center">
  <strong>A universal, append-only event-sourced ledger for modeling any business domain.</strong>
</p>

<p align="center">
  <em>"Agreements are the force that binds entities together.<br/>Without them, there are no relationships—only isolated atoms."</em>
</p>

---

## The Core Insight

> **Every relationship is an Agreement.**

This isn't a design pattern. It's the physics of business.

| Traditional Model | Universal Model |
|-------------------|-----------------|
| John IS an Employee | John HOLDS Employee role VIA Employment Agreement |
| Mary IS a Customer | Mary HOLDS Customer role VIA Purchase Agreement |
| Car #123 IS owned by Bob | Car #123 IS owned by Bob VIA Sale Agreement |

**Roles are not attributes. They are relationships.**

---

## ✨ Features

### Foundation
- **📜 Event Sourcing** — Immutable facts linked by cryptographic hash chain
- **🤝 Agreement-First** — All relationships established through explicit agreements
- **⏰ Temporal** — Query any state at any point in time
- **🔐 Auditable** — Complete traceable history, tamper-evident

### Domain Model
- **Entity** — Anything that can participate in agreements
- **Asset** — Anything that can be owned, transferred, or valued
- **Agreement** — The universal primitive for relationships
- **Role** — Relationships derived from agreements, not static attributes
- **Realm** — Isolated multi-tenant universes (also established by agreements!)

### Interface
- **Intent-Driven API** — Express what you want (`hire`, `sell`, `transfer`) not endpoints
- **Affordances** — API tells you what you can do next (HATEOAS++)
- **Real-time** — WebSocket & SSE streaming
- **Natural Language** — AI-powered Agent API for conversational interaction

### Security
- **Agreement-Based Access Control (ABAC)** — Every permission traceable to its source
- **Policy Engine** — Flexible rules that can override role decisions
- **Security as Memory** — Authorization decisions are part of the audit trail

### Production Ready
- **Snapshots & Projections** — Performance optimizations for scale
- **Sagas** — Distributed transactions with compensation
- **Scheduling** — Time-based triggers, deadlines, reminders
- **Webhooks & Notifications** — External integrations
- **Rate Limits & Quotas** — Operational governance
- **Data Export & Archival** — GDPR compliance, cold storage

---

## 🚀 Quickstart para Novos Tenants

### Criar seu Realm e receber credenciais

```bash
POST /intent
{
  "intent": "createRealm",
  "payload": {
    "name": "Minha Empresa"
  }
}
```

**Resposta inclui:**
- ✅ `realmId` - ID do seu realm
- ✅ `apiKey` - Chave API para autenticação
- ✅ `entityId` - ID da entidade sistema

📚 **Guia completo**: Veja `docs/TENANT_ONBOARDING_GUIDE.md`

---

## 🏗️ Architecture

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          UNIVERSAL LEDGER SYSTEM                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   Events ───▶ Agreements ───▶ Roles ───▶ Permissions ───▶ Actions            ║
║     │             │             │             │               │               ║
║     ▼             ▼             ▼             ▼               ▼               ║
║  IMMUTABLE    UNIVERSAL     TRACEABLE    CONTEXTUAL      AUDITED             ║
║   FACTS       CONTRACTS    RELATIONSHIPS  SECURITY       MEMORY              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

```
core/
├── shared/          # Universal primitives (EntityId, Timestamp, Duration...)
├── schema/          # Domain model (Event, Party, Asset, Agreement, Role)
├── universal/       # Generalized model with realms
├── enforcement/     # Hash chain, temporal rules, invariants
├── store/           # Event persistence (in-memory + PostgreSQL)
├── engine/          # Workflow & flow execution
├── aggregates/      # State reconstruction from events
├── api/             # Intent API, queries, HTTP, real-time
├── security/        # Authorization, policies, audit
├── memory/          # Narrative logging, stories
├── agent/           # AI-powered natural language interface
├── evolution/       # Schema versioning, upcasting, migrations
├── performance/     # Snapshots, projections, caching
├── distributed/     # Sagas, cross-realm, conflict resolution
├── scheduling/      # Time-based triggers, deadlines
├── attachments/     # Documents, signatures
├── outbound/        # Webhooks, notifications, integrations
├── observability/   # Metrics, tracing, health
├── operational/     # Rate limits, quotas, export, archival
├── templates/       # Agreement & workflow templates
├── search/          # Full-text & semantic search
└── testing/         # Time-travel, fixtures, property tests
```

---

## 🚀 Quick Start

```typescript
import { createUniversalLedger, Ids } from './core';

// Bootstrap the system
const ledger = createUniversalLedger();

// Create an employment relationship
const companyId = Ids.entity();
const employeeId = Ids.entity();
const agreementId = Ids.agreement();

// Record events (immutable facts)
await ledger.eventStore.append({
  type: 'EntityCreated',
  aggregateType: 'Entity',
  aggregateId: companyId,
  payload: { 
    entityType: 'Organization', 
    identity: { name: 'Acme Corp' } 
  }
});

await ledger.eventStore.append({
  type: 'EntityCreated',
  aggregateType: 'Entity',
  aggregateId: employeeId,
  payload: { 
    entityType: 'Person', 
    identity: { name: 'João Silva' } 
  }
});

await ledger.eventStore.append({
  type: 'AgreementProposed',
  aggregateType: 'Agreement',
  aggregateId: agreementId,
  payload: {
    agreementType: 'Employment',
    parties: [
      { entityId: companyId, role: 'Employer' },
      { entityId: employeeId, role: 'Employee' }
    ],
    terms: { 
      description: 'Employment of João as Software Engineer',
      clauses: [
        { type: 'Compensation', content: 'Annual salary of $100,000' }
      ]
    }
  }
});

// Query at any point in time
const state = await ledger.temporal.getAgreementAt(agreementId, Date.now());
```

---

## 💡 Use Cases

### E-Commerce
```
Entities: Store, Customers, Suppliers
Agreements: Purchase, Return, Supplier Contract
Assets: Products, Inventory
Workflows: Sale, Return, Fulfillment
```

### Healthcare
```
Entities: Hospital, Doctors, Patients, Insurance
Agreements: Employment, Care Agreement, Insurance Contract
Assets: Medical Records, Equipment
Workflows: Admission, Treatment, Discharge
```

### Legal/Notary
```
Entities: Notary, Parties, Witnesses
Agreements: Notarization Request, Contracts, Testimony
Assets: Documents, Seals
Workflows: Verification, Notarization
```

### HR/Workforce
```
Entities: Company, Employees, Contractors
Agreements: Employment, Contractor, NDA
Assets: Equipment, Credentials
Workflows: Hire, Onboard, Offboard
```

**The same primitives model ANY domain.**

---

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/danvoulez/Universal-Business-Ledger.git
cd Universal-Business-Ledger

# Install dependencies
npm install

# Build
npm run build

# Run development
npm run dev
```

### Requirements
- Node.js >= 18.0.0
- TypeScript 5.3+
- PostgreSQL (for production)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete system architecture |
| [PHILOSOPHY.md](./PHILOSOPHY.md) | The philosophical foundation |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Deployment guide |
| [core/store/postgres-schema.sql](./core/store/postgres-schema.sql) | Production database schema |

Ver [docs/README.md](./docs/README.md) para documentação completa.

---

## 🤝 Contributing

This is a conceptual architecture ready for real-world implementation. Contributions welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🌟 The Vision

> *"The ledger doesn't model business. The ledger **is** business—formalized."*

This system captures the fundamental nature of how business actually works:
- All relationships require consent (agreements)
- The past is immutable (events)
- Every action is attributable (actors)
- Every permission is traceable (roles → agreements)
- The system remembers its own story (memory)

**Built with ❤️ for a more transparent, auditable, and trustworthy world.**

---

<p align="center">
  <sub>In the beginning was the Agreement, and the Agreement was with the Ledger,<br/>and the Agreement was the foundation of all relationships.</sub>
</p>

