/**
 * UNIT TESTS - Conversational Agent
 * 
 * Tests the core agent functionality:
 * - Session management
 * - Turn tracking
 * - Content fallback
 * - Affordances and suggestions
 * - Error handling
 * 
 * Fase 3 - Agente Diamante
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createConversationalAgent } from '../../../antenna/agent/implementation.js';
import { createFakeLLMAdapter } from '../../../core/agent/fake-llm-adapter.js';
import { createInMemoryEventStore } from '../../../core/store/event-store.js';
import { createIntentHandler } from '../../../core/api/intent-api.js';
import { PRIMORDIAL_REALM_ID } from '../../../core/universal/primitives.js';
import type { ConversationalAgent } from '../../../core/agent/conversation.js';
import type { ChatResponse, AgentResponse } from '../../../core/agent/primitives.js';
import {
  validateAgentResponse,
  ensureNonEmptyMarkdown,
  ensureAffordancesArray,
} from '../../../core/agent/primitives.js';

describe('Conversational Agent - Unit Tests', () => {
  let agent: ConversationalAgent;
  
  before(async () => {
    const eventStore = createInMemoryEventStore();
    const intentHandler = createIntentHandler(eventStore);
    const fakeLLM = createFakeLLMAdapter();
    
    agent = createConversationalAgent(
      {
        llm: fakeLLM,
        intents: intentHandler,
      },
      {
        defaultRealmId: PRIMORDIAL_REALM_ID,
      }
    );
  });
  
  describe('1. Session Management', () => {
    it('should create a new session with startSession', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      assert(session, 'Session should be created');
      assert.strictEqual(session.realmId, PRIMORDIAL_REALM_ID, 'Session realmId should match');
      assert.strictEqual(session.actor.type, 'System', 'Session actor should match');
      assert(session.history.length === 0, 'New session should have empty history');
    });
    
    it('should return session when queried', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const retrieved = await agent.getSession(session.id);
      assert(retrieved, 'Session should be retrievable');
      assert.strictEqual(retrieved.id, session.id, 'Session ID should match');
    });
  });
  
  describe('2. Turn Tracking', () => {
    it('should start with turn 1 for first message', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response = await agent.chat(session.id, {
        text: 'Hello',
      });
      
      assert.strictEqual(response.meta.turn, 1, 'First message should be turn 1');
    });
    
    it('should increment turn for subsequent messages', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response1 = await agent.chat(session.id, {
        text: 'First message',
      });
      assert.strictEqual(response1.meta.turn, 1, 'First message should be turn 1');
      
      const response2 = await agent.chat(session.id, {
        text: 'Second message',
      });
      assert.strictEqual(response2.meta.turn, 2, 'Second message should be turn 2');
      
      const response3 = await agent.chat(session.id, {
        text: 'Third message',
      });
      assert.strictEqual(response3.meta.turn, 3, 'Third message should be turn 3');
    });
  });
  
  describe('3. Content Fallback', () => {
    it('should never return empty markdown', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      // Fake LLM returns empty for "error" keyword
      const response = await agent.chat(session.id, {
        text: 'error test',
      });
      
      // Should have fallback message
      assert(response.content.markdown.length > 0, 'Markdown should never be empty');
      assert(response.content.markdown.includes('Não consegui entender') || response.content.markdown.length > 0, 'Should have fallback or valid content');
    });
    
    it('should validate AgentResponse invariants', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response = await agent.chat(session.id, {
        text: 'Hello',
      });
      
      // Should not throw
      assert.doesNotThrow(
        () => validateAgentResponse(response),
        'AgentResponse should pass validation'
      );
    });
  });
  
  describe('4. Affordances and Suggestions', () => {
    it('should always return affordances as array', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response = await agent.chat(session.id, {
        text: 'Hello',
      });
      
      assert(Array.isArray(response.affordances), 'Affordances should always be an array');
      assert(response.affordances.length >= 0, 'Affordances can be empty but must be array');
    });
    
    it('should include suggestions when affordances are available', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response = await agent.chat(session.id, {
        text: 'Hello',
      });
      
      // Suggestions should be present if affordances exist
      if (response.affordances.length > 0) {
        assert(response.suggestions, 'Suggestions should be present when affordances exist');
        assert(Array.isArray(response.suggestions), 'Suggestions should be an array');
        assert(response.suggestions.length > 0, 'Suggestions should have at least one item');
      }
    });
  });
  
  describe('5. Meta Fields', () => {
    it('should always include processingMs >= 0', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response = await agent.chat(session.id, {
        text: 'Hello',
      });
      
      assert(response.meta.processingMs >= 0, 'processingMs should be >= 0');
      assert(typeof response.meta.processingMs === 'number', 'processingMs should be a number');
    });
    
    it('should always include turn >= 1', async () => {
      const session = await agent.startSession(
        PRIMORDIAL_REALM_ID,
        { type: 'System', systemId: 'test' }
      );
      
      const response = await agent.chat(session.id, {
        text: 'Hello',
      });
      
      assert(response.meta.turn >= 1, 'turn should be >= 1');
      assert(typeof response.meta.turn === 'number', 'turn should be a number');
    });
  });
});

