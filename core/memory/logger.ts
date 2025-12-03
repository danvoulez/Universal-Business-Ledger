/**
 * UNIVERSAL LOGGER - Memory-Based Logging
 * 
 * This logger doesn't just write text to files.
 * It forms memories that tell stories.
 * 
 * Features:
 * - Traditional logging interface (for familiarity)
 * - Automatic memory formation from logs
 * - Context propagation (correlation, causation)
 * - Multiple perspectives (dev, ops, business)
 * - Structured + narrative output
 * - Integration with event store
 */

import type { EntityId, Timestamp, ActorReference, Event } from '../schema/ledger';
import type { EventStore } from '../store/event-store';
import type { 
  Memory, 
  MemoryCategory, 
  SystemLayer, 
  SignificanceLevel,
  ViewerType,
  MemoryFormer,
  MemoryContext,
  Observation,
  AnomalyData,
  MilestoneData,
  ReflectionData,
} from './narrative';
import type { MemoryStore } from './story';

// ============================================================================
// LOGGER INTERFACE
// ============================================================================

export interface Logger {
  // Traditional log levels
  trace(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void;
  
  // Narrative logging
  milestone(name: string, description: string, metrics?: Record<string, number>): void;
  decision(what: string, options: string[], chosen: string, reason: string): void;
  relationship(action: string, entity1: string, entity2: string, context?: string): void;
  
  // Context management
  child(context: Partial<LogContext>): Logger;
  withCorrelation(correlationId: EntityId): Logger;
  withSpan(spanId: string, parentSpanId?: string): Logger;
  withActor(actor: ActorReference): Logger;
  withIntent(intent: string): Logger;
  withTags(...tags: string[]): Logger;
  
  // Timing
  time(label: string): () => void;
  
  // Structured output
  event(event: Event): void;
  
  // Get context
  getContext(): LogContext;
}

export interface LogContext {
  readonly realm: EntityId;
  readonly correlationId: EntityId;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  readonly actor: ActorReference;
  readonly intent?: string;
  readonly tags: readonly string[];
  readonly layer: SystemLayer;
  readonly domain: string;
}

// ============================================================================
// LOG OUTPUT FORMATS
// ============================================================================

export interface LogOutput {
  write(entry: LogEntry): void | Promise<void>;
}

export interface LogEntry {
  readonly timestamp: Timestamp;
  readonly level: SignificanceLevel;
  readonly message: string;
  readonly data?: Record<string, unknown>;
  readonly context: LogContext;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
  readonly timing?: {
    readonly label: string;
    readonly durationMs: number;
  };
  readonly memory?: Memory;
}

// ============================================================================
// CONSOLE OUTPUT (Human-readable)
// ============================================================================

export function createConsoleOutput(options: ConsoleOutputOptions = {}): LogOutput {
  const {
    color = true,
    timestamps = true,
    context = 'minimal',
    perspective = 'Developer',
  } = options;
  
  const levelColors: Record<SignificanceLevel, string> = {
    'Trace': '\x1b[90m',      // Gray
    'Debug': '\x1b[36m',      // Cyan
    'Info': '\x1b[32m',       // Green
    'Notice': '\x1b[34m',     // Blue
    'Warning': '\x1b[33m',    // Yellow
    'Error': '\x1b[31m',      // Red
    'Critical': '\x1b[35m',   // Magenta
    'Milestone': '\x1b[95m',  // Bright Magenta
  };
  
  const levelIcons: Record<SignificanceLevel, string> = {
    'Trace': '·',
    'Debug': '○',
    'Info': '●',
    'Notice': '◆',
    'Warning': '⚠',
    'Error': '✗',
    'Critical': '☠',
    'Milestone': '★',
  };
  
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  const bold = '\x1b[1m';
  
  return {
    write(entry: LogEntry) {
      const parts: string[] = [];
      
      // Timestamp
      if (timestamps) {
        const ts = new Date(entry.timestamp).toISOString();
        parts.push(color ? `${dim}${ts}${reset}` : ts);
      }
      
      // Level
      const levelColor = color ? levelColors[entry.level] : '';
      const icon = levelIcons[entry.level];
      parts.push(`${levelColor}${icon} ${entry.level.toUpperCase().padEnd(8)}${color ? reset : ''}`);
      
      // Message
      parts.push(color ? `${bold}${entry.message}${reset}` : entry.message);
      
      // Context (minimal)
      if (context !== 'none') {
        const ctx: string[] = [];
        if (entry.context.correlationId) ctx.push(`cid:${entry.context.correlationId.slice(0, 8)}`);
        if (entry.context.spanId) ctx.push(`span:${entry.context.spanId.slice(0, 8)}`);
        if (entry.context.intent) ctx.push(`intent:${entry.context.intent}`);
        if (ctx.length > 0) {
          parts.push(color ? `${dim}[${ctx.join(' ')}]${reset}` : `[${ctx.join(' ')}]`);
        }
      }
      
      console.log(parts.join(' '));
      
      // Data
      if (entry.data && Object.keys(entry.data).length > 0) {
        const dataStr = JSON.stringify(entry.data, null, 2);
        console.log(color ? `${dim}${dataStr}${reset}` : dataStr);
      }
      
      // Error
      if (entry.error) {
        console.log(color ? `${levelColors['Error']}${entry.error.stack || entry.error.message}${reset}` : entry.error.stack || entry.error.message);
      }
      
      // Timing
      if (entry.timing) {
        console.log(color 
          ? `${dim}⏱ ${entry.timing.label}: ${entry.timing.durationMs}ms${reset}`
          : `⏱ ${entry.timing.label}: ${entry.timing.durationMs}ms`
        );
      }
      
      // Narrative perspective
      if (entry.memory) {
        const perspectiveView = entry.memory.perspectives.find(p => p.viewer === perspective);
        if (perspectiveView?.view.description) {
          console.log(color 
            ? `${dim}📖 ${perspectiveView.view.description}${reset}`
            : `📖 ${perspectiveView.view.description}`
          );
        }
      }
    },
  };
}

export interface ConsoleOutputOptions {
  readonly color?: boolean;
  readonly timestamps?: boolean;
  readonly context?: 'none' | 'minimal' | 'full';
  readonly perspective?: ViewerType;
}

// ============================================================================
// JSON OUTPUT (Structured)
// ============================================================================

export function createJsonOutput(options: JsonOutputOptions = {}): LogOutput {
  const {
    pretty = false,
    includeMemory = false,
    stream = process.stdout,
  } = options;
  
  return {
    write(entry: LogEntry) {
      const output: Record<string, unknown> = {
        timestamp: new Date(entry.timestamp).toISOString(),
        level: entry.level,
        message: entry.message,
        context: {
          realm: entry.context.realm,
          correlationId: entry.context.correlationId,
          spanId: entry.context.spanId,
          actor: entry.context.actor,
          intent: entry.context.intent,
          tags: entry.context.tags,
        },
      };
      
      if (entry.data) output.data = entry.data;
      if (entry.error) output.error = entry.error;
      if (entry.timing) output.timing = entry.timing;
      if (includeMemory && entry.memory) output.memory = entry.memory;
      
      const json = pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
      stream.write(json + '\n');
    },
  };
}

export interface JsonOutputOptions {
  readonly pretty?: boolean;
  readonly includeMemory?: boolean;
  readonly stream?: NodeJS.WritableStream;
}

// ============================================================================
// MEMORY OUTPUT (Forms memories from logs)
// ============================================================================

export function createMemoryOutput(
  memoryStore: MemoryStore,
  memoryFormer: MemoryFormer
): LogOutput {
  return {
    async write(entry: LogEntry) {
      // Only form memories for significant logs
      const significanceThreshold: Record<SignificanceLevel, number> = {
        'Trace': 0, 'Debug': 1, 'Info': 2, 'Notice': 3,
        'Warning': 4, 'Error': 5, 'Critical': 6, 'Milestone': 7,
      };
      
      if (significanceThreshold[entry.level] < 2) {
        return; // Skip trace and debug
      }
      
      const context: MemoryContext = {
        realmId: entry.context.realm,
        correlationId: entry.context.correlationId,
        spanId: entry.context.spanId,
        parentSpanId: entry.context.parentSpanId,
        initiator: entry.context.actor,
        intent: entry.context.intent,
        tags: entry.context.tags,
      };
      
      let memory: Memory;
      
      if (entry.error) {
        memory = memoryFormer.anomaly({
          type: entry.level === 'Critical' ? 'Error' : entry.level === 'Error' ? 'Error' : 'Warning',
          message: entry.message,
          error: new Error(entry.error.message),
          context: entry.data || {},
          recoverable: entry.level !== 'Critical',
        }, context);
      } else if (entry.level === 'Milestone') {
        memory = memoryFormer.milestone({
          name: entry.message,
          description: entry.data?.description as string || entry.message,
          metrics: entry.data?.metrics as Record<string, number>,
        }, context);
      } else {
        memory = memoryFormer.observe({
          what: entry.message,
          category: mapLevelToCategory(entry.level),
          layer: entry.context.layer,
          data: entry.data || {},
          significance: entry.level,
        }, context);
      }
      
      await memoryStore.store(memory);
    },
  };
}

function mapLevelToCategory(level: SignificanceLevel): MemoryCategory {
  switch (level) {
    case 'Error':
    case 'Critical':
      return 'Anomaly';
    case 'Milestone':
      return 'Milestone';
    case 'Warning':
    case 'Notice':
      return 'Observation';
    default:
      return 'Observation';
  }
}

// ============================================================================
// LOGGER IMPLEMENTATION
// ============================================================================

export function createLogger(
  initialContext: Partial<LogContext>,
  outputs: LogOutput[],
  memoryFormer?: MemoryFormer
): Logger {
  const context: LogContext = {
    realm: initialContext.realm || 'default' as EntityId,
    correlationId: initialContext.correlationId || generateCorrelationId(),
    spanId: initialContext.spanId,
    parentSpanId: initialContext.parentSpanId,
    actor: initialContext.actor || { type: 'System', systemId: 'logger' },
    intent: initialContext.intent,
    tags: initialContext.tags || [],
    layer: initialContext.layer || 'Business',
    domain: initialContext.domain || 'General',
  };
  
  const timers = new Map<string, number>();
  
  function log(
    level: SignificanceLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
    
    for (const output of outputs) {
      output.write(entry);
    }
  }
  
  const logger: Logger = {
    trace: (msg, data) => log('Trace', msg, data),
    debug: (msg, data) => log('Debug', msg, data),
    info: (msg, data) => log('Info', msg, data),
    warn: (msg, data) => log('Warning', msg, data),
    error: (msg, err, data) => log('Error', msg, data, err),
    fatal: (msg, err, data) => log('Critical', msg, data, err),
    
    milestone(name, description, metrics) {
      log('Milestone', name, { description, metrics });
    },
    
    decision(what, options, chosen, reason) {
      log('Notice', `Decision: ${what}`, {
        options,
        chosen,
        reason,
      });
    },
    
    relationship(action, entity1, entity2, ctx) {
      log('Info', `${action}: ${entity1} ↔ ${entity2}`, {
        entity1,
        entity2,
        action,
        context: ctx,
      });
    },
    
    child(newContext) {
      return createLogger(
        { ...context, ...newContext },
        outputs,
        memoryFormer
      );
    },
    
    withCorrelation(correlationId) {
      return this.child({ correlationId });
    },
    
    withSpan(spanId, parentSpanId) {
      return this.child({ spanId, parentSpanId: parentSpanId || context.spanId });
    },
    
    withActor(actor) {
      return this.child({ actor });
    },
    
    withIntent(intent) {
      return this.child({ intent });
    },
    
    withTags(...tags) {
      return this.child({ tags: [...context.tags, ...tags] });
    },
    
    time(label) {
      const start = Date.now();
      timers.set(label, start);
      
      return () => {
        const duration = Date.now() - start;
        timers.delete(label);
        
        const entry: LogEntry = {
          timestamp: Date.now(),
          level: 'Debug',
          message: `Timer: ${label}`,
          context,
          timing: { label, durationMs: duration },
        };
        
        for (const output of outputs) {
          output.write(entry);
        }
      };
    },
    
    event(event) {
      if (!memoryFormer) {
        log('Info', event.type, event.payload as Record<string, unknown>);
        return;
      }
      
      const memory = memoryFormer.fromEvent(event, {
        realmId: context.realm,
        correlationId: context.correlationId,
        spanId: context.spanId,
        parentSpanId: context.parentSpanId,
        initiator: event.actor,
        intent: context.intent,
        tags: [...context.tags, event.type],
      });
      
      const entry: LogEntry = {
        timestamp: event.timestamp,
        level: memory.significance.level,
        message: memory.content.narrative.summary,
        data: memory.content.data,
        context,
        memory,
      };
      
      for (const output of outputs) {
        output.write(entry);
      }
    },
    
    getContext() {
      return context;
    },
  };
  
  return logger;
}

function generateCorrelationId(): EntityId {
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` as EntityId;
}

// ============================================================================
// GLOBAL LOGGER FACTORY
// ============================================================================

export interface LoggerFactory {
  /** Create a logger for a specific domain */
  forDomain(domain: string, layer?: SystemLayer): Logger;
  
  /** Create a logger for a request/operation */
  forRequest(correlationId: EntityId, intent?: string): Logger;
  
  /** Create a logger for an actor */
  forActor(actor: ActorReference): Logger;
  
  /** Get the root logger */
  root(): Logger;
  
  /** Add an output */
  addOutput(output: LogOutput): void;
}

export function createLoggerFactory(config: LoggerFactoryConfig): LoggerFactory {
  const outputs: LogOutput[] = [];
  
  // Setup default outputs
  if (config.console !== false) {
    outputs.push(createConsoleOutput(config.consoleOptions));
  }
  if (config.json) {
    outputs.push(createJsonOutput(config.jsonOptions));
  }
  if (config.memoryStore && config.memoryFormer) {
    outputs.push(createMemoryOutput(config.memoryStore, config.memoryFormer));
  }
  
  const rootLogger = createLogger(
    {
      realm: config.realm,
      actor: { type: 'System', systemId: 'root' },
      layer: 'Infrastructure',
      domain: 'System',
    },
    outputs,
    config.memoryFormer
  );
  
  return {
    forDomain(domain, layer = 'Business') {
      return rootLogger.child({ domain, layer });
    },
    
    forRequest(correlationId, intent) {
      return rootLogger.child({ correlationId, intent });
    },
    
    forActor(actor) {
      return rootLogger.child({ actor });
    },
    
    root() {
      return rootLogger;
    },
    
    addOutput(output) {
      outputs.push(output);
    },
  };
}

export interface LoggerFactoryConfig {
  readonly realm: EntityId;
  readonly console?: boolean;
  readonly consoleOptions?: ConsoleOutputOptions;
  readonly json?: boolean;
  readonly jsonOptions?: JsonOutputOptions;
  readonly memoryStore?: MemoryStore;
  readonly memoryFormer?: MemoryFormer;
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
import { createLoggerFactory, createMemoryFormer } from './memory';

// Create factory
const loggerFactory = createLoggerFactory({
  realm: 'my-company' as EntityId,
  console: true,
  consoleOptions: { color: true, perspective: 'Developer' },
  memoryStore: myMemoryStore,
  memoryFormer: createMemoryFormer(),
});

// Get loggers for different contexts
const apiLogger = loggerFactory.forDomain('API', 'Integration');
const bizLogger = loggerFactory.forDomain('Sales', 'Business');

// Use like traditional logger
apiLogger.info('Request received', { path: '/hire', method: 'POST' });

// With context propagation
const requestLogger = apiLogger
  .withCorrelation('cid-abc123')
  .withIntent('hire')
  .withActor({ type: 'Party', partyId: 'user-456' });

requestLogger.info('Processing hire request');
requestLogger.debug('Validating input', { employeeId: 'emp-789' });

// Timing
const done = requestLogger.time('database-query');
// ... do work ...
done(); // Logs: Timer: database-query (42ms)

// Narrative logging
bizLogger.milestone('First Sale', 'Completed first sale of the month', { revenue: 10000 });
bizLogger.decision(
  'Discount approval',
  ['0%', '10%', '20%'],
  '10%',
  'Customer is a returning client'
);

// Errors with context
try {
  throw new Error('Database connection failed');
} catch (err) {
  requestLogger.error('Failed to process request', err as Error, { retryable: true });
}
*/

