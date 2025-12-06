/**
 * INTENT-DRIVEN API
 * 
 * A universal API that responds to intent, not fixed endpoints.
 * 
 * Instead of:
 *   POST /employees
 *   POST /sales
 *   PUT /orders/:id/status
 * 
 * We have:
 *   POST /intent { intent: "employ", ... }
 *   POST /intent { intent: "sell", ... }
 *   POST /intent { intent: "transition", ... }
 * 
 * The system understands what you want to achieve and routes
 * to the appropriate agreement type, workflow, and validation.
 */

import type { EntityId, Timestamp, ActorReference } from '../schema/ledger';
import type { 
  Entity, 
  Agreement, 
  Asset, 
  Role,
  AgreementParticipant,
  Terms,
  Validity,
  Quantity,
} from '../universal/primitives';

// ============================================================================
// THE UNIVERSAL REQUEST
// ============================================================================

/**
 * Every API call is an Intent.
 * An Intent expresses what you want to achieve, not how to achieve it.
 */
export interface Intent<T = unknown> {
  /** What do you want to do? */
  readonly intent: string;
  
  /** In which realm? */
  readonly realm: EntityId;
  
  /** Who is making this intent? */
  readonly actor: ActorReference;
  
  /** When was this intent expressed? (for offline-first) */
  readonly timestamp?: Timestamp;
  
  /** Intent-specific payload */
  readonly payload: T;
  
  /** Idempotency key */
  readonly idempotencyKey?: string;
  
  /** Expected outcomes (for validation) */
  readonly expects?: ExpectedOutcome[];
}

export interface ExpectedOutcome {
  readonly type: 'AgreementCreated' | 'RoleGranted' | 'AssetTransferred' | 'StateChanged';
  readonly conditions?: Record<string, unknown>;
}

// ============================================================================
// THE UNIVERSAL RESPONSE
// ============================================================================

export interface IntentResult<T = unknown> {
  /** Did the intent succeed? */
  readonly success: boolean;
  
  /** What happened? */
  readonly outcome: Outcome<T>;
  
  /** Events that were recorded */
  readonly events: readonly EventReference[];
  
  /** What can you do next? */
  readonly affordances: readonly Affordance[];
  
  /** If failed, why? */
  readonly errors?: readonly IntentError[];
  
  /** Processing metadata */
  readonly meta: {
    readonly processedAt: Timestamp;
    readonly processingTime: number;
    readonly idempotencyKey?: string;
  };
}

export type Outcome<T = unknown> = 
  | { readonly type: 'Created'; readonly entity: T; readonly id: EntityId }
  | { readonly type: 'Updated'; readonly entity: T; readonly changes: string[] }
  | { readonly type: 'Transitioned'; readonly from: string; readonly to: string }
  | { readonly type: 'Transferred'; readonly asset: EntityId; readonly to: EntityId }
  | { readonly type: 'Consented'; readonly agreement: EntityId; readonly party: EntityId }
  | { readonly type: 'Fulfilled'; readonly obligation: string }
  | { readonly type: 'Queried'; readonly results: T }
  | { readonly type: 'Nothing'; readonly reason: string };

export interface EventReference {
  readonly id: EntityId;
  readonly type: string;
  readonly sequence: bigint;
}

/**
 * Affordances tell the client what they CAN do next.
 * This is HATEOAS on steroids - driven by workflow state.
 */
export interface Affordance {
  readonly intent: string;
  readonly description: string;
  readonly required: readonly string[];
  readonly optional?: readonly string[];
  readonly constraints?: Record<string, unknown>;
}

export interface IntentError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
  readonly suggestion?: string;
}

// ============================================================================
// INTENT TYPES
// ============================================================================

/**
 * All the intents the system understands.
 * These are verbs, not nouns. Actions, not resources.
 */

// --- ENTITY INTENTS ---

export interface RegisterEntityIntent {
  readonly entityType: string;
  readonly identity: {
    readonly name: string;
    readonly identifiers?: readonly { scheme: string; value: string }[];
    readonly contacts?: readonly { type: string; value: string }[];
    readonly attributes?: Record<string, unknown>;
  };
  readonly establishedBy?: EntityId; // Agreement that creates this entity
  readonly meta?: Record<string, unknown>;
}

// --- AGREEMENT INTENTS ---

export interface ProposeAgreementIntent {
  readonly agreementType: string;
  readonly parties: readonly {
    readonly entityId: EntityId;
    readonly role: string;
    readonly obligations?: readonly { id: string; description: string }[];
    readonly rights?: readonly { id: string; description: string }[];
  }[];
  readonly terms: {
    readonly description: string;
    readonly clauses?: readonly { id: string; type: string; content: string }[];
    readonly consideration?: {
      readonly description: string;
      readonly value?: { amount: number; currency: string };
    };
  };
  readonly assets?: readonly { assetId: EntityId; role: string }[];
  readonly validity?: {
    readonly effectiveFrom?: Timestamp;
    readonly effectiveUntil?: Timestamp;
  };
  readonly parentAgreementId?: EntityId;
}

export interface GiveConsentIntent {
  readonly agreementId: EntityId;
  readonly method: string; // 'Digital', 'Signature', 'Verbal', 'Click'
  readonly evidence?: string;
}

export interface FulfillObligationIntent {
  readonly agreementId: EntityId;
  readonly obligationId: string;
  readonly evidence?: string;
}

export interface TerminateAgreementIntent {
  readonly agreementId: EntityId;
  readonly reason: string;
}

// --- ASSET INTENTS ---

export interface RegisterAssetIntent {
  readonly assetType: string;
  readonly ownerId?: EntityId;
  readonly properties: Record<string, unknown>;
  readonly quantity?: { amount: number; unit: string };
  readonly establishedBy?: EntityId;
}

export interface TransferAssetIntent {
  readonly assetId: EntityId;
  readonly toEntityId: EntityId;
  readonly transferType: 'Ownership' | 'Custody';
  readonly agreementId: EntityId; // Must have a governing agreement
  readonly quantity?: { amount: number; unit: string }; // For partial transfers
}

// --- WORKFLOW INTENTS ---

export interface TransitionIntent {
  readonly targetType: 'Agreement' | 'Asset' | 'Workflow';
  readonly targetId: EntityId;
  readonly transition: string;
  readonly payload?: Record<string, unknown>;
}

// --- QUERY INTENTS ---

export interface QueryIntent {
  readonly queryType: 'Entity' | 'Agreement' | 'Asset' | 'Role' | 'History' | 'Affordances';
  readonly filters?: Record<string, unknown>;
  readonly atTime?: Timestamp; // Point-in-time query
  readonly pagination?: {
    readonly cursor?: string;
    readonly limit?: number;
  };
}

// --- META INTENTS ---

export interface ExplainIntent {
  /** What agreement type or workflow to explain */
  readonly subject: string;
  /** Level of detail */
  readonly depth?: 'summary' | 'full' | 'schema';
}

export interface SimulateIntent {
  /** The intent to simulate */
  readonly intent: Intent;
  /** Return what WOULD happen without doing it */
  readonly dryRun: true;
}

// ============================================================================
// INTENT HANDLER
// ============================================================================

export interface IntentHandler {
  /**
   * Process any intent
   */
  handle<T>(intent: Intent<T>): Promise<IntentResult>;
  
  /**
   * Get available intents for current context
   */
  getAvailableIntents(
    realm: EntityId,
    actor: ActorReference,
    context?: { targetType?: string; targetId?: EntityId }
  ): Promise<readonly Affordance[]>;
  
  /**
   * Validate an intent without executing
   */
  validate<T>(intent: Intent<T>): Promise<ValidationResult>;
  
  /**
   * Explain what an intent would do
   */
  explain<T>(intent: Intent<T>): Promise<Explanation>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly IntentError[];
  readonly warnings: readonly IntentError[];
}

export interface Explanation {
  readonly description: string;
  readonly steps: readonly string[];
  readonly effects: readonly string[];
  readonly requirements: readonly string[];
}

// ============================================================================
// INTENT REGISTRY
// ============================================================================

/**
 * Maps intent names to their handlers and schemas.
 * This is extensible - domains can register their own intents.
 */
export interface IntentRegistry {
  /** Register an intent handler */
  register(intentName: string, definition: IntentDefinition): void;
  
  /** Get an intent definition */
  get(intentName: string): IntentDefinition | undefined;
  
  /** Get all registered intents */
  getAll(): readonly IntentDefinition[];
  
  /** Get intents available for a context */
  getForContext(context: IntentContext): readonly IntentDefinition[];
}

export interface IntentDefinition {
  readonly name: string;
  readonly description: string;
  readonly category: 'Entity' | 'Agreement' | 'Asset' | 'Workflow' | 'Query' | 'Meta';
  
  /** JSON Schema for the payload */
  readonly schema: Record<string, unknown>;
  
  /** What permissions are required */
  readonly requiredPermissions: readonly string[];
  
  /** What agreement types this intent creates/affects */
  readonly affectsAgreementTypes?: readonly string[];
  
  /** Example payloads */
  readonly examples?: readonly Record<string, unknown>[];
  
  /** The handler function */
  readonly handler: (intent: Intent, context: HandlerContext) => Promise<IntentResult>;
}

export interface IntentContext {
  readonly realm: EntityId;
  readonly actor: ActorReference;
  readonly targetType?: string;
  readonly targetId?: EntityId;
  readonly currentState?: string;
}

export interface HandlerContext extends IntentContext {
  readonly eventStore: unknown; // EventStore
  readonly aggregates: unknown; // AggregateRepository
  readonly workflows: unknown; // WorkflowEngine
  readonly agreements: unknown; // AgreementTypeRegistry
  readonly authorization: unknown; // AuthorizationEngine
  readonly adapters?: Map<string, unknown>; // Adapter registry
  readonly runtimeRegistry?: unknown; // RuntimeRegistry
}

// ============================================================================
// BUILT-IN INTENTS
// ============================================================================

// Import workspace intent handlers
import {
  handleUploadFile,
  handleDownloadFile,
  handleListFiles,
  handleModifyFile,
  handleDeleteFile,
  handleRegisterFunction,
  handleExecuteFunction,
  handleExecuteScript,
  handleCloneRepository,
  handlePullRepository,
  handlePushRepository,
  type UploadFileIntent,
  type DownloadFileIntent,
  type ListFilesIntent,
  type ModifyFileIntent,
  type DeleteFileIntent,
  type RegisterFunctionIntent,
  type ExecuteFunctionIntent,
  type ExecuteScriptIntent,
  type CloneRepositoryIntent,
  type PullRepositoryIntent,
  type PushRepositoryIntent,
} from './intent-handlers/workspace-intents';

// Import asset intent handlers
import {
  handleRegisterAsset,
} from './intent-handlers/asset-intents';

export const BUILT_IN_INTENTS: readonly IntentDefinition[] = [
  // --- Entity Intents ---
  {
    name: 'register',
    description: 'Register a new entity (person, organization, system)',
    category: 'Entity',
    schema: {
      type: 'object',
      required: ['entityType', 'identity'],
      properties: {
        entityType: { type: 'string' },
        identity: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            identifiers: { type: 'array' },
            contacts: { type: 'array' },
          },
        },
      },
    },
    requiredPermissions: ['entity:create'],
    handler: async (intent, context) => {
      // Implementation would go here
      return {
        success: true,
        outcome: { type: 'Created', entity: {}, id: '' as EntityId },
        events: [],
        affordances: [
          { intent: 'propose', description: 'Propose an agreement with this entity', required: ['agreementType', 'terms'] },
        ],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  // --- Agreement Intents ---
  {
    name: 'propose',
    description: 'Propose a new agreement between parties',
    category: 'Agreement',
    schema: {
      type: 'object',
      required: ['agreementType', 'parties', 'terms'],
      properties: {
        agreementType: { type: 'string' },
        parties: { type: 'array' },
        terms: { type: 'object' },
        assets: { type: 'array' },
        validity: { type: 'object' },
      },
    },
    requiredPermissions: ['agreement:propose'],
    affectsAgreementTypes: ['*'],
    examples: [
      {
        agreementType: 'employment',
        parties: [
          { entityId: 'company-123', role: 'Employer' },
          { entityId: 'person-456', role: 'Employee' },
        ],
        terms: {
          description: 'Employment agreement for Software Engineer position',
          clauses: [
            { id: 'compensation', type: 'compensation', content: 'Annual salary of $100,000' },
            { id: 'duties', type: 'duties', content: 'Software development and maintenance' },
          ],
        },
      },
    ],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Created', entity: {}, id: '' as EntityId },
        events: [],
        affordances: [
          { intent: 'consent', description: 'Give consent to this agreement', required: ['method'] },
          { intent: 'terminate', description: 'Terminate this agreement', required: ['reason'] },
        ],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  {
    name: 'consent',
    description: 'Give consent to an agreement',
    category: 'Agreement',
    schema: {
      type: 'object',
      required: ['agreementId', 'method'],
      properties: {
        agreementId: { type: 'string' },
        method: { type: 'string', enum: ['Digital', 'Signature', 'Verbal', 'Click', 'Implied'] },
        evidence: { type: 'string' },
      },
    },
    requiredPermissions: ['agreement:consent'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Consented', agreement: '' as EntityId, party: '' as EntityId },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  {
    name: 'fulfill',
    description: 'Mark an obligation as fulfilled',
    category: 'Agreement',
    schema: {
      type: 'object',
      required: ['agreementId', 'obligationId'],
      properties: {
        agreementId: { type: 'string' },
        obligationId: { type: 'string' },
        evidence: { type: 'string' },
      },
    },
    requiredPermissions: ['agreement:fulfill'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Fulfilled', obligation: '' },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  {
    name: 'terminate',
    description: 'Terminate an agreement',
    category: 'Agreement',
    schema: {
      type: 'object',
      required: ['agreementId', 'reason'],
      properties: {
        agreementId: { type: 'string' },
        reason: { type: 'string' },
      },
    },
    requiredPermissions: ['agreement:terminate'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Transitioned', from: 'Active', to: 'Terminated' },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  // --- Asset Intents ---
  {
    name: 'register-asset',
    description: 'Register a new asset (supports Workspace type)',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['assetType', 'properties'],
      properties: {
        assetType: { type: 'string', enum: ['Workspace', 'Document', 'Product', 'Service', 'Other'] },
        ownerId: { type: 'string' },
        properties: { 
          type: 'object',
          properties: {
            name: { type: 'string' },
            runtime: { type: 'string', enum: ['Node.js', 'Python', 'Deno', 'WebAssembly', 'Multi'] },
            resources: { type: 'object' },
            identity: { type: 'object' },
          }
        },
        quantity: { type: 'object' },
      },
    },
    requiredPermissions: ['asset:create'],
    handler: handleRegisterAsset,
  },
  
  {
    name: 'transfer',
    description: 'Transfer an asset to another entity',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['assetId', 'toEntityId', 'agreementId'],
      properties: {
        assetId: { type: 'string' },
        toEntityId: { type: 'string' },
        transferType: { type: 'string', enum: ['Ownership', 'Custody'] },
        agreementId: { type: 'string' },
        quantity: { type: 'object' },
      },
    },
    requiredPermissions: ['asset:transfer'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Transferred', asset: '' as EntityId, to: '' as EntityId },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  // --- Workflow Intents ---
  {
    name: 'transition',
    description: 'Trigger a state transition on an entity',
    category: 'Workflow',
    schema: {
      type: 'object',
      required: ['targetType', 'targetId', 'transition'],
      properties: {
        targetType: { type: 'string', enum: ['Agreement', 'Asset', 'Workflow'] },
        targetId: { type: 'string' },
        transition: { type: 'string' },
        payload: { type: 'object' },
      },
    },
    requiredPermissions: ['workflow:transition'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Transitioned', from: '', to: '' },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  // --- Query Intents ---
  {
    name: 'query',
    description: 'Query entities, agreements, assets, or history',
    category: 'Query',
    schema: {
      type: 'object',
      required: ['queryType'],
      properties: {
        queryType: { type: 'string', enum: ['Entity', 'Agreement', 'Asset', 'Role', 'History', 'Affordances'] },
        filters: { type: 'object' },
        atTime: { type: 'number' },
        pagination: { type: 'object' },
      },
    },
    requiredPermissions: ['query:read'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Queried', results: [] },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  // --- Meta Intents ---
  {
    name: 'explain',
    description: 'Explain an agreement type, workflow, or intent',
    category: 'Meta',
    schema: {
      type: 'object',
      required: ['subject'],
      properties: {
        subject: { type: 'string' },
        depth: { type: 'string', enum: ['summary', 'full', 'schema'] },
      },
    },
    requiredPermissions: [],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Queried', results: {} },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  {
    name: 'simulate',
    description: 'Simulate an intent without executing it',
    category: 'Meta',
    schema: {
      type: 'object',
      required: ['intent'],
      properties: {
        intent: { type: 'object' },
      },
    },
    requiredPermissions: [],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Queried', results: { simulated: true } },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  {
    name: 'what-can-i-do',
    description: 'Get available actions for the current context',
    category: 'Meta',
    schema: {
      type: 'object',
      properties: {
        targetType: { type: 'string' },
        targetId: { type: 'string' },
      },
    },
    requiredPermissions: [],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Queried', results: [] },
        events: [],
        affordances: [],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
  
  // --- Workspace Intents ---
  {
    name: 'upload:file',
    description: 'Upload a file to a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'file', 'filename', 'path'],
      properties: {
        workspaceId: { type: 'string' },
        file: { type: ['string', 'array'] },
        filename: { type: 'string' },
        path: { type: 'string' },
      },
    },
    requiredPermissions: ['Workspace:File:create'],
    handler: handleUploadFile,
  },
  {
    name: 'download:file',
    description: 'Download a file from a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'fileId'],
      properties: {
        workspaceId: { type: 'string' },
        fileId: { type: 'string' },
        version: { type: 'number' },
      },
    },
    requiredPermissions: ['Workspace:File:read'],
    handler: handleDownloadFile,
  },
  {
    name: 'list:files',
    description: 'List files in a workspace',
    category: 'Query',
    schema: {
      type: 'object',
      required: ['workspaceId'],
      properties: {
        workspaceId: { type: 'string' },
        path: { type: 'string' },
      },
    },
    requiredPermissions: ['Workspace:Content:read'],
    handler: handleListFiles,
  },
  {
    name: 'modify:file',
    description: 'Modify a file in a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'fileId', 'content'],
      properties: {
        workspaceId: { type: 'string' },
        fileId: { type: 'string' },
        content: { type: ['string', 'array'] },
        previousVersionId: { type: 'string' },
      },
    },
    requiredPermissions: ['Workspace:Content:update'],
    handler: handleModifyFile,
  },
  {
    name: 'delete:file',
    description: 'Delete a file from a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'fileId'],
      properties: {
        workspaceId: { type: 'string' },
        fileId: { type: 'string' },
      },
    },
    requiredPermissions: ['Workspace:File:delete'],
    handler: handleDeleteFile,
  },
  {
    name: 'register:function',
    description: 'Register a function in a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'name', 'code', 'language', 'entryPoint'],
      properties: {
        workspaceId: { type: 'string' },
        name: { type: 'string' },
        code: { type: 'string' },
        language: { type: 'string', enum: ['javascript', 'python', 'typescript'] },
        entryPoint: { type: 'string' },
      },
    },
    requiredPermissions: ['Workspace:Function:create'],
    handler: handleRegisterFunction,
  },
  {
    name: 'execute:function',
    description: 'Execute a function in a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'functionId', 'input'],
      properties: {
        workspaceId: { type: 'string' },
        functionId: { type: 'string' },
        input: { type: 'object' },
      },
    },
    requiredPermissions: ['Workspace:Function:execute'],
    handler: handleExecuteFunction,
  },
  {
    name: 'execute:script',
    description: 'Execute a script file in a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'path'],
      properties: {
        workspaceId: { type: 'string' },
        path: { type: 'string' },
        input: { type: 'object' },
      },
    },
    requiredPermissions: ['Workspace:Script:execute'],
    handler: handleExecuteScript,
  },
  {
    name: 'clone:repository',
    description: 'Clone a git repository into a workspace',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'url'],
      properties: {
        workspaceId: { type: 'string' },
        url: { type: 'string' },
        branch: { type: 'string' },
        depth: { type: 'number' },
        credentials: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            token: { type: 'string' },
          },
        },
      },
    },
    requiredPermissions: ['Workspace:Content:create'],
    handler: handleCloneRepository,
  },
  {
    name: 'pull:repository',
    description: 'Pull latest changes from a git repository',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'repositoryId'],
      properties: {
        workspaceId: { type: 'string' },
        repositoryId: { type: 'string' },
        branch: { type: 'string' },
        credentials: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            token: { type: 'string' },
          },
        },
      },
    },
    requiredPermissions: ['Workspace:Content:update'],
    handler: handlePullRepository,
  },
  {
    name: 'push:repository',
    description: 'Push changes to a git repository',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['workspaceId', 'repositoryId'],
      properties: {
        workspaceId: { type: 'string' },
        repositoryId: { type: 'string' },
        branch: { type: 'string' },
        force: { type: 'boolean' },
        credentials: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            token: { type: 'string' },
          },
        },
      },
    },
    requiredPermissions: ['Workspace:Content:update'],
    handler: handlePushRepository,
  },
  
  // --- Authentication/Authorization Intents ---
  {
    name: 'delegate:auth',
    description: 'Create a realm-scoped API key for delegation (replaces /auth/delegate endpoint)',
    category: 'Authentication',
    schema: {
      type: 'object',
      required: ['realmId'],
      properties: {
        realmId: { type: 'string' },
        entityId: { type: 'string' },
        name: { type: 'string' },
        scopes: { type: 'array', items: { type: 'string' } },
        expiresInDays: { type: 'number' },
      },
    },
    requiredPermissions: ['admin'], // Requires master key or admin role
    handler: async (intent, context) => {
      // This intent creates an API key via Event Store
      // Implementation uses admin.createApiKey which now uses Event Store
      const { createApiKey } = await import('../../antenna/admin');
      const eventStore = context.eventStore as any;
      
      if (!eventStore) {
        return {
          success: false,
          outcome: { type: 'Nothing', reason: 'Event store not available' },
          events: [],
          affordances: [],
          errors: [{ code: 'ERROR', message: 'Event store required' }],
          meta: { processedAt: Date.now(), processingTime: 0 },
        };
      }
      
      const keyData = await createApiKey({
        realmId: intent.payload.realmId,
        entityId: intent.payload.entityId || (intent.actor.type === 'Entity' ? intent.actor.entityId : '' as EntityId),
        name: intent.payload.name || `Delegated key for ${intent.payload.realmId}`,
        scopes: intent.payload.scopes || ['read', 'write'],
        expiresInDays: intent.payload.expiresInDays || 365,
      }, eventStore);
      
      return {
        success: true,
        outcome: {
          type: 'Created',
          entity: {
            id: keyData.apiKey.id,
            realmId: keyData.apiKey.realmId,
            name: keyData.apiKey.name,
            scopes: keyData.apiKey.scopes,
            expiresAt: keyData.apiKey.expiresAt,
          },
          id: keyData.apiKey.id,
        },
        events: [], // Events created by createApiKey
        affordances: [
          { intent: 'revokeApiKey', description: 'Revoke this API key', required: ['keyId'] },
        ],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
  },
];

// ============================================================================
// SHORTHAND INTENTS (Natural Language Mapping)
// ============================================================================

/**
 * These map natural expressions to formal intents.
 * "I want to hire someone" → propose:employment
 * "Sell this to them" → propose:sale + transfer
 */
export const INTENT_ALIASES: Record<string, { intent: string; defaults?: Record<string, unknown> }> = {
  // Employment
  'hire': { intent: 'propose', defaults: { agreementType: 'employment' } },
  'employ': { intent: 'propose', defaults: { agreementType: 'employment' } },
  'fire': { intent: 'terminate', defaults: {} },
  'terminate-employment': { intent: 'terminate', defaults: {} },
  
  // Sales
  'sell': { intent: 'propose', defaults: { agreementType: 'sale' } },
  'buy': { intent: 'consent', defaults: {} },
  'purchase': { intent: 'propose', defaults: { agreementType: 'sale' } },
  
  // Membership
  'invite': { intent: 'propose', defaults: { agreementType: 'membership' } },
  'join': { intent: 'consent', defaults: {} },
  'leave': { intent: 'terminate', defaults: {} },
  
  // Authorization
  'grant-access': { intent: 'propose', defaults: { agreementType: 'authorization' } },
  'revoke-access': { intent: 'terminate', defaults: {} },
  'authorize': { intent: 'propose', defaults: { agreementType: 'authorization' } },
  
  // Custody
  'entrust': { intent: 'propose', defaults: { agreementType: 'custody' } },
  'return': { intent: 'terminate', defaults: {} },
  
  // Testimony
  'declare': { intent: 'propose', defaults: { agreementType: 'testimony' } },
  'witness': { intent: 'consent', defaults: { method: 'Signature' } },
  'attest': { intent: 'consent', defaults: { method: 'Signature' } },
  
  // General
  'agree': { intent: 'consent', defaults: {} },
  'accept': { intent: 'consent', defaults: {} },
  'reject': { intent: 'terminate', defaults: { reason: 'Rejected by party' } },
  'complete': { intent: 'fulfill', defaults: {} },
  'done': { intent: 'fulfill', defaults: {} },
};

// ============================================================================
// INTENT REGISTRY IMPLEMENTATION
// ============================================================================

class SimpleIntentRegistry implements IntentRegistry {
  private intents: Map<string, IntentDefinition> = new Map();

  register(intentName: string, definition: IntentDefinition): void {
    this.intents.set(intentName, definition);
  }

  get(intentName: string): IntentDefinition | undefined {
    return this.intents.get(intentName);
  }

  getAll(): readonly IntentDefinition[] {
    return Array.from(this.intents.values());
  }

  getForContext(context: IntentContext): readonly IntentDefinition[] {
    // For now, return all intents. In the future, filter by permissions/context
    return this.getAll();
  }
}

// ============================================================================
// INTENT HANDLER CREATION
// ============================================================================

/**
 * Create an IntentHandler from BUILT_IN_INTENTS
 */
export function createIntentHandler(
  registry?: IntentRegistry,
  context?: Partial<HandlerContext>
): IntentHandler {
  const intentRegistry = registry || (() => {
    const reg = new SimpleIntentRegistry();
    // Register all built-in intents
    for (const intent of BUILT_IN_INTENTS) {
      reg.register(intent.name, intent);
    }
    return reg;
  })();

  // Create adapters map if not provided
  const adapters = context?.adapters || new Map<string, unknown>();

  const defaultContext: Partial<HandlerContext> = {
    realm: 'default-realm' as EntityId,
    actor: { type: 'Anonymous' },
    adapters,
    ...context,
  };

  return {
    async handle<T>(intent: Intent<T>): Promise<IntentResult> {
      const definition = intentRegistry.get(intent.intent);
      
      if (!definition) {
        return {
          success: false,
          outcome: {
            type: 'Nothing',
            reason: `Intent "${intent.intent}" not found`,
          },
          events: [],
          affordances: [],
          meta: {
            processedAt: Date.now(),
            processingTime: 0,
          },
        };
      }

      try {
        const handlerContext: HandlerContext = {
          realm: intent.realm,
          actor: intent.actor,
          ...defaultContext,
          ...context,
        } as HandlerContext;

        return await definition.handler(intent, handlerContext);
      } catch (error: any) {
        return {
          success: false,
          outcome: {
            type: 'Nothing',
            reason: error.message || 'Intent execution failed',
          },
          events: [],
          affordances: [],
          meta: {
            processedAt: Date.now(),
            processingTime: 0,
          },
        };
      }
    },

    async getAvailableIntents(
      realm: EntityId,
      actor: ActorReference,
      context?: { targetType?: string; targetId?: EntityId }
    ): Promise<readonly Affordance[]> {
      const ctx: IntentContext = {
        realm,
        actor,
        targetType: context?.targetType,
        targetId: context?.targetId,
      };
      
      const intents = intentRegistry.getForContext(ctx);
      
      return intents.map(intent => ({
        intent: intent.name,
        description: intent.description,
        required: Object.keys(intent.schema.properties || {}).filter(
          key => (intent.schema.required || []).includes(key)
        ),
      }));
    },

    async validate<T>(intent: Intent<T>): Promise<ValidationResult> {
      const definition = intentRegistry.get(intent.intent);
      
      if (!definition) {
        return {
          valid: false,
          errors: [{
            code: 'INTENT_NOT_FOUND',
            message: `Intent "${intent.intent}" is not registered`,
            field: 'intent',
          }],
          warnings: [],
        };
      }

      // Basic schema validation would go here
      // For now, just check if intent exists
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    },

    async explain<T>(intent: Intent<T>): Promise<Explanation> {
      const definition = intentRegistry.get(intent.intent);
      
      if (!definition) {
        return {
          description: `Intent "${intent.intent}" is not registered`,
          steps: [],
          effects: [],
          requirements: [],
        };
      }

      return {
        description: definition.description,
        steps: [
          'Validate intent payload',
          'Check permissions',
          'Execute handler',
          'Record events',
        ],
        effects: [
          'Events will be recorded',
          'State may be updated',
        ],
        requirements: [
          `Permissions: ${definition.requiredPermissions.join(', ')}`,
        ],
      };
    },
  };
}

