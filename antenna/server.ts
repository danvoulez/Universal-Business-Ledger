/**
 * ANTENNA SERVER - The HTTP Interface
 * 
 * This is the "ignition" that makes the Ledger accessible over HTTP.
 * 
 * Endpoints:
 *   POST /chat              - Conversational AI interface
 *   POST /intend            - Execute any intent
 *   GET  /affordances       - Get available actions
 *   POST /session/start     - Start conversation session
 *   GET  /session/:id       - Get session state
 *   GET  /health            - Health check
 *   WS   /subscribe         - Real-time updates
 */

import type { EntityId, ActorReference } from '../core/shared/types';
import type { LLMAdapter } from '../sdk/types';
import type { IntentHandler } from '../core/api/intent-api';
import { createConversationalAgent } from './agent/implementation';
import { createAgentAPIRouter } from './agent/api';
import type { AgentAPIRouter } from './agent/api';
import { AntennaWebSocketServer } from './websocket';
import type { WebSocketHandlers } from './websocket';
import { createAnthropicAdapter } from '../sdk/anthropic';
import { createOpenAIAdapter } from '../sdk/openai';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface AntennaConfig {
  /** Port to listen on */
  port: number;
  
  /** Host to bind to */
  host?: string;
  
  /** CORS origins */
  corsOrigins?: string[];
  
  /** Default realm for new sessions */
  defaultRealmId?: EntityId;
  
  /** SDK Adapters */
  adapters?: {
    llm?: LLMAdapter;
    // Add more as needed
  };
  
  /** Intent handler from core */
  intentHandler?: IntentHandler;
}

export interface AntennaInstance {
  /** Start the server */
  start(): Promise<void>;
  
  /** Stop the server */
  stop(): Promise<void>;
  
  /** Get the agent router (for testing) */
  getAgentRouter(): AgentAPIRouter;
}

// ============================================================================
// SERVER IMPLEMENTATION
// ============================================================================

/**
 * Create an Antenna instance.
 */
export function createAntenna(config: AntennaConfig): AntennaInstance {
  const {
    port,
    host = '0.0.0.0',
    corsOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    defaultRealmId = 'default-realm' as EntityId,
    adapters = {},
    intentHandler,
  } = config;
  
  // LLM adapter and agent will be initialized in start()
  let llmAdapter: LLMAdapter | undefined = adapters.llm;
  let agent: any = null;
  let agentRouter: AgentAPIRouter | null = null;
  
  // HTTP server state
  let server: any = null;
  let wsServer: AntennaWebSocketServer | null = null;
  
  return {
    async start() {
      // Initialize LLM adapter from environment variables
      if (!llmAdapter) {
        const anthropicKey = process.env.ANTHROPIC_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        
        if (anthropicKey && anthropicKey !== 'your-anthropic-api-key') {
          console.log('🤖 Using Anthropic Claude');
          llmAdapter = createAnthropicAdapter();
          await llmAdapter.initialize({
            credentials: { apiKey: anthropicKey },
            options: { model: 'claude-sonnet-4-20250514' },
          });
        } else if (openaiKey && openaiKey !== 'your-openai-api-key') {
          console.log('🤖 Using OpenAI');
          llmAdapter = createOpenAIAdapter();
          await llmAdapter.initialize({
            credentials: { apiKey: openaiKey },
            options: { model: 'gpt-4' },
          });
        } else {
          console.log('⚠️  No LLM API keys found, using mock adapter');
          llmAdapter = createMockLLMAdapter();
        }
      }
      
      // Create the conversational agent with initialized LLM
      agent = createConversationalAgent(
        {
          llm: llmAdapter,
          intents: intentHandler || createMockIntentHandler(),
        },
        { defaultRealmId }
      );
      
      // Create API router
      agentRouter = createAgentAPIRouter(agent);
      
      // For Node.js environments, use native http module
      // In production, you'd use Hono, Express, or similar
      
      const http = await import('node:http');
      
      server = http.createServer(async (req, res) => {
        // CORS headers
        const origin = req.headers.origin || '';
        if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        
        // Handle preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        
        // Parse body for POST requests
        let body: any = {};
        if (req.method === 'POST') {
          body = await parseBody(req);
        }
        
        // Route requests
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;
        
        try {
          let result: any;
          
          // Health check
          if (path === '/health' && req.method === 'GET') {
            result = { status: 'ok', service: 'antenna', timestamp: Date.now() };
          }
          
          // Chat endpoint
          else if (path === '/chat' && req.method === 'POST') {
            if (!agentRouter) {
              throw new Error('Agent not initialized');
            }
            result = await agentRouter.chat(body);
          }
          
          // Start session
          else if (path === '/session/start' && req.method === 'POST') {
            if (!agentRouter) {
              throw new Error('Agent not initialized');
            }
            result = await agentRouter.startSession(body);
          }
          
          // Get session
          else if (path.startsWith('/session/') && req.method === 'GET') {
            if (!agentRouter) {
              throw new Error('Agent not initialized');
            }
            const sessionId = path.split('/')[2] as EntityId;
            result = await agentRouter.getSession(sessionId);
            if (!result) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Session not found' }));
              return;
            }
          }
          
          // Suggestions
          else if (path === '/suggestions' && req.method === 'GET') {
            if (!agentRouter) {
              throw new Error('Agent not initialized');
            }
            const sessionId = url.searchParams.get('sessionId') as EntityId;
            const partialInput = url.searchParams.get('partialInput') || undefined;
            result = await agentRouter.getSuggestions({ sessionId, partialInput });
          }
          
          // Intent endpoint (from core/api/http-server)
          else if ((path === '/' || path === '/intend') && req.method === 'POST') {
            if (intentHandler) {
              const intent = {
                intent: body.intent,
                realm: body.realm || defaultRealmId,
                actor: body.actor || { type: 'Anonymous' } as ActorReference,
                timestamp: Date.now(),
                payload: body.payload || {},
              };
              result = await intentHandler.handle(intent);
            } else {
              result = { error: 'Intent handler not configured' };
            }
          }
          
          // Affordances
          else if (path === '/affordances' && req.method === 'GET') {
            if (intentHandler) {
              const realm = (url.searchParams.get('realm') || defaultRealmId) as EntityId;
              const actor: ActorReference = { type: 'Anonymous' };
              result = await intentHandler.getAvailableIntents(realm, actor);
            } else {
              result = [];
            }
          }
          
          // Not found
          else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found', path }));
            return;
          }
          
          // Send response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          
        } catch (error: any) {
          console.error('Antenna error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      
      server.listen(port, host, () => {
        // Start WebSocket server
        if (intentHandler) {
          const wsHandlers: WebSocketHandlers = {
            getCurrentSequence: () => BigInt(0), // TODO: Get from event store
            handleIntent: async (intent) => {
              const result = await intentHandler.handle({
                intent: intent.intent,
                realm: intent.realm || defaultRealmId,
                actor: intent.actor || { type: 'Anonymous' } as ActorReference,
                timestamp: Date.now(),
                payload: intent.payload || {},
              });
              return result;
            },
            getEventsFrom: async function* (sequence: bigint) {
              // TODO: Implement event streaming from event store
              yield* [];
            },
            handleChat: async (request) => {
              if (!agentRouter) {
                throw new Error('Agent not initialized');
              }
              const chatResult = await agentRouter.chat({
                sessionId: request.sessionId,
                message: request.message,
                startSession: request.startSession,
              });
              return chatResult;
            },
          };
          
          wsServer = new AntennaWebSocketServer(
            { server, path: '/subscribe' },
            wsHandlers
          );
          wsServer.start();
        }
        
        console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     █████╗ ███╗   ██╗████████╗███████╗███╗   ██╗███╗   ██╗ █████╗            ║
║    ██╔══██╗████╗  ██║╚══██╔══╝██╔════╝████╗  ██║████╗  ██║██╔══██╗           ║
║    ███████║██╔██╗ ██║   ██║   █████╗  ██╔██╗ ██║██╔██╗ ██║███████║           ║
║    ██╔══██║██║╚██╗██║   ██║   ██╔══╝  ██║╚██╗██║██║╚██╗██║██╔══██║           ║
║    ██║  ██║██║ ╚████║   ██║   ███████╗██║ ╚████║██║ ╚████║██║  ██║           ║
║    ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═══╝╚═╝  ╚═╝           ║
║                                                                               ║
║    Universal Business Ledger - Flagship HTTP Interface                        ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

📡 Antenna listening on http://${host}:${port}

HTTP Endpoints:
  POST /chat              Conversational AI interface
  POST /intend            Execute any intent
  GET  /affordances       Get available actions
  POST /session/start     Start conversation session
  GET  /session/:id       Get session state
  GET  /suggestions       Get autocomplete suggestions
  GET  /health            Health check

WebSocket:
  WS   /subscribe         Real-time event subscriptions

Ready to receive signals! 🚀
`);
      });
    },
    
    async stop() {
      if (wsServer) {
        wsServer.stop();
        wsServer = null;
      }
      if (server) {
        server.close();
        console.log('Antenna stopped');
      }
    },
    
    getAgentRouter() {
      if (!agentRouter) {
        throw new Error('Agent not initialized. Call start() first.');
      }
      return agentRouter;
    },
  };
}

/**
 * Start Antenna with minimal configuration.
 * Convenience function for quick deployment.
 */
export async function startAntenna(config: Partial<AntennaConfig> = {}): Promise<AntennaInstance> {
  const antenna = createAntenna({
    port: config.port || parseInt(process.env.PORT || '3000'),
    ...config,
  });
  
  await antenna.start();
  return antenna;
}

// ============================================================================
// HELPERS
// ============================================================================

async function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// ============================================================================
// MOCK ADAPTERS (for development/testing)
// ============================================================================

function createMockLLMAdapter(): LLMAdapter {
  return {
    name: 'MockLLM',
    version: '1.0.0',
    platform: 'Custom',
    category: 'LLM',
    model: 'mock-1',
    
    async initialize() {},
    async healthCheck() { return { healthy: true, latencyMs: 0 }; },
    async shutdown() {},
    
    async complete(request) {
      // Simple mock that echoes back
      const lastMessage = request.messages[request.messages.length - 1];
      return {
        content: `I understood: "${lastMessage.content}"\n\nThis is a mock response. Configure a real LLM adapter (Anthropic, OpenAI) for actual AI capabilities.`,
        tokensUsed: 50,
        finishReason: 'stop',
      };
    },
    
    async *stream(request) {
      const response = await this.complete(request);
      yield { content: response.content, done: true };
    },
    
    async embed(texts) {
      return texts.map(() => new Array(384).fill(0).map(() => Math.random()));
    },
    
    estimateTokens(text) {
      return Math.ceil(text.length / 4);
    },
  };
}

function createMockIntentHandler(): IntentHandler {
  return {
    async handle(intent) {
      return {
        success: true,
        outcome: { type: 'Nothing', reason: 'Mock handler - configure real intent handler' },
        events: [],
        affordances: [
          { intent: 'query', description: 'Query the ledger', required: [] },
          { intent: 'propose', description: 'Propose an agreement', required: ['agreementType'] },
        ],
        meta: { processedAt: Date.now(), processingTime: 1 },
      };
    },
    
    async getAvailableIntents(realm, actor, context) {
      return [
        { intent: 'query', description: 'Query entities and agreements', required: [] },
        { intent: 'propose', description: 'Propose a new agreement', required: ['agreementType', 'parties'] },
        { intent: 'register', description: 'Register a new entity', required: ['entityType', 'identity'] },
      ];
    },
    
    async validate(intent) {
      return { valid: true, errors: [], warnings: [] };
    },
    
    async explain(intent) {
      return {
        description: `This would execute the "${intent.intent}" intent`,
        steps: ['Validate input', 'Check permissions', 'Execute', 'Record events'],
        effects: ['Events will be recorded', 'State will be updated'],
        requirements: ['Valid session', 'Appropriate permissions'],
      };
    },
  };
}

// ============================================================================
// AUTO-START WHEN RUN DIRECTLY
// ============================================================================

// Start the antenna when this file is executed directly
startAntenna().catch(err => {
  console.error('❌ Failed to start Antenna:', err);
  process.exit(1);
});

