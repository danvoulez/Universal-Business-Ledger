# Deployment on Render

## Render Services Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDER PLATFORM                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Web Service (Antenna)                                │   │
│  │  - HTTP API                                          │   │
│  │  - WebSocket support                                 │   │
│  │  - Always-on                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Background Worker (Jobs)                            │   │
│  │  - Git operations                                    │   │
│  │  - Long executions                                   │   │
│  │  - Export generation                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                 │   │
│  │  - Event Store                                        │   │
│  │  - Managed by Render                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Redis (Optional)                                    │   │
│  │  - Job queue                                         │   │
│  │  - Caching                                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Render Services Setup

### 1. Web Service (Antenna)

**Service Type:** Web Service  
**Build Command:** `npm install && npm run build`  
**Start Command:** `npm start`  
**Environment Variables:**
```bash
PORT=10000
NODE_ENV=production
DATABASE_URL=${{postgres.DATABASE_URL}}
REDIS_URL=${{redis.REDIS_URL}}  # Optional
OPENAI_API_KEY=YOUR_OPENAI_API_KEY...
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY...
GEMINI_API_KEY=YOUR_GEMINI_API_KEY...
```

**Plan:** Starter ($7/month) or Standard ($25/month)

### 2. Background Worker (Jobs)

**Service Type:** Background Worker  
**Build Command:** `npm install && npm run build`  
**Start Command:** `node dist/workers/job-processor.js`  
**Environment Variables:** Same as Web Service

**Plan:** Starter ($7/month) or Standard ($25/month)

### 3. PostgreSQL Database

**Service Type:** PostgreSQL  
**Plan:** Starter ($7/month) or Standard ($25/month)  
**Features:**
- Automatic backups
- Point-in-time recovery
- High availability (Standard plan)

### 4. Redis (Optional)

**Service Type:** Redis  
**Plan:** Starter ($7/month)  
**Use Cases:**
- Job queue
- Session storage
- Caching

## Cost Estimate

### Minimal Setup (Starter Plans)
- Web Service: $7/month
- Background Worker: $7/month
- PostgreSQL: $7/month
- **Total: $21/month**

### Production Setup (Standard Plans)
- Web Service: $25/month
- Background Worker: $25/month
- PostgreSQL: $25/month
- Redis: $7/month (optional)
- **Total: $82/month** (or $75 without Redis)

## Configuration Files

### render.yaml

```yaml
services:
  # Antenna Web Service
  - type: web
    name: antenna
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: PORT
        value: 10000
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: ledger-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: ledger-redis
          type: redis
          property: connectionString
      - key: OPENAI_API_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false

  # Background Worker
  - type: worker
    name: workspace-worker
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/workers/job-processor.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: ledger-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: ledger-redis
          type: redis
          property: connectionString

databases:
  - name: ledger-db
    plan: starter  # or standard
    databaseName: ledger
    user: ledger_user

services:
  - type: redis
    name: ledger-redis
    plan: starter
```

## Real-Time on Render

### ✅ WebSocket Support

**Yes!** Render web services fully support WebSockets:

- ✅ **Native WebSocket support** - No special configuration needed
- ✅ **Always-on connections** - No connection timeouts (unlike serverless)
- ✅ **Bidirectional communication** - Perfect for chat, live updates
- ✅ **No additional services needed** - Built into web service
- ✅ **Long-lived connections** - Perfect for subscriptions

### Real-Time Features Available

The UBL already has real-time infrastructure defined:

```typescript
// From core/api/realtime.ts
- WebSocket server interface (createWebSocketServer)
- SSE endpoints (createSSEEndpoint)
- Event subscriptions
- State change notifications
- Query result streaming
- Workflow transition alerts
```

### Implementation Status

**Current:** The real-time API is defined in `core/api/realtime.ts` with:
- ✅ Subscription types and filters
- ✅ Message protocols
- ✅ Server interfaces

**To Complete:** Wire up actual WebSocket library (e.g., `ws`):

```typescript
// Install: npm install ws @types/ws

// In antenna/server.ts
import { WebSocketServer } from 'ws';
import { createWebSocketServer } from '../core/api/realtime';

const wsServer = new WebSocketServer({ 
  server, 
  path: '/subscribe' 
});

wsServer.on('connection', (ws, req) => {
  // Handle WebSocket connection
  // Use createWebSocketServer handlers
});
```

**Alternative:** Use SSE (Server-Sent Events) for simpler unidirectional updates - works out of the box with HTTP.

## Advantages of Render

### ✅ Simplicity
- One platform for everything
- No complex serverless setup
- Easy to understand and debug

### ✅ Always-On
- No cold starts
- **WebSocket support** - Render web services support WebSockets natively
- **Real-time features** - Perfect for live updates, chat, notifications
- Long-lived connections work naturally (no timeout issues)

### ✅ Managed Services
- PostgreSQL with automatic backups
- Redis included
- Automatic SSL certificates
- Health checks

### ✅ Developer Experience
- Simple deployment (git push)
- Automatic deployments
- Logs in dashboard
- Environment variables UI

### ✅ Cost Predictable
- Fixed monthly cost
- No surprise bills
- Scales when you upgrade plan

## Deployment Steps

### 1. Prepare Repository

```bash
# Add render.yaml to repo
git add render.yaml
git commit -m "Add Render deployment config"
git push
```

### 2. Connect to Render

1. Go to render.com
2. New → Blueprint
3. Connect GitHub repo
4. Render auto-detects `render.yaml`
5. Deploy!

### 3. Set Environment Variables

In Render dashboard:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- Any other secrets

### 4. Deploy

Render will:
- Build the project
- Start services
- Connect to database
- Health check
- Go live!

## Worker Implementation

Create `workers/job-processor.ts`:

```typescript
/**
 * JOB PROCESSOR - Background Worker
 * 
 * Processes long-running operations:
 * - Git clone/pull/push
 * - Long script executions
 * - Large exports
 */

import { createUniversalLedger } from '../core';
import { createPostgresAdapter } from '../sdk/postgres';

const ledger = createUniversalLedger({
  eventStore: createPostgresAdapter(),
});

// Poll for jobs (or use Redis queue)
async function processJobs() {
  while (true) {
    const jobs = await getQueuedJobs();
    
    for (const job of jobs) {
      await processJob(job);
    }
    
    await sleep(1000); // Poll every second
  }
}

async function processJob(job: Job) {
  // Record job started
  await ledger.eventStore.append({
    type: 'JobStarted',
    aggregateId: job.id,
    aggregateType: 'Job',
    payload: { jobId: job.id },
  });
  
  try {
    let result;
    
    switch (job.type) {
      case 'clone:repository':
        result = await cloneRepository(job.payload);
        break;
      case 'execute:script':
        result = await executeScript(job.payload);
        break;
      case 'export:workspace':
        result = await exportWorkspace(job.payload);
        break;
    }
    
    // Record success
    await ledger.eventStore.append({
      type: 'JobCompleted',
      aggregateId: job.id,
      aggregateType: 'Job',
      payload: { jobId: job.id, result },
    });
  } catch (error) {
    // Record failure
    await ledger.eventStore.append({
      type: 'JobFailed',
      aggregateId: job.id,
      aggregateType: 'Job',
      payload: { jobId: job.id, error: error.message },
    });
  }
}

// Start processing
processJobs().catch(console.error);
```

## Package.json Scripts

```json
{
  "scripts": {
    "build": "node build.mjs",
    "start": "node dist/antenna/server.js",
    "worker": "node dist/workers/job-processor.js"
  }
}
```

## Monitoring

Render provides:
- **Logs** - Real-time in dashboard
- **Metrics** - CPU, memory, requests
- **Alerts** - Email notifications
- **Health Checks** - Automatic restarts

## Scaling

### Vertical Scaling
- Upgrade plan (Starter → Standard → Pro)
- More CPU/RAM per service

### Horizontal Scaling
- Add more worker instances
- Load balance web service (Standard+)

## Summary

✅ **Everything on Render:**
- Web Service (Antenna API)
- Background Worker (Jobs)
- PostgreSQL (Event Store)
- Redis (Optional, for queue/cache)

✅ **Benefits:**
- Simple deployment
- Always-on (no cold starts)
- Managed database
- Predictable costs
- Great DX

✅ **Cost:** $21-82/month depending on plan

Perfect for a production UBL deployment! 🚀

