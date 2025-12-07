/**
 * OPERATOR UX TESTS
 * 
 * Fase 6: UX DE OPERADOR DO DIAMANTE
 * 
 * Tests to ensure the agent behaves as an operator-friendly system:
 * - Incident messages with clear guidance
 * - Guidance messages for common issues
 * - Operational suggestions
 * - Message kinds are set correctly
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createConversationalAgent } from '../../../antenna/agent/implementation.js';
import { createFakeLLMAdapter } from '../../../core/agent/fake-llm-adapter.js';
import { createInMemoryEventStore } from '../../../core/store/event-store.js';
import { createUniversalLedger } from '../../../core/index.js';
import { PRIMORDIAL_REALM_ID } from '../../../core/universal/primitives.js';
import {
  buildAgentErrorResponse,
  buildOperationalSuggestions,
} from '../../../core/agent/primitives.js';
import {
  buildApiDownMessage,
  buildSessionGuidanceMessage,
  buildAffordanceExplanation,
  buildAwsCredentialIssueMessage,
  buildDatabaseIssueMessage,
} from '../../../core/agent/messages/operatorMessages.js';
import type { AgentResponse, AgentMessageKind } from '../../../core/agent/primitives.js';
import type { IntentHandler } from '../../../core/api/intent-api.js';
import { createIntentHandler } from '../../../core/api/intent-api.js';

describe('Operator UX - Unit Tests', () => {
  let agent: any;
  let eventStore: any;
  let intentHandler: IntentHandler;

  before(async () => {
    eventStore = createInMemoryEventStore();
    const ledger = createUniversalLedger({ eventStore });
    
    // Bootstrap realm manager
    const { createRealmManager } = await import('../../../core/universal/realm-manager.js');
    const realmManager = createRealmManager(eventStore);
    await realmManager.bootstrap();

    intentHandler = createIntentHandler({
      eventStore,
      aggregates: ledger.aggregates,
      temporal: ledger.temporal,
      realmManager: realmManager,
      policyEngine: ledger.policyEngine,
      systemActor: { type: 'System', systemId: 'test-system' },
    });

    const fakeLLM = createFakeLLMAdapter({
      'Hello': 'Hello there! How can I help you today?',
    });

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

  describe('1. Error Internal → Incident Message', () => {
    it('should return incident message with meta.kind = "incident"', () => {
      const error = new Error('Test error');
      const response = buildAgentErrorResponse(
        'sess-test' as any,
        error,
        1,
        {
          traceId: 'trace-123',
          endpoint: '/chat',
          operation: 'chat',
        }
      );

      assert.strictEqual(response.response.meta.kind, 'incident', 'Should have kind=incident');
      assert.ok(response.response.content.markdown.includes('⚠️'), 'Should have warning icon');
      assert.ok(response.response.content.markdown.includes('/chat'), 'Should mention endpoint');
      assert.ok(response.response.content.markdown.includes('verificar-status-aws.sh'), 'Should suggest command');
      assert.ok(Array.isArray(response.response.suggestions), 'Should have suggestions array');
      assert.ok(response.response.suggestions!.length > 0, 'Should have at least one suggestion');
    });

    it('should include traceId in incident message', () => {
      const error = new Error('Test error');
      const response = buildAgentErrorResponse(
        'sess-test' as any,
        error,
        1,
        {
          traceId: 'trace-abc123',
          endpoint: '/intent',
        }
      );

      assert.ok(response.response.content.markdown.includes('trace-abc123'), 'Should include traceId');
    });
  });

  describe('2. API Error (missing sessionId) → Guidance', () => {
    it('should return guidance message with meta.kind = "guidance"', () => {
      const guidance = buildSessionGuidanceMessage({
        reason: 'Você precisa fornecer sessionId ou startSession.',
      });

      assert.strictEqual(guidance.kind, 'guidance', 'Should have kind=guidance');
      assert.ok(guidance.markdown.length > 0, 'Should have non-empty markdown');
      assert.ok(guidance.markdown.includes('startSession'), 'Should explain startSession');
      assert.ok(guidance.markdown.includes('sessionId'), 'Should explain sessionId');
      assert.ok(Array.isArray(guidance.suggestions), 'Should have suggestions');
    });
  });

  describe('3. Operational Suggestions', () => {
    it('should generate suggestions for API errors', () => {
      const suggestions = buildOperationalSuggestions({
        hasError: true,
        endpoint: '/chat',
      });

      assert.ok(Array.isArray(suggestions), 'Should return array');
      assert.ok(suggestions.length > 0, 'Should have suggestions');
      assert.ok(suggestions.some(s => s.includes('testar-api-endpoints')), 'Should suggest API test');
      assert.ok(suggestions.some(s => s.includes('verificar-status-aws')), 'Should suggest status check');
    });

    it('should generate suggestions for deploy context', () => {
      const suggestions = buildOperationalSuggestions({
        hasError: true,
        isDeployContext: true,
      });

      assert.ok(suggestions.some(s => s.includes('deploy')), 'Should suggest deploy-related action');
    });

    it('should generate suggestions for realm context', () => {
      const suggestions = buildOperationalSuggestions({
        isRealmContext: true,
      });

      assert.ok(suggestions.some(s => s.includes('realm')), 'Should suggest realm-related action');
    });
  });

  describe('4. Affordance Explanation', () => {
    it('should explain affordances in natural language', () => {
      const affordances = [
        { intent: 'createRealm', label: 'Create Realm', description: 'Create a new realm with default config' },
        { intent: 'inspectRealm', label: 'Inspect Realm', description: 'View details of an existing realm' },
      ];

      const explanation = buildAffordanceExplanation(affordances);

      assert.ok(explanation.length > 0, 'Should have explanation');
      assert.ok(explanation.includes('createRealm'), 'Should mention createRealm');
      assert.ok(explanation.includes('inspectRealm'), 'Should mention inspectRealm');
      assert.ok(explanation.includes('Ações disponíveis'), 'Should have header');
    });

    it('should handle empty affordances', () => {
      const explanation = buildAffordanceExplanation([]);

      assert.ok(explanation.includes('Nenhuma ação'), 'Should indicate no actions');
    });
  });

  describe('5. Normal Response → Informational', () => {
    it('should set meta.kind = "informational" for normal responses', async () => {
      const session = await agent.startSession(PRIMORDIAL_REALM_ID, { type: 'System', systemId: 'test' });
      const response = await agent.chat(session.id, { text: 'Hello' });

      assert.strictEqual(response.meta.kind, 'informational', 'Normal response should be informational');
      assert.ok(response.content.markdown.length > 0, 'Should have content');
    });
  });

  describe('6. Operator Messages Helpers', () => {
    it('should build API down message with all required fields', () => {
      const message = buildApiDownMessage({
        traceId: 'trace-123',
        endpoint: '/chat',
        errorCode: 'ECONNREFUSED',
        errorMessage: 'Connection refused',
      });

      assert.strictEqual(message.kind, 'incident', 'Should be incident');
      assert.ok(message.markdown.includes('/chat'), 'Should mention endpoint');
      assert.ok(message.markdown.includes('trace-123'), 'Should include traceId');
      assert.ok(message.markdown.includes('verificar-status-aws.sh'), 'Should suggest command');
      assert.ok(Array.isArray(message.suggestions), 'Should have suggestions');
      assert.ok(message.suggestions.length > 0, 'Should have at least one suggestion');
    });

    it('should build AWS credential issue message', () => {
      const message = buildAwsCredentialIssueMessage({
        operation: 'deploy',
      });

      assert.strictEqual(message.kind, 'incident', 'Should be incident');
      assert.ok(message.markdown.includes('AWS'), 'Should mention AWS');
      assert.ok(message.markdown.includes('get-caller-identity'), 'Should suggest AWS command');
    });

    it('should build database issue message', () => {
      const message = buildDatabaseIssueMessage({
        operation: 'migration',
        databaseUrl: 'postgresql://...',
      });

      assert.strictEqual(message.kind, 'incident', 'Should be incident');
      assert.ok(message.markdown.includes('banco de dados'), 'Should mention database');
      assert.ok(message.markdown.includes('psql'), 'Should suggest psql command');
    });
  });
});

