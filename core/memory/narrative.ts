/**
 * NARRATIVE LOGGING - System Memory
 * 
 * In an event-sourced, audit-first system, logging IS the data.
 * Every event tells part of a story. This module weaves those
 * events into coherent narratives that can be:
 * 
 * - Queried like any other data
 * - Viewed from different perspectives
 * - Traced causally (what caused what)
 * - Reconstructed at any point in time
 * - Told as human-readable stories
 * 
 * This is not traditional logging. This is system memory.
 */

import type { EntityId, Timestamp, Event, ActorReference, AggregateType } from '../schema/ledger';

// ============================================================================
// THE MEMORY MODEL
// ============================================================================

/**
 * A Memory is a recorded moment in the system's existence.
 * Unlike traditional logs (just text), memories are structured,
 * connected, and meaningful.
 */
export interface Memory {
  /** Unique identifier */
  readonly id: EntityId;
  
  /** When this memory was formed */
  readonly timestamp: Timestamp;
  
  /** The event that created this memory (if event-triggered) */
  readonly eventId?: EntityId;
  
  /** The realm this memory belongs to */
  readonly realmId: EntityId;
  
  /** Classification */
  readonly classification: MemoryClassification;
  
  /** The core content */
  readonly content: MemoryContent;
  
  /** Causal chain - what led to this */
  readonly causation: Causation;
  
  /** How significant is this memory */
  readonly significance: Significance;
  
  /** Perspectives - how different viewers see this memory */
  readonly perspectives: readonly Perspective[];
  
  /** Tags for filtering and grouping */
  readonly tags: readonly string[];
  
  /** Related memories */
  readonly related: readonly EntityId[];
}

// ============================================================================
// MEMORY CLASSIFICATION
// ============================================================================

export interface MemoryClassification {
  /** Primary category */
  readonly category: MemoryCategory;
  
  /** Subcategory */
  readonly subcategory?: string;
  
  /** The domain area */
  readonly domain: string;
  
  /** System layer */
  readonly layer: SystemLayer;
}

export type MemoryCategory = 
  | 'Lifecycle'      // Birth, death, state changes
  | 'Relationship'   // Agreements formed, roles granted
  | 'Transaction'    // Transfers, exchanges
  | 'Decision'       // Choices made, paths taken
  | 'Anomaly'        // Unexpected events, errors
  | 'Milestone'      // Significant achievements
  | 'Communication'  // Messages, notifications
  | 'Observation'    // System observations, metrics
  | 'Reflection';    // Meta-observations about the system itself

export type SystemLayer =
  | 'Business'       // Business logic events
  | 'Workflow'       // State machine transitions
  | 'Integration'    // External system interactions
  | 'Infrastructure' // System-level operations
  | 'Security'       // Authentication, authorization
  | 'Performance';   // Timing, resource usage

// ============================================================================
// MEMORY CONTENT
// ============================================================================

export interface MemoryContent {
  /** What happened - the core fact */
  readonly what: string;
  
  /** Structured data about what happened */
  readonly data: Record<string, unknown>;
  
  /** The story - human readable narrative */
  readonly narrative: Narrative;
  
  /** Technical details (for debugging) */
  readonly technical?: TechnicalDetails;
}

export interface Narrative {
  /** One-line summary */
  readonly summary: string;
  
  /** Full description */
  readonly description?: string;
  
  /** The story from different points of view */
  readonly perspectives?: Record<string, string>;
  
  /** What this means / implications */
  readonly implications?: readonly string[];
}

export interface TechnicalDetails {
  /** Operation that was performed */
  readonly operation: string;
  
  /** Duration in milliseconds */
  readonly durationMs?: number;
  
  /** Resource usage */
  readonly resources?: {
    readonly cpu?: number;
    readonly memory?: number;
    readonly io?: number;
  };
  
  /** Stack trace (for errors) */
  readonly stack?: string;
  
  /** Request/response details */
  readonly request?: Record<string, unknown>;
  readonly response?: Record<string, unknown>;
  
  /** Debug context */
  readonly debug?: Record<string, unknown>;
}

// ============================================================================
// CAUSATION - The Chain of Why
// ============================================================================

export interface Causation {
  /** What directly caused this memory */
  readonly cause?: CausalReference;
  
  /** The root cause (first in the chain) */
  readonly rootCause?: CausalReference;
  
  /** The correlation ID (groups related memories) */
  readonly correlationId: EntityId;
  
  /** The span ID (for distributed tracing) */
  readonly spanId?: string;
  
  /** Parent span (for nested operations) */
  readonly parentSpanId?: string;
  
  /** Who initiated this chain */
  readonly initiator: ActorReference;
  
  /** The intent that started it all */
  readonly intent?: string;
}

export interface CausalReference {
  readonly type: 'Event' | 'Memory' | 'Command' | 'External';
  readonly id: EntityId;
  readonly description?: string;
}

// ============================================================================
// SIGNIFICANCE
// ============================================================================

export interface Significance {
  /** How important is this memory */
  readonly level: SignificanceLevel;
  
  /** Why is it significant */
  readonly reason?: string;
  
  /** Who should care about this */
  readonly audience: readonly string[];
  
  /** Should this trigger alerts */
  readonly alertWorthy: boolean;
  
  /** Retention policy */
  readonly retention: RetentionPolicy;
}

export type SignificanceLevel = 
  | 'Trace'      // Finest detail, usually filtered out
  | 'Debug'      // Development/debugging
  | 'Info'       // Normal operations
  | 'Notice'     // Notable but not problematic
  | 'Warning'    // Potential issues
  | 'Error'      // Errors that were handled
  | 'Critical'   // System integrity at risk
  | 'Milestone'; // Business-significant events

export interface RetentionPolicy {
  /** Minimum time to keep */
  readonly minRetention: Duration;
  
  /** Can be archived after this time */
  readonly archiveAfter?: Duration;
  
  /** Legal/compliance hold */
  readonly legalHold?: boolean;
  
  /** Reason for retention requirements */
  readonly reason?: string;
}

export interface Duration {
  readonly amount: number;
  readonly unit: 'hours' | 'days' | 'weeks' | 'months' | 'years' | 'forever';
}

// ============================================================================
// PERSPECTIVES - Different Ways of Seeing
// ============================================================================

/**
 * The same memory can be viewed from different perspectives.
 * A technical error is "500 Internal Server Error" to a developer,
 * but "We couldn't complete your request" to a user.
 */
export interface Perspective {
  /** Who is viewing */
  readonly viewer: ViewerType;
  
  /** What they see */
  readonly view: PerspectiveView;
}

export type ViewerType = 
  | 'System'      // Raw system view
  | 'Developer'   // Technical debugging view
  | 'Operator'    // Operations/monitoring view
  | 'Auditor'     // Compliance/audit view
  | 'Business'    // Business stakeholder view
  | 'User'        // End user view
  | 'Legal';      // Legal/compliance view

export interface PerspectiveView {
  /** Title/headline */
  readonly title: string;
  
  /** Description */
  readonly description: string;
  
  /** Recommended action */
  readonly action?: string;
  
  /** Visibility - should this viewer see it? */
  readonly visible: boolean;
  
  /** Redactions - fields to hide from this viewer */
  readonly redactions?: readonly string[];
}

// ============================================================================
// MEMORY FORMATION - Creating Memories
// ============================================================================

export interface MemoryFormer {
  /**
   * Form a memory from an event
   */
  fromEvent(event: Event, context: MemoryContext): Memory;
  
  /**
   * Form a memory from a direct observation
   */
  observe(observation: Observation, context: MemoryContext): Memory;
  
  /**
   * Form a memory marking a milestone
   */
  milestone(milestone: MilestoneData, context: MemoryContext): Memory;
  
  /**
   * Form a memory from an anomaly/error
   */
  anomaly(anomaly: AnomalyData, context: MemoryContext): Memory;
  
  /**
   * Form a reflection (meta-memory about the system)
   */
  reflect(reflection: ReflectionData, context: MemoryContext): Memory;
}

export interface MemoryContext {
  readonly realmId: EntityId;
  readonly correlationId: EntityId;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly initiator: ActorReference;
  readonly intent?: string;
  readonly tags?: readonly string[];
}

export interface Observation {
  readonly what: string;
  readonly category: MemoryCategory;
  readonly layer: SystemLayer;
  readonly data: Record<string, unknown>;
  readonly significance: SignificanceLevel;
}

export interface MilestoneData {
  readonly name: string;
  readonly description: string;
  readonly metrics?: Record<string, number>;
  readonly celebrationWorthy?: boolean;
}

export interface AnomalyData {
  readonly type: 'Error' | 'Warning' | 'Unexpected';
  readonly message: string;
  readonly error?: Error;
  readonly context: Record<string, unknown>;
  readonly recoverable: boolean;
  readonly action?: string;
}

export interface ReflectionData {
  readonly subject: string;
  readonly observation: string;
  readonly metrics?: Record<string, unknown>;
  readonly trends?: readonly TrendObservation[];
  readonly recommendations?: readonly string[];
}

export interface TrendObservation {
  readonly metric: string;
  readonly direction: 'up' | 'down' | 'stable' | 'volatile';
  readonly changePercent: number;
  readonly period: Duration;
}

// ============================================================================
// MEMORY FORMER IMPLEMENTATION
// ============================================================================

export function createMemoryFormer(): MemoryFormer {
  return {
    fromEvent(event: Event, context: MemoryContext): Memory {
      const narrative = generateEventNarrative(event);
      
      return {
        id: generateMemoryId(),
        timestamp: event.timestamp,
        eventId: event.id,
        realmId: context.realmId,
        classification: {
          category: classifyEvent(event),
          domain: event.aggregateType,
          layer: 'Business',
        },
        content: {
          what: event.type,
          data: event.payload as Record<string, unknown>,
          narrative,
        },
        causation: {
          cause: event.causation.commandId 
            ? { type: 'Command', id: event.causation.commandId }
            : undefined,
          correlationId: context.correlationId,
          spanId: context.spanId,
          parentSpanId: context.parentSpanId,
          initiator: event.actor,
          intent: context.intent,
        },
        significance: {
          level: determineSignificance(event),
          audience: determineAudience(event),
          alertWorthy: isAlertWorthy(event),
          retention: determineRetention(event),
        },
        perspectives: generatePerspectives(event, narrative),
        tags: [...(context.tags || []), event.type, event.aggregateType],
        related: [],
      };
    },
    
    observe(observation: Observation, context: MemoryContext): Memory {
      return {
        id: generateMemoryId(),
        timestamp: Date.now(),
        realmId: context.realmId,
        classification: {
          category: observation.category,
          domain: 'System',
          layer: observation.layer,
        },
        content: {
          what: observation.what,
          data: observation.data,
          narrative: {
            summary: observation.what,
          },
        },
        causation: {
          correlationId: context.correlationId,
          spanId: context.spanId,
          parentSpanId: context.parentSpanId,
          initiator: context.initiator,
          intent: context.intent,
        },
        significance: {
          level: observation.significance,
          audience: ['Operator', 'Developer'],
          alertWorthy: observation.significance === 'Warning' || observation.significance === 'Error',
          retention: { minRetention: { amount: 30, unit: 'days' } },
        },
        perspectives: [],
        tags: context.tags || [],
        related: [],
      };
    },
    
    milestone(milestone: MilestoneData, context: MemoryContext): Memory {
      return {
        id: generateMemoryId(),
        timestamp: Date.now(),
        realmId: context.realmId,
        classification: {
          category: 'Milestone',
          domain: 'Business',
          layer: 'Business',
        },
        content: {
          what: milestone.name,
          data: { metrics: milestone.metrics },
          narrative: {
            summary: milestone.name,
            description: milestone.description,
            implications: milestone.celebrationWorthy 
              ? ['🎉 This is worth celebrating!']
              : undefined,
          },
        },
        causation: {
          correlationId: context.correlationId,
          initiator: context.initiator,
          intent: context.intent,
        },
        significance: {
          level: 'Milestone',
          audience: ['Business', 'User', 'Operator'],
          alertWorthy: true,
          retention: { minRetention: { amount: 1, unit: 'forever' } },
        },
        perspectives: [
          {
            viewer: 'Business',
            view: {
              title: `🏆 ${milestone.name}`,
              description: milestone.description,
              visible: true,
            },
          },
        ],
        tags: ['milestone', ...(context.tags || [])],
        related: [],
      };
    },
    
    anomaly(anomaly: AnomalyData, context: MemoryContext): Memory {
      const level: SignificanceLevel = 
        anomaly.type === 'Error' ? (anomaly.recoverable ? 'Error' : 'Critical') :
        anomaly.type === 'Warning' ? 'Warning' : 'Notice';
      
      return {
        id: generateMemoryId(),
        timestamp: Date.now(),
        realmId: context.realmId,
        classification: {
          category: 'Anomaly',
          subcategory: anomaly.type,
          domain: 'System',
          layer: 'Infrastructure',
        },
        content: {
          what: anomaly.message,
          data: anomaly.context,
          narrative: {
            summary: anomaly.message,
            implications: anomaly.action ? [`Recommended: ${anomaly.action}`] : undefined,
          },
          technical: {
            operation: 'error-handling',
            stack: anomaly.error?.stack,
            debug: {
              errorName: anomaly.error?.name,
              errorMessage: anomaly.error?.message,
              recoverable: anomaly.recoverable,
            },
          },
        },
        causation: {
          correlationId: context.correlationId,
          spanId: context.spanId,
          parentSpanId: context.parentSpanId,
          initiator: context.initiator,
          intent: context.intent,
        },
        significance: {
          level,
          reason: anomaly.type,
          audience: ['Developer', 'Operator'],
          alertWorthy: level === 'Error' || level === 'Critical',
          retention: { 
            minRetention: { amount: level === 'Critical' ? 1 : 90, unit: level === 'Critical' ? 'years' : 'days' },
          },
        },
        perspectives: [
          {
            viewer: 'Developer',
            view: {
              title: `${anomaly.type}: ${anomaly.message}`,
              description: anomaly.error?.stack || anomaly.message,
              action: anomaly.action,
              visible: true,
            },
          },
          {
            viewer: 'User',
            view: {
              title: 'Something went wrong',
              description: anomaly.recoverable 
                ? 'We encountered an issue but are handling it.'
                : 'Please try again or contact support.',
              visible: !anomaly.recoverable,
              redactions: ['stack', 'debug'],
            },
          },
        ],
        tags: ['anomaly', anomaly.type.toLowerCase(), ...(context.tags || [])],
        related: [],
      };
    },
    
    reflect(reflection: ReflectionData, context: MemoryContext): Memory {
      return {
        id: generateMemoryId(),
        timestamp: Date.now(),
        realmId: context.realmId,
        classification: {
          category: 'Reflection',
          domain: 'Meta',
          layer: 'Infrastructure',
        },
        content: {
          what: `Reflection: ${reflection.subject}`,
          data: {
            metrics: reflection.metrics,
            trends: reflection.trends,
          },
          narrative: {
            summary: reflection.observation,
            implications: reflection.recommendations,
          },
        },
        causation: {
          correlationId: context.correlationId,
          initiator: { type: 'System', systemId: 'reflector' },
        },
        significance: {
          level: 'Notice',
          audience: ['Operator', 'Business'],
          alertWorthy: reflection.trends?.some(t => t.direction === 'down' && t.changePercent > 20) ?? false,
          retention: { minRetention: { amount: 1, unit: 'years' } },
        },
        perspectives: [],
        tags: ['reflection', reflection.subject, ...(context.tags || [])],
        related: [],
      };
    },
  };
}

// ============================================================================
// NARRATIVE GENERATION
// ============================================================================

function generateEventNarrative(event: Event): Narrative {
  const templates: Record<string, (e: Event) => Narrative> = {
    'PartyRegistered': (e) => ({
      summary: `New ${(e.payload as any).partyType} registered: ${(e.payload as any).identity?.name}`,
      description: `A new entity has joined the system.`,
      perspectives: {
        business: `Welcome aboard! ${(e.payload as any).identity?.name} is now part of the system.`,
        technical: `Entity created with type ${(e.payload as any).partyType}`,
      },
    }),
    
    'AgreementCreated': (e) => ({
      summary: `New ${(e.payload as any).agreementType} agreement proposed`,
      description: `An agreement has been proposed between parties.`,
      implications: ['Parties must give consent for the agreement to become active.'],
      perspectives: {
        business: `A new agreement is being formed. This represents a potential relationship.`,
        legal: `Agreement proposed. Awaiting consent from all required parties.`,
      },
    }),
    
    'AgreementStatusChanged': (e) => {
      const from = (e.payload as any).previousStatus;
      const to = (e.payload as any).newStatus;
      return {
        summary: `Agreement ${from} → ${to}`,
        description: `The agreement has transitioned to a new state.`,
        implications: getStatusChangeImplications(from, to),
        perspectives: {
          business: getBusinessPerspective(from, to),
          legal: getLegalPerspective(from, to),
        },
      };
    },
    
    'ConsentGiven': (e) => ({
      summary: `Consent recorded`,
      description: `A party has given their consent to an agreement.`,
      perspectives: {
        business: `One step closer to an active agreement.`,
        legal: `Consent recorded via ${(e.payload as any).method}. Evidence: ${(e.payload as any).evidence || 'N/A'}`,
      },
    }),
    
    'AssetTransferred': (e) => ({
      summary: `Asset ${(e.payload as any).transferType.toLowerCase()} transferred`,
      description: `An asset has changed hands.`,
      perspectives: {
        business: `Property has moved from one party to another.`,
        legal: `${(e.payload as any).transferType} transfer recorded under agreement ${(e.payload as any).agreementId}`,
      },
    }),
    
    'RoleGranted': (e) => ({
      summary: `Role "${(e.payload as any).roleType}" granted`,
      description: `A new role has been established.`,
      implications: ['This role grants specific permissions and responsibilities.'],
      perspectives: {
        business: `${(e.payload as any).roleType} role is now active.`,
        security: `New permissions granted. Role type: ${(e.payload as any).roleType}`,
      },
    }),
    
    'RoleRevoked': (e) => ({
      summary: `Role revoked`,
      description: `A role has been terminated.`,
      implications: ['Associated permissions are no longer active.'],
      perspectives: {
        business: `Role has ended.`,
        security: `Permissions revoked. Reason: ${(e.payload as any).reason}`,
      },
    }),
    
    'WorkflowTransitioned': (e) => ({
      summary: `Workflow: ${(e.payload as any).fromState} → ${(e.payload as any).toState}`,
      description: `A workflow has moved to a new state.`,
      perspectives: {
        technical: `State machine transition via "${(e.payload as any).transition}"`,
      },
    }),
  };
  
  const template = templates[event.type];
  if (template) {
    return template(event);
  }
  
  // Default narrative
  return {
    summary: `${event.type} on ${event.aggregateType}`,
    description: `An event occurred in the system.`,
  };
}

function getStatusChangeImplications(from: string, to: string): string[] {
  const implications: string[] = [];
  
  if (to === 'Active') {
    implications.push('The agreement is now in effect.');
    implications.push('Obligations are now enforceable.');
  } else if (to === 'Fulfilled') {
    implications.push('All obligations have been met.');
    implications.push('The agreement has concluded successfully.');
  } else if (to === 'Terminated') {
    implications.push('The agreement has ended.');
    implications.push('No further obligations exist under this agreement.');
  } else if (to === 'Breached') {
    implications.push('A breach has occurred.');
    implications.push('Remediation or dispute resolution may be required.');
  }
  
  return implications;
}

function getBusinessPerspective(from: string, to: string): string {
  if (to === 'Active') return '🎉 The deal is done! The agreement is now active.';
  if (to === 'Fulfilled') return '✅ Success! All obligations have been completed.';
  if (to === 'Terminated') return '📋 Agreement closed.';
  if (to === 'Breached') return '⚠️ Issue detected. Review required.';
  return `Agreement moved from ${from} to ${to}.`;
}

function getLegalPerspective(from: string, to: string): string {
  if (to === 'Active') return 'Agreement entered into force. Parties are bound by terms.';
  if (to === 'Fulfilled') return 'Performance complete. Agreement discharged.';
  if (to === 'Terminated') return 'Agreement terminated. See termination clause for effect.';
  if (to === 'Breached') return 'Material breach recorded. Review remedies.';
  return `Status change: ${from} → ${to}`;
}

function generatePerspectives(event: Event, narrative: Narrative): Perspective[] {
  const perspectives: Perspective[] = [];
  
  // Always include system perspective
  perspectives.push({
    viewer: 'System',
    view: {
      title: event.type,
      description: `${event.aggregateType}:${event.aggregateId} v${event.aggregateVersion}`,
      visible: true,
    },
  });
  
  // Add business perspective if available
  if (narrative.perspectives?.business) {
    perspectives.push({
      viewer: 'Business',
      view: {
        title: narrative.summary,
        description: narrative.perspectives.business,
        visible: true,
      },
    });
  }
  
  // Add legal perspective if available
  if (narrative.perspectives?.legal) {
    perspectives.push({
      viewer: 'Legal',
      view: {
        title: narrative.summary,
        description: narrative.perspectives.legal,
        visible: true,
      },
    });
  }
  
  return perspectives;
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

function classifyEvent(event: Event): MemoryCategory {
  const type = event.type;
  
  if (type.includes('Created') || type.includes('Registered')) return 'Lifecycle';
  if (type.includes('Agreement') || type.includes('Role') || type.includes('Consent')) return 'Relationship';
  if (type.includes('Transfer')) return 'Transaction';
  if (type.includes('Changed') || type.includes('Transition')) return 'Decision';
  if (type.includes('Error') || type.includes('Failed')) return 'Anomaly';
  if (type.includes('Completed') || type.includes('Fulfilled')) return 'Milestone';
  
  return 'Observation';
}

function determineSignificance(event: Event): SignificanceLevel {
  const type = event.type;
  
  if (type.includes('Error') || type.includes('Failed')) return 'Error';
  if (type.includes('Created') || type.includes('Fulfilled')) return 'Notice';
  if (type.includes('Transition') || type.includes('Changed')) return 'Info';
  
  return 'Info';
}

function determineAudience(event: Event): string[] {
  const audiences: string[] = ['System'];
  
  if (event.aggregateType === 'Agreement') {
    audiences.push('Business', 'Legal');
  }
  if (event.aggregateType === 'Asset') {
    audiences.push('Business', 'Operator');
  }
  if (event.type.includes('Role')) {
    audiences.push('Security', 'Operator');
  }
  
  return audiences;
}

function isAlertWorthy(event: Event): boolean {
  const type = event.type;
  
  return type.includes('Error') || 
         type.includes('Failed') ||
         type.includes('Breached') ||
         type.includes('Critical');
}

function determineRetention(event: Event): RetentionPolicy {
  // Agreements and financial transactions: long retention
  if (event.aggregateType === 'Agreement') {
    return { 
      minRetention: { amount: 7, unit: 'years' },
      reason: 'Legal compliance',
    };
  }
  
  // Asset transfers: medium retention
  if (event.type.includes('Transfer')) {
    return {
      minRetention: { amount: 5, unit: 'years' },
      reason: 'Audit trail',
    };
  }
  
  // Default
  return {
    minRetention: { amount: 1, unit: 'years' },
    archiveAfter: { amount: 90, unit: 'days' },
  };
}

function generateMemoryId(): EntityId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `mem-${timestamp}-${random}` as EntityId;
}

