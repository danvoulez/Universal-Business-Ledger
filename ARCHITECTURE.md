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
│   ├── http-server.ts     #    HTTP gateway
│   ├── query-language.ts  #    Declarative query builder
│   └── realtime.ts        #    WebSocket & SSE streaming
│
├── security/               # ← AUTHORIZATION
│   ├── authorization.ts   #    Agreement-Based Access Control
│   ├── policies.ts        #    Policy engine
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
├── evolution/              # ← SCHEMA EVOLUTION
│   └── versioning.ts      #    Upcasting, migrations, deprecation
│
├── performance/            # ← OPTIMIZATION
│   └── snapshots.ts       #    Snapshots, projections, caching
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
│   └── governance.ts      #    Rate limits, quotas, archival
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
└── index.ts               # ← UNIFIED EXPORTS
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
POST /intend { intent: "hire", payload: { ... } }
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
// - Event store (in-memory for development)
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

## Extended Capabilities

### 7. Schema Evolution

Events are immutable, but schemas evolve. We handle this through **upcasting**:

```typescript
// Old events stay as-is in storage
// When reading, we transform them to current schema

Upcaster: v1 → v2 → v3 → v4 (current)

// Example: PartyRegistered evolved
// v1: { name, type }
// v2: { identity: { name, identifiers }, type }  
// v3: { identity, partyType }  (renamed 'type')
// v4: { identity, partyType, establishedBy }
```

### 8. Performance Optimization

For large event streams, we use **snapshots**:

```
Events: E₁ ── E₂ ── E₃ ── ··· ── E₁₀₀ ── E₁₀₁ ── ···
                                    │
                              Snapshot₁₀₀
                                    │
                                    ▼
              To get current: Load Snapshot₁₀₀ + replay E₁₀₁...
              Instead of:     Replay E₁...E₁₀₁
```

**Projections** create read-optimized views for complex queries.

### 9. Distributed Transactions (Sagas)

Multi-step processes use the Saga pattern with compensation:

```
SAGA: Hire Employee
┌─────────────────────────────────────────────────────────────────────────────┐
│ Step 1: Create Agreement    ──▶  (if fails: void agreement)                │
│ Step 2: Grant Role          ──▶  (if fails: revoke role, void agreement)   │
│ Step 3: Provision Access    ──▶  (if fails: revoke access, role, agreement)│
│ Step 4: Start Onboarding    ──▶  Success!                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

If Step 3 fails, Steps 2 and 1 are automatically compensated.

### 10. Scheduling & Deadlines

Time-based triggers are first-class citizens:

```typescript
// Agreement expiry with reminders
SCHEDULE_PATTERNS.agreementExpiry(agreementId, expiresAt)
// Creates:
// - 30-day reminder
// - 7-day reminder  
// - 1-day reminder
// - Expiration trigger

// Payment deadline with escalation
SCHEDULE_PATTERNS.paymentDue(agreementId, dueDate, recipientId)
// Creates:
// - Due date notification
// - 1-day overdue: Flag as overdue
// - 7-day overdue: Escalate to manager
```

### 11. Documents & Signatures

Agreements often have attached documents:

```typescript
Document {
  contentHash: "sha256:abc123...",  // Content-addressed
  signatures: [
    {
      signerId: "ent-joao",
      algorithm: "Ed25519",
      purpose: "Consent",
      timestamp: 1701532800000
    }
  ]
}
```

Documents are:
- Immutable (new version = new document)
- Signed with PKI
- Versioned
- Attached to agreements

### 12. Webhooks & Notifications

The ledger notifies external systems:

```typescript
Webhook {
  url: "https://external.system/events",
  filters: { eventTypes: ["AgreementActivated"] },
  auth: { type: "HMAC", secret: "..." }
}

// Notifications support multiple channels
Notification {
  channel: "Email" | "SMS" | "InApp" | "Slack",
  template: "agreement-proposed",
  recipients: ["ent-joao"]
}
```

### 13. Observability

Beyond Memory (narrative logging), we have quantitative observability:

```typescript
// Metrics
LEDGER_METRICS.events.total        // Counter: total events
LEDGER_METRICS.api.duration        // Histogram: request latency
LEDGER_METRICS.workflows.active    // Gauge: active workflows

// Tracing
Trace {
  traceId: "abc123",
  spans: [
    { operation: "HandleIntent", duration: 45ms },
    { operation: "Authorize", duration: 3ms },
    { operation: "AppendEvent", duration: 12ms }
  ]
}

// Health
SystemHealth {
  status: "Healthy",
  checks: [
    { component: "EventStore", status: "Healthy" },
    { component: "Database", status: "Healthy" },
    { component: "Projections", status: "Degraded", message: "5 events behind" }
  ]
}
```

### 14. Operational Controls

Production systems need governance:

```typescript
// Rate Limiting
RateLimit {
  scope: { type: "Realm", realmId: "tenant-123" },
  limit: 1000,
  window: { amount: 1, unit: "hours" }
}

// Quotas
Quota {
  resource: "Events",
  limit: 1_000_000,
  scope: "PerRealm"
}

// Data Export (GDPR)
ExportRequest {
  type: "EntityData",  // All data for one entity
  format: "JSON",
  scope: { entityId: "ent-joao" }
}

// Archival
ArchivalPolicy {
  archiveAfter: { amount: 2, unit: "years" },
  destination: { type: "Glacier", vault: "ledger-archive" }
}
```

### 15. Templates

Pre-built patterns make the system practical:

```typescript
// Standard Employment Agreement template
const employment = AGREEMENT_TEMPLATES.employment;
// Variables: position, salary, currency, hoursPerWeek, startDate

// Instantiate
templateRegistry.instantiate("employment-template", {
  position: "Software Engineer",
  salary: 100000,
  currency: "USD",
  hoursPerWeek: 40,
  startDate: "2024-01-15"
});
```

### 16. Search

Beyond structured queries, full-text and semantic search:

```typescript
// Full-text search
searchEngine.search({
  query: "software contract",
  type: "FullText",
  filters: { agreementTypes: ["Employment", "Service"] },
  facets: ["status", "agreementType"]
});

// Semantic search (AI-powered)
semanticEngine.searchSemantic("agreements about intellectual property");

// Find similar documents
semanticEngine.findSimilar(documentId);
```

### 17. Testing Utilities

Event sourcing enables powerful testing:

```typescript
// Time-travel testing
harness.setTime(new Date('2024-01-01'));
harness.advanceTime(30 * 24 * 60 * 60 * 1000); // 30 days
const stateAtTime = await harness.getStateAt('Agreement', agreementId, sequence);

// Fixtures
fixtureManager.load('simple-employment');
// Creates: employer, employee, active agreement, role

// Property tests
PropertyTest {
  name: "Aggregate version equals event count",
  property: async (input) => {
    // Verify this holds for ANY sequence of events
  }
}

// Scenario builder (BDD-style)
scenario()
  .given("An active employment agreement")
  .when("The employee resigns")
  .then("The agreement transitions to Terminated")
  .thenEventEmitted("AgreementTerminated")
  .execute();
```

## Adapter Layer

The Universal Ledger integrates with external platforms through a standardized adapter layer.

### 18. Platform Adapters

Platform-specific adapters translate between the ledger's universal model and each platform's conventions:

```typescript
// PAYMENTS - Stripe
const stripe = createStripeAdapter();
// PaymentIntent.succeeded → ObligationFulfilled event
// Customer.created → Entity created

// AI/LLM - Anthropic, OpenAI
const claude = createAnthropicAdapter();  // Claude models
const gpt = createOpenAIAdapter();         // GPT-4, GPT-3.5
const azureAI = createAzureOpenAIAdapter(); // Azure-hosted OpenAI

// IDENTITY - Auth0
const auth0 = createAuth0Adapter();
// Auth0 user → Entity + Session events
// Auth0 roles → Agreement-derived roles

// COMMUNICATION
const twilio = createTwilioAdapter();   // SMS, Voice, WhatsApp
const sendgrid = createSendGridAdapter(); // Email
const slack = createSlackAdapter();       // Team messaging

// DATABASE / EVENT STORE
const postgres = createPostgresAdapter();  // Production event store
const supabase = createSupabaseAdapter();  // Supabase (PostgreSQL + extras)
const neon = createNeonAdapter();          // Serverless PostgreSQL
```

Each adapter implements a common interface:
```typescript
interface Adapter {
  name: string;
  version: string;
  initialize(config: AdapterConfig): Promise<void>;
  healthCheck(): Promise<AdapterHealth>;
  shutdown(): Promise<void>;
}
```

### 19. Industry Standards

For maximum interoperability, the ledger speaks standard protocols:

```typescript
// CloudEvents - Universal event format
const cloudEvent = toCloudEvent(ledgerEvent);
// Works with: AWS EventBridge, Google Pub/Sub, Kafka, any CloudEvents consumer

// OpenAPI - Self-documenting API
const spec = generateOpenAPISpec(intentRegistry, templates);
// Works with: Swagger UI, Postman, code generators

// S3 - Object storage
const s3 = createS3Adapter({
  endpoint: "s3.amazonaws.com",  // or MinIO, Backblaze, etc.
});
// Content-addressed document storage

// GraphQL - Flexible queries
const schema = generateGraphQLSchema(aggregateTypes);
// Query exactly what you need

// gRPC - High-performance RPC
const proto = generateProtoFile(intentRegistry);
// Binary protocol for service-to-service

// AMQP - Message queuing (RabbitMQ)
const amqp = createAMQPAdapter({
  url: "amqp://localhost"
});
// Exchange-based routing for events
```

### Adapter Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UNIVERSAL LEDGER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Core Domain Model                            │   │
│  │              Entities • Agreements • Events • Roles                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                        ┌───────────┴───────────┐                           │
│                        ▼                       ▼                           │
│  ┌────────────────────────────┐  ┌────────────────────────────────┐       │
│  │    PLATFORM ADAPTERS       │  │    INDUSTRY STANDARDS          │       │
│  │                            │  │                                │       │
│  │  ┌────────┐ ┌────────┐    │  │  ┌─────────────┐ ┌───────────┐ │       │
│  │  │ Stripe │ │ Auth0  │    │  │  │ CloudEvents │ │  OpenAPI  │ │       │
│  │  └────────┘ └────────┘    │  │  └─────────────┘ └───────────┘ │       │
│  │  ┌────────┐ ┌────────┐    │  │  ┌─────────────┐ ┌───────────┐ │       │
│  │  │ OpenAI │ │Anthropic│   │  │  │     S3      │ │  GraphQL  │ │       │
│  │  └────────┘ └────────┘    │  │  └─────────────┘ └───────────┘ │       │
│  │  ┌────────┐ ┌────────┐    │  │  ┌─────────────┐ ┌───────────┐ │       │
│  │  │ Twilio │ │SendGrid│    │  │  │    gRPC     │ │   AMQP    │ │       │
│  │  └────────┘ └────────┘    │  │  └─────────────┘ └───────────┘ │       │
│  │  ┌────────┐ ┌────────┐    │  │                                │       │
│  │  │ Slack  │ │Postgres│    │  │                                │       │
│  │  └────────┘ └────────┘    │  │                                │       │
│  │                            │  │                                │       │
│  │  "Knows the PLATFORM"      │  │  "Speaks the PROTOCOL"        │       │
│  └────────────────────────────┘  └────────────────────────────────┘       │
│                    │                           │                           │
│                    └────────────┬──────────────┘                           │
│                                 ▼                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │     EXTERNAL WORLD      │
                    │                         │
                    │  Payment processors     │
                    │  Identity providers     │
                    │  Message brokers        │
                    │  Cloud services         │
                    │  Any S3-compatible      │
                    │  Any gRPC client        │
                    │  Any GraphQL client     │
                    └─────────────────────────┘
```

## Why This Architecture?

### Perfect Auditability
Every action is recorded with WHO, WHAT, WHEN, WHY, and HOW. You can reconstruct any state at any point in time.

### Legal Compliance
- Tamper-evident through cryptographic chaining
- Non-repudiation through actor tracking
- Complete history through append-only storage

### Universal Flexibility
The Agreement model can represent ANY business relationship—no special cases, just different agreement types.

### Traceable Security
Every permission is traceable to its establishing agreement. "Why can John do X?" always has a clear answer.

### System Memory
Logging isn't a separate concern—it's integral to the system. The ledger IS the audit log.

### Production Ready
With snapshots, projections, caching, rate limiting, quotas, archival, and observability—the system is designed for real-world scale.

### Developer Experience
Templates, fixtures, time-travel testing, and property tests make development and maintenance a joy.

---

## Complete Conceptual Model

```
╔═════════════════════════════════════════════════════════════════════════════════╗
║                          UNIVERSAL LEDGER SYSTEM                                 ║
║                        Complete Conceptual Architecture                          ║
╠═════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  FOUNDATION                                                                      ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │   Events    │  Aggregates │  Workflows  │    Flows    │   Realms    │        ║
║  │  (Facts)    │   (State)   │  (States)   │ (Processes) │  (Tenants)  │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  DOMAIN MODEL                                                                    ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │  Entities   │   Assets    │ Agreements  │    Roles    │ Permissions │        ║
║  │  (Actors)   │  (Objects)  │  (Pacts)    │(Relations)  │  (Access)   │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  INTERFACE                                                                       ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │   Intents   │   Queries   │  WebSocket  │     SSE     │    Agent    │        ║
║  │  (Actions)  │  (Reads)    │  (Realtime) │ (Streaming) │    (AI)     │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  SECURITY & MEMORY                                                               ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │Authorization│  Policies   │   Memory    │   Stories   │   Logging   │        ║
║  │   (ABAC)    │  (Rules)    │ (Narrative) │  (History)  │  (Trace)    │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  EVOLUTION & PERFORMANCE                                                         ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │  Upcasting  │ Migrations  │  Snapshots  │ Projections │   Caching   │        ║
║  │ (Versioning)│  (Batch)    │  (Optimize) │  (Views)    │  (Speed)    │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  DISTRIBUTED                                                                     ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │    Sagas    │ Cross-Realm │  Conflicts  │ Scheduling  │  Deadlines  │        ║
║  │(Compensate) │ (Boundaries)│ (Resolution)│  (Triggers) │ (Reminders) │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  EXTERNAL                                                                        ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │   Webhooks  │Notifications│Integrations │  Documents  │  Signatures │        ║
║  │  (Events)   │  (Alerts)   │   (APIs)    │  (Files)    │   (PKI)     │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  OPERATIONAL                                                                     ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │   Metrics   │   Tracing   │   Health    │   Alerts    │ Rate Limits │        ║
║  │ (Numbers)   │   (Path)    │  (Status)   │ (Warnings)  │  (Control)  │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │   Quotas    │   Export    │  Archival   │  Retention  │  Templates  │        ║
║  │  (Limits)   │   (GDPR)    │  (Storage)  │ (Compliance)│ (Patterns)  │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  SEARCH & TESTING                                                                ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │  Full-Text  │  Semantic   │Time-Travel  │  Fixtures   │  Property   │        ║
║  │  (Search)   │    (AI)     │  (Testing)  │   (Setup)   │  (Verify)   │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  PLATFORM ADAPTERS                                                               ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │   Stripe    │   Auth0     │   OpenAI    │  Anthropic  │   Twilio    │        ║
║  │ (Payments)  │ (Identity)  │   (LLM)     │   (LLM)     │   (SMS)     │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │  SendGrid   │   Slack     │  Postgres   │  Supabase   │    Neon     │        ║
║  │  (Email)    │  (Chat)     │   (DB)      │   (BaaS)    │(Serverless) │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║                                                                                  ║
║  INDUSTRY STANDARDS                                                              ║
║  ┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐        ║
║  │ CloudEvents │   OpenAPI   │     S3      │   GraphQL   │    gRPC     │        ║
║  │  (Events)   │   (REST)    │ (Storage)   │  (Queries)  │   (RPC)     │        ║
║  └─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘        ║
║  ┌─────────────┐                                                                 ║
║  │    AMQP     │                                                                 ║
║  │ (Messaging) │                                                                 ║
║  └─────────────┘                                                                 ║
║                                                                                  ║
╚═════════════════════════════════════════════════════════════════════════════════╝
```

---

*"Agreements are the force that binds entities together. Without them, there are no relationships—only isolated atoms."*

*"The system doesn't just record what happened—it remembers, explains, and evolves."*
