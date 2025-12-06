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
import { createIntentHandler } from '../core/api/intent-api';
import { createConversationalAgent } from './agent/implementation';
import { createAgentAPIRouter } from './agent/api';
import type { AgentAPIRouter } from './agent/api';
import { AntennaWebSocketServer } from './websocket';
import type { WebSocketHandlers } from './websocket';
import { createAnthropicAdapter } from '../sdk/anthropic';
import { createOpenAIAdapter } from '../sdk/openai';
import { createRedisRateLimiter } from '../core/operational/rate-limiter-redis';
import type { RateLimiter } from '../core/operational/governance';
import { createS3CompatibleAdapter } from '../core/adapters/standards/s3';
import { createWorkspaceStorageFromAdapter } from '../core/sandbox/storage';
import { S3_PROVIDER_PRESETS } from '../core/adapters/standards/s3';
import Redis from 'ioredis';
import * as admin from './admin';
import { createEventStore } from '../core/store/create-event-store';
import { ProjectionManager } from '../core/store/projections-manager';
import { createWorkflowEngine, AGREEMENT_WORKFLOW, ASSET_WORKFLOW } from '../core/engine/workflow-engine';
import { createAggregateRepository } from '../core/aggregates/rehydrators';
import { createAgreementTypeRegistry } from '../core/universal/agreement-types';
import { createAuthorizationEngine, type RoleStore, type AuthorizationAuditLogger, type AuthorizationAudit, type AuditQuery } from '../core/security/authorization';
import type { Role } from '../core/universal/primitives';
import { createPolicyEngine } from '../core/security/policies';
import type { ActorReference, EntityId, Timestamp } from '../core/shared/types';

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
  let finalIntentHandler: IntentHandler | null = null;
  
  // Rate limiter
  let rateLimiter: RateLimiter | null = null;
  
  // HTTP server state
  let server: any = null;
  let wsServer: AntennaWebSocketServer | null = null;
  
  // Projection manager (initialized in start())
  let projectionManager: ProjectionManager | null = null;

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
      
      // Initialize WorkspaceStorage adapter if AWS S3 is configured
      const adaptersMap = new Map<string, unknown>();
      const awsRegion = process.env.AWS_REGION || 'us-east-1';
      const awsS3Bucket = process.env.AWS_S3_BUCKET;
      const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

      // If S3 bucket is configured, try to initialize WorkspaceStorage
      // Credentials can come from environment variables OR IAM Role (when running on EC2)
      if (awsS3Bucket) {
        try {
          const s3Adapter = createS3CompatibleAdapter('AWS-S3');
          
          // If access keys are provided, use them. Otherwise, rely on IAM Role (default AWS SDK behavior)
          const credentials = (awsAccessKeyId && awsSecretAccessKey) ? {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
          } : undefined;
          
          await s3Adapter.initialize({
            credentials: credentials || {
              // Empty credentials - AWS SDK will use IAM Role when running on EC2
              accessKeyId: '',
              secretAccessKey: '',
            },
            options: {
              ...S3_PROVIDER_PRESETS.aws(awsRegion, awsS3Bucket),
              bucket: awsS3Bucket,
            },
          });
          
          const workspaceStorage = createWorkspaceStorageFromAdapter(s3Adapter);
          adaptersMap.set('WorkspaceStorage', workspaceStorage);
          console.log(`✅ WorkspaceStorage configured with S3 bucket: ${awsS3Bucket} (using ${credentials ? 'explicit credentials' : 'IAM Role'})`);
        } catch (error: any) {
          console.warn(`⚠️  Failed to initialize WorkspaceStorage: ${error.message}`);
        }
      } else {
        console.warn('⚠️  WorkspaceStorage not configured (AWS_S3_BUCKET not set)');
      }

      // Initialize Git adapter (SimpleGit)
      try {
        const { createSimpleGitAdapter } = await import('../core/sandbox/git-adapters/simple-git');
        const gitAdapter = createSimpleGitAdapter();
        adaptersMap.set('Git', gitAdapter);
        console.log('✅ Git adapter configured (simple-git)');
      } catch (error: any) {
        console.warn(`⚠️  Failed to initialize Git adapter: ${error.message}`);
        console.warn('   Install simple-git with: npm install simple-git');
      }

      // Initialize core services for intent handlers
      // Automatically uses PostgreSQL if DATABASE_URL is set, otherwise in-memory
      const eventStore = createEventStore();
      
      // Initialize Projection Manager if PostgreSQL is available
      const dbPool = (eventStore as any).getPool?.();
      if (dbPool) {
        projectionManager = new ProjectionManager({
          eventStore,
          db: dbPool,
        });
        projectionManager.registerWorkspaceProjection();
        await projectionManager.start();
        console.log('✅ Projection manager started with workspace projection');
      } else {
        console.warn('⚠️  Projection manager not started (PostgreSQL not available)');
      }
      
      const aggregates = createAggregateRepository(eventStore);
      const workflowEngine = createWorkflowEngine(eventStore, {
        async getAggregate(type, id) {
          switch (type) {
            case 'Party': return aggregates.getParty(id);
            case 'Asset': return aggregates.getAsset(id);
            case 'Agreement': return aggregates.getAgreement(id);
            case 'Role': return aggregates.getRole(id);
            case 'Workflow': return aggregates.getWorkflowInstance(id);
            default: return null;
          }
        },
        async getActorRoles(actor) {
          if (actor.type !== 'Party') return [];
          // Get roles from aggregates
          return [];
        },
        async emitDomainEvent(eventType, payload) {
          // Emit domain events if needed
        },
      });
      
      // Register default workflows
      workflowEngine.registerDefinition(AGREEMENT_WORKFLOW);
      workflowEngine.registerDefinition(ASSET_WORKFLOW);
      
      // Create agreement type registry
      const agreementTypeRegistry = createAgreementTypeRegistry();
      
      // Create in-memory role store (gets roles from aggregates)
      const roleStore: RoleStore = {
        async getActiveRoles(actor: ActorReference, realm: EntityId, at: Timestamp): Promise<readonly Role[]> {
          // Get roles from agreements via aggregates
          const roles: Role[] = [];
          // TODO: Query agreements and extract roles
          return roles;
        },
        async getRolesByHolder(holderId: EntityId): Promise<readonly Role[]> {
          return [];
        },
        async getRole(roleId: EntityId): Promise<Role | null> {
          return null;
        },
      };
      
      // Create policy engine
      const policyEngine = createPolicyEngine();
      
      // Create in-memory audit logger
      const auditLogs: AuthorizationAudit[] = [];
      const auditLogger: AuthorizationAuditLogger = {
        async log(audit: AuthorizationAudit): Promise<void> {
          auditLogs.push(audit);
        },
        async query(query: AuditQuery): Promise<readonly AuthorizationAudit[]> {
          return auditLogs.filter(log => {
            if (query.actorId && log.actorId !== query.actorId) return false;
            if (query.realmId && log.realmId !== query.realmId) return false;
            if (query.timeRange) {
              if (query.timeRange.from && log.timestamp < query.timeRange.from) return false;
              if (query.timeRange.to && log.timestamp > query.timeRange.to) return false;
            }
            return true;
          }).slice(0, query.limit || 100);
        },
      };
      
      // Create authorization engine
      const authorizationEngine = createAuthorizationEngine(roleStore, policyEngine, auditLogger);
      
      // Create realm manager
      const { createRealmManager } = await import('../core/universal/realm-manager');
      const realmManager = createRealmManager(eventStore);

      // Create the conversational agent with initialized LLM
      // Use real intent handler if provided, otherwise create one from BUILT_IN_INTENTS
      finalIntentHandler = intentHandler || createIntentHandler(undefined, {
        eventStore,
        aggregates,
        workflows: workflowEngine,
        agreements: agreementTypeRegistry,
        authorization: authorizationEngine,
        adapters: adaptersMap,
        realmManager, // Add realm manager to context
      });
      
      agent = createConversationalAgent(
        {
          llm: llmAdapter,
          intents: finalIntentHandler,
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
        // CORS headers - sempre retornar
        const origin = req.headers.origin || '';
        const isProduction = process.env.NODE_ENV === 'production';
        const allowAllOrigins = corsOrigins.includes('*') || !isProduction;
        const originAllowed = allowAllOrigins || corsOrigins.includes(origin);
        
        // Sempre retornar headers CORS (browsers precisam mesmo se negado)
        if (originAllowed) {
          // Permitir origem específica ou todas em dev/staging
          res.setHeader('Access-Control-Allow-Origin', allowAllOrigins ? (origin || '*') : origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        } else if (origin) {
          // Em produção, se origem não permitida, não retornar Allow-Origin
          // Mas ainda retornar outros headers para debugging
        }
        
        // Headers CORS sempre retornados
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key, X-Request-ID, X-API-Key');
        res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas para preflight cache
        
        // Handle preflight OPTIONS request
        if (req.method === 'OPTIONS') {
          res.writeHead(originAllowed ? 204 : 403);
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
            const databaseUrl = process.env.DATABASE_URL;
            const eventStoreHealth = await eventStore.healthCheck?.() || { healthy: false };
            const eventStoreName = eventStore.name || 'Unknown';
            const isPostgres = eventStoreName === 'PostgreSQL';
            const isPersisting = isPostgres && eventStoreHealth.healthy;
            
            result = {
              status: 'ok',
              service: 'antenna',
              timestamp: Date.now(),
              eventStore: {
                type: eventStoreName,
                databaseUrl: databaseUrl ? '***configured***' : null,
                isPersisting,
                health: eventStoreHealth,
                warning: !isPersisting ? (databaseUrl ? 'PostgreSQL connection failed or not initialized' : 'Using in-memory store - data will not persist') : undefined,
              },
            };
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
            
            // Handle admin intents via admin module (work without full intent handler)
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
                // Create API key via Event Store (following ORIGINAL philosophy)
                const context = (finalIntentHandler || intentHandler) as any;
                const eventStore = context?.context?.eventStore;
                if (!eventStore) {
                  result = {
                    success: false,
                    outcome: { type: 'Nothing' as const, reason: 'Event store not available' },
                    events: [],
                    affordances: [],
                    errors: [{ code: 'ERROR', message: 'Event store required' }],
                    meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                  };
                } else {
                  const keyData = await admin.createApiKey(body.payload, eventStore);
                  result = {
                    success: true,
                    outcome: { type: 'Created' as const, entity: keyData.apiKey, id: keyData.apiKey.id },
                    events: [],
                    affordances: [],
                    meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                  };
                }
              } else if (body.intent === 'query' && body.payload?.queryType === 'Realm') {
                // Query realms from Event Store (following ORIGINAL philosophy)
                const realmId = body.payload?.filters?.realmId;
                const context = (finalIntentHandler || intentHandler) as any;
                const eventStore = context?.context?.eventStore;
                let results;
                if (realmId) {
                  const realm = await admin.getRealm(realmId, eventStore);
                  results = realm ? [realm] : [];
                } else {
                  results = await admin.listRealms(eventStore);
                }
                result = {
                  success: true,
                  outcome: { type: 'Queried' as const, results },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'query' && body.payload?.queryType === 'Entity') {
                // Query entities from Event Store (following ORIGINAL philosophy)
                const realmId = body.payload?.filters?.realmId;
                const context = (finalIntentHandler || intentHandler) as any;
                const eventStore = context?.context?.eventStore;
                const aggregates = context?.context?.aggregates;
                const results = await admin.listEntities(realmId, eventStore, aggregates);
                result = {
                  success: true,
                  outcome: { type: 'Queried' as const, results },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'query' && body.payload?.queryType === 'ApiKey') {
                // Query API keys from Event Store (following ORIGINAL philosophy)
                const realmId = body.payload?.filters?.realmId;
                const entityId = body.payload?.filters?.entityId;
                const context = (finalIntentHandler || intentHandler) as any;
                const eventStore = context?.context?.eventStore;
                const results = await admin.listApiKeys(realmId, entityId, eventStore);
                result = {
                  success: true,
                  outcome: { type: 'Queried' as const, results },
                  events: [],
                  affordances: [],
                  meta: { processedAt: Date.now(), processingTime: Date.now() - startTime },
                };
              } else if (body.intent === 'revokeApiKey') {
                // Revoke API key via Event Store (following ORIGINAL philosophy)
                const context = (finalIntentHandler || intentHandler) as any;
                const eventStore = context?.context?.eventStore;
                const actor = body.actor || { type: 'System', systemId: 'admin' } as ActorReference;
                const revoked = await admin.revokeApiKey(body.payload?.keyId, eventStore, actor);
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
                // Use finalIntentHandler if available (created above), otherwise use provided intentHandler
                const handlerToUse = finalIntentHandler || intentHandler;
                if (handlerToUse) {
                  const intent = {
                    intent: body.intent,
                    realm: body.realm || defaultRealmId,
                    actor: body.actor || { type: 'Anonymous' } as ActorReference,
                    timestamp: Date.now(),
                    payload: body.payload || {},
                  };
                  result = await handlerToUse.handle(intent);
                } else {
                  result = { error: 'Intent handler not configured' };
                }
              }
          }
          
          // Delegation endpoint - MOVED TO INTENT (following ORIGINAL philosophy)
          // Use intent 'delegate:auth' or 'create:realmApiKey' instead
          // This endpoint is deprecated - kept for backward compatibility only
          // TODO: Remove in next version, use intent instead
          else if (path === '/auth/delegate' && req.method === 'POST') {
            // Redirect to intent handler (following ORIGINAL philosophy: everything via /intent)
            const masterKey = req.headers.authorization?.replace('Bearer ', '') || body.masterKey;
            const expectedMasterKey = config.masterApiKey || process.env.UBL_MASTER_API_KEY;
            
            if (!expectedMasterKey || masterKey !== expectedMasterKey) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Unauthorized - Invalid master key',
                hint: 'Use intent "delegate:auth" via POST /intent instead'
              }));
              return;
            }
            
            const realmId = body.realmId;
            if (!realmId) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'realmId is required',
                hint: 'Use intent "delegate:auth" via POST /intent instead'
              }));
              return;
            }
            
            // Use intent handler to create API key (following ORIGINAL philosophy)
            const handlerToUse = finalIntentHandler || intentHandler;
            if (handlerToUse) {
              const context = handlerToUse as any;
              const eventStore = context?.context?.eventStore;
              
              // Create API key via Event Store
              const keyData = await admin.createApiKey({
                realmId,
                entityId: body.entityId || ('' as EntityId), // System entity if not provided
                name: body.name || `Realm-scoped key for ${realmId}`,
                scopes: body.scopes || ['read', 'write'],
                expiresInDays: body.expiresInDays || 365,
              }, eventStore);
              
              result = {
                token: keyData.key,
                realmId,
                expiresAt: keyData.apiKey.expiresAt,
                scope: 'realm',
                permissions: keyData.apiKey.scopes,
                apiKeyId: keyData.apiKey.id,
                deprecated: true,
                hint: 'This endpoint is deprecated. Use intent "delegate:auth" via POST /intent instead',
              };
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Intent handler not configured' }));
              return;
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
          
          // Serialize result, converting BigInt to string
          const serializedResult = JSON.stringify(result, (key, value) => {
            if (typeof value === 'bigint') {
              return value.toString();
            }
            return value;
          });
          
          // Send response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(serializedResult);
          
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
      // Stop projection manager
      if (projectionManager) {
        await projectionManager.stop();
      }
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

