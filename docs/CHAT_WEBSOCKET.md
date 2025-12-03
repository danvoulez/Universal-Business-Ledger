# Chat via WebSocket

Chat messages now use **WebSocket** instead of HTTP for better real-time communication.

## What Changed

### Before (HTTP)
```javascript
// HTTP POST request
await ledger.chat('Hello');
```

### After (WebSocket)
```javascript
// WebSocket message (same API, different transport)
await ledger.chat('Hello');
```

The API stays the same - the frontend code doesn't need to change!

## Benefits

✅ **Real-time** - Instant message delivery  
✅ **Bidirectional** - Server can push updates  
✅ **Lower latency** - No HTTP overhead  
✅ **Persistent connection** - No connection setup per message  
✅ **Better UX** - Feels more like a real chat  

## How It Works

```
Frontend                    Backend
─────────────────────────────────────
ledger.chat() ──────────► WebSocket
  (WebSocket)              /subscribe
                           │
                           ├─► Agent processes
                           │
                           └─► Response via WebSocket
```

## Implementation Details

### Backend (`antenna/websocket.ts`)

Added `chat` action handler:

```typescript
case 'chat':
  await this.handleChat(conn, message);
  break;
```

The chat handler:
1. Receives message via WebSocket
2. Calls agent router (same as HTTP)
3. Returns response via WebSocket

### Frontend (`api/ledgerClient.js`)

The `chat()` method now uses WebSocket:

```javascript
async chat(message, options = {}) {
  const ws = await import('./websocketClient.js');
  const client = ws.getWebSocketClient();
  
  return client.chat(message, {
    sessionId: options.sessionId || await ensureSession(),
    startSession: options.startSession,
  });
}
```

### WebSocket Protocol

**Client → Server:**
```json
{
  "action": "chat",
  "sessionId": "session-123",
  "message": {
    "text": "Hello!",
    "context": { ... }
  },
  "startSession": {
    "realmId": "default",
    "actor": { "type": "Anonymous" }
  },
  "requestId": "chat-123"
}
```

**Server → Client:**
```json
{
  "type": "chatResponse",
  "requestId": "chat-123",
  "response": {
    "id": "resp-456",
    "content": {
      "type": "message",
      "markdown": "# Hello!\n\nHow can I help?"
    },
    "affordances": [...],
    "suggestions": [...]
  },
  "sessionId": "session-123"
}
```

## Session Management

Sessions work the same way:
- First message: `startSession` creates new session
- Subsequent messages: Use `sessionId`
- Session stored in localStorage (same as before)

## Fallback

If WebSocket fails, you can still use HTTP:

```javascript
// Direct HTTP (if needed)
await fetch('/chat', {
  method: 'POST',
  body: JSON.stringify({ sessionId, message }),
});
```

But WebSocket is preferred for chat!

## Example

```javascript
import { ledger } from './api/ledgerClient';

// Send message (uses WebSocket automatically)
const result = await ledger.chat('Create a new agreement');

// Response structure (same as before)
const markdown = result.response.content.markdown;
const affordances = result.response.affordances;
const sessionId = result.sessionId;
```

## Benefits for Chat

1. **Instant delivery** - No HTTP round-trip delay
2. **Streaming support** - Can stream responses (future)
3. **Typing indicators** - Server can send "agent is typing"
4. **Presence** - Know when agent is online
5. **Better mobile** - More battery efficient than polling

## Migration

✅ **No changes needed** - The API is the same!

The frontend code (`Chat.jsx`) works without modifications because:
- Same response structure
- Same error handling
- Same session management

Just better transport! 🚀

