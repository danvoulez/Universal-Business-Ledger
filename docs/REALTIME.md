# Real-Time Communication

The Universal Business Ledger supports **both HTTP API and WebSocket** connections.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │  HTTP API Client     │  │  WebSocket Client            │ │
│  │  (ledgerClient.js)   │  │  (websocketClient.js)        │ │
│  │                      │  │                              │ │
│  │  - Chat              │  │  - Real-time subscriptions   │ │
│  │  - Intents           │  │  - Event streaming           │ │
│  │  - Queries           │  │  - Intent execution          │ │
│  │  - Sessions          │  │  - Live updates              │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                          │              │
                          ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ANTENNA (Backend)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │
│  │  HTTP Server         │  │  WebSocket Server            │ │
│  │  (server.ts)         │  │  (websocket.ts)              │ │
│  │                      │  │                              │ │
│  │  POST /chat          │  │  WS /subscribe               │ │
│  │  POST /intent         │  │  - Subscriptions             │ │
│  │  GET  /session/:id   │  │  - Heartbeats                │ │
│  │  ...                 │  │  - Intent execution         │ │
│  └──────────────────────┘  └─────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## HTTP API (ledgerClient.js)

**Use for:**
- ✅ One-time requests
- ✅ Chat conversations
- ✅ Session management
- ✅ Simple queries

**Example:**
```javascript
import { ledger } from './api/ledgerClient';

// Chat with agent
const response = await ledger.chat('Create a new agreement');

// Execute intent
const result = await ledger.intend('register:entity', {
  entityType: 'Person',
  identity: { name: 'John Doe' },
});

// Query events
const events = await ledger.events.list({ limit: 10 });
```

## WebSocket (websocketClient.js)

**Use for:**
- ✅ Real-time event subscriptions
- ✅ Live updates
- ✅ Dashboard monitoring
- ✅ Collaborative features

**Example:**
```javascript
import { createWebSocketClient } from './api/websocketClient';

// Create connection
const ws = createWebSocketClient();

// Subscribe to all events
const subId = ws.subscribe({
  type: 'events',
  filters: { realm: 'default' },
  includePayload: true,
}, (message) => {
  console.log('Event:', message);
});

// Subscribe to specific entity
ws.subscribe({
  type: 'aggregate',
  filters: {
    aggregate: { type: 'Party', id: 'entity-123' },
  },
}, (message) => {
  console.log('Entity updated:', message);
});

// Execute intent via WebSocket
const result = await ws.intend('register:entity', {
  entityType: 'Person',
  identity: { name: 'Jane Doe' },
});
```

## When to Use Which?

### Use HTTP API when:
- Making one-time requests
- You don't need real-time updates
- Simple request/response pattern
- Mobile apps (battery efficient)

### Use WebSocket when:
- You need live updates
- Building dashboards
- Real-time collaboration
- Event streaming
- Long-running subscriptions

## Combined Usage

You can use **both together**:

```javascript
import { ledger } from './api/ledgerClient';
import { createWebSocketClient } from './api/websocketClient';

// HTTP for initial data
const initialEvents = await ledger.events.list();

// WebSocket for live updates
const ws = createWebSocketClient();
ws.subscribe({
  type: 'events',
  filters: { realm: 'default' },
}, (message) => {
  // Update UI with new event
  addEventToUI(message.event);
});
```

## WebSocket Protocol

### Client → Server Messages

```typescript
// Subscribe
{
  action: 'subscribe',
  subscription: {
    type: 'events' | 'aggregate' | 'query' | 'workflow',
    filters: { ... },
    includePayload?: boolean,
    replayFrom?: 'beginning' | number | Timestamp,
  }
}

// Unsubscribe
{
  action: 'unsubscribe',
  subscriptionId: 'sub-123',
}

// Execute Intent
{
  action: 'intend',
  intent: {
    intent: 'register:entity',
    realm: 'default',
    payload: { ... },
  },
  requestId?: 'req-123',
}

// Ping
{
  action: 'ping',
}
```

### Server → Client Messages

```typescript
// Event
{
  type: 'event',
  subscriptionId: 'sub-123',
  event: {
    id: 'evt-123',
    sequence: 42n,
    timestamp: 1234567890,
    eventType: 'EntityRegistered',
    aggregateType: 'Party',
    aggregateId: 'entity-123',
    payload: { ... },
  }
}

// Subscribed
{
  type: 'subscribed',
  subscriptionId: 'sub-123',
  replayCount?: 10,
}

// Heartbeat
{
  type: 'heartbeat',
  timestamp: 1234567890,
  serverSequence: 42n,
}

// Intent Result
{
  type: 'intentResult',
  requestId: 'req-123',
  result: { ... },
}
```

## Connection Management

### Auto-Reconnect

The WebSocket client automatically reconnects on disconnect:

```javascript
const ws = createWebSocketClient();

// Listen to state changes
ws.onStateChange((state) => {
  if (state.connected) {
    console.log('✅ Connected');
  } else if (state.connecting) {
    console.log('🔄 Connecting...');
  } else if (state.error) {
    console.error('❌ Error:', state.error);
  }
});
```

### Manual Control

```javascript
// Connect
ws.connect();

// Disconnect (won't auto-reconnect)
ws.disconnect();

// Check connection
if (ws.isConnected()) {
  // Send message
}
```

## Subscription Types

### 1. Events
Subscribe to all events matching filters:

```javascript
ws.subscribe({
  type: 'events',
  filters: {
    realm: 'default',
    eventTypes: ['EntityRegistered', 'AgreementCreated'],
  },
}, callback);
```

### 2. Aggregate
Subscribe to changes on a specific aggregate:

```javascript
ws.subscribe({
  type: 'aggregate',
  filters: {
    aggregate: {
      type: 'Party',
      id: 'entity-123',
    },
  },
}, callback);
```

### 3. Query
Subscribe to query result changes:

```javascript
ws.subscribe({
  type: 'query',
  filters: {
    query: {
      target: 'Agreement',
      where: { status: 'Active' },
    },
  },
}, callback);
```

### 4. Workflow
Subscribe to workflow transitions:

```javascript
ws.subscribe({
  type: 'workflow',
  filters: {
    workflowDefinitionId: 'workflow-123',
    workflowStates: ['Pending', 'Active'],
  },
}, callback);
```

## Best Practices

1. **Use HTTP for initial load** - Faster, simpler
2. **Use WebSocket for updates** - Real-time, efficient
3. **Handle reconnection** - Listen to state changes
4. **Clean up subscriptions** - Unsubscribe on unmount
5. **Debounce rapid updates** - Use `debounceMs` in subscription

## Example: Real-Time Dashboard

```javascript
import { ledger } from './api/ledgerClient';
import { createWebSocketClient } from './api/websocketClient';

// Load initial data
const [events, setEvents] = useState([]);

useEffect(() => {
  // Initial load via HTTP
  ledger.events.list({ limit: 50 }).then(setEvents);
  
  // Live updates via WebSocket
  const ws = createWebSocketClient();
  const subId = ws.subscribe({
    type: 'events',
    filters: { realm: 'default' },
  }, (message) => {
    if (message.type === 'event') {
      setEvents(prev => [message.event, ...prev]);
    }
  });
  
  return () => {
    ws.unsubscribe(subId);
    ws.disconnect();
  };
}, []);
```

## Summary

✅ **HTTP API** - Simple, one-time requests  
✅ **WebSocket** - Real-time, live updates  
✅ **Use both** - Best of both worlds!  
✅ **Auto-reconnect** - Handles disconnections  
✅ **Type-safe** - Full TypeScript support  

Perfect for building modern, real-time applications! 🚀

