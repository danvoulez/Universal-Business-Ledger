/**
 * STORY ENGINE - Weaving Memories into Narratives
 * 
 * Memories are individual moments. Stories are the threads
 * that connect them into coherent narratives.
 * 
 * This module provides:
 * - Story reconstruction (what happened to X?)
 * - Causal chains (why did X happen?)
 * - Timeline views (what happened when?)
 * - Perspective filtering (show me the business view)
 * - Pattern detection (what keeps happening?)
 */

import type { EntityId, Timestamp, AggregateType, ActorReference } from '../schema/ledger';
import type { 
  Memory, 
  MemoryCategory, 
  SystemLayer, 
  SignificanceLevel,
  ViewerType,
  Perspective,
  Duration,
} from './narrative';

// ============================================================================
// STORY TYPES
// ============================================================================

/**
 * A Story is a coherent narrative constructed from memories.
 */
export interface Story {
  /** Unique identifier */
  readonly id: EntityId;
  
  /** Story title */
  readonly title: string;
  
  /** What is this story about */
  readonly subject: StorySubject;
  
  /** Time span of the story */
  readonly timespan: {
    readonly start: Timestamp;
    readonly end: Timestamp;
  };
  
  /** The chapters (grouped memories) */
  readonly chapters: readonly Chapter[];
  
  /** Summary of the story */
  readonly summary: StorySummary;
  
  /** Key moments */
  readonly highlights: readonly Highlight[];
  
  /** Patterns observed */
  readonly patterns?: readonly Pattern[];
  
  /** Current status */
  readonly status: 'Ongoing' | 'Concluded' | 'Abandoned';
  
  /** How the story ended (if concluded) */
  readonly conclusion?: Conclusion;
}

export interface StorySubject {
  readonly type: 'Entity' | 'Agreement' | 'Asset' | 'Relationship' | 'Process' | 'Actor';
  readonly id?: EntityId;
  readonly description: string;
}

export interface Chapter {
  readonly title: string;
  readonly timespan: {
    readonly start: Timestamp;
    readonly end: Timestamp;
  };
  readonly memories: readonly Memory[];
  readonly summary: string;
  readonly significance: SignificanceLevel;
}

export interface StorySummary {
  /** One-line summary */
  readonly headline: string;
  
  /** Full summary */
  readonly narrative: string;
  
  /** Key statistics */
  readonly stats: {
    readonly totalEvents: number;
    readonly duration: Duration;
    readonly keyActors: readonly string[];
    readonly categories: Record<MemoryCategory, number>;
  };
  
  /** What this story means */
  readonly interpretation?: string;
}

export interface Highlight {
  readonly memory: Memory;
  readonly reason: string;
  readonly impact: 'High' | 'Medium' | 'Low';
}

export interface Pattern {
  readonly name: string;
  readonly description: string;
  readonly occurrences: number;
  readonly examples: readonly EntityId[];
  readonly trend: 'Increasing' | 'Decreasing' | 'Stable';
}

export interface Conclusion {
  readonly type: 'Success' | 'Failure' | 'Neutral' | 'Abandoned';
  readonly summary: string;
  readonly lessons?: readonly string[];
}

// ============================================================================
// STORY QUERIES
// ============================================================================

export interface StoryQuery {
  /** What is the story about */
  readonly subject?: StorySubject;
  
  /** Time range */
  readonly timeRange?: {
    readonly from?: Timestamp;
    readonly to?: Timestamp;
  };
  
  /** Filter by perspective */
  readonly perspective?: ViewerType;
  
  /** Filter by significance */
  readonly minSignificance?: SignificanceLevel;
  
  /** Filter by category */
  readonly categories?: readonly MemoryCategory[];
  
  /** Filter by tags */
  readonly tags?: readonly string[];
  
  /** Include related stories */
  readonly includeRelated?: boolean;
  
  /** Group memories into chapters by */
  readonly chapterBy?: 'day' | 'week' | 'phase' | 'actor' | 'category';
  
  /** Maximum memories to include */
  readonly limit?: number;
}

// ============================================================================
// STORY TELLER - Constructing Stories
// ============================================================================

export interface StoryTeller {
  /**
   * Tell the story of an entity
   */
  tellEntityStory(entityId: EntityId, query?: StoryQuery): Promise<Story>;
  
  /**
   * Tell the story of an agreement
   */
  tellAgreementStory(agreementId: EntityId, query?: StoryQuery): Promise<Story>;
  
  /**
   * Tell the story of a relationship between entities
   */
  tellRelationshipStory(
    entity1: EntityId, 
    entity2: EntityId, 
    query?: StoryQuery
  ): Promise<Story>;
  
  /**
   * Tell the story of a time period
   */
  tellPeriodStory(
    realm: EntityId,
    from: Timestamp,
    to: Timestamp,
    query?: StoryQuery
  ): Promise<Story>;
  
  /**
   * Follow a causal chain
   */
  traceCausation(memoryId: EntityId): Promise<CausalChain>;
  
  /**
   * Find patterns across memories
   */
  findPatterns(query: PatternQuery): Promise<readonly Pattern[]>;
  
  /**
   * Get a timeline view
   */
  getTimeline(query: TimelineQuery): Promise<Timeline>;
}

export interface CausalChain {
  /** The memory we started from */
  readonly origin: Memory;
  
  /** The chain going backward (causes) */
  readonly causes: readonly Memory[];
  
  /** The chain going forward (effects) */
  readonly effects: readonly Memory[];
  
  /** The root cause */
  readonly rootCause?: Memory;
  
  /** Summary of the chain */
  readonly summary: string;
}

export interface PatternQuery {
  readonly realm?: EntityId;
  readonly timeRange?: { from?: Timestamp; to?: Timestamp };
  readonly categories?: readonly MemoryCategory[];
  readonly minOccurrences?: number;
}

export interface TimelineQuery {
  readonly subject?: StorySubject;
  readonly realm?: EntityId;
  readonly timeRange?: { from?: Timestamp; to?: Timestamp };
  readonly granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  readonly perspective?: ViewerType;
}

export interface Timeline {
  readonly periods: readonly TimelinePeriod[];
  readonly totalMemories: number;
  readonly highlights: readonly Memory[];
}

export interface TimelinePeriod {
  readonly start: Timestamp;
  readonly end: Timestamp;
  readonly label: string;
  readonly memories: readonly Memory[];
  readonly summary: string;
  readonly significance: SignificanceLevel;
}

// ============================================================================
// STORY TELLER IMPLEMENTATION
// ============================================================================

export function createStoryTeller(memoryStore: MemoryStore): StoryTeller {
  return {
    async tellEntityStory(entityId: EntityId, query?: StoryQuery): Promise<Story> {
      const memories = await memoryStore.queryMemories({
        aggregateId: entityId,
        timeRange: query?.timeRange,
        categories: query?.categories,
        minSignificance: query?.minSignificance,
        limit: query?.limit,
      });
      
      const chapters = groupIntoChapters(memories, query?.chapterBy || 'phase');
      const highlights = findHighlights(memories);
      const patterns = await findPatternsInMemories(memories);
      
      const firstMemory = memories[0];
      const lastMemory = memories[memories.length - 1];
      
      return {
        id: generateStoryId(),
        title: `The Story of Entity ${entityId}`,
        subject: {
          type: 'Entity',
          id: entityId,
          description: `Entity ${entityId}`,
        },
        timespan: {
          start: firstMemory?.timestamp || Date.now(),
          end: lastMemory?.timestamp || Date.now(),
        },
        chapters,
        summary: generateSummary(memories, chapters),
        highlights,
        patterns,
        status: determineStatus(memories),
      };
    },
    
    async tellAgreementStory(agreementId: EntityId, query?: StoryQuery): Promise<Story> {
      const memories = await memoryStore.queryMemories({
        aggregateId: agreementId,
        aggregateType: 'Agreement',
        timeRange: query?.timeRange,
        limit: query?.limit,
      });
      
      const chapters = groupIntoChapters(memories, 'phase');
      const highlights = findHighlights(memories);
      
      // Agreement stories have natural phases
      const phases = ['Draft', 'Proposed', 'Negotiation', 'Active', 'Conclusion'];
      const phaseChapters = phases.map(phase => {
        const phaseMemories = memories.filter(m => 
          (m.content.data as any)?.status === phase ||
          (m.content.data as any)?.newStatus === phase
        );
        return {
          title: phase,
          timespan: {
            start: phaseMemories[0]?.timestamp || 0,
            end: phaseMemories[phaseMemories.length - 1]?.timestamp || 0,
          },
          memories: phaseMemories,
          summary: `The ${phase.toLowerCase()} phase of this agreement.`,
          significance: 'Info' as SignificanceLevel,
        };
      }).filter(ch => ch.memories.length > 0);
      
      const firstMemory = memories[0];
      const lastMemory = memories[memories.length - 1];
      
      return {
        id: generateStoryId(),
        title: `Agreement Story: ${agreementId}`,
        subject: {
          type: 'Agreement',
          id: agreementId,
          description: 'The lifecycle of an agreement',
        },
        timespan: {
          start: firstMemory?.timestamp || Date.now(),
          end: lastMemory?.timestamp || Date.now(),
        },
        chapters: phaseChapters.length > 0 ? phaseChapters : chapters,
        summary: generateAgreementSummary(memories),
        highlights,
        status: determineAgreementStatus(memories),
        conclusion: findConclusion(memories),
      };
    },
    
    async tellRelationshipStory(
      entity1: EntityId,
      entity2: EntityId,
      query?: StoryQuery
    ): Promise<Story> {
      // Find all memories involving both entities
      const memories1 = await memoryStore.queryMemories({ aggregateId: entity1 });
      const memories2 = await memoryStore.queryMemories({ aggregateId: entity2 });
      
      // Find agreements between them
      const sharedAgreements = new Set<EntityId>();
      for (const m of [...memories1, ...memories2]) {
        if (m.classification.category === 'Relationship') {
          const parties = (m.content.data as any)?.parties || [];
          if (parties.some((p: any) => p.entityId === entity1) &&
              parties.some((p: any) => p.entityId === entity2)) {
            sharedAgreements.add(m.eventId || m.id);
          }
        }
      }
      
      // Combine and sort by time
      const relationshipMemories = [...memories1, ...memories2]
        .filter(m => 
          m.content.narrative.summary.includes(entity1) ||
          m.content.narrative.summary.includes(entity2) ||
          sharedAgreements.has(m.eventId || m.id)
        )
        .sort((a, b) => a.timestamp - b.timestamp);
      
      const chapters = groupIntoChapters(relationshipMemories, 'phase');
      
      return {
        id: generateStoryId(),
        title: `Relationship: ${entity1} & ${entity2}`,
        subject: {
          type: 'Relationship',
          description: `The relationship between ${entity1} and ${entity2}`,
        },
        timespan: {
          start: relationshipMemories[0]?.timestamp || Date.now(),
          end: relationshipMemories[relationshipMemories.length - 1]?.timestamp || Date.now(),
        },
        chapters,
        summary: generateSummary(relationshipMemories, chapters),
        highlights: findHighlights(relationshipMemories),
        status: 'Ongoing',
      };
    },
    
    async tellPeriodStory(
      realm: EntityId,
      from: Timestamp,
      to: Timestamp,
      query?: StoryQuery
    ): Promise<Story> {
      const memories = await memoryStore.queryMemories({
        realm,
        timeRange: { from, to },
        minSignificance: query?.minSignificance,
        categories: query?.categories,
      });
      
      const chapters = groupIntoChapters(memories, query?.chapterBy || 'day');
      const highlights = findHighlights(memories);
      const patterns = await findPatternsInMemories(memories);
      
      return {
        id: generateStoryId(),
        title: `${realm} - ${formatDateRange(from, to)}`,
        subject: {
          type: 'Process',
          description: `Activity in realm ${realm}`,
        },
        timespan: { start: from, end: to },
        chapters,
        summary: generatePeriodSummary(memories, from, to),
        highlights,
        patterns,
        status: to > Date.now() ? 'Ongoing' : 'Concluded',
      };
    },
    
    async traceCausation(memoryId: EntityId): Promise<CausalChain> {
      const origin = await memoryStore.getMemory(memoryId);
      if (!origin) {
        throw new Error(`Memory not found: ${memoryId}`);
      }
      
      // Trace backward through causes
      const causes: Memory[] = [];
      let current = origin;
      while (current.causation.cause) {
        const causeMemory = await memoryStore.getMemoryByEvent(current.causation.cause.id);
        if (!causeMemory) break;
        causes.unshift(causeMemory);
        current = causeMemory;
      }
      
      // Trace forward through effects
      const effects = await memoryStore.queryMemories({
        causedBy: memoryId,
      });
      
      const rootCause = causes.length > 0 ? causes[0] : origin;
      
      return {
        origin,
        causes,
        effects,
        rootCause,
        summary: generateCausalSummary(rootCause, origin, effects),
      };
    },
    
    async findPatterns(query: PatternQuery): Promise<readonly Pattern[]> {
      const memories = await memoryStore.queryMemories({
        realm: query.realm,
        timeRange: query.timeRange,
        categories: query.categories,
      });
      
      return findPatternsInMemories(memories, query.minOccurrences);
    },
    
    async getTimeline(query: TimelineQuery): Promise<Timeline> {
      const memories = await memoryStore.queryMemories({
        aggregateId: query.subject?.id,
        realm: query.realm,
        timeRange: query.timeRange,
      });
      
      const periods = groupByGranularity(memories, query.granularity);
      const highlights = findHighlights(memories).map(h => h.memory);
      
      return {
        periods,
        totalMemories: memories.length,
        highlights,
      };
    },
  };
}

// ============================================================================
// MEMORY STORE INTERFACE
// ============================================================================

export interface MemoryStore {
  /** Store a memory */
  store(memory: Memory): Promise<void>;
  
  /** Get a memory by ID */
  getMemory(id: EntityId): Promise<Memory | null>;
  
  /** Get memory by event ID */
  getMemoryByEvent(eventId: EntityId): Promise<Memory | null>;
  
  /** Query memories */
  queryMemories(query: MemoryStoreQuery): Promise<readonly Memory[]>;
}

export interface MemoryStoreQuery {
  readonly aggregateId?: EntityId;
  readonly aggregateType?: AggregateType;
  readonly realm?: EntityId;
  readonly timeRange?: { from?: Timestamp; to?: Timestamp };
  readonly categories?: readonly MemoryCategory[];
  readonly tags?: readonly string[];
  readonly minSignificance?: SignificanceLevel;
  readonly causedBy?: EntityId;
  readonly correlationId?: EntityId;
  readonly limit?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function groupIntoChapters(
  memories: readonly Memory[],
  groupBy: 'day' | 'week' | 'phase' | 'actor' | 'category'
): Chapter[] {
  if (memories.length === 0) return [];
  
  const groups = new Map<string, Memory[]>();
  
  for (const memory of memories) {
    let key: string;
    
    switch (groupBy) {
      case 'day':
        key = new Date(memory.timestamp).toISOString().split('T')[0];
        break;
      case 'week':
        const date = new Date(memory.timestamp);
        const week = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
        key = `Week ${week}`;
        break;
      case 'phase':
        key = (memory.content.data as any)?.status || 
              (memory.content.data as any)?.newStatus || 
              memory.classification.category;
        break;
      case 'actor':
        key = memory.causation.initiator.type === 'Party' 
          ? memory.causation.initiator.partyId 
          : memory.causation.initiator.type;
        break;
      case 'category':
        key = memory.classification.category;
        break;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(memory);
  }
  
  return Array.from(groups.entries()).map(([title, chapterMemories]) => ({
    title,
    timespan: {
      start: chapterMemories[0].timestamp,
      end: chapterMemories[chapterMemories.length - 1].timestamp,
    },
    memories: chapterMemories,
    summary: `${chapterMemories.length} event(s) in this chapter.`,
    significance: getMaxSignificance(chapterMemories),
  }));
}

function findHighlights(memories: readonly Memory[]): Highlight[] {
  const significancePriority: Record<SignificanceLevel, number> = {
    'Trace': 0,
    'Debug': 1,
    'Info': 2,
    'Notice': 3,
    'Warning': 4,
    'Error': 5,
    'Critical': 6,
    'Milestone': 7,
  };
  
  return memories
    .filter(m => significancePriority[m.significance.level] >= 3)
    .map(m => ({
      memory: m,
      reason: m.significance.reason || m.content.narrative.summary,
      impact: m.significance.level === 'Critical' || m.significance.level === 'Milestone' 
        ? 'High' as const
        : m.significance.level === 'Error' || m.significance.level === 'Warning'
          ? 'Medium' as const
          : 'Low' as const,
    }))
    .slice(0, 10); // Top 10 highlights
}

async function findPatternsInMemories(
  memories: readonly Memory[],
  minOccurrences = 3
): Promise<Pattern[]> {
  const patterns: Map<string, { count: number; examples: EntityId[] }> = new Map();
  
  // Count event types
  for (const memory of memories) {
    const key = memory.content.what;
    if (!patterns.has(key)) {
      patterns.set(key, { count: 0, examples: [] });
    }
    const pattern = patterns.get(key)!;
    pattern.count++;
    if (pattern.examples.length < 3) {
      pattern.examples.push(memory.id);
    }
  }
  
  return Array.from(patterns.entries())
    .filter(([_, data]) => data.count >= minOccurrences)
    .map(([name, data]) => ({
      name,
      description: `"${name}" occurred ${data.count} times`,
      occurrences: data.count,
      examples: data.examples,
      trend: 'Stable' as const, // Would need time series analysis for real trend
    }));
}

function generateSummary(memories: readonly Memory[], chapters: readonly Chapter[]): StorySummary {
  const categories: Record<MemoryCategory, number> = {
    'Lifecycle': 0,
    'Relationship': 0,
    'Transaction': 0,
    'Decision': 0,
    'Anomaly': 0,
    'Milestone': 0,
    'Communication': 0,
    'Observation': 0,
    'Reflection': 0,
  };
  
  const actors = new Set<string>();
  
  for (const memory of memories) {
    categories[memory.classification.category]++;
    if (memory.causation.initiator.type === 'Party') {
      actors.add(memory.causation.initiator.partyId);
    }
  }
  
  const first = memories[0];
  const last = memories[memories.length - 1];
  const durationMs = last ? last.timestamp - first.timestamp : 0;
  
  return {
    headline: `${memories.length} events across ${chapters.length} chapters`,
    narrative: generateNarrativeText(memories, chapters),
    stats: {
      totalEvents: memories.length,
      duration: msToDuration(durationMs),
      keyActors: Array.from(actors),
      categories,
    },
  };
}

function generateAgreementSummary(memories: readonly Memory[]): StorySummary {
  const base = generateSummary(memories, []);
  
  // Find key moments
  const created = memories.find(m => m.content.what.includes('Created'));
  const activated = memories.find(m => (m.content.data as any)?.newStatus === 'Active');
  const concluded = memories.find(m => 
    ['Fulfilled', 'Terminated', 'Breached', 'Expired'].includes((m.content.data as any)?.newStatus)
  );
  
  let narrative = 'This agreement ';
  if (created) narrative += `was created on ${new Date(created.timestamp).toLocaleDateString()}. `;
  if (activated) narrative += `Became active on ${new Date(activated.timestamp).toLocaleDateString()}. `;
  if (concluded) narrative += `Concluded as ${(concluded.content.data as any)?.newStatus} on ${new Date(concluded.timestamp).toLocaleDateString()}.`;
  
  return {
    ...base,
    narrative,
  };
}

function generatePeriodSummary(memories: readonly Memory[], from: Timestamp, to: Timestamp): StorySummary {
  const base = generateSummary(memories, []);
  
  const milestones = memories.filter(m => m.significance.level === 'Milestone');
  const anomalies = memories.filter(m => m.classification.category === 'Anomaly');
  
  let narrative = `During this period, ${memories.length} events occurred. `;
  if (milestones.length > 0) narrative += `${milestones.length} milestone(s) were achieved. `;
  if (anomalies.length > 0) narrative += `${anomalies.length} anomaly(ies) were recorded.`;
  
  return {
    ...base,
    headline: `${formatDateRange(from, to)}: ${memories.length} events`,
    narrative,
  };
}

function generateCausalSummary(
  rootCause: Memory,
  origin: Memory,
  effects: readonly Memory[]
): string {
  let summary = `This event was `;
  
  if (rootCause.id === origin.id) {
    summary += `a root cause with ${effects.length} downstream effect(s).`;
  } else {
    summary += `caused by "${rootCause.content.narrative.summary}" `;
    summary += `and led to ${effects.length} effect(s).`;
  }
  
  return summary;
}

function generateNarrativeText(memories: readonly Memory[], chapters: readonly Chapter[]): string {
  if (memories.length === 0) return 'No events recorded.';
  if (memories.length === 1) return memories[0].content.narrative.summary;
  
  const first = memories[0];
  const last = memories[memories.length - 1];
  
  return `The story began with "${first.content.narrative.summary}" ` +
         `and most recently "${last.content.narrative.summary}". ` +
         `Over ${chapters.length} chapter(s), ${memories.length} significant moments were recorded.`;
}

function determineStatus(memories: readonly Memory[]): 'Ongoing' | 'Concluded' | 'Abandoned' {
  if (memories.length === 0) return 'Abandoned';
  
  const last = memories[memories.length - 1];
  const daysSinceLast = (Date.now() - last.timestamp) / (24 * 60 * 60 * 1000);
  
  if (daysSinceLast > 90) return 'Abandoned';
  
  // Check for conclusion markers
  const concludedStatuses = ['Fulfilled', 'Terminated', 'Completed', 'Destroyed'];
  if (concludedStatuses.some(s => last.content.what.includes(s))) {
    return 'Concluded';
  }
  
  return 'Ongoing';
}

function determineAgreementStatus(memories: readonly Memory[]): 'Ongoing' | 'Concluded' | 'Abandoned' {
  const last = memories[memories.length - 1];
  if (!last) return 'Abandoned';
  
  const finalStatuses = ['Fulfilled', 'Terminated', 'Breached', 'Expired'];
  const status = (last.content.data as any)?.newStatus || (last.content.data as any)?.status;
  
  if (finalStatuses.includes(status)) return 'Concluded';
  
  return 'Ongoing';
}

function findConclusion(memories: readonly Memory[]): Conclusion | undefined {
  const last = memories[memories.length - 1];
  if (!last) return undefined;
  
  const status = (last.content.data as any)?.newStatus || (last.content.data as any)?.status;
  
  const conclusionMap: Record<string, Conclusion['type']> = {
    'Fulfilled': 'Success',
    'Terminated': 'Neutral',
    'Breached': 'Failure',
    'Expired': 'Neutral',
  };
  
  if (conclusionMap[status]) {
    return {
      type: conclusionMap[status],
      summary: last.content.narrative.summary,
      lessons: last.content.narrative.implications,
    };
  }
  
  return undefined;
}

function groupByGranularity(
  memories: readonly Memory[],
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month'
): TimelinePeriod[] {
  const msPerUnit: Record<string, number> = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };
  
  const unitMs = msPerUnit[granularity];
  const groups = new Map<number, Memory[]>();
  
  for (const memory of memories) {
    const bucket = Math.floor(memory.timestamp / unitMs) * unitMs;
    if (!groups.has(bucket)) {
      groups.set(bucket, []);
    }
    groups.get(bucket)!.push(memory);
  }
  
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([start, periodMemories]) => ({
      start,
      end: start + unitMs,
      label: formatPeriodLabel(start, granularity),
      memories: periodMemories,
      summary: `${periodMemories.length} event(s)`,
      significance: getMaxSignificance(periodMemories),
    }));
}

function getMaxSignificance(memories: readonly Memory[]): SignificanceLevel {
  const priority: Record<SignificanceLevel, number> = {
    'Trace': 0, 'Debug': 1, 'Info': 2, 'Notice': 3,
    'Warning': 4, 'Error': 5, 'Critical': 6, 'Milestone': 7,
  };
  
  let max: SignificanceLevel = 'Trace';
  for (const m of memories) {
    if (priority[m.significance.level] > priority[max]) {
      max = m.significance.level;
    }
  }
  return max;
}

function msToDuration(ms: number): Duration {
  if (ms < 60 * 60 * 1000) return { amount: Math.round(ms / 60000), unit: 'hours' };
  if (ms < 24 * 60 * 60 * 1000) return { amount: Math.round(ms / 3600000), unit: 'hours' };
  if (ms < 7 * 24 * 60 * 60 * 1000) return { amount: Math.round(ms / 86400000), unit: 'days' };
  if (ms < 30 * 24 * 60 * 60 * 1000) return { amount: Math.round(ms / 604800000), unit: 'weeks' };
  return { amount: Math.round(ms / 2592000000), unit: 'months' };
}

function formatDateRange(from: Timestamp, to: Timestamp): string {
  const fromDate = new Date(from).toLocaleDateString();
  const toDate = new Date(to).toLocaleDateString();
  if (fromDate === toDate) return fromDate;
  return `${fromDate} - ${toDate}`;
}

function formatPeriodLabel(timestamp: Timestamp, granularity: string): string {
  const date = new Date(timestamp);
  switch (granularity) {
    case 'minute': return date.toLocaleTimeString();
    case 'hour': return `${date.toLocaleDateString()} ${date.getHours()}:00`;
    case 'day': return date.toLocaleDateString();
    case 'week': return `Week of ${date.toLocaleDateString()}`;
    case 'month': return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    default: return date.toISOString();
  }
}

function generateStoryId(): EntityId {
  return `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` as EntityId;
}

