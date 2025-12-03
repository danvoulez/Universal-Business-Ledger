# Frontend Developer Guide

Quick-start guide for building UIs that consume the Universal Ledger.

## Core Principle

**The frontend is logic-less.** All business logic lives in the backend. The frontend:
1. Sends natural language (or structured intents) to the Agent API
2. Receives Markdown + Affordances
3. Renders beautifully

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Your domain)                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Render Markdown                                       │   │
│  │  • Display affordances as buttons                        │   │
│  │  • Handle user input                                     │   │
│  │  • Real-time subscriptions (WebSocket/SSE)              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Agent API)                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Interpret natural language                            │   │
│  │  • Execute intents                                       │   │
│  │  • Enforce authorization                                 │   │
│  │  • Format responses as Markdown                         │   │
│  │  • Compute affordances (what can you do next?)          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. The Main Endpoint

```typescript
// POST /api/chat
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    sessionId: 'session-abc123',
    message: 'show me all active agreements'
  })
});

const data = await response.json();
// {
//   markdown: "## Active Agreements\n\n| Name | Type | Parties | Status |\n...",
//   affordances: [
//     { action: 'view', label: 'View Details', params: { id: 'agr-123' } },
//     { action: 'create', label: 'New Agreement' },
//     { action: 'export', label: 'Export CSV' }
//   ],
//   context: { ... }
// }
```

### 2. Render the Response

```tsx
// React example
function ChatMessage({ response }) {
  return (
    <div className="message">
      {/* Render Markdown */}
      <Markdown>{response.markdown}</Markdown>
      
      {/* Render Affordances as buttons */}
      <div className="affordances">
        {response.affordances.map(aff => (
          <button 
            key={aff.action}
            onClick={() => handleAffordance(aff)}
            className={`btn btn-${aff.style || 'default'}`}
          >
            {aff.label}
          </button>
        ))}
      </div>
    </div>
  );
}

async function handleAffordance(affordance) {
  // Send the affordance back as a structured intent
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: currentSession,
      intent: affordance.action,
      params: affordance.params
    })
  });
  // ... render new response
}
```

---

## Response Structure

Every response from the Agent API follows this structure:

```typescript
interface RichAgentResponse {
  id: string;
  sessionId: string;
  
  // Main content area
  main: {
    markdown: string;     // Human-readable text
    blocks: Block[];      // Structured UI components
  };
  
  // What user can do next
  affordances: Affordance[];
  
  // Tool calls made (for transparency)
  toolCalls?: ToolCall[];
  
  // Sidebar updates (chat history, flows)
  sidebar?: SidebarUpdate;
  
  // Right panel (ledger visualization)
  ledgerPanel?: LedgerPanelUpdate;
  
  // Real-time subscriptions to establish
  subscriptions?: Subscription[];
  
  // Conversation context
  context: ConversationContext;
}

// Block types - structured UI the frontend just renders
type Block =
  | { type: 'markdown'; content: string }
  | { type: 'table'; columns: Column[]; rows: Row[] }
  | { type: 'chart'; chartType: 'bar'|'line'|'pie'; data: DataPoint[] }
  | { type: 'calendar'; events: CalendarEvent[] }
  | { type: 'records'; records: RecordItem[] }
  | { type: 'buttons'; buttons: ActionButton[] }
  | { type: 'plan'; id: string; summary: string; records: PlannedRecord[] }  // KEY!
  | { type: 'alert'; severity: 'info'|'success'|'warning'|'error'; message: string }
  | { type: 'progress'; current: number; total: number }
  | { type: 'timeline'; events: TimelineEvent[] }
  | { type: 'form'; fields: FormField[]; submitAction: string }
  ;

interface Affordance {
  action: string;      // Intent to execute
  label: string;       // Button text
  params?: Record<string, unknown>;  // Pre-filled parameters
  style?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: string;
  confirm?: string;    // Confirmation message (if destructive)
  shortcut?: string;   // Keyboard shortcut hint
}
```

---

## Plans: Staged Records

The key feature: **Plans let users review records before they're created.**

```typescript
// Agent returns a plan block
{
  main: {
    markdown: "I'll create an employment agreement:",
    blocks: [
      {
        type: 'plan',
        id: 'plan-abc123',
        summary: 'Create employment agreement and Employee role',
        records: [
          {
            name: 'Employment Agreement - John Smith',
            recordType: 'agreement',
            data: { employee: 'John', employer: 'Acme', position: 'Engineer' }
          },
          {
            name: 'Employee Role - John',
            recordType: 'instance',
            data: { role: 'Employee', scope: 'Acme' }
          }
        ],
        confirmed: false
      }
    ]
  },
  affordances: [
    { action: 'confirm_plan', label: 'Create Agreement', style: 'primary' },
    { action: 'edit_plan', label: 'Edit Details' },
    { action: 'cancel', label: 'Cancel', style: 'ghost' }
  ]
}
```

### Rendering a Plan

```tsx
function PlanBlock({ plan, onConfirm, onReject }) {
  if (plan.confirmed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-green-600">
          <Check className="w-4 h-4" />
          <span>Recorded in ledger</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4">
      <p className="text-sm text-gray-600 mb-3">{plan.summary}</p>
      
      {plan.records.map((record, i) => (
        <div key={i} className="bg-white border rounded-lg p-3 mb-2">
          <div className="font-medium">{record.name}</div>
          <div className="text-xs text-gray-400">{record.recordType}</div>
          {Object.entries(record.data).map(([k, v]) => (
            <div key={k} className="text-sm text-gray-500">
              {k}: {v}
            </div>
          ))}
        </div>
      ))}
      
      <div className="flex gap-2 mt-3">
        <button onClick={() => onConfirm(plan.id)} className="btn-primary">
          Confirm
        </button>
        <button onClick={() => onReject(plan.id)} className="btn-ghost">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

### Confirming a Plan

```typescript
// User clicks "Confirm"
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    sessionId,
    intent: 'confirm_plan',
    params: { planId: 'plan-abc123' }
  })
});

// Backend creates the records, returns confirmation
// {
//   main: {
//     markdown: "✓ Created 2 records:\n- Employment Agreement\n- Employee Role",
//     blocks: [{ type: 'plan', ...plan, confirmed: true }]
//   },
//   affordances: [
//     { action: 'view_agreement', label: 'View Agreement' },
//     { action: 'create_another', label: 'Create Another' }
//   ]
// }
```

---

## Three-Panel Layout

The Agent can update all three panels:

```
┌──────────────┬────────────────────────────┬─────────────────────┐
│   SIDEBAR    │         MAIN CHAT          │    LEDGER PANEL     │
│              │                            │                     │
│  sidebar:    │  main: { markdown, blocks }│  ledgerPanel:       │
│  - history   │                            │  - records          │
│  - flows     │                            │  - filters          │
│  - pinned    │                            │  - counts           │
│              │                            │                     │
└──────────────┴────────────────────────────┴─────────────────────┘
```

### Sidebar Update

```typescript
// Response includes sidebar updates
{
  sidebar: {
    history: [
      { id: 'conv-1', title: 'Hiring John', lastMessageAt: 1701532800000 },
      { id: 'conv-2', title: 'Office lease', lastMessageAt: 1701446400000 },
    ],
    flows: [
      { id: 'flow-1', name: 'Onboarding', status: 'active', progress: 60 },
    ],
    user: { id: 'ent-123', name: 'Maria', roles: ['Admin'] }
  }
}
```

### Ledger Panel Update

```typescript
// Response includes ledger panel updates
{
  ledgerPanel: {
    records: [
      { id: 'rec-1', name: 'Employment - John', type: 'agreement', status: 'pending', ... },
      { id: 'rec-2', name: 'NDA - Acme', type: 'agreement', status: 'active', ... },
    ],
    filters: {
      statuses: [
        { value: 'pending', label: 'Pending', count: 1 },
        { value: 'active', label: 'Active', count: 5 },
      ],
      types: [
        { value: 'agreement', label: 'Agreement', count: 3 },
        { value: 'entity', label: 'Entity', count: 8 },
      ]
    },
    activeFilters: { statuses: ['pending'], types: [] },
    counts: { total: 11, pending: 1, inProgress: 2, completed: 8 }
  }
}
```

---

## Common Flows

### Flow 1: Natural Language Query

```
User: "who works at Acme?"
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  Response:                                            │
│                                                       │
│  ## Acme Corporation - Employees                      │
│                                                       │
│  | Name           | Role              | Since      |  │
│  |----------------|-------------------|------------|  │
│  | John Smith     | Software Engineer | 2024-02-01 |  │
│  | Maria Garcia   | Product Manager   | 2023-06-15 |  │
│  | Alex Chen      | Designer          | 2024-01-10 |  │
│                                                       │
│  **3 active employees**                               │
│                                                       │
│  [View Details] [Add Employee] [Export]               │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Flow 2: Create Something

```
User: "hire Sarah as Marketing Manager"
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  Response:                                            │
│                                                       │
│  ## Create Employment Agreement                       │
│                                                       │
│  I'll create an employment agreement with:            │
│                                                       │
│  - **Employee**: Sarah Johnson                        │
│  - **Position**: Marketing Manager                    │
│  - **Employer**: [Please specify]                     │
│                                                       │
│  Which company should be the employer?                │
│                                                       │
│  [Acme Corp] [TechStart Inc] [Other...]               │
│                                                       │
└───────────────────────────────────────────────────────┘

User clicks: [Acme Corp]
                │
                ▼
┌───────────────────────────────────────────────────────┐
│  Response:                                            │
│                                                       │
│  ## Confirm Employment Agreement                      │
│                                                       │
│  - **Employee**: Sarah Johnson                        │
│  - **Position**: Marketing Manager                    │
│  - **Employer**: Acme Corporation                     │
│  - **Start Date**: February 15, 2024                  │
│  - **Salary**: [Not specified]                        │
│                                                       │
│  Ready to create this agreement?                      │
│                                                       │
│  [✓ Create Agreement] [Edit Details] [Cancel]         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Flow 3: Real-time Updates

```typescript
// Subscribe to agreement events
const ws = new WebSocket('wss://api.ledger.local/realtime');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'agreements',
    filters: { entityId: currentUserId }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // data.markdown contains formatted notification
  // data.affordances contains relevant actions
  
  showNotification(data.markdown, data.affordances);
};
```

---

## Markdown Rendering

The backend returns rich Markdown. Recommended libraries:

```typescript
// React
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';  // Tables, strikethrough, etc.

<ReactMarkdown 
  remarkPlugins={[remarkGfm]}
  components={{
    // Custom table styling
    table: ({ children }) => (
      <table className="ledger-table">{children}</table>
    ),
    // Custom link handling
    a: ({ href, children }) => (
      <a href={href} onClick={(e) => handleLink(e, href)}>{children}</a>
    )
  }}
>
  {response.markdown}
</ReactMarkdown>
```

### Expected Markdown Patterns

```markdown
## Headers for sections

**Bold** for emphasis

| Tables | For | Data |
|--------|-----|------|
| row1   | a   | b    |

- Lists for options
- Another option

> Blockquotes for notes/warnings

`inline code` for IDs and technical values

---
Horizontal rules for separation
```

---

## Styling Affordances

Affordances come with optional styling hints:

```tsx
function AffordanceButton({ affordance, onClick }) {
  const styles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    default: 'bg-white border border-gray-300 hover:bg-gray-50'
  };
  
  const handleClick = () => {
    if (affordance.confirm) {
      if (window.confirm(affordance.confirm)) {
        onClick(affordance);
      }
    } else {
      onClick(affordance);
    }
  };
  
  return (
    <button 
      className={`px-4 py-2 rounded ${styles[affordance.style || 'default']}`}
      onClick={handleClick}
    >
      {affordance.label}
    </button>
  );
}
```

---

## Helper Endpoints

Beyond the main `/api/chat`, you have helpers:

### Authentication Status

```typescript
// GET /api/me
const me = await fetch('/api/me').then(r => r.json());
// {
//   entityId: 'ent-abc123',
//   name: 'John Smith',
//   roles: [
//     { role: 'Employee', scope: 'Acme Corp' },
//     { role: 'ProjectLead', scope: 'Project X' }
//   ]
// }
```

### Session History

```typescript
// GET /api/sessions/:sessionId/history
const history = await fetch(`/api/sessions/${sessionId}/history`).then(r => r.json());
// [
//   { role: 'user', content: 'show agreements' },
//   { role: 'assistant', markdown: '...', affordances: [...] },
//   { role: 'user', content: 'view agr-123' },
//   ...
// ]
```

### Entity Lookup (Autocomplete)

```typescript
// GET /api/entities/search?q=john&type=Person
const matches = await fetch('/api/entities/search?q=john&type=Person').then(r => r.json());
// [
//   { id: 'ent-abc', name: 'John Smith', type: 'Person' },
//   { id: 'ent-def', name: 'Johnny Appleseed', type: 'Person' }
// ]
```

### Affordance Metadata

```typescript
// GET /api/affordances
const allAffordances = await fetch('/api/affordances').then(r => r.json());
// {
//   'create-agreement': {
//     label: 'Create Agreement',
//     description: 'Propose a new agreement between parties',
//     requiredParams: ['type', 'parties'],
//     optionalParams: ['terms', 'validity']
//   },
//   ...
// }
```

---

## Real-time Subscriptions

### WebSocket

```typescript
const ws = new WebSocket('wss://api.ledger.local/realtime');

// Subscribe to specific events
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: [
    { name: 'agreements', filters: { partyId: myId } },
    { name: 'notifications', filters: { recipientId: myId } }
  ]
}));

// Handle incoming events
ws.onmessage = (event) => {
  const { channel, data } = JSON.parse(event.data);
  
  switch (channel) {
    case 'agreements':
      updateAgreementsList(data);
      break;
    case 'notifications':
      showToast(data.markdown);
      break;
  }
};
```

### Server-Sent Events (simpler)

```typescript
const events = new EventSource('/api/events?channels=agreements,notifications');

events.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleEvent(data);
};

events.onerror = () => {
  // Reconnect logic
  setTimeout(() => connectSSE(), 5000);
};
```

---

## Error Handling

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;        // Human-readable
    suggestion?: string;    // What to do
    affordances?: Affordance[];  // Recovery actions
  };
}

// Example error
// {
//   error: {
//     code: 'UNAUTHORIZED',
//     message: 'You don\'t have permission to view this agreement.',
//     suggestion: 'You may need to request access from the agreement owner.',
//     affordances: [
//       { action: 'request-access', label: 'Request Access', params: { agreementId: 'agr-123' } }
//     ]
//   }
// }
```

```tsx
function handleResponse(response) {
  if (response.error) {
    return (
      <div className="error">
        <p className="error-message">{response.error.message}</p>
        {response.error.suggestion && (
          <p className="error-suggestion">{response.error.suggestion}</p>
        )}
        {response.error.affordances && (
          <div className="error-actions">
            {response.error.affordances.map(aff => (
              <AffordanceButton key={aff.action} affordance={aff} />
            ))}
          </div>
        )}
      </div>
    );
  }
  // ... render normal response
}
```

---

## UI Component Examples

### Chat Interface

```tsx
function LedgerChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => `session-${Date.now()}`);
  
  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    
    // Get response
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message: input })
    }).then(r => r.json());
    
    // Add assistant response
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      markdown: response.markdown,
      affordances: response.affordances 
    }]);
  };
  
  const handleAffordance = async (aff) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId, 
        intent: aff.action,
        params: aff.params 
      })
    }).then(r => r.json());
    
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      markdown: response.markdown,
      affordances: response.affordances 
    }]);
  };
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.role === 'user' ? (
              <p>{msg.content}</p>
            ) : (
              <>
                <Markdown>{msg.markdown}</Markdown>
                <div className="affordances">
                  {msg.affordances?.map(aff => (
                    <button key={aff.action} onClick={() => handleAffordance(aff)}>
                      {aff.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything or describe what you want to do..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
```

### Quick Actions Palette

```tsx
function QuickActions() {
  const commonActions = [
    { action: 'list-agreements', label: '📜 My Agreements' },
    { action: 'create-agreement', label: '➕ New Agreement' },
    { action: 'pending-consents', label: '✍️ Pending Consents' },
    { action: 'recent-activity', label: '🕐 Recent Activity' },
  ];
  
  return (
    <div className="quick-actions">
      {commonActions.map(action => (
        <button 
          key={action.action}
          onClick={() => sendIntent(action.action)}
          className="quick-action-btn"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
```

---

## Styling Recommendations

### Color Palette (CSS Variables)

```css
:root {
  /* Primary */
  --color-primary: #667eea;
  --color-primary-dark: #5a67d8;
  
  /* Status */
  --color-success: #48bb78;
  --color-warning: #ed8936;
  --color-danger: #f56565;
  
  /* Agreement States */
  --state-draft: #a0aec0;
  --state-proposed: #ed8936;
  --state-active: #48bb78;
  --state-terminated: #f56565;
  
  /* Text */
  --text-primary: #1a202c;
  --text-secondary: #718096;
  --text-muted: #a0aec0;
  
  /* Surfaces */
  --surface-primary: #ffffff;
  --surface-secondary: #f7fafc;
  --surface-elevated: #ffffff;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### Agreement Status Badges

```tsx
function StatusBadge({ status }) {
  const styles = {
    Draft: 'bg-gray-100 text-gray-800',
    Proposed: 'bg-yellow-100 text-yellow-800',
    Active: 'bg-green-100 text-green-800',
    Terminated: 'bg-red-100 text-red-800',
    Expired: 'bg-purple-100 text-purple-800'
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-sm ${styles[status]}`}>
      {status}
    </span>
  );
}
```

---

## Testing Your Integration

```typescript
// Mock the API for development
const mockResponses = {
  'show agreements': {
    markdown: `## Your Agreements\n\n| Name | Status |\n|------|--------|\n| Employment | Active |`,
    affordances: [
      { action: 'view', label: 'View', params: { id: 'agr-123' } }
    ]
  }
};

async function mockChat(sessionId, message) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 500));
  
  const key = Object.keys(mockResponses).find(k => 
    message.toLowerCase().includes(k)
  );
  
  return mockResponses[key] || {
    markdown: `I understood: "${message}"\n\nWhat would you like to do?`,
    affordances: [
      { action: 'help', label: 'Show Help' }
    ]
  };
}
```

---

## Summary

| What Frontend Does | What Backend Does |
|-------------------|-------------------|
| Render Markdown | Interpret natural language |
| Display affordance buttons | Execute business logic |
| Handle user input | Enforce authorization |
| Subscribe to real-time events | Format responses |
| Style and animate | Compute affordances |

**Remember:** If you're writing `if` statements about business rules in the frontend, you're doing it wrong. Send it to the backend and let the Agent figure it out.

---

*"The best frontend is the one that doesn't know what an Agreement is—it just renders what the backend says."*

