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
}

// ============================================================================
// BUILT-IN INTENTS
// ============================================================================

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
    description: 'Register a new asset',
    category: 'Asset',
    schema: {
      type: 'object',
      required: ['assetType', 'properties'],
      properties: {
        assetType: { type: 'string' },
        ownerId: { type: 'string' },
        properties: { type: 'object' },
        quantity: { type: 'object' },
      },
    },
    requiredPermissions: ['asset:create'],
    handler: async (intent, context) => {
      return {
        success: true,
        outcome: { type: 'Created', entity: {}, id: '' as EntityId },
        events: [],
        affordances: [
          { intent: 'transfer', description: 'Transfer this asset', required: ['toEntityId', 'agreementId'] },
        ],
        meta: { processedAt: Date.now(), processingTime: 0 },
      };
    },
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

