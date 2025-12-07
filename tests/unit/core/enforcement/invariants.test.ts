/**
 * UNIT TESTS - Core/Enforcement Invariants
 * 
 * Testes para:
 * - Hash chain integrity
 * - Temporal validation
 * - Aggregate version enforcement
 * - Business rule invariants
 * 
 * Sprint 1 - Prioridade: ALTA
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  createHashChain,
  createTemporalEnforcer
} from '../../../../core/enforcement/invariants.js';
import { Ids, asEntityId } from '../../../../core/shared/types.js';
import type { Event } from '../../../../core/schema/ledger.js';
import type { ActorReference } from '../../../../core/shared/types.js';

describe('Hash Chain', () => {
  let hashChain: ReturnType<typeof createHashChain>;
  
  before(() => {
    hashChain = createHashChain();
  });
  
  after(() => {
    // Cleanup if needed
  });
  
  describe('computeHash()', () => {
    it('should compute hash for event', () => {
      const event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: { test: 'data' },
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        causation: {}
      };
      
      const hash = hashChain.computeHash(event);
      
      assert(typeof hash === 'string', 'Hash should be string');
      assert(hash.startsWith('sha256:'), `Hash should start with sha256:: ${hash}`);
      assert(hash.length > 20, 'Hash should have sufficient length');
    });
    
    it('should produce same hash for same event', () => {
      const event = {
        id: 'test-id',
        sequence: 1n,
        timestamp: 1000,
        type: 'TestEvent',
        aggregateId: 'agg-1',
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: { test: 'data' },
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        causation: {}
      };
      
      const hash1 = hashChain.computeHash(event);
      const hash2 = hashChain.computeHash(event);
      
      assert.equal(hash1, hash2, 'Same event should produce same hash');
    });
    
    it('should produce different hash for different events', () => {
      const event1 = {
        id: 'test-id-1',
        sequence: 1n,
        timestamp: 1000,
        type: 'TestEvent',
        aggregateId: 'agg-1',
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: { test: 'data1' },
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        causation: {}
      };
      
      const event2 = {
        ...event1,
        payload: { test: 'data2' }
      };
      
      const hash1 = hashChain.computeHash(event1);
      const hash2 = hashChain.computeHash(event2);
      
      assert.notEqual(hash1, hash2, 'Different events should produce different hashes');
    });
  });
  
  describe('verifyHash()', () => {
    it('should verify correct hash', () => {
      const event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        causation: {}
      };
      
      const hash = hashChain.computeHash(event);
      const eventWithHash: Event = { ...event, hash } as Event;
      
      assert(hashChain.verifyHash(eventWithHash), 'Valid hash should verify');
    });
    
    it('should reject incorrect hash', () => {
      const event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'TestEvent',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:wronghash',
        causation: {}
      } as Event;
      
      assert(!hashChain.verifyHash(event), 'Invalid hash should not verify');
    });
  });
  
  describe('verifyChain()', () => {
    it('should verify valid chain', () => {
      const events: Event[] = [];
      let previousHash = 'genesis';
      
      for (let i = 0; i < 5; i++) {
        const event = {
          id: Ids.entity(),
          sequence: BigInt(i + 1),
          timestamp: Date.now() + i,
          type: 'TestEvent',
          aggregateId: Ids.entity(),
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: { index: i },
          actor: { type: 'System' as const, systemId: 'test' },
          previousHash,
          causation: {}
        };
        
        const hash = hashChain.computeHash(event);
        events.push({ ...event, hash } as Event);
        previousHash = hash;
      }
      
      const result = hashChain.verifyChain(events);
      assert(result.isValid, 'Valid chain should verify');
      assert(!result.error, 'Valid chain should have no error');
    });
    
    it('should detect broken chain', () => {
      const events: Event[] = [];
      let previousHash = 'genesis';
      
      // Create valid chain
      for (let i = 0; i < 3; i++) {
        const event = {
          id: Ids.entity(),
          sequence: BigInt(i + 1),
          timestamp: Date.now() + i,
          type: 'TestEvent',
          aggregateId: Ids.entity(),
          aggregateType: 'Entity' as const,
          aggregateVersion: i + 1,
          payload: {},
          actor: { type: 'System' as const, systemId: 'test' },
          previousHash,
          causation: {}
        };
        
        const hash = hashChain.computeHash(event);
        events.push({ ...event, hash } as Event);
        previousHash = hash;
      }
      
      // Break the chain
      events[1] = {
        ...events[1],
        previousHash: 'wrong-previous-hash'
      } as Event;
      
      const result = hashChain.verifyChain(events);
      assert(!result.isValid, 'Broken chain should not verify');
      assert(result.error, 'Broken chain should have error');
      assert(result.invalidAt, 'Should identify where chain broke');
    });
  });
});

describe('Temporal Enforcer', () => {
  let enforcer: ReturnType<typeof createTemporalEnforcer>;
  
  before(() => {
    enforcer = createTemporalEnforcer(() => 0n); // Start from 0
  });
  
  describe('validateTemporal()', () => {
    it('should validate monotonic sequence', () => {
      const event1: Event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:test1',
        causation: {}
      } as Event;
      
      const event2: Event = {
        id: Ids.entity(),
        sequence: 2n,
        timestamp: Date.now() + 1,
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: event1.hash,
        hash: 'sha256:test2',
        causation: {}
      } as Event;
      
      const result = enforcer.validateTemporal(event2, event1);
      assert(result.isValid, 'Monotonic sequence should be valid');
      assert.equal(result.violations.length, 0, 'Should have no violations');
    });
    
    it('should reject non-monotonic sequence', () => {
      const event1: Event = {
        id: Ids.entity(),
        sequence: 2n,
        timestamp: Date.now(),
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:test1',
        causation: {}
      } as Event;
      
      const event2: Event = {
        id: Ids.entity(),
        sequence: 1n, // Wrong: should be > 2
        timestamp: Date.now() + 1,
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: event1.hash,
        hash: 'sha256:test2',
        causation: {}
      } as Event;
      
      const result = enforcer.validateTemporal(event2, event1);
      assert(!result.isValid, 'Non-monotonic sequence should be invalid');
      assert(result.violations.length > 0, 'Should have violations');
      assert(result.violations.some(v => v.type === 'SequenceNotMonotonic'), 'Should detect sequence violation');
    });
    
    it('should reject duplicate sequence', () => {
      const event1: Event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:test1',
        causation: {}
      } as Event;
      
      const event2: Event = {
        id: Ids.entity(),
        sequence: 1n, // Wrong: duplicate sequence
        timestamp: Date.now() + 1,
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: event1.hash,
        hash: 'sha256:test2',
        causation: {}
      } as Event;
      
      const result = enforcer.validateTemporal(event2, event1);
      assert(!result.isValid, 'Duplicate sequence should be invalid');
      assert(result.violations.length > 0, 'Should have violations');
    });
    
    it('should reject broken chain link', () => {
      const event1: Event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:test1',
        causation: {}
      } as Event;
      
      const event2: Event = {
        id: Ids.entity(),
        sequence: 2n,
        timestamp: Date.now() + 1,
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'wrong-hash', // Wrong: should be event1.hash
        hash: 'sha256:test2',
        causation: {}
      } as Event;
      
      const result = enforcer.validateTemporal(event2, event1);
      assert(!result.isValid, 'Broken chain link should be invalid');
      assert(result.violations.length > 0, 'Should have violations');
      assert(result.violations.some(v => v.type === 'ChainBroken'), 'Should detect chain broken violation');
    });
    
    it('should validate first event (no previous)', () => {
      const event1: Event = {
        id: Ids.entity(),
        sequence: 1n,
        timestamp: Date.now(),
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:test1',
        causation: {}
      } as Event;
      
      const result = enforcer.validateTemporal(event1);
      assert(result.isValid, 'First event should be valid');
      assert.equal(result.violations.length, 0, 'Should have no violations');
    });
    
    it('should handle large sequence numbers', () => {
      const event1: Event = {
        id: Ids.entity(),
        sequence: BigInt('999999999999999999'),
        timestamp: Date.now(),
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 1,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: 'genesis',
        hash: 'sha256:test1',
        causation: {}
      } as Event;
      
      const event2: Event = {
        id: Ids.entity(),
        sequence: BigInt('999999999999999999') + 1n,
        timestamp: Date.now() + 1,
        type: 'Test',
        aggregateId: Ids.entity(),
        aggregateType: 'Entity' as const,
        aggregateVersion: 2,
        payload: {},
        actor: { type: 'System' as const, systemId: 'test' },
        previousHash: event1.hash,
        hash: 'sha256:test2',
        causation: {}
      } as Event;
      
      const result = enforcer.validateTemporal(event2, event1);
      assert(result.isValid, 'Large sequence numbers should be valid');
    });
  });
  
  describe('acquireNextSequence()', () => {
    it('should return monotonically increasing sequence', () => {
      const seq1 = enforcer.acquireNextSequence();
      const seq2 = enforcer.acquireNextSequence();
      const seq3 = enforcer.acquireNextSequence();
      
      assert(seq2 > seq1, 'Sequence should increase');
      assert(seq3 > seq2, 'Sequence should continue increasing');
    });
  });
});

