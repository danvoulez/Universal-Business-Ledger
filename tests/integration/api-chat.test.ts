/**
 * INTEGRATION TESTS - Chat API
 * 
 * Tests the complete flow:
 * - POST /chat with startSession
 * - POST /chat with existing sessionId
 * - Error handling
 * - Contract validation
 * 
 * Fase 3 - Agente Diamante
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createAgentAPIRouter } from '../../core/agent/api.js';
import { createConversationalAgent } from '../../antenna/agent/implementation.js';
import { createFakeLLMAdapter } from '../../core/agent/fake-llm-adapter.js';
import { createInMemoryEventStore } from '../../core/store/event-store.js';
import { createIntentHandler } from '../../core/api/intent-api.js';
import { PRIMORDIAL_REALM_ID } from '../../core/universal/primitives.js';
import type { ChatResponse } from '../../core/agent/primitives.js';
import { validateAgentResponse } from '../../core/agent/primitives.js';

describe('Chat API - Integration Tests', () => {
  let agentRouter: ReturnType<typeof createAgentAPIRouter>;
  
  before(async () => {
    const eventStore = createInMemoryEventStore();
    const intentHandler = createIntentHandler(eventStore);
    const fakeLLM = createFakeLLMAdapter();
    
    const agent = createConversationalAgent(
      {
        llm: fakeLLM,
        intents: intentHandler,
      },
      {
        defaultRealmId: PRIMORDIAL_REALM_ID,
      }
    );
    
    agentRouter = createAgentAPIRouter(agent);
  });
  
  describe('1. New Session + First Message', () => {
    it('should create session and return ChatResponse with turn=1', async () => {
      const data: ChatResponse = await agentRouter.chat({
        message: { text: 'Hello' },
        startSession: {
          realmId: PRIMORDIAL_REALM_ID,
          actor: { type: 'System', systemId: 'test' },
        },
      });
      
      // Validate contract
      assert(data.response, 'Response should have response field');
      assert(data.sessionId, 'Response should have sessionId field');
      
      // Validate AgentResponse
      assert.strictEqual(data.response.meta.turn, 1, 'First message should be turn 1');
      assert(data.response.content.markdown.length > 0, 'Markdown should not be empty');
      assert(Array.isArray(data.response.affordances), 'Affordances should be array');
      assert(data.response.meta.processingMs >= 0, 'processingMs should be >= 0');
      
      // Should pass validation
      assert.doesNotThrow(
        () => validateAgentResponse(data.response),
        'ChatResponse should pass validation'
      );
    });
  });
  
  describe('2. Subsequent Messages', () => {
    it('should increment turn for subsequent messages', async () => {
      // First message
      const data1: ChatResponse = await agentRouter.chat({
        message: { text: 'First' },
        startSession: {
          realmId: PRIMORDIAL_REALM_ID,
          actor: { type: 'System', systemId: 'test' },
        },
      });
      
      const sessionId = data1.sessionId;
      
      assert.strictEqual(data1.response.meta.turn, 1, 'First message should be turn 1');
      
      // Second message
      const data2: ChatResponse = await agentRouter.chat({
        sessionId,
        message: { text: 'Second' },
      });
      
      assert.strictEqual(data2.sessionId, sessionId, 'Session ID should remain the same');
      assert.strictEqual(data2.response.meta.turn, 2, 'Second message should be turn 2');
    });
  });
  
  describe('3. Error Handling', () => {
    it('should throw error when sessionId is missing', async () => {
      await assert.rejects(
        async () => {
          await agentRouter.chat({
            message: { text: 'Hello' },
            // Missing both sessionId and startSession
          });
        },
        (error: Error) => {
          assert(error.message.includes('Session ID') || error.message.includes('startSession'), 'Error should mention session requirement');
          return true;
        },
        'Should throw error when sessionId and startSession are missing'
      );
    });
    
    it('should return valid ChatResponse even when LLM returns empty', async () => {
      // Fake LLM returns empty for "error" keyword
      const data: ChatResponse = await agentRouter.chat({
        message: { text: 'error test' },
        startSession: {
          realmId: PRIMORDIAL_REALM_ID,
          actor: { type: 'System', systemId: 'test' },
        },
      });
      
      // Should have fallback message (never empty)
      assert(data.response.content.markdown.length > 0, 'Should have fallback message');
      assert.doesNotThrow(
        () => validateAgentResponse(data.response),
        'Should pass validation even with fallback'
      );
    });
  });
  
  describe('4. Contract Validation', () => {
    it('should always return valid ChatResponse structure', async () => {
      const data: ChatResponse = await agentRouter.chat({
        message: { text: 'Test contract' },
        startSession: {
          realmId: PRIMORDIAL_REALM_ID,
          actor: { type: 'System', systemId: 'test' },
        },
      });
      
      // Validate structure
      assert(data.response, 'Must have response');
      assert(data.sessionId, 'Must have sessionId');
      assert(data.response.id, 'Response must have id');
      assert(data.response.content, 'Response must have content');
      assert(data.response.content.markdown, 'Content must have markdown');
      assert(Array.isArray(data.response.affordances), 'Affordances must be array');
      assert(data.response.meta, 'Response must have meta');
      assert(data.response.meta.turn >= 1, 'meta.turn must be >= 1');
      assert(data.response.meta.processingMs >= 0, 'meta.processingMs must be >= 0');
      
      // Validate using helper
      assert.doesNotThrow(
        () => validateAgentResponse(data.response),
        'Should pass validation'
      );
    });
  });
});

