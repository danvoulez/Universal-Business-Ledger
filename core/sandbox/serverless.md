# Serverless Architecture for Workspace

## Serverless Compatibility Analysis

### ✅ What Works with Serverless

1. **API Endpoints** - Intent API, HTTP handlers
   - Stateless request/response
   - Perfect for serverless functions

2. **Event Store** - Database operations
   - Managed DB (Supabase, Neon) works great
   - No server needed

3. **File Storage** - S3/storage operations
   - Stateless upload/download
   - Perfect for serverless

4. **Query Operations** - Reading data
   - Fast, stateless
   - Works great

### ⚠️ What Needs Adaptation

1. **Long-Running Operations**
   - Git clone (can take minutes)
   - Large file processing
   - Long code executions
   - **Solution:** Job Queue + Workers

2. **State Management**
   - Workspace state (files, repos)
   - **Solution:** Store in Event Store + S3 (already stateless!)

3. **Real-Time Features**
   - WebSocket connections
   - **Solution:** Managed real-time (Supabase Realtime, Pusher)

4. **Execution Time Limits**
   - AWS Lambda: 15min max
   - Vercel: 10s-300s
   - **Solution:** Async jobs for long operations

## Serverless Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVERLESS LAYER                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  API Functions (Vercel/Netlify/Lambda)                      │
│  ├── POST /intent          → Fast (< 1s)                     │
│  ├── GET  /query           → Fast (< 1s)                     │
│  ├── POST /upload:file     → Fast (< 5s)                     │
│  └── POST /clone:repo     → Queue job (async)              │
│                                                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    JOB QUEUE                                 │
│  (AWS SQS, Vercel Queue, Inngest, etc.)                     │
│                                                               │
│  ├── git:clone      → Worker processes                       │
│  ├── git:push       → Worker processes                       │
│  ├── execute:script → Worker processes                       │
│  └── export:workspace → Worker processes                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                    WORKERS (Long-Running)                    │
│  (AWS ECS, Railway, Render, Fly.io)                         │
│                                                               │
│  - Process jobs from queue                                   │
│  - Can run for hours if needed                               │
│  - Update Event Store when done                              │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Strategy

### 1. Fast Operations (Serverless Functions)

```typescript
// Vercel/Netlify/Lambda function
export async function POST(request: Request) {
  const { intent, payload } = await request.json();
  
  // Fast operations (< 5s)
  if (intent === 'query' || intent === 'upload:file') {
    return handleFastOperation(intent, payload);
  }
  
  // Long operations → Queue job
  if (intent === 'clone:repository' || intent === 'execute:script') {
    const jobId = await queueJob(intent, payload);
    return { jobId, status: 'queued' };
  }
}
```

### 2. Job Queue for Long Operations

```typescript
// Queue long-running operations
interface Job {
  id: EntityId;
  type: 'git:clone' | 'git:push' | 'execute:script' | 'export:workspace';
  payload: unknown;
  workspaceId: EntityId;
  createdAt: Timestamp;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

// Create job event
{
  type: 'JobQueued',
  payload: {
    jobId: EntityId,
    jobType: 'git:clone',
    workspaceId: EntityId,
    // ... job data
  }
}

// Job completed event
{
  type: 'JobCompleted',
  payload: {
    jobId: EntityId,
    result: unknown,
    durationMs: number,
  }
}
```

### 3. Worker Process (Long-Running)

```typescript
// Worker (runs on ECS/Railway/Render)
async function processJob(job: Job) {
  // Record job started
  await eventStore.append({
    type: 'JobStarted',
    aggregateId: job.id,
    aggregateType: 'Job',
    payload: { jobId: job.id },
  });
  
  try {
    // Execute long-running operation
    let result;
    switch (job.type) {
      case 'git:clone':
        result = await cloneRepository(job.payload);
        break;
      case 'execute:script':
        result = await executeScript(job.payload);
        break;
      // ...
    }
    
    // Record success
    await eventStore.append({
      type: 'JobCompleted',
      aggregateId: job.id,
      aggregateType: 'Job',
      payload: { jobId: job.id, result },
    });
  } catch (error) {
    // Record failure
    await eventStore.append({
      type: 'JobFailed',
      aggregateId: job.id,
      aggregateType: 'Job',
      payload: { jobId: job.id, error: error.message },
    });
  }
}
```

### 4. Real-Time Updates

```typescript
// Use managed real-time service
import { createClient } from '@supabase/supabase-js';

// Subscribe to job updates
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

supabase
  .channel(`job:${jobId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'events',
    filter: `aggregate_id=eq.${jobId}`,
  }, (payload) => {
    // Notify frontend: job updated
    notifyClient(jobId, payload.new);
  })
  .subscribe();
```

## Serverless-Friendly Operations

### ✅ Fast (Serverless Functions)

| Operation | Time | Serverless? |
|-----------|------|-------------|
| `query` | < 1s | ✅ Yes |
| `upload:file` (small) | < 5s | ✅ Yes |
| `download:file` | < 2s | ✅ Yes |
| `list:files` | < 1s | ✅ Yes |
| `register:function` | < 1s | ✅ Yes |
| `create:workspace` | < 1s | ✅ Yes |

### ⚠️ Long (Job Queue)

| Operation | Time | Serverless? |
|-----------|------|-------------|
| `clone:repository` | 30s-5min | ⚠️ Queue job |
| `pull:repository` | 10s-2min | ⚠️ Queue job |
| `push:repository` | 10s-2min | ⚠️ Queue job |
| `execute:script` (long) | 1min-1hr | ⚠️ Queue job |
| `export:workspace` (large) | 30s-10min | ⚠️ Queue job |

## Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND                                                    │
│  - React/Vue app                                            │
│  - Real-time subscriptions                                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│  SERVERLESS API (Vercel/Netlify)                            │
│  - Fast operations (< 5s)                                   │
│  - Queue long operations                                    │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                       │
┌───────▼────────┐    ┌────────▼────────┐
│  JOB QUEUE     │    │  MANAGED DB      │
│  (Inngest/     │    │  (Supabase/      │
│   Vercel Queue)│    │   Neon)         │
└───────┬────────┘    └─────────────────┘
        │
┌───────▼─────────────────────────────────────────────────────┐
│  WORKERS (Railway/Render/Fly.io)                            │
│  - Process long jobs                                        │
│  - Update Event Store                                       │
│  - Can run for hours                                        │
└─────────────────────────────────────────────────────────────┘
```

## Cost Comparison

### Serverless (Vercel/Netlify)
- ✅ **Free tier:** 100GB bandwidth, 1000 function invocations/day
- ✅ **Pay per use:** $0.000016/GB-second
- ✅ **No idle costs**
- ⚠️ **Timeout limits:** 10s-300s

### Workers (Railway/Render)
- ✅ **Free tier:** 500 hours/month
- ✅ **$5-20/month:** For always-on workers
- ✅ **No timeout limits**
- ⚠️ **Idle costs:** If always running

### Hybrid Approach (Recommended)
- **API:** Serverless (Vercel) - Free tier
- **Workers:** Railway/Render - $5-10/month
- **DB:** Supabase - Free tier (500MB)
- **Storage:** S3/R2 - Pay per use

**Total:** ~$5-10/month for small scale

## Implementation Example

```typescript
// serverless/api/intent.ts (Vercel function)
export default async function handler(req, res) {
  const { intent, payload } = req.body;
  
  // Fast operations
  if (['query', 'upload:file', 'list:files'].includes(intent)) {
    const result = await handleIntent(intent, payload);
    return res.json(result);
  }
  
  // Long operations → Queue
  if (['clone:repository', 'execute:script'].includes(intent)) {
    const jobId = await inngest.send({
      name: intent,
      data: payload,
    });
    
    return res.json({ 
      jobId, 
      status: 'queued',
      pollUrl: `/api/jobs/${jobId}` 
    });
  }
}

// workers/process-job.ts (Railway worker)
import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'workspace-worker' });

inngest.createFunction(
  { id: 'clone-repository' },
  { event: 'clone:repository' },
  async ({ event, step }) => {
    // This can run for minutes/hours
    const result = await cloneRepository(event.data);
    
    // Update Event Store
    await eventStore.append({
      type: 'RepositoryCloned',
      payload: result,
    });
    
    return result;
  }
);
```

## Answer: YES, with Hybrid Architecture

✅ **Serverless-friendly:**
- API endpoints (fast operations)
- Database queries
- File uploads/downloads
- Real-time (via managed service)

⚠️ **Needs workers:**
- Git operations (clone/push)
- Long executions
- Large exports

**Best approach:** Hybrid
- Serverless for API (free/cheap)
- Workers for long jobs ($5-10/month)
- Managed DB (free tier)
- S3 storage (pay per use)

**Total cost:** ~$5-15/month for small scale, scales with usage.

