/**
 * UNIT TESTS - Core/Shared Types
 * 
 * Testes unitários para primitivos compartilhados:
 * - Geração de IDs
 * - Validação de tipos
 * - Conversões de tempo
 * - Validação de períodos
 * 
 * Sprint 1 - Prioridade: ALTA
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  Ids,
  asEntityId,
  isValidAt,
  durationToMs,
  generateId,
  describeActor,
  scopeContains
} from '../../../../core/shared/types.js';
import type { EntityId, Validity, Duration, ActorReference, Scope } from '../../../../core/shared/types.js';

describe('IDs', () => {
  describe('Ids.entity()', () => {
    it('should generate valid entity IDs', () => {
      const id = Ids.entity();
      assert(typeof id === 'string', 'ID should be string');
      assert(id.length >= 5, 'ID should have sufficient length');
      // Format: ent-{timestamp}-{random}
      assert(id.startsWith('ent-'), `Entity ID should start with 'ent-': ${id}`);
    });
    
    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 1000 }, () => Ids.entity()));
      assert.equal(ids.size, 1000, 'IDs should be unique');
    });
    
    it('should generate IDs with consistent format', () => {
      const ids = Array.from({ length: 100 }, () => Ids.entity());
      for (const id of ids) {
        assert(id.startsWith('ent-'), `All IDs should start with 'ent-': ${id}`);
        const parts = id.split('-');
        assert(parts.length >= 3, `ID should have format ent-{timestamp}-{random}: ${id}`);
        assert(parts[0] === 'ent', `First part should be 'ent': ${id}`);
      }
    });
    
    it('should generate IDs quickly (performance)', () => {
      const start = Date.now();
      const ids = Array.from({ length: 10000 }, () => Ids.entity());
      const duration = Date.now() - start;
      assert(duration < 1000, `Should generate 10000 IDs in < 1s, took ${duration}ms`);
      assert.equal(ids.length, 10000, 'Should generate all requested IDs');
    });
    
    it('should handle high-frequency generation', () => {
      // Generate many IDs in rapid succession
      const ids = new Set();
      for (let i = 0; i < 10000; i++) {
        ids.add(Ids.entity());
      }
      assert.equal(ids.size, 10000, 'Should maintain uniqueness under high frequency');
    });
  });
  
  describe('Ids.agreement()', () => {
    it('should generate valid agreement IDs', () => {
      const id = Ids.agreement();
      assert(typeof id === 'string', 'ID should be string');
      assert(id.length >= 5, 'ID should have sufficient length');
      assert(id.startsWith('agr-'), `Agreement ID should start with 'agr-': ${id}`);
    });
    
    it('should generate unique agreement IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => Ids.agreement()));
      assert.equal(ids.size, 100, 'Agreement IDs should be unique');
    });
  });
  
  describe('Ids.role()', () => {
    it('should generate valid role IDs', () => {
      const id = Ids.role();
      assert(typeof id === 'string', 'ID should be string');
      assert(id.startsWith('rol-'), `Role ID should start with 'rol-': ${id}`);
    });
  });
  
  describe('Ids.asset()', () => {
    it('should generate valid asset IDs', () => {
      const id = Ids.asset();
      assert(typeof id === 'string', 'ID should be string');
      assert(id.startsWith('ast-'), `Asset ID should start with 'ast-': ${id}`);
    });
  });
  
  describe('asEntityId()', () => {
    it('should convert string to EntityId', () => {
      const id = asEntityId('test-id');
      assert.equal(id, 'test-id');
      assert(typeof id === 'string');
    });
    
    it('should handle UUID format', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = asEntityId(uuid);
      assert.equal(id, uuid);
    });
  });
  
  describe('generateId()', () => {
    it('should generate IDs with custom prefix', () => {
      const id = generateId('custom');
      assert(typeof id === 'string', 'ID should be string');
      assert(id.length >= 5, 'ID should have sufficient length');
      assert(id.startsWith('custom-'), `ID should start with 'custom-': ${id}`);
    });
    
    it('should generate unique IDs with same prefix', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId('test')));
      assert.equal(ids.size, 100, 'IDs should be unique');
    });
    
    it('should generate IDs without prefix', () => {
      const id = generateId('');
      assert(typeof id === 'string', 'ID should be string');
      assert(id.length >= 5, 'ID should have sufficient length');
    });
  });
});

describe('Validity', () => {
  describe('isValidAt()', () => {
    it('should return true for time within validity period', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now - 1000,
        effectiveUntil: now + 1000
      };
      
      assert(isValidAt(validity, now), 'Should be valid at current time');
    });
    
    it('should return false for time before effectiveFrom', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now + 1000,
        effectiveUntil: now + 2000
      };
      
      assert(!isValidAt(validity, now), 'Should not be valid before effectiveFrom');
    });
    
    it('should return false for time after effectiveUntil', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now - 2000,
        effectiveUntil: now - 1000
      };
      
      assert(!isValidAt(validity, now), 'Should not be valid after effectiveUntil');
    });
    
    it('should handle null effectiveUntil (indefinite)', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now - 1000
        // effectiveUntil is undefined = indefinite
      };
      
      assert(isValidAt(validity, now), 'Should be valid when effectiveUntil is undefined');
      assert(isValidAt(validity, now + 1000000), 'Should be valid far in future when indefinite');
    });
    
    it('should handle validity starting now', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now
        // effectiveUntil is undefined = indefinite
      };
      
      assert(isValidAt(validity, now), 'Should be valid starting now');
    });
    
    it('should handle boundary conditions (exactly at effectiveFrom)', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now,
        effectiveUntil: now + 1000
      };
      
      assert(isValidAt(validity, now), 'Should be valid exactly at effectiveFrom');
    });
    
    it('should handle boundary conditions (exactly at effectiveUntil)', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now - 1000,
        effectiveUntil: now
      };
      
      assert(isValidAt(validity, now), 'Should be valid exactly at effectiveUntil');
    });
    
    it('should handle boundary conditions (just before effectiveFrom)', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now,
        effectiveUntil: now + 1000
      };
      
      assert(!isValidAt(validity, now - 1), 'Should not be valid just before effectiveFrom');
    });
    
    it('should handle boundary conditions (just after effectiveUntil)', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now - 1000,
        effectiveUntil: now
      };
      
      assert(!isValidAt(validity, now + 1), 'Should not be valid just after effectiveUntil');
    });
    
    it('should handle invalid validity period (effectiveUntil before effectiveFrom)', () => {
      const now = Date.now();
      const validity: Validity = {
        effectiveFrom: now + 1000,
        effectiveUntil: now - 1000 // Invalid: before effectiveFrom
      };
      
      // This is an invalid validity period, but the function should handle it gracefully
      assert(!isValidAt(validity, now), 'Should not be valid when period is invalid');
      assert(!isValidAt(validity, now + 2000), 'Should not be valid even after effectiveFrom if period is invalid');
    });
    
    it('should handle very large timestamps', () => {
      const farFuture = Number.MAX_SAFE_INTEGER - 1000;
      const validity: Validity = {
        effectiveFrom: farFuture - 1000,
        effectiveUntil: farFuture
      };
      
      assert(isValidAt(validity, farFuture - 500), 'Should handle very large timestamps');
      assert(!isValidAt(validity, farFuture + 1), 'Should not be valid after very large effectiveUntil');
    });
    
    it('should handle very old timestamps', () => {
      const oldTime = 0; // Unix epoch
      const validity: Validity = {
        effectiveFrom: oldTime,
        effectiveUntil: oldTime + 1000
      };
      
      assert(isValidAt(validity, oldTime + 500), 'Should handle very old timestamps');
      assert(!isValidAt(validity, oldTime - 1), 'Should not be valid before very old effectiveFrom');
    });
  });
});

describe('Duration', () => {
  describe('durationToMs()', () => {
    it('should convert days to milliseconds', () => {
      const duration: Duration = { amount: 7, unit: 'days' };
      const ms = durationToMs(duration);
      assert.equal(ms, 7 * 24 * 60 * 60 * 1000, '7 days should equal 604800000ms');
    });
    
    it('should convert hours to milliseconds', () => {
      const duration: Duration = { amount: 2, unit: 'hours' };
      const ms = durationToMs(duration);
      assert.equal(ms, 2 * 60 * 60 * 1000, '2 hours should equal 7200000ms');
    });
    
    it('should convert minutes to milliseconds', () => {
      const duration: Duration = { amount: 30, unit: 'minutes' };
      const ms = durationToMs(duration);
      assert.equal(ms, 30 * 60 * 1000, '30 minutes should equal 1800000ms');
    });
    
    it('should convert seconds to milliseconds', () => {
      const duration: Duration = { amount: 45, unit: 'seconds' };
      const ms = durationToMs(duration);
      assert.equal(ms, 45 * 1000, '45 seconds should equal 45000ms');
    });
    
    it('should return null for forever', () => {
      const duration: Duration = { amount: 1, unit: 'forever' };
      const ms = durationToMs(duration);
      assert.equal(ms, null, 'Forever should return null');
    });
    
    it('should handle zero duration', () => {
      const duration: Duration = { amount: 0, unit: 'seconds' };
      const ms = durationToMs(duration);
      assert.equal(ms, 0, 'Zero seconds should equal 0ms');
    });
    
    it('should handle fractional amounts', () => {
      const duration: Duration = { amount: 0.5, unit: 'hours' };
      const ms = durationToMs(duration);
      assert.equal(ms, 0.5 * 60 * 60 * 1000, '0.5 hours should equal 1800000ms');
    });
    
    it('should handle large amounts', () => {
      const duration: Duration = { amount: 1000, unit: 'years' };
      const ms = durationToMs(duration);
      assert(ms !== null, 'Large amounts should not return null');
      assert(ms! > 0, 'Large amounts should return positive value');
    });
    
    it('should handle all duration units', () => {
      const units: Duration['unit'][] = ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
      for (const unit of units) {
        if (unit === 'forever') continue;
        const duration: Duration = { amount: 1, unit };
        const ms = durationToMs(duration);
        assert(ms !== null, `${unit} should not return null`);
        assert(ms! > 0, `${unit} should return positive value`);
      }
    });
    
    it('should handle negative amounts gracefully', () => {
      const duration: Duration = { amount: -1, unit: 'seconds' };
      const ms = durationToMs(duration);
      // Negative durations may be valid in some contexts (e.g., time travel)
      assert(ms !== null, 'Negative amounts should be handled');
      assert.equal(ms, -1000, 'Negative seconds should equal negative milliseconds');
    });
  });
});

describe('ActorReference', () => {
  describe('describeActor()', () => {
    it('should describe Entity actor', () => {
      const actor: ActorReference = { type: 'Entity', entityId: asEntityId('ent-123') };
      const description = describeActor(actor);
      assert.equal(description, 'Entity ent-123');
    });
    
    it('should describe System actor', () => {
      const actor: ActorReference = { type: 'System', systemId: 'genesis' };
      const description = describeActor(actor);
      assert.equal(description, 'System:genesis');
    });
    
    it('should describe System actor with component', () => {
      const actor: ActorReference = { type: 'System', systemId: 'genesis', component: 'api' };
      const description = describeActor(actor);
      assert.equal(description, 'System:genesis/api');
    });
    
    it('should describe Workflow actor', () => {
      const actor: ActorReference = { type: 'Workflow', workflowId: asEntityId('wfl-123') };
      const description = describeActor(actor);
      assert.equal(description, 'Workflow wfl-123');
    });
    
    it('should describe Anonymous actor', () => {
      const actor: ActorReference = { type: 'Anonymous', reason: 'test' };
      const description = describeActor(actor);
      assert.equal(description, 'Anonymous (test)');
    });
  });
});

describe('Scope', () => {
  describe('scopeContains()', () => {
    it('should return true when container is Global', () => {
      const container: Scope = { type: 'Global' };
      const contained: Scope = { type: 'Realm', targetId: asEntityId('rlm-123') };
      assert(scopeContains(container, contained), 'Global scope should contain everything');
    });
    
    it('should return true when scopes match', () => {
      const container: Scope = { type: 'Realm', targetId: asEntityId('rlm-123') };
      const contained: Scope = { type: 'Realm', targetId: asEntityId('rlm-123') };
      assert(scopeContains(container, contained), 'Matching scopes should contain');
    });
    
    it('should return false when types differ', () => {
      const container: Scope = { type: 'Realm', targetId: asEntityId('rlm-123') };
      const contained: Scope = { type: 'Entity', targetId: asEntityId('ent-123') };
      assert(!scopeContains(container, contained), 'Different scope types should not contain');
    });
    
    it('should return false when targetIds differ', () => {
      const container: Scope = { type: 'Realm', targetId: asEntityId('rlm-123') };
      const contained: Scope = { type: 'Realm', targetId: asEntityId('rlm-456') };
      assert(!scopeContains(container, contained), 'Different targetIds should not contain');
    });
  });
});

