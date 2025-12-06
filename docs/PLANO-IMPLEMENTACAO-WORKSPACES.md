# 🏗️ Plano de Implementação Backend - Workspaces

**Baseado na Filosofia UBL:** Agreement-Based, Event-Sourced, Intent-Driven, ABAC  
**Priorizado por:** Análise Arquitetural (Estrutural → Extensível → Específico)

---

## 📋 Princípios Fundamentais do UBL

1. **Agreement-Based**: Tudo é estabelecido via Agreements
2. **Event Sourcing**: Toda mudança gera eventos imutáveis
3. **Intent-Driven**: Tudo via intents, não endpoints fixos
4. **Asset-Based**: Workspaces são Assets
5. **ABAC**: Permissões via Agreements, não RBAC estático
6. **Realm Isolation**: Cada realm é isolado

---

## 🎯 PRIORIDADE 1: ESTRUTURAL (Core - Alta Prioridade)

**O que é:** Funcionalidades universais que deveriam estar no core do UBL  
**Por quê:** Sandbox/Workspace já está arquitetado no core, falta implementar  
**Impacto:** Qualquer app que use workspace precisa disso

---

### **1.1. AGREEMENT TYPES - Padrões Universais**

#### **`workspace-membership` Agreement Type**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA** (Estrutural)  
**Por quê:** Padrão universal de controle de acesso a recursos

```typescript
// core/universal/agreement-types.ts

export const WORKSPACE_MEMBERSHIP_TYPE: AgreementTypeDefinition = {
  id: 'workspace-membership',
  name: 'Workspace Membership',
  description: 'Grants access to a workspace',
  version: 1,
  
  requiredParticipants: [
    {
      role: 'WorkspaceOwner',
      minCount: 1,
      maxCount: 1,
      allowedEntityTypes: ['Person', 'Organization'],
      requiresConsent: false,
    },
    {
      role: 'Member',
      minCount: 1,
      maxCount: null,
      allowedEntityTypes: ['Person', 'Organization'],
      requiresConsent: true,
    }
  ],
  
  grantsRoles: [
    {
      participantRole: 'WorkspaceOwner',
      roleType: 'WorkspaceOwner',
      scope: { type: 'Asset', assetId: '<workspace-asset-id>' },
      validity: 'agreement',
      permissions: [
        { action: '*', resource: 'Workspace:*' },
        { action: 'manage', resource: 'Workspace:Members' },
        { action: 'delete', resource: 'Workspace:*' },
        { action: 'configure', resource: 'Workspace:*' },
      ],
      delegatable: true,
    },
    {
      participantRole: 'Member',
      roleType: 'WorkspaceMember',
      scope: { type: 'Asset', assetId: '<workspace-asset-id>' },
      validity: 'agreement',
      permissions: [
        { action: 'read', resource: 'Workspace:*' },
        { action: 'edit', resource: 'Workspace:Content' },
        { action: 'create', resource: 'Workspace:Resource' },
        { action: 'execute', resource: 'Workspace:Function' },
      ],
      delegatable: false,
    }
  ],
  
  requiredTerms: [
    {
      name: 'workspaceAssetId',
      type: 'EntityId',
      description: 'ID do workspace asset',
      required: true,
    }
  ]
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/universal/agreement-types.ts`
- Registrar no `AgreementTypeRegistry`

---

#### **`workspace-execution` Agreement Type**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA** (Estrutural)  
**Por quê:** Padrão universal de controle de execução de código

```typescript
export const WORKSPACE_EXECUTION_TYPE: AgreementTypeDefinition = {
  id: 'workspace-execution',
  name: 'Workspace Execution Agreement',
  description: 'Grants permission to execute code in a workspace',
  version: 1,
  
  requiredParticipants: [
    {
      role: 'WorkspaceOwner',
      minCount: 1,
      allowedEntityTypes: ['Person', 'Organization'],
    },
    {
      role: 'Executor',
      minCount: 1,
      allowedEntityTypes: ['Person', 'Organization', 'System'],
      requiresConsent: true,
    }
  ],
  
  grantsRoles: [
    {
      participantRole: 'Executor',
      roleType: 'WorkspaceExecutor',
      scope: { type: 'Asset', assetId: '<workspace-asset-id>' },
      validity: 'agreement',
      permissions: [
        { action: 'execute', resource: 'Workspace:Function:*' },
        { action: 'execute', resource: 'Workspace:Script:*' },
      ],
      delegatable: false,
    }
  ],
  
  requiredTerms: [
    {
      name: 'workspaceAssetId',
      type: 'EntityId',
      required: true,
    },
    {
      name: 'resourceQuota',
      type: 'object',
      required: true,
      properties: {
        cpuSeconds: { type: 'number' },
        memoryMB: { type: 'number' },
        maxExecutionsPerDay: { type: 'number' },
      }
    }
  ]
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/universal/agreement-types.ts`

---

### **1.2. INTENTS GENÉRICOS - Workspace Operations**

**Status:** ⚠️ Arquitetados, não implementados  
**Prioridade:** 🔴 **ALTA** (Estrutural)  
**Por quê:** Operações universais de workspace, qualquer app precisa

#### **1.2.1. File Operations Intents**

##### **`upload:file` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
// core/api/intent-handlers/workspace-intents.ts

export interface UploadFileIntent {
  workspaceId: EntityId;
  file: Uint8Array | string;
  filename: string;
  path: string;
}

async function handleUploadFile(intent: Intent<UploadFileIntent>, context: HandlerContext) {
  // 1. Verificar permissão via ABAC
  const auth = await context.authorization.authorize({
    actor: intent.actor,
    action: { type: 'create', resource: 'Workspace:File' },
    resource: { type: 'Workspace', id: intent.payload.workspaceId },
    context: { realm: intent.realm }
  });
  
  // 2. Criar File asset
  const fileId = generateId();
  const contentHash = await hashContent(intent.payload.file);
  
  // 3. Armazenar
  const storageLocation = await context.storage.store({
    workspaceId: intent.payload.workspaceId,
    fileId,
    version: 1,
    content: intent.payload.file,
    hash: contentHash,
  });
  
  // 4. Criar evento FileUploaded
  const event = await context.eventStore.append({
    type: 'FileUploaded',
    aggregateType: 'File',
    aggregateId: fileId,
    payload: {
      workspaceId: intent.payload.workspaceId,
      fileId,
      filename: intent.payload.filename,
      path: intent.payload.path,
      sizeBytes: intent.payload.file.length,
      contentHash,
      storageLocation,
      uploadedBy: intent.actor,
    }
  });
  
  return {
    success: true,
    outcome: { type: 'Created', entity: { id: fileId, filename: intent.payload.filename }, id: fileId },
    events: [event],
    affordances: [
      { intent: 'modify:file', description: 'Edit this file', required: ['workspaceId', 'fileId'] },
      { intent: 'execute:script', description: 'Execute this file', required: ['workspaceId', 'path'] },
    ]
  };
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts` (criar)

---

##### **`download:file` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
export interface DownloadFileIntent {
  workspaceId: EntityId;
  fileId: EntityId;
  version?: number;
}

async function handleDownloadFile(intent: Intent<DownloadFileIntent>, context: HandlerContext) {
  // 1. Verificar permissão
  // 2. Obter versão do arquivo
  // 3. Carregar conteúdo do storage
  // 4. Retornar conteúdo ou URL assinada
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

##### **`list:files` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
export interface ListFilesIntent {
  workspaceId: EntityId;
  path?: string;
}

async function handleListFiles(intent: Intent<ListFilesIntent>, context: HandlerContext) {
  // 1. Verificar permissão
  // 2. Query eventos FileUploaded e FileModified
  // 3. Construir árvore de arquivos
  // 4. Retornar lista
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

##### **`modify:file` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
export interface ModifyFileIntent {
  workspaceId: EntityId;
  fileId: EntityId;
  content: Uint8Array | string;
  previousVersionId?: EntityId;
}

async function handleModifyFile(intent: Intent<ModifyFileIntent>, context: HandlerContext) {
  // 1. Verificar permissão via ABAC
  // 2. Obter versão anterior
  // 3. Calcular hash do novo conteúdo
  // 4. Armazenar conteúdo
  // 5. Criar evento FileModified
  // 6. Retornar nova versão
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

##### **`delete:file` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
export interface DeleteFileIntent {
  workspaceId: EntityId;
  fileId: EntityId;
}

async function handleDeleteFile(intent: Intent<DeleteFileIntent>, context: HandlerContext) {
  // 1. Verificar permissão
  // 2. Criar evento FileDeleted
  // 3. Marcar como deletado (não remover do storage para auditoria)
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

#### **1.2.2. Workspace Management Intent**

##### **`register-asset` (Workspace Support)**

**Status:** ⚠️ Existe, mas não suporta Workspace completamente  
**Prioridade:** 🔴 **ALTA**

**O que adicionar:**
- Validar que `assetType: 'Workspace'` cria workspace asset corretamente
- Criar evento `WorkspaceCreated`
- Estabelecer Agreement de ownership automaticamente

```typescript
// core/api/intent-handlers/asset-intents.ts

async function handleRegisterAsset(intent: Intent<RegisterAssetIntent>, context: HandlerContext) {
  if (intent.payload.assetType === 'Workspace') {
    // Criar workspace asset
    const workspaceAsset = await createWorkspaceAsset(intent.payload, context);
    
    // Criar Agreement de ownership automaticamente
    const ownershipAgreement = await proposeAgreement({
      type: 'workspace-membership',
      parties: [
        { entityId: intent.actor.entityId, role: 'WorkspaceOwner' },
        { entityId: workspaceAsset.id, role: 'Workspace' }
      ],
      terms: { workspaceAssetId: workspaceAsset.id }
    });
    
    // Evento
    await recordEvent({
      type: 'WorkspaceCreated',
      aggregateId: workspaceAsset.id,
      payload: {
        workspaceId: workspaceAsset.id,
        name: intent.payload.identity.name,
        runtime: intent.payload.identity.attributes.runtime,
        createdBy: intent.actor,
      }
    });
    
    return {
      success: true,
      outcome: { type: 'Created', entity: workspaceAsset, id: workspaceAsset.id },
      events: [/* ... */],
      affordances: [
        { intent: 'clone:repository', description: 'Clone a git repository', required: ['workspaceId', 'url'] },
        { intent: 'upload:file', description: 'Upload a file', required: ['workspaceId', 'file', 'path'] },
      ]
    };
  }
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/asset-intents.ts` (criar se não existir)

---

#### **1.2.3. Code Execution Intents**

##### **`register:function` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
export interface RegisterFunctionIntent {
  workspaceId: EntityId;
  name: string;
  code: string;
  language: 'javascript' | 'python' | 'typescript';
  entryPoint: string;
}

async function handleRegisterFunction(intent: Intent<RegisterFunctionIntent>, context: HandlerContext) {
  // 1. Verificar permissão
  // 2. Criar Function asset
  // 3. Armazenar código
  // 4. Criar evento FunctionRegistered
  // 5. Atualizar workspace asset
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

##### **`execute:function` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

```typescript
export interface ExecuteFunctionIntent {
  workspaceId: EntityId;
  functionId: EntityId;
  input: unknown;
}

async function handleExecuteFunction(intent: Intent<ExecuteFunctionIntent>, context: HandlerContext) {
  // 1. Verificar permissão via Agreement
  // 2. Verificar quota de recursos
  // 3. Obter função
  // 4. Executar em sandbox (via runtime plugin)
  // 5. Criar evento FunctionExecuted
  // 6. Atualizar uso de recursos
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

##### **`execute:script` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🔴 **ALTA**

Similar a `execute:function`, mas executa arquivo diretamente.

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

### **1.3. WORKSPACE STORAGE INTERFACE**

**Status:** ⚠️ Storage existe, mas precisa interface específica para workspace  
**Prioridade:** 🔴 **ALTA** (Estrutural)

```typescript
// core/sandbox/storage.ts

export interface WorkspaceStorage {
  // File operations
  storeFile(workspaceId: EntityId, fileId: EntityId, version: number, content: Uint8Array, hash: string): Promise<string>;
  loadFile(storageLocation: string): Promise<Uint8Array>;
  
  // Function storage
  storeFunction(workspaceId: EntityId, functionId: EntityId, code: string): Promise<void>;
  loadFunction(workspaceId: EntityId, functionId: EntityId): Promise<string>;
  
  // Repository storage
  getRepositoryPath(workspaceId: EntityId, repositoryId: EntityId): Promise<string>;
  
  // Export
  createExport(workspaceId: EntityId, format: string, files: string[]): Promise<string>; // Retorna URL
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/sandbox/storage.ts` (estender interface existente)

---

### **1.4. AUTHORIZATION - ABAC para Workspaces**

**Status:** ⚠️ ABAC existe, mas precisa suportar workspace-specific permissions  
**Prioridade:** 🔴 **ALTA** (Estrutural)

```typescript
// core/security/authorization.ts

// Adicionar suporte a escopo Asset (workspace)
function isScopeValid(scope: RoleScope, resource: Resource, context: AuthorizationContext): boolean {
  if (scope.type === 'Asset') {
    return resource.type === 'Workspace' && resource.id === scope.assetId;
  }
  // ... outros tipos de escopo
}

// Adicionar recursos específicos de workspace
export const WORKSPACE_RESOURCES = {
  'Workspace:*': 'All workspace operations',
  'Workspace:Content': 'Workspace content (files)',
  'Workspace:Members': 'Workspace membership',
  'Workspace:Function': 'Workspace functions',
  'Workspace:Git': 'Git operations',
  'Workspace:File': 'File operations',
} as const;
```

**Onde implementar:**
- `Universal-Business-Ledger/core/security/authorization.ts` (estender)

---

### **1.5. EVENT TYPES - Registrar Eventos**

**Status:** ⚠️ Eventos definidos, mas não registrados  
**Prioridade:** 🔴 **ALTA** (Estrutural)

**Eventos necessários:**
1. ✅ `WorkspaceCreated` - Já definido
2. ✅ `FileUploaded` - Já definido
3. ✅ `FileModified` - Já definido
4. ✅ `FileDeleted` - Já definido
5. ✅ `RepositoryCloned` - Já definido
6. ✅ `RepositoryPulled` - Já definido
7. ✅ `RepositoryPushed` - Já definido
8. ✅ `FunctionExecuted` - Já definido
9. ✅ `FunctionRegistered` - Implementado em `workspace-intents.ts`
10. ✅ `WorkspaceExported` - Já definido

**O que fazer:**
- Registrar eventos no `EventTypeRegistry`
- Criar handlers de eventos para atualizar projections

**Onde implementar:**
- `Universal-Business-Ledger/core/store/event-store.ts` (registrar tipos)
- `Universal-Business-Ledger/core/store/projections.ts` (criar projections se necessário)

---

### **1.6. INTENT REGISTRY - Registrar Intents**

**Status:** ❌ Intents não estão registrados  
**Prioridade:** 🔴 **ALTA** (Estrutural)

```typescript
// antenna/server.ts ou core/api/intent-registry.ts

const workspaceIntents = [
  // File operations
  { name: 'upload:file', handler: handleUploadFile, schema: uploadFileSchema },
  { name: 'download:file', handler: handleDownloadFile, schema: downloadFileSchema },
  { name: 'list:files', handler: handleListFiles, schema: listFilesSchema },
  { name: 'modify:file', handler: handleModifyFile, schema: modifyFileSchema },
  { name: 'delete:file', handler: handleDeleteFile, schema: deleteFileSchema },
  
  // Execution
  { name: 'register:function', handler: handleRegisterFunction, schema: registerFunctionSchema },
  { name: 'execute:function', handler: handleExecuteFunction, schema: executeFunctionSchema },
  { name: 'execute:script', handler: handleExecuteScript, schema: executeScriptSchema },
];

workspaceIntents.forEach(intent => {
  intentRegistry.register(intent.name, {
    name: intent.name,
    handler: intent.handler,
    schema: intent.schema,
  });
});
```

**Onde implementar:**
- `Universal-Business-Ledger/antenna/server.ts` (no startup)

---

## 🎯 PRIORIDADE 2: EXTENSÍVEL (Plugins/Adapters - Média Prioridade)

**O que é:** Implementações específicas que podem ser plugins/adapters  
**Por quê:** Não são universais, apps podem escolher quais usar  
**Impacto:** Funcionalidades opcionais que melhoram a experiência

---

### **2.1. GIT OPERATIONS - Como Adapter**

**Status:** ❌ Não existe  
**Prioridade:** 🟡 **MÉDIA** (Extensível)  
**Por quê:** Git é tecnologia específica, pode ser adapter

#### **`clone:repository` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🟡 **MÉDIA**

```typescript
export interface CloneRepositoryIntent {
  workspaceId: EntityId;
  url: string;
  branch?: string;
  credentials?: { username: string; token: string };
}

async function handleCloneRepository(intent: Intent<CloneRepositoryIntent>, context: HandlerContext) {
  // 1. Verificar permissão
  // 2. Usar GitAdapter para clonar
  const gitAdapter = context.adapters.get('Git');
  const commit = await gitAdapter.clone({
    url: intent.payload.url,
    branch: intent.payload.branch || 'main',
    workspaceId: intent.payload.workspaceId,
    credentials: intent.payload.credentials,
  });
  
  // 3. Criar evento RepositoryCloned
  // 4. Atualizar workspace asset
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`
- Integrar com `core/adapters/git/` (criar adapter)

---

#### **Git Adapter Implementation**

```typescript
// core/adapters/git/simple-git.ts

import simpleGit from 'simple-git';
import type { GitAdapter } from './types';

export function createSimpleGitAdapter(): GitAdapter {
  return {
    name: 'simple-git',
    platform: 'Local',
    async clone(options) {
      const git = simpleGit();
      const path = await getRepositoryPath(options.workspaceId, options.repositoryId);
      await git.clone(options.url, path, {
        '--branch': options.branch || 'main',
      });
      return await git.revparse(['HEAD']);
    },
    // ... outros métodos
  };
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/adapters/git/simple-git.ts` (criar)
- `Universal-Business-Ledger/core/adapters/git/types.ts` (criar interface)

---

#### **`pull:repository` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🟡 **MÉDIA**

```typescript
export interface PullRepositoryIntent {
  workspaceId: EntityId;
  repositoryId: EntityId;
  branch?: string;
}

async function handlePullRepository(intent: Intent<PullRepositoryIntent>, context: HandlerContext) {
  // Usar GitAdapter
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

#### **`push:repository` Intent**

**Status:** ❌ Não existe  
**Prioridade:** 🟡 **MÉDIA**

```typescript
export interface PushRepositoryIntent {
  workspaceId: EntityId;
  repositoryId: EntityId;
  branch: string;
  message: string;
  credentials?: { username: string; token: string };
}

async function handlePushRepository(intent: Intent<PushRepositoryIntent>, context: HandlerContext) {
  // Usar GitAdapter
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`

---

### **2.2. RUNTIME IMPLEMENTATIONS - Como Plugins**

**Status:** ⚠️ Arquitetura definida, implementação parcial  
**Prioridade:** 🟡 **MÉDIA** (Extensível)  
**Por quê:** Runtimes específicos podem ser plugins

#### **Runtime Plugin Interface**

```typescript
// core/sandbox/runtimes/registry.ts

export interface RuntimePlugin {
  name: string;
  runtime: WorkspaceRuntime;
  execute: (request: ExecutionRequest) => Promise<ExecutionResult>;
}

export class RuntimeRegistry {
  private plugins: Map<string, RuntimePlugin> = new Map();
  
  register(plugin: RuntimePlugin) {
    this.plugins.set(plugin.runtime, plugin);
  }
  
  get(runtime: WorkspaceRuntime): RuntimePlugin | null {
    return this.plugins.get(runtime) || null;
  }
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/sandbox/runtimes/registry.ts` (criar)

---

#### **Node.js Runtime Plugin**

```typescript
// core/sandbox/runtimes/nodejs.ts

import { VM } from 'vm2'; // ou isolated-vm

export function createNodeJSRuntime(): RuntimePlugin {
  return {
    name: 'Node.js',
    runtime: 'Node.js',
    async execute(request: ExecutionRequest): Promise<ExecutionResult> {
      const vm = new VM({
        timeout: request.resources.timeoutMs,
        memoryLimit: request.resources.memoryLimit * 1024 * 1024,
        sandbox: {}
      });
      
      try {
        const output = vm.run(request.code);
        return {
          success: true,
          output,
          resources: { /* medir */ },
          logs: [],
        };
      } catch (error) {
        return {
          success: false,
          error: { message: error.message, stack: error.stack },
          resources: { /* ... */ },
          logs: [],
        };
      }
    }
  };
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/sandbox/runtimes/nodejs.ts`

**Dependências:**
- `vm2` ou `isolated-vm` (npm package)

---

#### **Python Runtime Plugin**

```typescript
// core/sandbox/runtimes/python.ts

export function createPythonRuntime(): RuntimePlugin {
  return {
    name: 'Python',
    runtime: 'Python',
    async execute(request: ExecutionRequest): Promise<ExecutionResult> {
      // Executar Python em container/subprocess isolado
      // Medir recursos
      // Capturar output/logs
    }
  };
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/sandbox/runtimes/python.ts`

---

### **2.3. EXPORT INTENT**

**Status:** ❌ Não existe  
**Prioridade:** 🟡 **MÉDIA** (Extensível)

```typescript
export interface ExportWorkspaceIntent {
  workspaceId: EntityId;
  format: 'zip' | 'tar' | 'json';
  include: {
    files?: boolean;
    repositories?: boolean;
    functions?: boolean;
    logs?: boolean;
  };
  paths?: string[];
}

async function handleExportWorkspace(intent: Intent<ExportWorkspaceIntent>, context: HandlerContext) {
  // 1. Verificar permissão
  // 2. Coletar arquivos/funções conforme include
  // 3. Criar arquivo export (zip/tar/json)
  // 4. Upload para storage (S3)
  // 5. Gerar URL assinada (expira em 24h)
  // 6. Criar evento WorkspaceExported
  // 7. Retornar URL
}
```

**Onde implementar:**
- `Universal-Business-Ledger/core/api/intent-handlers/workspace-intents.ts`
- Integrar com `core/sandbox/export.ts` (criar se não existir)

**Dependências:**
- `archiver` (npm package para zip/tar)

---

## 🎯 PRIORIDADE 3: OTIMIZAÇÕES (Baixa Prioridade)

**O que é:** Melhorias de performance e otimizações  
**Por quê:** Não são críticas para funcionamento básico  
**Impacto:** Melhor experiência, mas não bloqueia funcionalidade

---

### **3.1. PROJECTIONS - Workspace State**

**Status:** ✅ **COMPLETO** - Workspace projection implementada  
**Prioridade:** 🟢 **BAIXA** (Otimização) ✅

```sql
-- core/store/postgres-schema.sql

CREATE TABLE workspace_projection (
  id UUID PRIMARY KEY,
  realm_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  runtime TEXT NOT NULL,
  resources JSONB NOT NULL,
  status TEXT NOT NULL,
  version BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  created_by JSONB NOT NULL,
  last_activity_at BIGINT NOT NULL,
  repositories JSONB DEFAULT '[]'::jsonb,
  files JSONB DEFAULT '[]'::jsonb,
  functions UUID[] DEFAULT ARRAY[]::UUID[],
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_workspace_projection_realm ON workspace_projection(realm_id);
CREATE INDEX idx_workspace_projection_status ON workspace_projection(status);
```

**Implementado:**
- ✅ Tabela `workspace_projection` criada em `core/store/postgres-schema.sql`
- ✅ Handler de projection implementado em `core/store/workspace-projection.ts`
- ✅ Checkpoint inicializado em `projection_checkpoints`
- ✅ Suporta eventos: `WorkspaceCreated`, `FileUploaded`, `FileModified`, `FileDeleted`, `FunctionRegistered`, `FunctionExecuted`
- ✅ Métodos de query: `getWorkspace()`, `getWorkspacesByRealm()`
- ✅ Rebuild completo: `rebuild()`
- ✅ Processamento incremental: `processNewEvents()`

---

## 📊 Resumo de Prioridades

### **🔴 ALTA PRIORIDADE (Estrutural - Core)**

1. ✅ **Agreement Types**
   - `workspace-membership`
   - `workspace-execution`

2. ✅ **Intents Básicos**
   - `register-asset` (suportar Workspace)
   - `upload:file`
   - `download:file`
   - `list:files`
   - `modify:file`
   - `delete:file`

3. ✅ **Execution Intents**
   - `register:function`
   - `execute:function`
   - `execute:script`

4. ✅ **Storage Interface**
   - WorkspaceStorage interface

5. ✅ **Authorization**
   - ✅ ABAC para workspace-specific permissions (recursos definidos: Workspace:*, Workspace:Content, Workspace:Members, Workspace:Function)

6. ✅ **Event Types**
   - Registrar eventos Workspace*

7. ✅ **Intent Registry**
   - Registrar todos os intents

### **🟡 MÉDIA PRIORIDADE (Extensível - Plugins/Adapters)**

8. ❌ **Git Operations** (Não implementado)
   - ❌ `clone:repository`
   - ❌ `pull:repository`
   - ❌ `push:repository`
   - ❌ Git Adapter implementation

9. ⚠️ **Runtime Plugins** (Parcial)
   - ✅ Runtime Registry
   - ✅ Node.js Runtime
   - ❌ Python Runtime

10. ❌ **Export** (Não implementado)
    - ❌ `export:workspace`

### **🟢 BAIXA PRIORIDADE (Otimizações)**

11. ✅ **Projections** (Implementado)
    - ✅ Workspace projection para performance

---

## 🎯 Checklist de Implementação por Prioridade

### **Fase 1: Fundação (Alta Prioridade - Estrutural)**

- [x] Criar `workspace-membership` Agreement Type ✅
- [x] Criar `workspace-execution` Agreement Type ✅
- [x] Estender `register-asset` para suportar Workspace ✅
- [x] Criar eventos Workspace* no EventStore ✅ (WorkspaceCreated, FileUploaded, FileModified, FileDeleted, FunctionRegistered, FunctionExecuted)
- [x] Implementar `upload:file` intent ✅
- [x] Implementar `download:file` intent ✅
- [x] Implementar `list:files` intent ✅
- [x] Implementar `modify:file` intent ✅
- [x] Implementar `delete:file` intent ✅
- [x] Criar WorkspaceStorage interface ✅
- [x] Estender ABAC para workspace permissions ✅ (recursos definidos: Workspace:*, Workspace:Content, Workspace:Members, Workspace:Function, Workspace:File, Workspace:Script)
- [x] Registrar eventos no EventStore ✅ (usados nos handlers)
- [x] Registrar intents no IntentRegistry ✅ (BUILT_IN_INTENTS)

### **Fase 2: Execution (Alta Prioridade - Estrutural)**

- [x] Implementar `register:function` intent ✅
- [x] Implementar `execute:function` intent ✅
- [x] Implementar `execute:script` intent ✅
- [x] Criar Runtime Registry (interface) ✅
- [x] Criar Node.js Runtime Plugin ✅

### **Fase 3: Git Operations (Média Prioridade - Extensível)**

- [x] Criar Git Adapter interface ✅
- [x] Implementar SimpleGit adapter ✅
- [x] Implementar `clone:repository` intent ✅
- [x] Implementar `pull:repository` intent ✅
- [x] Implementar `push:repository` intent ✅

### **Fase 4: Extensões (Média Prioridade - Extensível)**

- [ ] Criar Python Runtime Plugin
- [ ] Implementar `export:workspace` intent
- [ ] Criar outros runtime plugins conforme necessário

### **Fase 5: Otimizações (Baixa Prioridade)**

- [x] Criar workspace projection ✅
  - [x] Tabela `workspace_projection` no schema SQL ✅
  - [x] Handler `WorkspaceProjection` em `core/store/workspace-projection.ts` ✅
  - [x] Suporte a eventos: WorkspaceCreated, FileUploaded, FileModified, FileDeleted, FunctionRegistered, FunctionExecuted ✅
  - [x] Métodos de query: `getWorkspace()`, `getWorkspacesByRealm()` ✅
  - [x] Rebuild completo: `rebuild()` ✅
  - [x] Processamento incremental: `processNewEvents()` ✅
  - [x] ProjectionManager criado e integrado no server ✅
  - [x] Inicialização automática quando PostgreSQL está disponível ✅
- [ ] Otimizações de performance (futuro)
- [ ] Testes completos (futuro)

---

## 📝 Notas Importantes

### **Filosofia de Extensibilidade**

O UBL já tem sistema de **Adapters** (`core/adapters/`) que permite:
- ✅ Adicionar funcionalidades sem modificar core
- ✅ Apps escolherem quais adapters usar
- ✅ Manter core limpo e universal

**Exemplo:**
- Core define interface `GitAdapter`
- Apps podem registrar: `simple-git`, `github-api`, `gitlab-api`
- Intents usam adapter registrado

### **O que NÃO fazer**

- ❌ Intents muito específicos (ex: `create:blog-post`)
- ❌ Lógica de negócio específica de app
- ❌ UI/UX específicos

### **Padrão de Implementação**

1. **Core define interface/abstração**
2. **Adapters/Plugins implementam**
3. **Intents usam abstração**
4. **Apps registram adapters que precisam**

---

**Última atualização:** 2024-12-19  
**Priorização baseada em:** Análise Arquitetural (Estrutural → Extensível → Otimizações)
