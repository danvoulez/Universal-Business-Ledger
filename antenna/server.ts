/**
 * ANTENNA SERVER - The HTTP Interface
 * 
 * This is the "ignition" that makes the Ledger accessible over HTTP.
 * 
 * Endpoints:
 *   POST /chat              - Conversational AI interface
 *   POST /intent            - Execute any intent (canonical)
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
import { createRedisRateLimiter } from '../core/operational/rate-limiter-redis';
import type { RateLimiter } from '../core/operational/governance';
import Redis from 'ioredis';
import * as admin from './admin';

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
  
  /** Redis connection string for rate limiting */
  redisUrl?: string;
  
  /** Master API key for delegation endpoint */
  masterApiKey?: string;
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
  
  // Rate limiter
  let rateLimiter: RateLimiter | null = null;
  
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
      
      // Initialize rate limiter if Redis URL is provided
      const redisUrl = config.redisUrl || process.env.REDIS_URL;
      if (redisUrl) {
        rateLimiter = createRedisRateLimiter({ redis: redisUrl });
        
        // Register default rate limits
        rateLimiter.register({
          id: 'intent-requests' as EntityId,
          name: 'Intent Requests',
          description: 'Rate limit for POST /intent requests',
          scope: { type: 'Realm' },
          limit: 100, // 100 requests per window
          window: 60000, // 1 minute
          action: { type: 'Reject', message: 'Rate limit exceeded. Please try again later.' },
          enabled: true,
        });
        
        console.log('✅ Rate limiter initialized with Redis');
      } else {
        console.log('⚠️  Rate limiter not initialized (REDIS_URL not set)');
      }
      
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
          else if ((path === '/' || path === '/intent') && req.method === 'POST') {
            // Extrair realmId da API key se disponível (não precisa informar em outros logins)
            let resolvedRealmId = body.realm || defaultRealmId;
            
            // Se tem Authorization header, tentar extrair realmId da API key
            const authHeader = req.headers.authorization;
            if (authHeader) {
              const apiKeyValue = authHeader.replace('Bearer ', '').trim();
              if (apiKeyValue && apiKeyValue.startsWith('ubl_')) {
                const apiKeyInfo = await admin.verifyApiKey(apiKeyValue);
                if (apiKeyInfo && apiKeyInfo.realmId) {
                  resolvedRealmId = apiKeyInfo.realmId;
                  // Se body.realm foi fornecido, validar que corresponde à API key
                  if (body.realm && body.realm !== apiKeyInfo.realmId) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                      error: 'Realm ID mismatch: API key belongs to a different realm',
                      apiKeyRealm: apiKeyInfo.realmId,
                      requestedRealm: body.realm,
                    }));
                    return;
                  }
                }
              }
            }
            
            // Rate limiting check
            if (rateLimiter) {
              const rateLimitCheck = await rateLimiter.check({ 
                type: 'Realm', 
                realmId: resolvedRealmId as EntityId 
              });
              
              if (!rateLimitCheck.allowed) {
                res.writeHead(429, { 
                  'Content-Type': 'application/json',
                  'Retry-After': rateLimitCheck.retryAfter?.toString() || '60',
                });
                res.end(JSON.stringify({ 
                  error: 'Rate limit exceeded',
                  retryAfter: rateLimitCheck.retryAfter,
                }));
                return;
              }
              
              // Record the request
              await rateLimiter.record({ 
                type: 'Realm', 
                realmId: resolvedRealmId as EntityId 
              });
            }
            
            // Atualizar body.realm com o realmId resolvido
            body.realm = resolvedRealmId;
            
            if (intentHandler) {
              const intent = {
                intent: body.intent,
                realm: body.realm || defaultRealmId,
                actor: body.actor || { type: 'Anonymous' } as ActorReference,
                timestamp: Date.now(),
                payload: body.payload || {},
              };
              
              // Handle admin intents via admin module (before passing to intent handler)
              const startTime = Date.now();
              
              if (body.intent === 'createRealm') {
                const realmData = await admin.createRealm(body.payload, intentHandler);
                result = {
                  success: true,
                  outcome: { 
                    type: 'Created' as const, 
                    entity: {
                      ...realmData.realm,
                      apiKey: realmData.apiKey, // Include API key in response
                      entityId: realmData.entityId,
                    }, 
                    id: realmData.realm.id 
                  },
                  events: [],
                  affordances: [
                    { intent: 'createUser', description: 'Create a user in this realm', required: ['realmId', 'email', 'name'] },
                    { intent: 'register', description: 'Create an entity in this realm', required: ['entityType', 'identity'] },
                    { intent: 'createApiKey', description: 'Create additional API keys', required: ['realmId', 'entityId', 'name'] },
                    { intent: 'query', description: 'Query entities, agreements, or assets', required: ['queryType'] },
                  ],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'createUser') {
                // Criar usuário - sempre requer realmId
                const userData = await admin.createUser(body.payload, intentHandler);
                result = {
                  success: true,
                  outcome: { 
                    type: 'Created' as const, 
                    entity: {
                      ...userData.user,
                      apiKey: userData.apiKey,
                      credentials: userData.credentials, // Email e senha temporária
                    }, 
                    id: userData.entityId 
                  },
                  events: [],
                  affordances: [
                    { intent: 'register', description: 'Create more entities in this realm', required: ['entityType', 'identity'] },
                    { intent: 'createApiKey', description: 'Create additional API keys', required: ['realmId', 'entityId', 'name'] },
                    { intent: 'query', description: 'Query entities, agreements, or assets', required: ['queryType'] },
                  ],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'createUser') {
                // Criar usuário - sempre requer realmId
                // Se não fornecido, tentar usar do contexto (API key)
                if (!body.payload.realmId) {
                  // Tentar extrair do realm resolvido acima
                  body.payload.realmId = body.realm || defaultRealmId;
                }
                
                // Validar que realmId foi fornecido
                if (!body.payload.realmId) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ 
                    error: 'realmId is required for createUser intent',
                    hint: 'Provide realmId in payload or use an API key that belongs to a realm',
                  }));
                  return;
                }
                
                const userData = await admin.createUser(body.payload, intentHandler);
                result = {
                  success: true,
                  outcome: { 
                    type: 'Created' as const, 
                    entity: {
                      ...userData.user,
                      apiKey: userData.apiKey,
                      credentials: userData.credentials, // Email e senha temporária
                    }, 
                    id: userData.entityId 
                  },
                  events: [],
                  affordances: [
                    { intent: 'register', description: 'Create more entities in this realm', required: ['entityType', 'identity'] },
                    { intent: 'createApiKey', description: 'Create additional API keys', required: ['realmId', 'entityId', 'name'] },
                    { intent: 'query', description: 'Query entities, agreements, or assets', required: ['queryType'] },
                  ],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'createApiKey') {
                const keyData = await admin.createApiKey(body.payload);
                result = {
                  success: true,
                  outcome: { type: 'Created' as const, entity: keyData.apiKey, id: keyData.apiKey.id },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'query' && body.payload?.queryType === 'Realm') {
                // Query realms
                const realmId = body.payload?.filters?.realmId;
                let results;
                if (realmId) {
                  const realm = await admin.getRealm(realmId);
                  results = realm ? [realm] : [];
                } else {
                  results = await admin.listRealms();
                }
                result = {
                  success: true,
                  outcome: { type: 'Queried' as const, results },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'query' && body.payload?.queryType === 'Entity') {
                // Query entities
                const realmId = body.payload?.filters?.realmId;
                const results = await admin.listEntities(realmId);
                result = {
                  success: true,
                  outcome: { type: 'Queried' as const, results },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'query' && body.payload?.queryType === 'ApiKey') {
                // Query API keys
                const realmId = body.payload?.filters?.realmId;
                const entityId = body.payload?.filters?.entityId;
                const results = await admin.listApiKeys(realmId, entityId);
                result = {
                  success: true,
                  outcome: { type: 'Queried' as const, results },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'revokeApiKey') {
                const revoked = await admin.revokeApiKey(body.payload?.keyId);
                result = {
                  success: revoked,
                  outcome: revoked 
                    ? { type: 'Updated' as const, entity: { revoked: true }, changes: ['revoked'] }
                    : { type: 'Nothing' as const, reason: 'API key not found' },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else {
                // Pass through to intent handler for other intents
                result = await intentHandler.handle(intent);
              }
            } else {
              result = { error: 'Intent handler not configured' };
            }
          }
          
          // Delegation endpoint - Create realm-scoped API key
          else if (path === '/auth/delegate' && req.method === 'POST') {
            const masterKey = req.headers.authorization?.replace('Bearer ', '') || body.masterKey;
            const expectedMasterKey = config.masterApiKey || process.env.UBL_MASTER_API_KEY;
            
            if (!expectedMasterKey || masterKey !== expectedMasterKey) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unauthorized - Invalid master key' }));
              return;
            }
            
            const realmId = body.realmId;
            if (!realmId) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'realmId is required' }));
              return;
            }
            
            // Generate a realm-scoped API key (in production, use proper JWT or token generation)
            const realmScopedKey = generateRealmScopedKey(realmId);
            
            result = {
              token: realmScopedKey,
              realmId,
              expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
              scope: 'realm',
              permissions: ['read', 'write'], // Limited to this realm only
            };
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
  POST /intent            Execute any intent
  GET  /affordances       Get available actions
  POST /session/start     Start conversation session
  GET  /session/:id       Get session state
  GET  /suggestions       Get autocomplete suggestions
  GET  /health            Health check

Admin Intents (via POST /intent):
  createRealm             Create a new realm
  createApiKey            Create API key for realm/entity
  query (queryType: Realm) List/get realms
  query (queryType: Entity) List/get entities
  query (queryType: ApiKey) List/get API keys
  revokeApiKey            Revoke an API key

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

/**
 * Generate a realm-scoped API key.
 * In production, this should be a proper JWT signed with a secret.
 */
function generateRealmScopedKey(realmId: EntityId): string {
  // Simple implementation - in production, use JWT with proper signing
  const payload = {
    realmId,
    type: 'realm-scoped',
    iat: Math.floor(Date.now() / 1000),
  };
  
  // Base64 encode (in production, use proper JWT signing)
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `ubl_sk_realm_${encoded}`;
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

