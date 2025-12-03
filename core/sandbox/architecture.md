# Sandbox Architecture - UBL Integration

## Philosophy Alignment

The sandbox follows UBL's core principles:

1. **Execution as Events** - Every code execution is an immutable event
2. **Agreement-Based Access** - Who can execute what is controlled by agreements
3. **Resources as Assets** - Compute resources (CPU, memory) are assets allocated via agreements
4. **Realm Isolation** - Each realm has its own sandbox environment
5. **Intent-Driven** - Express execution intent, not implementation details
6. **Full Audit Trail** - Every execution is traceable and auditable
7. **Workspace as Asset** - Development workspaces are assets that can be shared/transferred

## Core Capabilities

The sandbox is a **full development workspace** that supports:

- ✅ **Git Integration** - Clone, pull, push repositories
- ✅ **File Management** - Upload, download, edit files
- ✅ **Code Execution** - Run functions, scripts, workflows
- ✅ **Export** - Export results, logs, artifacts
- ✅ **Collaboration** - Share workspaces via agreements

## Core Concepts

### 1. Workspace (Sandbox)

A **Workspace** is an aggregate that represents a full development environment:

```typescript
interface Workspace {
  id: EntityId;
  realmId: EntityId;
  
  // Identity
  name: string;
  description?: string;
  
  // Configuration
  runtime: 'Node.js' | 'Python' | 'Deno' | 'WebAssembly' | 'Multi';
  resources: {
    cpuLimit: number;      // CPU cores
    memoryLimit: number;   // MB
    storageLimit: number;  // GB
    timeoutMs: number;     // Max execution time
    networkAccess: boolean;
    gitAccess: boolean;    // Can clone/push repos
  };
  
  // Security
  allowedImports: string[];  // What can be imported
  blockedImports: string[];  // What's blocked
  allowedGitHosts: string[]; // GitHub, GitLab, etc.
  environmentVariables: Record<string, string>;
  
  // Workspace Contents
  repositories: RepositoryReference[];  // Cloned git repos
  files: FileReference[];               // Uploaded files
  functions: EntityId[];                 // Registered functions
  
  // State
  status: 'Active' | 'Suspended' | 'Terminated';
  createdAt: Timestamp;
  createdBy: ActorReference;
  lastActivityAt: Timestamp;
}

interface RepositoryReference {
  id: EntityId;
  url: string;              // Git URL
  branch: string;
  commit: string;           // Current commit
  localPath: string;        // Path in workspace
  clonedAt: Timestamp;
  lastPulledAt?: Timestamp;
}

interface FileReference {
  id: EntityId;
  filename: string;
  path: string;             // Path in workspace
  sizeBytes: number;
  uploadedAt: Timestamp;
  uploadedBy: ActorReference;
}
```

### 2. Function Definition

A **Function** is an asset that represents executable code:

```typescript
interface Function {
  id: EntityId;
  realmId: EntityId;
  
  // Code
  name: string;
  code: string;              // Source code
  language: 'javascript' | 'python' | 'typescript';
  entryPoint: string;        // Function name to call
  
  // Metadata
  description?: string;
  parameters: FunctionParameter[];
  returnType: string;
  
  // Versioning
  version: number;
  previousVersionId?: EntityId;
  
  // Attached to agreement (who can use it)
  agreementId?: EntityId;
}
```

### 3. Execution Agreement

An **Execution Agreement** controls who can execute what:

```typescript
interface ExecutionAgreement extends Agreement {
  type: 'Execution';
  
  // What can be executed
  functions: EntityId[];      // Function IDs
  sandboxId: EntityId;       // Which sandbox
  
  // Who can execute
  executors: EntityId[];      // Party IDs
  
  // Constraints
  maxExecutionsPerDay?: number;
  maxExecutionTimeMs?: number;
  allowedInputTypes?: string[];
  allowedOutputTypes?: string[];
  
  // Resource limits
  resourceQuota: {
    cpuSeconds: number;
    memoryMB: number;
  };
}
```

### 4. Workspace Events

All workspace operations create immutable events:

```typescript
// Execution
interface FunctionExecuted extends Event {
  type: 'FunctionExecuted';
  workspaceId: EntityId;
  functionId: EntityId;
  input: unknown;
  output: unknown;
  error?: ExecutionError;
  resources: ResourceUsage;
  executedBy: ActorReference;
  agreementId: EntityId;
  logs: string[];
}

// Git Operations
interface RepositoryCloned extends Event {
  type: 'RepositoryCloned';
  workspaceId: EntityId;
  repositoryUrl: string;
  branch: string;
  commit: string;
  clonedBy: ActorReference;
}

interface RepositoryPulled extends Event {
  type: 'RepositoryPulled';
  workspaceId: EntityId;
  repositoryId: EntityId;
  fromCommit: string;
  toCommit: string;
  pulledBy: ActorReference;
}

interface RepositoryPushed extends Event {
  type: 'RepositoryPushed';
  workspaceId: EntityId;
  repositoryId: EntityId;
  branch: string;
  commit: string;
  pushedBy: ActorReference;
}

// File Operations (All events are immutable and versioned)
interface FileUploaded extends Event {
  type: 'FileUploaded';
  workspaceId: EntityId;
  fileId: EntityId;
  filename: string;
  path: string;
  sizeBytes: number;
  contentHash: Hash;  // SHA-256 of content
  storageLocation: string;  // Where in storage (S3 key, etc.)
  uploadedBy: ActorReference;
}

interface FileModified extends Event {
  type: 'FileModified';
  workspaceId: EntityId;
  fileId: EntityId;
  previousVersionId: EntityId;  // Link to previous version
  path: string;
  sizeBytes: number;
  contentHash: Hash;  // New content hash
  storageLocation: string;
  changes?: {  // Optional: what changed (for text files)
    linesAdded: number;
    linesRemoved: number;
    diff?: string;
  };
  modifiedBy: ActorReference;
}

interface FileDeleted extends Event {
  type: 'FileDeleted';
  workspaceId: EntityId;
  fileId: EntityId;
  path: string;
  deletedBy: ActorReference;
  reason?: string;
}

interface FileExported extends Event {
  type: 'FileExported';
  workspaceId: EntityId;
  exportId: EntityId;
  format: 'zip' | 'tar' | 'json' | 'csv';
  contents: string[];  // File paths included
  exportedBy: ActorReference;
  downloadUrl: string;
  expiresAt: Timestamp;
}
```

## Architecture Layers

### Layer 1: Core Workspace (`core/sandbox/`)

```
core/sandbox/
├── workspace.ts        # Workspace aggregate & events
├── function.ts         # Function definitions
├── executor.ts         # Execution engine interface
├── git.ts              # Git operations (clone, pull, push)
├── files.ts            # File management (upload, download, list)
├── export.ts           # Export functionality
├── storage.ts          # Workspace storage interface
├── resources.ts        # Resource management
└── security.ts         # Security policies
```

**Key Components:**

1. **Workspace Store** - Manages workspace environments
2. **Function Registry** - Stores function definitions
3. **Execution Engine** - Abstract interface for runtime execution
4. **Git Manager** - Handles repository operations
5. **File Manager** - Handles file upload/download
6. **Export Service** - Creates exports (zip, tar, etc.)
7. **Resource Manager** - Tracks and limits resource usage
8. **Security Enforcer** - Validates permissions

### Layer 2: Runtime Implementations (`core/sandbox/runtimes/`)

```
core/sandbox/runtimes/
├── nodejs.ts           # Node.js sandbox
├── python.ts           # Python sandbox
├── deno.ts             # Deno sandbox
└── wasm.ts             # WebAssembly sandbox
```

Each runtime:
- Implements `ExecutionEngine` interface
- Provides isolation (VM, container, or process)
- Enforces resource limits
- Captures logs and metrics
- Reports security violations

### Layer 3: SDK Integration (`sdk/sandbox/`)

```
sdk/sandbox/
├── docker.ts           # Docker-based sandbox
├── firecracker.ts      # Firecracker micro-VM
└── kubernetes.ts       # Kubernetes jobs
```

External sandbox providers (optional, for production).

## Integration Points

### 1. Intent API Integration

Add new intents for full workspace operations:

```typescript
// ===== WORKSPACE MANAGEMENT =====

// Create workspace
{
  intent: 'create:workspace',
  payload: {
    name: string,
    runtime: 'Node.js' | 'Python' | 'Deno' | 'Multi',
    resources: {...},
  }
}

// ===== GIT OPERATIONS =====

// Clone repository
{
  intent: 'clone:repository',
  payload: {
    workspaceId: EntityId,
    url: string,
    branch?: string,
    credentials?: { username: string; token: string },
  }
}

// Pull repository
{
  intent: 'pull:repository',
  payload: {
    workspaceId: EntityId,
    repositoryId: EntityId,
    branch?: string,
  }
}

// Push to repository
{
  intent: 'push:repository',
  payload: {
    workspaceId: EntityId,
    repositoryId: EntityId,
    branch: string,
    message: string,
    credentials?: { username: string; token: string },
  }
}

// ===== FILE OPERATIONS =====

// Upload file
{
  intent: 'upload:file',
  payload: {
    workspaceId: EntityId,
    file: File | Uint8Array,
    filename: string,
    path: string,  // Destination path in workspace
  }
}

// Download file
{
  intent: 'download:file',
  payload: {
    workspaceId: EntityId,
    fileId: EntityId,
  }
}

// List files
{
  intent: 'list:files',
  payload: {
    workspaceId: EntityId,
    path?: string,  // Directory path
  }
}

// ===== EXPORT =====

// Export workspace
{
  intent: 'export:workspace',
  payload: {
    workspaceId: EntityId,
    format: 'zip' | 'tar' | 'json',
    include: {
      files?: boolean,
      repositories?: boolean,
      functions?: boolean,
      logs?: boolean,
    },
    paths?: string[],  // Specific paths to export
  }
}

// ===== EXECUTION =====

// Execute a function
{
  intent: 'execute:function',
  payload: {
    workspaceId: EntityId,
    functionId: EntityId,
    input: unknown,
  }
}

// Execute script/file
{
  intent: 'execute:script',
  payload: {
    workspaceId: EntityId,
    path: string,  // Path to script in workspace
    args?: string[],
    env?: Record<string, string>,
  }
}

// Register a function
{
  intent: 'register:function',
  payload: {
    workspaceId: EntityId,
    name: string,
    code: string,
    language: string,
    entryPoint: string,
  }
}
```

### 2. Agreement Integration

Execution agreements are regular agreements:

```typescript
// Create execution agreement
{
  intent: 'propose:agreement',
  payload: {
    type: 'Execution',
    parties: [...],
    terms: {
      functions: [functionId1, functionId2],
      sandboxId: sandboxId,
      executors: [partyId1, partyId2],
      resourceQuota: {...},
    }
  }
}
```

### 3. Workflow Integration

Functions can be workflow steps:

```typescript
const workflow = {
  steps: [
    {
      type: 'Function',
      functionId: 'func-123',
      input: { from: 'step1.output' },
    }
  ]
};
```

### 4. Asset Integration

Compute resources are assets:

```typescript
// Allocate compute resource
{
  intent: 'transfer:asset',
  payload: {
    assetType: 'ComputeResource',
    from: 'system',
    to: partyId,
    quantity: { amount: 100, unit: 'cpu-seconds' },
  }
}
```

## Security Model

### 1. Permission Check Flow

```
User Request → Intent API
  ↓
Check Execution Agreement
  ↓
Validate Function Access
  ↓
Check Resource Quota
  ↓
Enforce Sandbox Limits
  ↓
Execute in Isolated Runtime
  ↓
Record Execution Event
```

### 2. Isolation Levels

- **Realm Isolation** - Each realm has separate sandboxes
- **Function Isolation** - Each function runs in its own context
- **Resource Isolation** - CPU/memory limits per execution
- **Network Isolation** - Controlled network access
- **File System Isolation** - Restricted file access

### 3. Audit Trail

Every execution creates:
- `FunctionExecuted` event (immutable)
- Resource usage metrics
- Security logs
- Error traces (if any)

## Example Flows

### Flow 1: Clone Repo, Upload File, Execute, Export

```typescript
// 1. Create workspace
{
  intent: 'create:workspace',
  payload: {
    name: 'My Project',
    runtime: 'Node.js',
    resources: { cpuLimit: 2, memoryLimit: 4096, storageLimit: 10 }
  }
}
// Event: WorkspaceCreated

// 2. Clone repository
{
  intent: 'clone:repository',
  payload: {
    workspaceId: workspaceId,
    url: 'https://github.com/user/repo.git',
    branch: 'main',
    credentials: { username: 'user', token: 'ghp_...' }
  }
}
// Event: RepositoryCloned

// 3. Upload file
{
  intent: 'upload:file',
  payload: {
    workspaceId: workspaceId,
    file: fileData,
    filename: 'config.json',
    path: '/workspace/config.json'
  }
}
// Event: FileUploaded

// 4. Execute script from repo
{
  intent: 'execute:script',
  payload: {
    workspaceId: workspaceId,
    path: '/workspace/repo/scripts/process.js',
    args: ['--input', 'config.json']
  }
}
// Event: ScriptExecuted

// 5. Export results
{
  intent: 'export:workspace',
  payload: {
    workspaceId: workspaceId,
    format: 'zip',
    include: { files: true, logs: true },
    paths: ['/workspace/output/', '/workspace/logs/']
  }
}
// Event: WorkspaceExported
// Returns: Download URL (expires in 24h)
```

### Flow 2: Register Function, Execute, Push Results

```typescript
// 1. Register function
{
  intent: 'register:function',
  payload: {
    workspaceId: workspaceId,
    name: 'calculateTax',
    code: `function calculateTax(amount, rate) { return amount * rate; }`,
    language: 'javascript',
    entryPoint: 'calculateTax'
  }
}
// Event: FunctionRegistered

// 2. Create execution agreement
{
  intent: 'propose:agreement',
  payload: {
    type: 'Execution',
    parties: [accountantId, systemId],
    terms: {
      workspaceId: workspaceId,
      functions: [calculateTaxFunctionId],
      executors: [accountantId],
      resourceQuota: { cpuSeconds: 1000, memoryMB: 512 }
    }
  }
}
// Event: AgreementProposed → AgreementConsented

// 3. Execute function
{
  intent: 'execute:function',
  payload: {
    workspaceId: workspaceId,
    functionId: calculateTaxFunctionId,
    input: { amount: 1000, rate: 0.1 }
  }
}
// Event: FunctionExecuted

// 4. Push results to git
{
  intent: 'push:repository',
  payload: {
    workspaceId: workspaceId,
    repositoryId: repoId,
    branch: 'results',
    message: 'Add calculation results',
    credentials: { username: 'user', token: 'ghp_...' }
  }
}
// Event: RepositoryPushed
```

### Flow 3: Query Workspace History

```typescript
// Get all operations in workspace
{
  intent: 'query',
  target: 'Event',
  where: {
    aggregateType: 'Workspace',
    aggregateId: workspaceId
  },
  orderBy: '-timestamp'
}
// Returns: All events (clones, uploads, executions, exports, etc.)

// Get all exports
{
  intent: 'query',
  target: 'Event',
  where: {
    type: 'WorkspaceExported',
    workspaceId: workspaceId
  }
}
```

## Benefits of This Design

1. **Fully Auditable** - Every execution is an event
2. **Agreement-Based** - Access control via agreements
3. **Multi-Tenant** - Realm isolation built-in
4. **Resource Management** - Quotas as assets
5. **Intent-Driven** - Natural language execution
6. **Extensible** - Add new runtimes easily
7. **Secure** - Multiple isolation layers
8. **Traceable** - Full causal chain

## File Versioning & Auto-Save

### Event-Sourced File History

Every file operation creates an **immutable event** in the Event Store:

```
FileUploaded (v1) → FileModified (v2) → FileModified (v3) → FileDeleted (v4)
```

**Key Principles:**

1. **Auto-Save** - Every change creates a new event immediately
2. **Immutable Versions** - Each version is a separate event (can't be changed)
3. **Content-Addressed** - Files identified by hash (deduplication)
4. **Full History** - Query any version at any point in time
5. **Storage Separation** - Metadata in Event Store, content in Storage (S3)

### How It Works

```typescript
// User edits file → Auto-saved as event
{
  intent: 'modify:file',
  payload: {
    workspaceId: workspaceId,
    fileId: fileId,
    content: newContent,
  }
}

// Creates event:
{
  type: 'FileModified',
  fileId: fileId,
  previousVersionId: previousVersionId,  // Links to previous
  contentHash: sha256(newContent),
  storageLocation: 'sandbox/workspace-123/file-abc/v2',
  timestamp: Date.now(),
  modifiedBy: actor,
}

// Storage:
// - Event Store: Metadata, version chain, who/when
// - S3/Storage: Actual file content (content-addressed by hash)
```

### Querying File History

```typescript
// Get all versions of a file
{
  intent: 'query',
  target: 'Event',
  where: {
    aggregateType: 'File',
    aggregateId: fileId,
  },
  orderBy: 'timestamp'
}
// Returns: [FileUploaded, FileModified, FileModified, ...]

// Get file at specific time
{
  intent: 'query',
  target: 'Event',
  where: {
    aggregateType: 'File',
    aggregateId: fileId,
  },
  atTimestamp: specificTimestamp
}
// Returns: File version at that moment

// Get file diff between versions
{
  intent: 'get:file-diff',
  payload: {
    fileId: fileId,
    fromVersion: v2,
    toVersion: v5,
  }
}
```

### Benefits

- ✅ **Never lose data** - Every change is an event
- ✅ **Time travel** - See file at any point in time
- ✅ **Audit trail** - Who changed what, when
- ✅ **Deduplication** - Same content = same hash (storage efficient)
- ✅ **Realm isolation** - Each realm's files are separate
- ✅ **Agreement-controlled** - Who can modify files via agreements

## Storage Architecture

### Separation of Concerns

Storage is **separated** into two distinct layers:

#### 1. Document Storage (`core/attachments/`)
- **Purpose:** Business documents (contracts, PDFs, files)
- **Lifecycle:** Permanent, versioned
- **Access:** User-facing, agreement-controlled visibility
- **Interface:** `DocumentStore`
- **Backend:** Uses `StorageAdapter` (S3, GCS, Azure, etc.)
- **Path Pattern:** `documents/{realmId}/{documentId}/{version}`

#### 2. Sandbox Storage (`core/sandbox/storage/`)
- **Purpose:** Execution artifacts (function code, temp files, logs)
- **Lifecycle:** Ephemeral, execution-scoped
- **Access:** Internal, execution-scoped
- **Interface:** `SandboxStorage`
- **Backend:** Can share same `StorageAdapter`, but different namespace
- **Path Pattern:** `sandbox/{realmId}/{executionId}/{artifact}`

### Workspace Storage Interface

```typescript
interface WorkspaceStorage {
  // Function code storage
  storeFunction(functionId: EntityId, code: string): Promise<void>;
  getFunction(functionId: EntityId): Promise<string>;
  
  // File operations
  uploadFile(
    workspaceId: EntityId,
    path: string,
    content: Uint8Array | ReadableStream
  ): Promise<FileReference>;
  
  downloadFile(workspaceId: EntityId, path: string): Promise<Uint8Array>;
  
  listFiles(workspaceId: EntityId, path?: string): Promise<FileReference[]>;
  
  deleteFile(workspaceId: EntityId, path: string): Promise<void>;
  
  // Git repository storage
  storeRepository(
    workspaceId: EntityId,
    repositoryId: EntityId,
    path: string
  ): Promise<void>;
  
  getRepositoryPath(workspaceId: EntityId, repositoryId: EntityId): Promise<string>;
  
  // Execution artifacts (temporary)
  storeExecutionArtifact(
    executionId: EntityId,
    artifact: 'input' | 'output' | 'logs' | 'error',
    data: Uint8Array
  ): Promise<void>;
  
  getExecutionArtifact(
    executionId: EntityId,
    artifact: 'input' | 'output' | 'logs' | 'error'
  ): Promise<Uint8Array | null>;
  
  // Export
  createExport(
    workspaceId: EntityId,
    format: 'zip' | 'tar' | 'json',
    paths: string[]
  ): Promise<string>;  // Returns download URL
  
  // Cleanup (after retention period)
  cleanupExecution(executionId: EntityId): Promise<void>;
  cleanupWorkspace(workspaceId: EntityId): Promise<void>;
}
```

### Storage Backend Options

Both can use the same underlying storage, but with different configurations:

```typescript
// Document storage - permanent
const documentStorage = createS3Adapter({
  bucket: 'ledger-documents',
  pathPrefix: 'documents/',
  retention: 'permanent',
});

// Sandbox storage - ephemeral
const sandboxStorage = createS3Adapter({
  bucket: 'ledger-sandbox',  // Or same bucket
  pathPrefix: 'sandbox/',
  retention: '7days',  // Auto-delete after 7 days
  lifecycle: {
    transitionToGlacier: '30days',
    expiration: '90days',
  }
});
```

### Why Separate?

1. **Different Lifecycles**
   - Documents: Permanent, versioned, user-managed
   - Sandbox: Ephemeral, execution-scoped, auto-cleanup

2. **Different Access Patterns**
   - Documents: User queries, downloads, sharing
   - Sandbox: Internal execution, audit logs, debugging

3. **Different Security Models**
   - Documents: Agreement-based visibility, user permissions
   - Sandbox: Execution-scoped, realm-isolated, no user access

4. **Different Retention Policies**
   - Documents: Keep forever (or per agreement)
   - Sandbox: Keep for audit period, then archive/delete

5. **Different Costs**
   - Documents: Long-term storage, versioning
   - Sandbox: Temporary storage, can use cheaper tiers

### Unified Backend, Separate Namespaces

They can share the same physical storage backend (S3 bucket, etc.) but use different namespaces:

```
s3://ledger-storage/
├── documents/          # Document storage
│   ├── realm-123/
│   │   ├── doc-abc/
│   │   └── doc-def/
│   └── realm-456/
│
└── sandbox/            # Sandbox storage
    ├── realm-123/
    │   ├── exec-001/   # Auto-deleted after 7 days
    │   └── exec-002/
    └── realm-456/
```

This gives:
- ✅ **Separation** at the abstraction level
- ✅ **Flexibility** to use different backends
- ✅ **Cost optimization** (different retention policies)
- ✅ **Security isolation** (different access controls)

## Implementation Requirements

### What Already Exists (Reuse)

✅ **StorageAdapter** (`sdk/types.ts`) - Low-level storage interface
✅ **S3Adapter** (`sdk/s3.ts`) - S3-compatible storage implementation
✅ **Event Store** (`core/store/event-store.ts`) - Event persistence
✅ **Agreement System** (`core/universal/`) - Permission management
✅ **Intent API** (`core/api/intent-api.ts`) - Intent-driven interface

### What Needs to Be Built

#### Core Types (~200 lines)
- `workspace.ts` - Workspace aggregate, events
- `function.ts` - Function definitions
- `git.ts` - Git operation types

#### Storage Layer (~150 lines)
- `storage.ts` - WorkspaceStorage interface
- Implementation wrapping `StorageAdapter` with workspace paths

#### Git Integration (~300 lines)
- `git/manager.ts` - Git operations (clone, pull, push)
- Uses `simple-git` or `isomorphic-git` library
- Handles credentials, branches, commits

#### File Management (~200 lines)
- `files/manager.ts` - Upload, download, list files
- Uses `WorkspaceStorage` interface

#### Export Service (~200 lines)
- `export/service.ts` - Create zip/tar/json exports
- Uses `archiver` or similar library
- Generates signed download URLs

#### Execution Engine (~400 lines)
- `executor.ts` - Execution interface
- `runtimes/nodejs.ts` - Node.js runtime
- Uses `vm2` or `isolated-vm` for isolation

#### Intent Handlers (~300 lines)
- Integration with `core/api/intent-api.ts`
- Handlers for: create:workspace, clone:repository, upload:file, export:workspace, etc.

**Total New Code: ~1,750 lines**

### External Dependencies Needed

```json
{
  "dependencies": {
    "simple-git": "^3.0.0",        // Git operations
    "archiver": "^6.0.0",          // ZIP/TAR creation
    "vm2": "^3.9.0",               // Node.js sandboxing
    "isolated-vm": "^4.0.0"        // Alternative: better isolation
  }
}
```

## Implementation Priority

1. **Phase 1:** Core workspace types & events (~200 lines)
2. **Phase 2:** Workspace storage (wraps StorageAdapter) (~150 lines)
3. **Phase 3:** File management (upload/download/list) (~200 lines)
4. **Phase 4:** Git integration (clone/pull/push) (~300 lines)
5. **Phase 5:** Export service (zip/tar/json) (~200 lines)
6. **Phase 6:** Node.js execution engine (~400 lines)
7. **Phase 7:** Intent API integration (~300 lines)
8. **Phase 8:** Agreement-based permissions (reuse existing)
9. **Phase 9:** Resource management (~200 lines)
10. **Phase 10:** Additional runtimes (Python, etc.)

