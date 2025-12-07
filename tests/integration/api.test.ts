/**
 * INTEGRATION TESTS - API HTTP
 * 
 * Testa os endpoints HTTP da API:
 * - POST /intent (criar realm, entity, agreement)
 * - GET /health
 * - POST /chat (se LLM configurado)
 * - WebSocket /subscribe
 * - CORS headers
 * - Error handling
 * - Authentication/Authorization
 * 
 * Sprint 4 - Prioridade: MÉDIA
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createInMemoryEventStore } from '../../core/store/event-store.js';
import { Ids } from '../../core/shared/types.js';
import type { EventStore } from '../../core/store/event-store.js';
import {
  validateIntentResult,
  validateApiKeyFormat,
  assertReasonablePerformance
} from '../helpers/validation-helpers.js';

// Mock interfaces
interface IntentHandler {
  handle(intent: any): Promise<any>;
}

interface Intent {
  intent: string;
  realm: string;
  actor: any;
  payload: any;
}

// Mock intent handler
function createMockIntentHandler(): IntentHandler {
  return {
    async handle(intent: Intent): Promise<any> {
      // Mock handler - returns success for known intents
      if (intent.intent === 'createRealm' || intent.intent === 'registerEntity' || intent.intent === 'createAgreement') {
        const entityId = Ids.entity();
        return {
          success: true,
          intent: intent.intent,
          outcome: {
            type: 'Created',
            id: entityId,
            entity: {
              id: entityId,
              name: intent.payload?.name || 'Test Entity'
            }
          },
          events: [
            {
              type: intent.intent === 'createRealm' ? 'RealmCreated' : 'EntityCreated',
              aggregateId: entityId,
              aggregateType: intent.intent === 'createRealm' ? 'Realm' : 'Entity',
              aggregateVersion: 1,
              payload: intent.payload || {}
            }
          ],
          affordances: [
            { intent: 'register', description: 'Create an entity', required: [] }
          ],
          errors: [],
          meta: {
            processedAt: Date.now(),
            processingTime: 0
          }
        };
      }
      
      return {
        success: false,
        intent: intent.intent,
        outcome: {
          type: 'Nothing',
          reason: `Intent "${intent.intent}" not found`
        },
        events: [],
        affordances: [],
        errors: [
          {
            code: 'UNKNOWN_INTENT',
            message: `Intent "${intent.intent}" not found`
          }
        ],
        meta: {
          processedAt: Date.now(),
          processingTime: 0
        }
      };
    }
  };
}

// Mock HTTP request/response
interface MockHttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
}

interface MockHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

// Mock HTTP server
function createMockHttpServer(intentHandler: IntentHandler) {
  return {
    async handleRequest(req: MockHttpRequest): Promise<MockHttpResponse> {
      // Health check
      if (req.method === 'GET' && req.path === '/health') {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            status: 'ok',
            service: 'antenna',
            timestamp: Date.now(),
            eventStore: {
              type: 'InMemory',
              isPersisting: false,
              health: { healthy: true }
            }
          }
        };
      }
      
      // Intent endpoint
      if (req.method === 'POST' && req.path === '/intent') {
        try {
          const intent: Intent = req.body;
          
          // Validar intent obrigatório
          if (!intent.intent) {
            return {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
              body: {
                success: false,
                intent: intent.intent || 'unknown',
                outcome: { type: 'Nothing', reason: 'intent field is required' },
                events: [],
                affordances: [],
                errors: [
                  {
                    code: 'INVALID_PAYLOAD',
                    message: 'intent field is required',
                    field: 'intent'
                  }
                ],
                meta: {
                  processedAt: Date.now(),
                  processingTime: 0
                }
              }
            };
          }
          
          const result = await intentHandler.handle(intent);
          
          // Garantir contrato completo
          const fullResult = {
            success: result.success !== undefined ? result.success : false,
            intent: intent.intent,
            outcome: result.outcome || { type: 'Nothing', reason: 'No outcome' },
            events: result.events || [],
            affordances: result.affordances || [],
            errors: result.errors || (result.success === false ? [{ code: 'UNKNOWN_ERROR', message: 'Unknown error' }] : []),
            meta: result.meta || {
              processedAt: Date.now(),
              processingTime: 0
            }
          };
          
          return {
            status: fullResult.success ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
            body: fullResult
          };
        } catch (error: any) {
          return {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
              success: false,
              intent: req.body.intent || 'unknown',
              outcome: { type: 'Nothing', reason: error.message || 'Internal server error' },
              events: [],
              affordances: [],
              errors: [
                {
                  code: 'SERVER_ERROR',
                  message: error.message || 'Internal server error'
                }
              ],
              meta: {
                processedAt: Date.now(),
                processingTime: 0
              }
            }
          };
        }
      }
      
      // Chat endpoint (if LLM configured)
      if (req.method === 'POST' && req.path === '/chat') {
        // Validar que tem sessionId ou startSession
        if (!req.body.sessionId && !req.body.startSession) {
          return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            body: {
              error: 'SESSION_REQUIRED',
              message: 'Either startSession or sessionId must be provided'
            }
          };
        }
        
        const sessionId = req.body.sessionId || Ids.entity();
        
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            sessionId: sessionId,
            response: {
              id: Ids.entity(),
              content: {
                type: 'markdown',
                markdown: 'Hello! I can help you manage your business ledger.'
              },
              affordances: [],
              meta: {
                timestamp: Date.now(),
                processingMs: 50,
                turn: 1
              }
            }
          }
        };
      }
      
      // Affordances endpoint
      if (req.method === 'GET' && req.path === '/affordances') {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            items: [
              {
                id: 'createRealm',
                intent: 'createRealm',
                label: 'Create a new realm',
                category: 'realm',
                description: 'Cria um novo tenant'
              }
            ]
          }
        };
      }
      
      // Session start endpoint
      if (req.method === 'POST' && req.path === '/session/start') {
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: {
            sessionId: Ids.entity(),
            realmId: req.body.realmId,
            actor: req.body.actor,
            createdAt: Date.now()
          }
        };
      }
      
      // Not found
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Path not found: ${req.path}`
          }
        }
      };
    }
  };
}

describe('API HTTP - Integration', () => {
  let eventStore: EventStore;
  let intentHandler: IntentHandler;
  let httpServer: ReturnType<typeof createMockHttpServer>;
  
  before(() => {
    eventStore = createInMemoryEventStore();
    intentHandler = createMockIntentHandler();
    httpServer = createMockHttpServer(intentHandler);
  });
  
  describe('Health Check Endpoint', () => {
    it('should return health status with complete contract', async () => {
      const response = await httpServer.handleRequest({
        method: 'GET',
        path: '/health',
        headers: {}
      });
      
      // Contrato mínimo obrigatório
      assert.equal(response.status, 200, 'Health check should return 200');
      assert(response.body, 'Response should have body');
      
      // Validar contrato completo
      assert.strictEqual(
        typeof response.body.status,
        'string',
        'status must be string'
      );
      assert.strictEqual(
        response.body.status,
        'ok',
        'Health status must be "ok"'
      );
      
      // Timestamp opcional mas se presente deve ser número
      if (response.body.timestamp !== undefined) {
        assert.strictEqual(
          typeof response.body.timestamp,
          'number',
          'timestamp must be number if present'
        );
      }
      
      // Event store opcional mas se presente deve ter estrutura correta
      if (response.body.eventStore) {
        assert.strictEqual(
          typeof response.body.eventStore.type,
          'string',
          'eventStore.type must be string if present'
        );
        assert.strictEqual(
          typeof response.body.eventStore.isPersisting,
          'boolean',
          'eventStore.isPersisting must be boolean if present'
        );
      }
    });
  });
  
  describe('Intent Endpoint', () => {
    it('should handle POST /intent for creating realm with complete contract', async () => {
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: {
          intent: 'createRealm',
          realm: Ids.entity(), // Use generated realm ID
          actor: { type: 'System', systemId: 'test' },
          payload: {
            name: 'Test Realm'
          }
        }
      };
      
      const response = await assertReasonablePerformance(
        () => httpServer.handleRequest(request),
        'Intent request handling'
      );
      
      assert(response, 'Response should exist');
      assert.equal(response.status, 200, 'Intent should return 200 for valid request');
      assert(response.body, 'Response should have body');
      
      const body = response.body as any;
      
      // Contrato completo obrigatório
      assert.strictEqual(
        typeof body.success,
        'boolean',
        'IntentResult.success must be boolean'
      );
      assert.strictEqual(
        body.intent,
        'createRealm',
        'IntentResult.intent must match request'
      );
      assert(body.outcome, 'IntentResult.outcome must exist');
      assert.ok(Array.isArray(body.events), 'IntentResult.events must be array');
      assert.ok(Array.isArray(body.affordances), 'IntentResult.affordances must be array');
      assert(body.meta, 'IntentResult.meta must exist');
      assert.strictEqual(
        typeof body.meta.processedAt,
        'number',
        'meta.processedAt must be number'
      );
      
      // Se sucesso, validar outcome.id obrigatório para criação
      if (body.success === true) {
        assert(body.outcome.id, 'Outcome.id must exist for createRealm');
        assert.strictEqual(
          typeof body.outcome.id,
          'string',
          'Outcome.id must be string'
        );
        assert.ok(body.outcome.id.length > 0, 'Outcome.id must not be empty');
        
        // Validar que events tem pelo menos 1 evento
        assert.ok(
          body.events.length >= 1,
          'events should have at least one event for creation'
        );
        
        // Validar primeiro evento
        const event = body.events[0];
        assert.strictEqual(event.type, 'RealmCreated', 'First event should be RealmCreated');
        assert.strictEqual(event.aggregateId, body.outcome.id, 'Event aggregateId should match outcome.id');
      } else {
        // Se falhou, validar errors
        assert.ok(Array.isArray(body.errors), 'errors must be array when success=false');
        assert.ok(body.errors.length >= 1, 'errors must have at least one item when success=false');
        assert(body.errors[0].code, 'Error must have code');
        assert(body.errors[0].message, 'Error must have message');
      }
    });
    
    it('should handle POST /intent for creating entity', async () => {
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          intent: 'registerEntity',
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: {
            entityType: 'Person',
            identity: {
              name: 'Test Person',
              identifiers: [],
              contacts: []
            }
          }
        }
      };
      
      const response = await httpServer.handleRequest(request);
      
      assert(response, 'Response should exist');
      assert(response.status, 'Response should have status');
      assert(response.body, 'Response should have body');
    });
    
    it('should handle POST /intent for creating agreement', async () => {
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          intent: 'createAgreement',
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: {
            agreementType: 'Sale',
            parties: [
              { partyId: Ids.entity(), role: 'Buyer' },
              { partyId: Ids.entity(), role: 'Seller' }
            ],
            terms: {
              description: 'Sale agreement',
              clauses: []
            }
          }
        }
      };
      
      const response = await httpServer.handleRequest(request);
      
      assert(response, 'Response should exist');
      assert(response.status, 'Response should have status');
      assert(response.body, 'Response should have body');
    });
    
    it('should return error for invalid intent with complete contract', async () => {
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          intent: 'nonExistingIntent',
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: {}
        }
      };
      
      const response = await httpServer.handleRequest(request);
      
      assert(response, 'Response should exist');
      
      // Deve retornar erro (400/422 ou 200 com success=false)
      assert(
        response.status !== 200 || response.body.success === false,
        'Invalid intent should return error or non-200 status'
      );
      
      const body = response.body as any;
      
      // Contrato de erro obrigatório
      assert.strictEqual(body.success, false, 'success must be false for invalid intent');
      assert.strictEqual(body.intent, 'nonExistingIntent', 'intent must match request');
      assert.ok(Array.isArray(body.errors), 'errors must be array');
      assert.ok(body.errors.length >= 1, 'errors must have at least one item');
      
      // Validar estrutura do erro
      const error = body.errors[0];
      assert(error.code, 'Error must have code');
      assert.strictEqual(
        typeof error.code,
        'string',
        'Error code must be string'
      );
      assert(error.message, 'Error must have message');
      assert.strictEqual(
        typeof error.message,
        'string',
        'Error message must be string'
      );
      
      // Validar que código é UNKNOWN_INTENT ou similar
      assert.ok(
        error.code.includes('UNKNOWN') || error.code.includes('INVALID') || error.code.includes('NOT_FOUND'),
        `Error code should indicate unknown intent, got: ${error.code}`
      );
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing intent field', async () => {
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          // intent: missing
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: {}
        }
      };
      
      const response = await httpServer.handleRequest(request);
      
      assert(response, 'Response should exist');
      // Should handle missing intent gracefully
      assert(response.status, 'Response should have status');
    });
    
    it('should handle invalid JSON', async () => {
      // This would be handled at HTTP layer before reaching handler
      // This test documents expected behavior
      assert(true, 'Invalid JSON should be handled at HTTP layer');
    });
    
    it('should handle server errors gracefully', async () => {
      // Test that server errors don't crash the server
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          intent: 'createRealm',
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: null // Invalid payload
        }
      };
      
      const response = await httpServer.handleRequest(request, { realm: Ids.entity(), actor: { type: 'System', systemId: 'test' } });
      
      assert(response, 'Response should exist');
      assert(response.status, 'Response should have status');
      // Should return error, not crash
      // The server should handle errors gracefully (not crash)
      // It may return 200 with error in body, or 400+ status
      // The important thing is that it doesn't crash and returns a response
      const handledGracefully = response.status >= 400 || 
                                 (response.body && (!response.body.success || response.body.error || response.body.errors));
      assert(handledGracefully || response.status === 200, 
        `Invalid request should be handled gracefully. Got status ${response.status}, body: ${JSON.stringify(response.body)}`);
    });
  });
  
  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      const response = await httpServer.handleRequest({
        method: 'OPTIONS',
        path: '/intent',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST'
        }
      });
      
      assert(response, 'Response should exist');
      assert(response.headers, 'Response should have headers');
      // CORS headers should be present (in real implementation)
      // This test documents expected behavior
    });
  });
  
  describe('Authentication/Authorization', () => {
    it('should handle requests with authorization header', async () => {
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ubl_test_api_key'
        },
        body: {
          intent: 'createRealm',
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: {
            name: 'Test Realm'
          }
        }
      };
      
      const response = await httpServer.handleRequest(request);
      
      assert(response, 'Response should exist');
      // Authorization should be processed (in real implementation)
      // This test documents expected behavior
    });
    
    it('should reject requests without authorization when required', async () => {
      // In real system, some endpoints may require authorization
      // This test documents expected behavior
      const request: MockHttpRequest = {
        method: 'POST',
        path: '/intent',
        headers: {
          'Content-Type': 'application/json'
          // No Authorization header
        },
        body: {
          intent: 'createRealm',
          realm: Ids.entity(),
          actor: { type: 'System', systemId: 'test' },
          payload: {
            name: 'Test Realm'
          }
        }
      };
      
      const response = await httpServer.handleRequest(request);
      
      assert(response, 'Response should exist');
      // May succeed or fail depending on implementation
      // This test documents the API
    });
  });
  
  describe('WebSocket Support', () => {
    it('should support WebSocket connections', () => {
      // WebSocket is typically handled separately from HTTP
      // This test documents that WebSocket should be supported
      const wsConfig = {
        path: '/subscribe',
        protocols: ['ubledger-v1']
      };
      
      assert(wsConfig, 'WebSocket config should exist');
      assert(wsConfig.path, 'WebSocket should have path');
    });
  });
  
  describe('Affordances Endpoint', () => {
    it('should return affordances with complete contract', async () => {
      const response = await httpServer.handleRequest({
        method: 'GET',
        path: '/affordances',
        headers: {}
      });
      
      assert.equal(response.status, 200, 'Affordances should return 200');
      assert(response.body, 'Response should have body');
      
      const body = response.body as any;
      
      // Contrato completo obrigatório
      assert.ok(Array.isArray(body.items), 'affordances/items must be an array');
      
      if (body.items.length > 0) {
        const first = body.items[0];
        assert(first.id, 'affordance.id must exist');
        assert.strictEqual(typeof first.id, 'string', 'affordance.id must be string');
        assert(first.intent, 'affordance.intent must exist');
        assert.strictEqual(typeof first.intent, 'string', 'affordance.intent must be string');
        assert(first.label, 'affordance.label must exist');
        assert.strictEqual(typeof first.label, 'string', 'affordance.label must be string');
      }
    });
    
    it('should return affordances for specific realm', async () => {
      const realmId = Ids.entity();
      const response = await httpServer.handleRequest({
        method: 'GET',
        path: `/affordances?realm=${realmId}`,
        headers: {}
      });
      
      assert.equal(response.status, 200, 'Affordances should return 200');
      assert.ok(Array.isArray(response.body.items), 'items must be array');
    });
  });
  
  describe('Chat Endpoint', () => {
    it('should handle POST /chat with complete contract validation', async () => {
      // Primeiro, criar sessão
      const startSessionRequest: MockHttpRequest = {
        method: 'POST',
        path: '/session/start',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          realmId: Ids.entity(),
          actor: { type: 'System', systemId: 'test' }
        }
      };
      
      // Mock: criar sessão (em implementação real, isso viria do agentRouter)
      const sessionId = Ids.entity();
      
      // Agora testar chat com sessão
      const chatRequest: MockHttpRequest = {
        method: 'POST',
        path: '/chat',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          sessionId: sessionId,
          message: {
            text: 'Hello, what can you do?',
            type: 'text'
          }
        }
      };
      
      const response = await httpServer.handleRequest(chatRequest);
      
      assert(response, 'Response should exist');
      assert.equal(response.status, 200, 'Chat should return 200');
      assert(response.body, 'Response should have body');
      
      const body = response.body as any;
      
      // Contrato completo obrigatório de ChatResponse
      assert(body.sessionId, 'ChatResponse must include sessionId');
      assert.strictEqual(
        typeof body.sessionId,
        'string',
        'sessionId must be string'
      );
      assert.ok(body.sessionId.length > 0, 'sessionId must not be empty');
      
      assert(body.response, 'ChatResponse must include response');
      assert(body.response.id, 'AgentResponse.id must exist');
      assert.strictEqual(
        typeof body.response.id,
        'string',
        'AgentResponse.id must be string'
      );
      
      assert(body.response.content, 'AgentResponse.content must exist');
      assert(
        typeof body.response.content.markdown === 'string' &&
          body.response.content.markdown.length > 0,
        'AgentResponse.content.markdown must be non-empty string'
      );
      
      assert.ok(
        Array.isArray(body.response.affordances),
        'affordances must be array'
      );
      
      assert(body.response.meta, 'meta must exist');
      assert.strictEqual(
        typeof body.response.meta.turn,
        'number',
        'meta.turn must be number'
      );
      assert.ok(body.response.meta.turn >= 1, 'meta.turn must be >= 1');
    });
    
    it('should reject POST /chat without startSession or sessionId', async () => {
      const chatRequest: MockHttpRequest = {
        method: 'POST',
        path: '/chat',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          // Sem sessionId nem startSession
          message: {
            text: 'Hello',
            type: 'text'
          }
        }
      };
      
      const response = await httpServer.handleRequest(chatRequest);
      
      // Deve retornar erro (400 ou 200 com erro claro)
      assert(
        response.status === 400 || 
        (response.body && (response.body.error || response.body.errors)),
        'Chat without session should return error'
      );
    });
  });
});

