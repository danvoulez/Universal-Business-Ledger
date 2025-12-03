# Backend Developer Guide

Quick-start guide for working with the Universal Ledger backend.

## Core Concepts (30 seconds)

```
Event → Aggregate → Workflow → Agreement → Role
  │         │           │           │         │
Facts    State     Transitions   Pacts    Access
```

**Everything is an Event.** Events are immutable facts that build up aggregate state.

**Agreements are the force.** All relationships (employment, sales, licenses) are Agreements between Entities.

**Roles come from Agreements.** No agreement = no role = no access.

---

## Quick Start

### 1. Create an Entity

```typescript
import { createEvent, Ids } from './core';

const event = createEvent({
  type: 'EntityCreated',
  aggregateType: 'Entity',
  aggregateId: Ids.entity(),  // "ent-abc123..."
  actor: { type: 'System' },
  payload: {
    name: 'Acme Corporation',
    type: 'Organization',
    metadata: { industry: 'Technology' }
  }
});

await eventStore.append([event]);
```

### 2. Create an Agreement

```typescript
const agreementId = Ids.agreement();

const proposedEvent = createEvent({
  type: 'AgreementProposed',
  aggregateType: 'Agreement',
  aggregateId: agreementId,
  actor: { type: 'Entity', id: employerId },
  payload: {
    agreementType: 'Employment',
    parties: [
      { entityId: employerId, role: 'Employer' },
      { entityId: employeeId, role: 'Employee' }
    ],
    terms: {
      position: 'Software Engineer',
      salary: { amount: 120000, currency: 'USD', period: 'yearly' },
      startDate: '2024-02-01'
    },
    validity: {
      from: Date.now(),
      to: null  // Open-ended
    }
  }
});
```

### 3. Handle Consent & Activation

```typescript
// Employee consents
const consentEvent = createEvent({
  type: 'PartyConsented',
  aggregateType: 'Agreement',
  aggregateId: agreementId,
  actor: { type: 'Entity', id: employeeId },
  payload: { partyId: employeeId }
});

// Check if all parties consented, then activate
const activatedEvent = createEvent({
  type: 'AgreementActivated',
  aggregateType: 'Agreement',
  aggregateId: agreementId,
  actor: { type: 'System' },
  payload: { activatedAt: Date.now() }
});

// This automatically creates the Role
const roleEvent = createEvent({
  type: 'RoleEstablished',
  aggregateType: 'Role',
  aggregateId: Ids.role(),
  actor: { type: 'System' },
  payload: {
    entityId: employeeId,
    role: 'Employee',
    scope: { type: 'Organization', id: employerId },
    establishedBy: agreementId
  }
});
```

---

## Working with Workflows

### Define a Workflow

```typescript
import { Workflow } from './core';

const employmentWorkflow: Workflow = {
  id: 'wf-employment',
  name: 'Employment Agreement',
  aggregateType: 'Agreement',
  
  states: {
    Draft: { type: 'initial' },
    Proposed: { type: 'intermediate' },
    Active: { type: 'intermediate' },
    Terminated: { type: 'final' }
  },
  
  transitions: [
    {
      from: 'Draft',
      to: 'Proposed',
      event: 'AgreementProposed',
      guards: [
        { type: 'HasRequiredParties', config: { min: 2 } }
      ]
    },
    {
      from: 'Proposed',
      to: 'Active',
      event: 'AgreementActivated',
      guards: [
        { type: 'AllPartiesConsented' }
      ],
      sideEffects: [
        { type: 'CreateRoles' },
        { type: 'NotifyParties', config: { template: 'agreement-activated' } }
      ]
    },
    {
      from: 'Active',
      to: 'Terminated',
      event: 'AgreementTerminated',
      sideEffects: [
        { type: 'RevokeRoles' }
      ]
    }
  ]
};
```

### Execute Transitions

```typescript
import { createWorkflowEngine } from './core';

const engine = createWorkflowEngine(eventStore);
engine.registerWorkflow(employmentWorkflow);

// Attempt transition
const result = await engine.transition(
  'Agreement',
  agreementId,
  'AgreementActivated',
  { activatedAt: Date.now() },
  { type: 'System' }
);

if (!result.success) {
  console.error('Transition failed:', result.error);
  // e.g., "Guard failed: AllPartiesConsented - Missing consent from ent-xyz"
}
```

---

## Using the Intent API

### Register Intents

```typescript
import { IntentRegistry } from './core';

const registry = new IntentRegistry();

registry.register({
  verb: 'hire',
  intent: 'CreateEmploymentAgreement',
  requiredParams: ['employer', 'employee', 'position'],
  optionalParams: ['salary', 'startDate'],
  workflow: 'wf-employment',
  description: 'Create an employment agreement between employer and employee'
});
```

### Handle Natural Language

```typescript
// User says: "hire John as Software Engineer at Acme"
const parsed = registry.parse('hire John as Software Engineer at Acme');
// → { verb: 'hire', intent: 'CreateEmploymentAgreement', params: {...} }

// Or use the Agent API for full NL processing
const response = await agentAPI.chat({
  sessionId: 'session-123',
  message: 'hire John as Software Engineer at Acme starting next month'
});

console.log(response.markdown);
// "I'll create an Employment Agreement:
//  - Employer: Acme Corporation
//  - Employee: John Smith
//  - Position: Software Engineer
//  - Start Date: March 1, 2024
// 
//  Ready to proceed?"

console.log(response.affordances);
// [{ action: 'confirm', label: 'Create Agreement' },
//  { action: 'edit', label: 'Modify Terms' },
//  { action: 'cancel', label: 'Cancel' }]
```

---

## Authorization (ABAC)

### Check Permissions

```typescript
import { createAuthorizationEngine } from './core';

const authEngine = createAuthorizationEngine(eventStore);

const decision = await authEngine.authorize({
  subject: { entityId: userId },
  action: 'ViewSalary',
  resource: { type: 'Agreement', id: agreementId },
  context: { timestamp: Date.now() }
});

if (decision.allowed) {
  // Proceed
} else {
  console.log('Denied:', decision.reason);
  // e.g., "No active role grants ViewSalary permission"
}
```

### How Roles Work

```typescript
// Roles are derived from active Agreements
// Query: "What can John do?"

const roles = await authEngine.getEntityRoles(johnId);
// [
//   { role: 'Employee', scope: 'Acme Corp', agreementId: 'agr-123' },
//   { role: 'ProjectMember', scope: 'Project X', agreementId: 'agr-456' }
// ]

// Each role has permissions defined in the role registry
const permissions = roleRegistry.getPermissions('Employee');
// ['ViewOwnAgreement', 'RequestTimeOff', 'SubmitExpense', ...]
```

---

## Using Adapters

### Configure Adapters

```typescript
import { 
  createPostgresAdapter,
  createStripeAdapter,
  createSlackAdapter,
  createAnthropicAdapter 
} from './core/adapters';

// Event Store
const eventStore = createPostgresAdapter();
await eventStore.initialize({
  credentials: {
    connectionString: process.env.DATABASE_URL
  }
});

// Payments
const payments = createStripeAdapter();
await payments.initialize({
  credentials: { apiKey: process.env.STRIPE_SECRET_KEY }
});

// Notifications
const slack = createSlackAdapter();
await slack.initialize({
  credentials: { botToken: process.env.SLACK_BOT_TOKEN },
  options: { defaultChannel: '#agreements' }
});

// AI
const llm = createAnthropicAdapter();
await llm.initialize({
  credentials: { apiKey: process.env.ANTHROPIC_API_KEY }
});
```

### Handle Webhooks

```typescript
// Stripe webhook → Ledger event
app.post('/webhooks/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const event = await payments.handleWebhook(req.body, signature);
  
  if (event) {
    // Convert to ledger event
    const ledgerEvent = stripeEventToLedgerEvent(event);
    await eventStore.append([ledgerEvent]);
  }
  
  res.sendStatus(200);
});

// Slack slash command
app.post('/slack/commands', async (req, res) => {
  const { command, text, user_id } = req.body;
  
  if (command === '/ledger') {
    const response = await agentAPI.chat({
      sessionId: `slack-${user_id}`,
      message: text
    });
    
    res.json({
      response_type: 'in_channel',
      blocks: markdownToSlackBlocks(response.markdown)
    });
  }
});
```

---

## Querying Data

### Query Builder

```typescript
import { QueryBuilder } from './core';

// Find all active agreements for an entity
const query = new QueryBuilder()
  .select('Agreement')
  .where('parties', 'contains', { entityId: userId })
  .where('status', 'equals', 'Active')
  .orderBy('createdAt', 'desc')
  .limit(10);

const results = await query.execute(eventStore);
```

### Time-Travel Queries

```typescript
// State at a specific point in time
const stateLastMonth = await rehydrator.getStateAt(
  'Agreement',
  agreementId,
  Date.now() - 30 * 24 * 60 * 60 * 1000  // 30 days ago
);

// Full history
const history = await rehydrator.getHistory('Agreement', agreementId);
// [{ event, stateBefore, stateAfter, timestamp }, ...]
```

---

## Multitenancy (Realms)

```typescript
// All events are scoped to a realm
const event = createEvent({
  type: 'EntityCreated',
  // ...
  realmId: 'realm-tenant-123'  // Tenant isolation
});

// Queries are automatically filtered by realm
const results = await query
  .inRealm('realm-tenant-123')
  .execute(eventStore);

// Cross-realm operations require special permissions
const crossRealmOp = await sagaManager.startCrossRealmSaga({
  sourceRealm: 'realm-tenant-a',
  targetRealm: 'realm-tenant-b',
  // ...
});
```

---

## Common Patterns

### 1. Event Handler

```typescript
eventStore.subscribe(async (event) => {
  switch (event.type) {
    case 'AgreementActivated':
      await notifyParties(event);
      await createRoles(event);
      await updateProjections(event);
      break;
      
    case 'AgreementTerminated':
      await revokeRoles(event);
      await archiveDocuments(event);
      break;
  }
});
```

### 2. Saga for Complex Flows

```typescript
const hiringSaga = {
  name: 'HiringProcess',
  steps: [
    { action: 'CreateAgreement', compensate: 'VoidAgreement' },
    { action: 'SetupPayroll', compensate: 'RemoveFromPayroll' },
    { action: 'CreateAccounts', compensate: 'DisableAccounts' },
    { action: 'NotifyTeam', compensate: null }  // No compensation needed
  ]
};

const result = await sagaManager.execute(hiringSaga, {
  employer: acmeId,
  employee: johnId,
  position: 'Engineer'
});

if (!result.success) {
  // All completed steps were automatically compensated
  console.log('Saga rolled back:', result.compensatedSteps);
}
```

### 3. Scheduled Tasks

```typescript
scheduler.schedule({
  id: 'deadline-reminder',
  type: 'RecurringCheck',
  cron: '0 9 * * *',  // Daily at 9am
  handler: async () => {
    const upcomingDeadlines = await findDeadlinesWithin(7 * 24 * 60 * 60 * 1000);
    for (const deadline of upcomingDeadlines) {
      await sendReminder(deadline);
    }
  }
});
```

---

## File Structure

```
core/
├── schema/           # Domain types (Event, Agreement, etc.)
├── engine/           # Workflow & Flow engines
├── store/            # Event store implementations
├── api/              # Intent API, Query, Realtime
├── agent/            # AI-powered Agent API
├── security/         # Authorization (ABAC)
├── memory/           # Narrative logging
├── adapters/         # External integrations
│   ├── stripe.ts
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── twilio.ts
│   ├── sendgrid.ts
│   ├── slack.ts
│   ├── postgres.ts
│   └── standards/    # CloudEvents, OpenAPI, S3, GraphQL, gRPC, AMQP
└── index.ts          # Unified exports
```

---

## Quick Reference

| Task | Code |
|------|------|
| Generate ID | `Ids.entity()`, `Ids.agreement()`, `Ids.event()` |
| Create event | `createEvent({ type, aggregateType, aggregateId, actor, payload })` |
| Append events | `eventStore.append([event1, event2])` |
| Load aggregate | `rehydrator.rehydrate('Agreement', id)` |
| Check permission | `authEngine.authorize({ subject, action, resource, context })` |
| Execute intent | `agentAPI.chat({ sessionId, message })` |
| Query | `new QueryBuilder().select('Entity').where(...).execute()` |
| Subscribe | `eventStore.subscribe(handler)` |

---

*"Every line of code that touches the ledger should ask: What Agreement authorizes this?"*

