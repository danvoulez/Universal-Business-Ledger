/**
 * AGENT MEMORY - Conversation Context
 * 
 * What the AI agent remembers about conversations.
 * NOT to be confused with core/trajectory (system audit trail).
 * 
 * Memory = What the agent recalls to provide context
 * Trajectory = What the system records for compliance
 * 
 * This includes:
 * - Conversation history
 * - User preferences learned over time
 * - Context from previous interactions
 * - Consolidated summaries of past conversations
 */

import type { EntityId, Timestamp } from '../../core/shared/types';

// ============================================================================
// MEMORY TYPES
// ============================================================================

/**
 * A single memory unit - something the agent remembers.
 */
export interface Memory {
  /** Unique identifier */
  readonly id: EntityId;
  
  /** When this memory was formed */
  readonly createdAt: Timestamp;
  
  /** When this memory was last accessed */
  readonly lastAccessedAt: Timestamp;
  
  /** The type of memory */
  readonly type: MemoryType;
  
  /** The actual content */
  readonly content: string;
  
  /** Structured data if applicable */
  readonly data?: Record<string, unknown>;
  
  /** Who this memory is about/for */
  readonly subjectId?: EntityId;
  
  /** The realm this memory belongs to */
  readonly realmId: EntityId;
  
  /** How important is this memory (affects retention) */
  readonly importance: MemoryImportance;
  
  /** Tags for retrieval */
  readonly tags: readonly string[];
  
  /** Embedding vector for semantic search */
  readonly embedding?: readonly number[];
}

export type MemoryType =
  | 'Conversation'    // A conversation exchange
  | 'Preference'      // User preference learned
  | 'Fact'            // A fact about the user/context
  | 'Summary'         // Consolidated summary
  | 'Instruction'     // Special instructions to remember
  | 'Feedback';       // User feedback on agent behavior

export type MemoryImportance =
  | 'Critical'        // Always include in context
  | 'High'            // Include when relevant
  | 'Medium'          // Include if space permits
  | 'Low';            // Archive, rarely include

// ============================================================================
// MEMORY CONTEXT - What gets loaded for a conversation
// ============================================================================

/**
 * The context loaded for a conversation.
 */
export interface MemoryContext {
  /** Recent conversation history */
  readonly recentMessages: readonly ConversationMessage[];
  
  /** Relevant memories retrieved */
  readonly relevantMemories: readonly Memory[];
  
  /** User facts/preferences */
  readonly userContext: UserContext;
  
  /** System instructions */
  readonly systemInstructions: readonly string[];
  
  /** Total tokens estimated */
  readonly estimatedTokens: number;
}

export interface ConversationMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: Timestamp;
  readonly metadata?: Record<string, unknown>;
}

export interface UserContext {
  readonly userId: EntityId;
  readonly name?: string;
  readonly preferences: Record<string, unknown>;
  readonly facts: readonly string[];
}

// ============================================================================
// MEMORY STORE
// ============================================================================

export interface MemoryStore {
  /** Save a memory */
  save(memory: Memory): Promise<void>;
  
  /** Get memory by ID */
  get(id: EntityId): Promise<Memory | null>;
  
  /** Search memories by text */
  search(query: string, options?: MemorySearchOptions): Promise<readonly Memory[]>;
  
  /** Search by semantic similarity (requires embeddings) */
  searchSemantic(embedding: readonly number[], options?: MemorySearchOptions): Promise<readonly Memory[]>;
  
  /** Get memories for a subject */
  forSubject(subjectId: EntityId, options?: MemorySearchOptions): Promise<readonly Memory[]>;
  
  /** Get recent memories */
  recent(realmId: EntityId, limit?: number): Promise<readonly Memory[]>;
  
  /** Delete old/low-importance memories */
  consolidate(realmId: EntityId): Promise<ConsolidationResult>;
}

export interface MemorySearchOptions {
  readonly types?: readonly MemoryType[];
  readonly minImportance?: MemoryImportance;
  readonly realmId?: EntityId;
  readonly limit?: number;
  readonly tags?: readonly string[];
}

export interface ConsolidationResult {
  readonly memoriesRemoved: number;
  readonly summariesCreated: number;
  readonly tokensFreed: number;
}

// ============================================================================
// MEMORY MANAGER
// ============================================================================

export interface MemoryManager {
  /** Load context for a conversation */
  loadContext(sessionId: EntityId, query?: string): Promise<MemoryContext>;
  
  /** Remember something from the conversation */
  remember(memory: Omit<Memory, 'id' | 'createdAt' | 'lastAccessedAt'>): Promise<Memory>;
  
  /** Update user preference */
  setPreference(userId: EntityId, key: string, value: unknown): Promise<void>;
  
  /** Record a fact about the user */
  recordFact(userId: EntityId, fact: string): Promise<void>;
  
  /** Consolidate old memories into summaries */
  consolidate(realmId: EntityId): Promise<ConsolidationResult>;
  
  /** Clear conversation history (keep preferences/facts) */
  clearConversation(sessionId: EntityId): Promise<void>;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

/**
 * Create an in-memory store (for development/testing).
 */
export function createInMemoryStore(): MemoryStore {
  const memories = new Map<EntityId, Memory>();
  
  return {
    async save(memory) {
      memories.set(memory.id, memory);
    },
    
    async get(id) {
      return memories.get(id) || null;
    },
    
    async search(query, options) {
      const queryLower = query.toLowerCase();
      return Array.from(memories.values())
        .filter(m => {
          if (options?.types && !options.types.includes(m.type)) return false;
          if (options?.realmId && m.realmId !== options.realmId) return false;
          return m.content.toLowerCase().includes(queryLower);
        })
        .slice(0, options?.limit || 10);
    },
    
    async searchSemantic(embedding, options) {
      // Would use vector similarity - for now, return recent
      return this.recent(options?.realmId || 'default' as EntityId, options?.limit);
    },
    
    async forSubject(subjectId, options) {
      return Array.from(memories.values())
        .filter(m => m.subjectId === subjectId)
        .slice(0, options?.limit || 20);
    },
    
    async recent(realmId, limit = 10) {
      return Array.from(memories.values())
        .filter(m => m.realmId === realmId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    },
    
    async consolidate(realmId) {
      // Simple consolidation: remove low-importance old memories
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      
      let removed = 0;
      for (const [id, memory] of memories) {
        if (
          memory.realmId === realmId &&
          memory.importance === 'Low' &&
          memory.createdAt < oneWeekAgo
        ) {
          memories.delete(id);
          removed++;
        }
      }
      
      return {
        memoriesRemoved: removed,
        summariesCreated: 0,
        tokensFreed: removed * 100, // Rough estimate
      };
    },
  };
}

/**
 * Create a memory manager.
 */
export function createMemoryManager(
  store: MemoryStore,
  options?: {
    maxContextTokens?: number;
    recentMessageCount?: number;
  }
): MemoryManager {
  const maxTokens = options?.maxContextTokens || 4000;
  const recentCount = options?.recentMessageCount || 10;
  
  // Track conversation messages per session
  const sessionMessages = new Map<EntityId, ConversationMessage[]>();
  
  return {
    async loadContext(sessionId, query) {
      const messages = sessionMessages.get(sessionId) || [];
      const recentMessages = messages.slice(-recentCount);
      
      // Get relevant memories
      const relevantMemories = query 
        ? await store.search(query, { limit: 5 })
        : [];
      
      // Build user context from stored preferences/facts
      const userFacts = await store.search('', { 
        types: ['Preference', 'Fact'], 
        limit: 10 
      });
      
      const userContext: UserContext = {
        userId: sessionId, // Simplified - would be actual user ID
        preferences: {},
        facts: userFacts.filter(m => m.type === 'Fact').map(m => m.content),
      };
      
      // Load preferences
      for (const mem of userFacts.filter(m => m.type === 'Preference')) {
        if (mem.data) {
          Object.assign(userContext.preferences, mem.data);
        }
      }
      
      // Get system instructions
      const instructions = await store.search('', { types: ['Instruction'], limit: 5 });
      
      return {
        recentMessages,
        relevantMemories,
        userContext,
        systemInstructions: instructions.map(m => m.content),
        estimatedTokens: estimateTokens(recentMessages, relevantMemories),
      };
    },
    
    async remember(partial) {
      const memory: Memory = {
        ...partial,
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2)}` as EntityId,
        createdAt: Date.now() as Timestamp,
        lastAccessedAt: Date.now() as Timestamp,
      };
      
      await store.save(memory);
      return memory;
    },
    
    async setPreference(userId, key, value) {
      await this.remember({
        type: 'Preference',
        content: `User prefers ${key}: ${value}`,
        data: { [key]: value },
        subjectId: userId,
        realmId: 'default' as EntityId,
        importance: 'High',
        tags: ['preference', key],
      });
    },
    
    async recordFact(userId, fact) {
      await this.remember({
        type: 'Fact',
        content: fact,
        subjectId: userId,
        realmId: 'default' as EntityId,
        importance: 'Medium',
        tags: ['fact'],
      });
    },
    
    async consolidate(realmId) {
      return store.consolidate(realmId);
    },
    
    async clearConversation(sessionId) {
      sessionMessages.delete(sessionId);
    },
  };
}

function estimateTokens(
  messages: readonly ConversationMessage[], 
  memories: readonly Memory[]
): number {
  let chars = 0;
  for (const m of messages) chars += m.content.length;
  for (const m of memories) chars += m.content.length;
  return Math.ceil(chars / 4); // Rough token estimate
}

