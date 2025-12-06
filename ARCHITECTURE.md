# Universal Ledger System - Architecture

## The Vision: A Universal Business Operating System

This system is **universal**—it can model any business domain. The key insight: **all business relationships are agreements**. Employment, sales, partnerships, custody, testimony—everything is a pact between entities.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         UNIVERSAL LEDGER SYSTEM                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   Events ───▶ Agreements ───▶ Roles ───▶ Permissions ───▶ Actions            ║
║     │             │             │             │               │               ║
║     │             │             │             │               │               ║
║     ▼             ▼             ▼             ▼               ▼               ║
║  IMMUTABLE    UNIVERSAL     TRACEABLE    CONTEXTUAL      AUDITED            ║
║   FACTS       CONTRACTS    RELATIONSHIPS  SECURITY       MEMORY             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Core Philosophy

### 1. The Arrow of Time

The past is immutable. Events are facts that have happened—they can never be changed, only compensated for with new events.

```
Genesis ══════════════════════════════════════════════════════════▶ Now
   │                                                                │
   │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐       │
   │  │ E₁  │──│ E₂  │──│ E₃  │──│ E₄  │──│ E₅  │──│ E₆  │── ··· │
   │  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘       │
   │     │        │        │        │        │        │            │
   │     ▼        ▼        ▼        ▼        ▼        ▼            │
   │  hash₁ ← hash₂ ← hash₃ ← hash₄ ← hash₅ ← hash₆              │
   │                                                                │
   └────────────────── Cryptographic Chain ─────────────────────────┘
```

### 2. Agreements as the Universal Primitive

Every relationship is an agreement:

| Traditional Model | Universal Model |
|-------------------|-----------------|
| John IS an Employee | John HOLDS Employee role VIA Employment Agreement |
| Mary IS a Customer | Mary HOLDS Customer role VIA Purchase Agreement |
| Car #123 IS owned by Bob | Car #123 IS owned by Bob VIA Sale Agreement |

### 3. Roles as Relationships, Not Attributes

Roles are **not** static attributes. They are **relationships** established by agreements.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    AGREEMENT: Employment #EMP-2024-001                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │  ┌────────────┐                          ┌─────────────────────┐   │  │
│   │  │            │   establishes            │                     │   │  │
│   │  │  Entity:   │ ════════════════════════▶│  Role: Employee     │   │  │
│   │  │   João     │                          │                     │   │  │
│   │  │            │                          │  • Scope: Acme Corp │   │  │
│   │  └────────────┘                          │  • Valid: 2024-01-  │   │  │
│   │                                          │  • Permissions:     │   │  │
│   │                                          │    - read:*         │   │  │
│   │                                          │    - propose:agr    │   │  │
│   │                                          │    - create:asset   │   │  │
│   │                                          └─────────────────────┘   │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Authorization is Traceable

Unlike traditional RBAC where "John is Admin" is opaque, our system answers:
- **WHO** gave John this role? → Employment Agreement #123
- **WHEN** did it start? → 2024-01-15
- **WHEN** does it end? → Indefinite (or termination date)
- **WHAT** can John do? → Permissions defined in agreement
- **IN WHAT CONTEXT?** → Scoped to Realm "Acme Corp"

## System Architecture

### Module Structure

```
core/
├── shared/                 # ← FOUNDATION: Universal primitives
│   ├── types.ts           #    EntityId, Timestamp, Duration, Validity, etc.
│   └── index.ts           #    Clean exports
│
├── schema/                 # ← DOMAIN MODEL
│   ├── ledger.ts          #    Event, Party, Asset, Agreement, Role
│   └── workflow.ts        #    Workflow, Flow definitions
│
├── universal/              # ← GENERALIZED MODEL
│   ├── primitives.ts      #    Entity, Agreement, Role with realms
│   ├── agreement-types.ts #    Extensible agreement type registry
│   └── realm-manager.ts   #    Multitenancy via agreements
│
├── enforcement/            # ← RULES & VALIDATION
│   └── invariants.ts      #    Hash chain, temporal, business rules
│
├── store/                  # ← PERSISTENCE
│   ├── event-store.ts     #    In-memory (dev) event store
│   ├── postgres-event-store.ts # PostgreSQL implementation
│   ├── create-event-store.ts   # Factory (auto-selects PostgreSQL or in-memory)
│   └── postgres-schema.sql#    Production PostgreSQL schema
│
├── engine/                 # ← EXECUTION
│   ├── workflow-engine.ts #    State machine executor
│   └── flow-orchestrator.ts#   Complex process orchestration
│
├── aggregates/             # ← STATE RECONSTRUCTION
│   └── rehydrators.ts     #    Rebuild state from events
│
├── api/                    # ← INTERFACE LAYER
│   ├── intent-api.ts      #    Intent-driven API
│   ├── intent-handlers/    #    Intent handler implementations
│   │   ├── asset-intents.ts
│   │   └── workspace-intents.ts
│   ├── http-server.ts     #    HTTP gateway
│   ├── query-language.ts  #    Declarative query builder
│   └── realtime.ts        #    WebSocket & SSE streaming
│
├── security/               # ← AUTHORIZATION
│   ├── authorization.ts   #    Agreement-Based Access Control
│   ├── authentication.ts  #    JWT, API keys, session management
│   ├── policies.ts         #    Policy engine
│   └── audit-integration.ts#   Security → Memory integration
│
├── memory/                 # ← SYSTEM MEMORY
│   ├── narrative.ts       #    Structured logging
│   ├── story.ts           #    Story building from events
│   └── logger.ts          #    Log integration
│
├── agent/                  # ← AI-POWERED INTERFACE
│   ├── conversation.ts    #    Chat session management
│   └── api.ts             #    Agent API for frontend
│
├── sandbox/                # ← WORKSPACE SYSTEM (DETURPADO addition)
│   ├── workspace.ts       #    Workspace management
│   ├── storage.ts         #    File storage (S3 adapter)
│   └── runtimes/          #    Code execution runtimes
│       ├── nodejs.ts
│       └── registry.ts
│
├── trajectory/             # ← AUDIT TRAIL (DETURPADO addition)
│   ├── trace.ts           #    Trace tracking
│   ├── path.ts            #    Path reconstruction
│   └── logger.ts          #    Trajectory logging
│
├── evolution/              # ← SCHEMA EVOLUTION
│   └── versioning.ts      #    Upcasting, migrations, deprecation
│
├── performance/            # ← OPTIMIZATION
│   └── snapshots.ts      #    Snapshots, projections, caching
│
├── distributed/            # ← DISTRIBUTED OPERATIONS
│   └── saga.ts            #    Sagas, cross-realm, conflicts
│
├── scheduling/             # ← TIME-BASED TRIGGERS
│   └── scheduler.ts       #    Deadlines, reminders, recurring tasks
│
├── attachments/            # ← DOCUMENTS & SIGNATURES
│   └── documents.ts       #    Files, signing, templates
│
├── outbound/               # ← EXTERNAL INTEGRATIONS
│   └── integrations.ts    #    Webhooks, notifications, APIs
│
├── observability/          # ← METRICS & HEALTH
│   └── metrics.ts         #    Counters, tracing, alerts
│
├── operational/            # ← PRODUCTION CONTROLS
│   ├── governance.ts      #    Rate limits, quotas, archival
│   └── rate-limiter-redis.ts # Redis-based rate limiting
│
├── templates/              # ← REUSABLE PATTERNS
│   └── registry.ts        #    Agreement & workflow templates
│
├── search/                 # ← FULL-TEXT & SEMANTIC
│   └── engine.ts          #    Indexing, facets, AI search
│
├── testing/                # ← TEST UTILITIES
│   └── harness.ts         #    Time-travel, fixtures, properties
│
├── adapters/               # ← PLATFORM ADAPTERS (DETURPADO addition)
│   ├── standards/         #    Standard protocols
│   │   ├── s3.ts          #    AWS S3 storage
│   │   ├── cloudevents.ts#    CloudEvents format
│   │   ├── graphql.ts     #    GraphQL schema generation
│   │   └── ...
│   └── ...                #    Platform-specific adapters
│
└── index.ts               # ← UNIFIED EXPORTS

antenna/                   # ← HTTP SERVER (DETURPADO addition)
├── server.ts              #    Main HTTP server
├── admin.ts               #    Admin API (Event Store-based)
├── agent/                 #    Agent endpoints
└── websocket.ts           #    WebSocket support

sdk/                       # ← TYPESCRIPT SDK (DETURPADO addition)
└── index.ts               #    Client SDK

workers/                    # ← BACKGROUND WORKERS (DETURPADO addition)
└── job-processor.ts        #    Job processing
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTENT                                          │
│   "I want to hire João as an Employee"                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INTENT HANDLER                                     │
│   1. Parse intent → propose:employment                                      │
│   2. Validate actor permissions                                             │
│   3. Check workflow guards                                                  │
│   4. Verify business rules                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTHORIZATION                                      │
│   Request: { actor: Company, action: propose, resource: Agreement }         │
│   Check roles → Company has "Employer" capability                           │
│   Check policies → No conflicts                                             │
│   Decision: ALLOWED ✓                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT STORE                                        │
│   Append: AgreementCreated                                                  │
│   - type: "Employment"                                                      │
│   - parties: [Company:Employer, João:Employee]                              │
│   - terms: { salary, duties, ... }                                          │
│   - hash: sha256(previous + this)                                           │
│   - aggregateVersion: calculated (not hardcoded)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌───────────────────────────────────┐ ┌───────────────────────────────────┐
│           WORKFLOW                 │ │           MEMORY                   │
│   Agreement: Draft → Proposed      │ │   Memory created:                  │
│   Guards: ✓ Has parties            │ │   "Employment proposed for João"   │
│   Actions: Send notifications      │ │   Category: Relationship           │
└───────────────────────────────────┘ │   Audience: Business, Legal, HR     │
                        │              └───────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESPONSE                                           │
│   {                                                                         │
│     success: true,                                                          │
│     outcome: { type: "Created", id: "agr-abc123" },                         │
│     affordances: [                                                          │
│       { intent: "consent", description: "Give consent" },                   │
│       { intent: "terminate", description: "Cancel proposal" }               │
│     ]                                                                       │
│   }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Temporal Queries

Query the state of any entity at any point in time:

```typescript
// What roles did João have on January 1st, 2024?
QueryBuilder
  .roles()
  .where('holderId', 'eq', 'joao-123')
  .at(new Date('2024-01-01').getTime())
  .include('establishingAgreement')
  .build();
```

### 2. Intent-Driven API

Instead of REST endpoints, express what you want to achieve:

```typescript
// Traditional REST
POST /employees { ... }

// Intent-driven
POST /intent { intent: "hire", payload: { ... } }
```

### 3. Affordances

The API tells you what you can do next:

```json
{
  "affordances": [
    { "intent": "consent", "description": "Accept this agreement" },
    { "intent": "reject", "description": "Decline this agreement" },
    { "intent": "amend", "description": "Propose changes" }
  ]
}
```

### 4. Real-time Updates

Subscribe to changes via WebSocket or SSE:

```typescript
// WebSocket
{ action: "subscribe", subscription: { type: "events", filters: { realm: "acme" } } }

// SSE
GET /events?realm=acme&type=AgreementCreated,AgreementStatusChanged
```

### 5. Security as Memory

Authorization decisions become part of the audit trail:

```typescript
// Every Allow/Deny is logged as a Memory
Memory {
  category: "Decision",
  what: "Authorization: DENIED - delete on Agreement",
  actor: "user-123",
  reason: "No matching permissions",
  significance: "Warning"
}
```

### 6. Multitenancy via Agreements

Even multitenancy is modeled as agreements:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRIMORDIAL REALM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────┐        License Agreement         ┌───────────┐             │
│   │  SYSTEM   │════════════════════════════════▶│  TENANT   │             │
│   │  (Entity) │                                  │  (Entity) │             │
│   └───────────┘                                  └───────────┘             │
│        │                                               │                    │
│        │                                               │                    │
│        │ grants                                        │ has                │
│        ▼                                               ▼                    │
│   ┌──────────────────┐                     ┌────────────────────────┐      │
│   │ Role: Platform   │                     │    TENANT REALM        │      │
│   │      Owner       │                     │    (Isolated Space)    │      │
│   │                  │                     │                        │      │
│   │ • Global scope   │                     │  Their own:            │      │
│   │ • All permissions│                     │  • Entities            │      │
│   └──────────────────┘                     │  • Agreements          │      │
│                                            │  • Assets              │      │
│                                            │  • Workflows           │      │
│                                            └────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Shared Foundation

All modules use common primitives from `core/shared/`:

| Type | Purpose | Example |
|------|---------|---------|
| `EntityId` | Time-ordered unique identifier | `"ent-m5x2k-f8g3h9"` |
| `Timestamp` | Unix epoch milliseconds | `1701532800000` |
| `Duration` | Time span with unit | `{ amount: 7, unit: 'days' }` |
| `Validity` | Effective period | `{ effectiveFrom, effectiveUntil }` |
| `Scope` | Context boundaries | `{ type: 'Realm', targetId: '...' }` |
| `ActorReference` | Who performed action | `{ type: 'Entity', entityId: '...' }` |

### ID Generation

```typescript
import { Ids } from './core';

const entityId = Ids.entity();     // "ent-m5x2k-f8g3h9"
const agreementId = Ids.agreement(); // "agr-m5x2k-f8g3h9"
const roleId = Ids.role();          // "rol-m5x2k-f8g3h9"
```

## Quick Start

```typescript
import { createUniversalLedger, Ids } from './core';

// Bootstrap the system
const ledger = createUniversalLedger();

// The system is now ready with:
// - Event store (PostgreSQL if DATABASE_URL set, otherwise in-memory)
// - Workflow engine with standard workflows
// - Flow orchestrator for complex processes
// - Aggregate repository for state queries
// - Temporal queries for point-in-time lookups
```

## Production Deployment

For production, use:
1. **PostgreSQL Event Store** - See `core/store/postgres-schema.sql`
2. **Custom Services** - Implement real notification, validation handlers
3. **Security Policies** - Configure policies for your domain
4. **Realm Setup** - Create tenant realms via License Agreements

## DETURPADO Enhancements

This implementation (DETURPADO) includes additional features while maintaining the core ORIGINAL philosophy:

### Additional Modules:
- **`antenna/`** - Complete HTTP server with `/intent` endpoint
- **`core/sandbox/`** - Workspace system for code execution
- **`core/trajectory/`** - Enhanced audit trail
- **`core/adapters/`** - Platform adapters (S3, Stripe, Auth0, etc.)
- **`sdk/`** - TypeScript SDK for client integration
- **`workers/`** - Background job processing

### Key Corrections Applied:
- ✅ Aggregate versions calculated dynamically (not hardcoded)
- ✅ All actors are entities (not "System")
- ✅ Admin API uses Event Store (not in-memory)
- ✅ Everything via `/intent` (Intent-Driven)
- ✅ Consent explicit in Agreement Types

See `PHILOSOPHY.md` for the core philosophical foundation.

---

*"Agreements are the force that binds entities together. Without them, there are no relationships—only isolated atoms."*

*"The system doesn't just record what happened—it remembers, explains, and evolves."*

