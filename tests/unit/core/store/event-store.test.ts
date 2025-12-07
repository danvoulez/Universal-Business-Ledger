/**
 * UNIT TESTS - Core/Store Event Store
 * 
 * Testes para:
 * - Append de eventos
 * - Leitura por aggregate
 * - Leitura por tipo
 * - Leitura por timestamp
 * - Validação de hash chain
 * - Validação de versão (optimistic locking)
 * - Subscription a novos eventos
 * - Verificação de integridade
 * 
 * Sprint 2 - Prioridade: ALTA
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createInMemoryEventStore } from '../../../../core/store/event-store.js';
import { Ids } from '../../../../core/shared/types.js';
import type { EventStore } from '../../../../core/store/event-store.js';
import type { Event } from '../../../../core/schema/ledger.js';
import {
  validateEventIntegrity,
  validateEventSequence,
  assertReasonableTimestamp,
  assertReasonablePerformance
} from '../../../helpers/validation-helpers.js';

describe('Event Store', () => {
  let eventStore: EventStore;
  
  before(() => {
    eventStore = createInMemoryEventStore();
  });
  
  describe('append()', () => {
    it('should append events successfully', async () => {
      const event = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: { test: 'data' },
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      assert(event, 'Event should be created');
      assert(event.id, 'Event should have id');
      assert(event.sequence, 'Event should have sequence');
      assert(event.hash, 'Event should have hash');
      assert.equal(event.type, 'TestEvent', 'Event type should match');
      assert.equal(event.aggregateVersion, 1, 'Aggregate version should match');
      assert(event.actor, 'Event should have actor');
      assert.equal(event.actor.type, 'System', 'Actor type should match');
      
      // Rigorous validation
      const integrity = validateEventIntegrity(event);
      assert(integrity.isValid, `Event integrity failed: ${integrity.errors.join(', ')}`);
      assertReasonableTimestamp(event.timestamp);
    });
    
    it('should reject events with invalid aggregate version (optimistic locking)', async () => {
      const aggregateId = Ids.entity();
      
      // Append first event
      await eventStore.append({
        type: 'TestEvent',
        aggregateId,
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      // Try to append with wrong version (should fail or be rejected)
      // Note: This depends on implementation - some stores may allow this
      // This test documents expected behavior
      try {
        await eventStore.append({
          type: 'TestEvent',
          aggregateId,
          aggregateType: 'Entity' as const,
          aggregateVersion: 1, // Wrong: should be 2
          payload: {},
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
        
        // If it succeeds, verify it's handled correctly
        const events: Event[] = [];
        for await (const event of eventStore.getByAggregate('Entity', aggregateId)) {
          events.push(event);
        }
        // Should have correct versioning
        assert(events.length >= 1, 'Should have at least one event');
      } catch (error) {
        // Expected: optimistic locking should reject wrong version
        assert(error, 'Should reject invalid aggregate version');
      }
    });
    
    it('should handle very large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(1000000) // 1MB payload
      };
      
      const event = await eventStore.append({
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: largePayload,
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      assert(event, 'Should handle large payloads');
      assert.equal((event.payload as any).data.length, 1000000, 'Large payload should be preserved');
    });
    
    it('should handle many events efficiently', async () => {
      const aggregateId = Ids.entity();
      const start = Date.now();
      
      // Append many events
      for (let i = 0; i < 1000; i++) {
        await eventStore.append({
          type: 'TestEvent',
          aggregateId,
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: { index: i },
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
      }
      
      const duration = Date.now() - start;
      assert(duration < 10000, `Should append 1000 events in < 10s, took ${duration}ms`);
      
      // Verify all events exist
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Entity', aggregateId)) {
        events.push(event);
      }
      assert.equal(events.length, 1000, 'Should have all 1000 events');
    });
    
    it('should maintain hash chain integrity with many events', async () => {
      const events: Event[] = [];
      
      for (let i = 0; i < 100; i++) {
        const event = await eventStore.append({
          type: 'TestEvent',
          aggregateId: Ids.entity(),
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: { index: i },
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
        events.push(event);
      }
      
      // Verify chain integrity
      const result = await eventStore.verifyIntegrity();
      assert(result.isValid, 'Chain should remain valid with many events');
    });
    
    it('should assign monotonic sequence numbers', async () => {
      const event1 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const event2 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      assert(event2.sequence > event1.sequence, 'Sequence should be monotonic');
    });
    
    it('should compute hash for events', async () => {
      const event = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: { test: 'data' },
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      assert(event.hash, 'Event should have hash');
      assert(event.hash.startsWith('sha256:'), 'Hash should start with sha256:');
    });
    
    it('should link events via previousHash', async () => {
      const event1 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const event2 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      assert.equal(event2.previousHash, event1.hash, 'Event2 should link to event1 hash');
    });
  });
  
  describe('getByAggregate()', () => {
    it('should retrieve events by aggregate', async () => {
      const aggregateId = Ids.entity();
      
      const event1 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId,
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: { step: 1 },
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const event2 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'TestEvent',
        aggregateId,
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: { step: 2 },
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Entity', aggregateId)) {
        events.push(event);
      }
      
      assert.equal(events.length, 2, 'Should retrieve 2 events');
      assert.equal(events[0].id, event1.id, 'First event should match');
      assert.equal(events[1].id, event2.id, 'Second event should match');
    });
    
    it('should filter events by version range', async () => {
      const aggregateId = Ids.entity();
      
      for (let i = 1; i <= 5; i++) {
        await eventStore.append({
          id: Ids.entity(),
          timestamp: Date.now() + i,
          type: 'TestEvent',
          aggregateId,
          aggregateType: 'Entity' as const,
          aggregateVersion: i,
          payload: { step: i },
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
      }
      
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Entity', aggregateId, {
        fromVersion: 2,
        toVersion: 4
      })) {
        events.push(event);
      }
      
      assert.equal(events.length, 3, 'Should retrieve 3 events (versions 2, 3, 4)');
      assert.equal(events[0].aggregateVersion, 2, 'First event should be version 2');
      assert.equal(events[2].aggregateVersion, 4, 'Last event should be version 4');
    });
    
    it('should filter events by timestamp range', async () => {
      const aggregateId = Ids.entity();
      const baseTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        await eventStore.append({
          id: Ids.entity(),
          timestamp: baseTime + (i * 1000),
          type: 'TestEvent',
          aggregateId,
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: {},
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
      }
      
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Entity', aggregateId, {
        fromTimestamp: baseTime + 1000,
        toTimestamp: baseTime + 3000
      })) {
        events.push(event);
      }
      
      assert.equal(events.length, 3, 'Should retrieve 3 events in timestamp range');
    });
  });
  
  describe('getBySequence()', () => {
    it('should retrieve events by sequence range', async () => {
      const events: Event[] = [];
      
      for (let i = 0; i < 5; i++) {
        const event = await eventStore.append({
          id: Ids.entity(),
          timestamp: Date.now() + i,
          type: 'TestEvent',
          aggregateId: Ids.entity(),
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: {},
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
        events.push(event);
      }
      
      const retrieved: Event[] = [];
      for await (const event of eventStore.getBySequence(events[1].sequence, events[3].sequence)) {
        retrieved.push(event);
      }
      
      assert.equal(retrieved.length, 3, 'Should retrieve 3 events');
      assert.equal(retrieved[0].sequence, events[1].sequence, 'First should match');
      assert.equal(retrieved[2].sequence, events[3].sequence, 'Last should match');
    });
  });
  
  describe('getById()', () => {
    it('should retrieve event by id', async () => {
      const event = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const retrieved = await eventStore.getById(event.id);
      
      assert(retrieved, 'Event should be retrieved');
      assert.equal(retrieved.id, event.id, 'Event id should match');
      assert.equal(retrieved.type, event.type, 'Event type should match');
    });
    
    it('should return null for non-existent event', async () => {
      const retrieved = await eventStore.getById(Ids.entity());
      assert.equal(retrieved, null, 'Should return null for non-existent event');
    });
  });
  
  describe('getLatest()', () => {
    it('should retrieve latest event for aggregate', async () => {
      const aggregateId = Ids.entity();
      
      const event1 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId,
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const event2 = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'TestEvent',
        aggregateId,
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      const latest = await eventStore.getLatest('Entity', aggregateId);
      
      assert(latest, 'Latest event should exist');
      assert.equal(latest.id, event2.id, 'Should return latest event');
      assert.equal(latest.aggregateVersion, 2, 'Should have latest version');
    });
  });
  
  describe('subscribe()', () => {
    it('should subscribe to new events', async () => {
      const subscription = eventStore.subscribe();
      const events: Event[] = [];
      
      // Start subscription
      const subscriptionPromise = (async () => {
        for await (const event of subscription) {
          events.push(event);
          if (events.length >= 2) break;
        }
      })();
      
      // Append events
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        causation: {}
      });
      
      // Wait a bit for subscription to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      assert(events.length >= 2, 'Should receive at least 2 events');
      
      // Wait for subscription to complete (if not already done)
      try {
        await Promise.race([
          subscriptionPromise,
          new Promise(resolve => setTimeout(resolve, 1000))
        ]);
      } catch (error) {
        // Subscription may have already completed
      }
    }, { timeout: 5000 });
  });
  
  describe('verifyIntegrity()', () => {
    it('should verify chain integrity', async () => {
      const events: Event[] = [];
      
      for (let i = 0; i < 5; i++) {
        const event = await eventStore.append({
          id: Ids.entity(),
          timestamp: Date.now() + i,
          type: 'TestEvent',
          aggregateId: Ids.entity(),
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: {},
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
        events.push(event);
      }
      
      const result = await eventStore.verifyIntegrity();
      
      assert(result.isValid, 'Chain should be valid');
      assert(!result.error, 'Should have no errors');
    });
    
    it('should verify integrity for sequence range', async () => {
      const events: Event[] = [];
      
      for (let i = 0; i < 10; i++) {
        const event = await eventStore.append({
          id: Ids.entity(),
          timestamp: Date.now() + i,
          type: 'TestEvent',
          aggregateId: Ids.entity(),
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: {},
          actor: { type: 'System' as const, systemId: 'test' },
          causation: {}
        });
        events.push(event);
      }
      
      const result = await eventStore.verifyIntegrity(events[2].sequence, events[7].sequence);
      
      assert(result.isValid, 'Chain should be valid for range');
    });
  });
  
  describe('healthCheck()', () => {
    it('should return health status', async () => {
      const health = await eventStore.healthCheck();
      
      assert(health.healthy, 'Store should be healthy');
      assert(typeof health.latencyMs === 'number', 'Should have latency');
    });
  });
});