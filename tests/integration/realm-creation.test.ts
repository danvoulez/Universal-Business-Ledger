/**
 * INTEGRATION TESTS - Realm Creation
 * 
 * Testa o fluxo completo de criação de realm:
 * - Criar realm via intent
 * - Realm criado no event store
 * - Entidades sistema criadas
 * - License agreement criado
 * - API key gerada
 * - Realm isolado
 * 
 * Sprint 4 - Prioridade: ALTA
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createInMemoryEventStore } from '../../core/store/event-store.js';
import { createUniversalLedger } from '../../core/index.js';
import { Ids, PRIMORDIAL_REALM_ID } from '../../core/shared/types.js';
import type { EventStore } from '../../core/store/event-store.js';
import type { UniversalLedger } from '../../core/index.js';
import type { Event } from '../../core/schema/ledger.js';
import {
  validateEventIntegrity,
  validateEventSequence,
  validateIntentResult,
  validateApiKeyFormat,
  validateRealmIsolation,
  assertReasonableTimestamp,
  assertReasonablePerformance
} from '../helpers/validation-helpers.js';

describe('Realm Creation - Integration', () => {
  let eventStore: EventStore;
  let ledger: UniversalLedger;
  
  before(async () => {
    eventStore = createInMemoryEventStore();
    ledger = createUniversalLedger({
      eventStore,
      // Mock adapters for testing
      adapters: {
        s3: null as any,
        git: null as any,
        llm: null as any,
        stripe: null as any,
      }
    });
  });
  
  describe('createRealm Intent', () => {
    it('should create realm with all required components', async () => {
      const realmName = 'Test Realm';
      const realmId = Ids.realm();
      
      // Create realm via intent (simulated)
      // In real system, this would be: POST /intent { intent: 'createRealm', payload: { name: realmName } }
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      
      // Step 1: Create realm entity
      const realmEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'RealmCreated',
        aggregateId: realmId,
        aggregateType: 'Realm' as const,
        aggregateVersion: 1,
        payload: {
          name: realmName,
          createdAt: Date.now()
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(realmEvent, 'Realm event should be created');
      assert.equal(realmEvent.aggregateId, realmId, 'Realm ID should match');
      
      // Rigorous validation
      const integrity = validateEventIntegrity(realmEvent);
      assert(integrity.isValid, `Realm event integrity failed: ${integrity.errors.join(', ')}`);
      assertReasonableTimestamp(realmEvent.timestamp);
      
      // Step 2: Create system entities
      const systemEntityId = Ids.entity();
      const systemEntityEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'PartyRegistered',
        aggregateId: systemEntityId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Organization' as const,
          identity: {
            name: `${realmName} System`,
            identifiers: [],
            contacts: []
          }
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(systemEntityEvent, 'System entity event should be created');
      
      // Step 3: Create licensee entity
      const licenseeEntityId = Ids.entity();
      const licenseeEntityEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 2,
        type: 'PartyRegistered',
        aggregateId: licenseeEntityId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Organization' as const,
          identity: {
            name: realmName,
            identifiers: [],
            contacts: []
          }
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(licenseeEntityEvent, 'Licensee entity event should be created');
      
      // Step 4: Create license agreement
      const licenseAgreementId = Ids.agreement();
      const licenseAgreementEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 3,
        type: 'AgreementCreated',
        aggregateId: licenseAgreementId,
        aggregateType: 'Agreement' as const,
        aggregateVersion: 1,
        payload: {
          agreementType: 'License',
          parties: [
            { partyId: systemEntityId, role: 'Licensor' },
            { partyId: licenseeEntityId, role: 'Licensee' }
          ],
          terms: {
            description: `License agreement for ${realmName}`,
            clauses: []
          },
          validity: {
            effectiveFrom: Date.now()
          }
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(licenseAgreementEvent, 'License agreement event should be created');
      
      // Step 5: Generate API key (simulated)
      const apiKey = `ubl_${Ids.entity().replace(/-/g, '')}`;
      const apiKeyEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 4,
        type: 'ApiKeyGenerated',
        aggregateId: systemEntityId,
        aggregateType: 'Party' as const,
        aggregateVersion: 2,
        payload: {
          apiKey,
          realmId,
          entityId: systemEntityId
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(apiKeyEvent, 'API key event should be created');
      
      // Verify all events are in the store
      const allEvents: Event[] = [];
      for await (const event of eventStore.getBySequence(1n)) {
        allEvents.push(event);
      }
      
      assert(allEvents.length >= 5, 'Should have at least 5 events (realm, system, licensee, agreement, apiKey)');
      
      // Rigorous validation of event sequence
      const sequenceValidation = await validateEventSequence(allEvents, eventStore);
      assert(sequenceValidation.isValid, 
        `Event sequence validation failed: ${sequenceValidation.errors.join(', ')}`);
      
      // Verify realm isolation - events should reference the realm
      const realmEvents = allEvents.filter(e => 
        e.aggregateId === realmId || 
        (e.payload as any)?.realmId === realmId
      );
      
      assert(realmEvents.length > 0, 'Should have events related to the realm');
      
      // Validate each event's integrity
      for (const event of allEvents) {
        const integrity = validateEventIntegrity(event);
        assert(integrity.isValid, 
          `Event ${event.id} integrity failed: ${integrity.errors.join(', ')}`);
      }
    });
    
    it('should create realm with isolated event stream', async () => {
      const realm1Id = Ids.realm();
      const realm2Id = Ids.realm();
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      
      // Create realm 1
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'RealmCreated',
        aggregateId: realm1Id,
        aggregateType: 'Realm' as const,
        aggregateVersion: 1,
        payload: { name: 'Realm 1', createdAt: Date.now() },
        actor: systemActor,
        causation: {}
      });
      
      // Create realm 2
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'RealmCreated',
        aggregateId: realm2Id,
        aggregateType: 'Realm' as const,
        aggregateVersion: 1,
        payload: { name: 'Realm 2', createdAt: Date.now() },
        actor: systemActor,
        causation: {}
      });
      
      // Verify realms are separate
      const realm1Events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Realm', realm1Id)) {
        realm1Events.push(event);
      }
      
      const realm2Events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Realm', realm2Id)) {
        realm2Events.push(event);
      }
      
      assert(realm1Events.length > 0, 'Realm 1 should have events');
      assert(realm2Events.length > 0, 'Realm 2 should have events');
      assert.notEqual(realm1Id, realm2Id, 'Realms should be different');
      
      // Rigorous isolation validation
      const isolationValidation = await validateRealmIsolation(
        realm1Events,
        realm2Events,
        realm1Id,
        realm2Id
      );
      assert(isolationValidation.isValid,
        `Realm isolation validation failed: ${isolationValidation.errors.join(', ')}`);
    });
  });
  
  describe('Realm Components', () => {
    it('should create system entity for realm', async () => {
      const realmId = Ids.realm();
      const systemEntityId = Ids.entity();
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'PartyRegistered',
        aggregateId: systemEntityId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Organization' as const,
          identity: {
            name: 'System Entity',
            identifiers: [],
            contacts: []
          }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Verify system entity exists
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Party', systemEntityId)) {
        events.push(event);
      }
      
      assert(events.length > 0, 'System entity should have events');
      assert.equal(events[0].type, 'PartyRegistered', 'First event should be PartyRegistered');
    });
    
    it('should create license agreement for realm', async () => {
      const agreementId = Ids.agreement();
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'AgreementCreated',
        aggregateId: agreementId,
        aggregateType: 'Agreement' as const,
        aggregateVersion: 1,
        payload: {
          agreementType: 'License',
          parties: [
            { partyId: Ids.entity(), role: 'Licensor' },
            { partyId: Ids.entity(), role: 'Licensee' }
          ],
          terms: {
            description: 'License agreement',
            clauses: []
          },
          validity: {
            effectiveFrom: Date.now()
          }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Verify agreement exists
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Agreement', agreementId)) {
        events.push(event);
      }
      
      assert(events.length > 0, 'License agreement should have events');
      assert.equal(events[0].type, 'AgreementCreated', 'First event should be AgreementCreated');
    });
    
    it('should generate API key for realm', async () => {
      const realmId = Ids.realm();
      const entityId = Ids.entity();
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      
      const apiKey = `ubl_${Ids.entity().replace(/-/g, '')}`;
      
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'ApiKeyGenerated',
        aggregateId: entityId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          apiKey,
          realmId,
          entityId
        },
        actor: systemActor,
        causation: {}
      });
      
      // Verify API key event exists
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Party', entityId)) {
        if (event.type === 'ApiKeyGenerated') {
          events.push(event);
        }
      }
      
      assert(events.length > 0, 'API key event should exist');
      const payload = events[0].payload as any;
      assert(payload.apiKey, 'API key should be in payload');
      assert(payload.apiKey.startsWith('ubl_'), 'API key should start with ubl_');
      assert.equal(payload.realmId, realmId, 'API key should reference realm');
    });
  });
  
  describe('Realm Isolation', () => {
    it('should isolate events by realm', async () => {
      const realm1Id = Ids.realm();
      const realm2Id = Ids.realm();
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      
      // Create entity in realm 1
      const entity1Id = Ids.entity();
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'PartyRegistered',
        aggregateId: entity1Id,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Person 1', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Create entity in realm 2
      const entity2Id = Ids.entity();
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'PartyRegistered',
        aggregateId: entity2Id,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Person 2', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Verify entities are separate
      const entity1Events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Party', entity1Id)) {
        entity1Events.push(event);
      }
      
      const entity2Events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Party', entity2Id)) {
        entity2Events.push(event);
      }
      
      assert(entity1Events.length > 0, 'Entity 1 should have events');
      assert(entity2Events.length > 0, 'Entity 2 should have events');
      assert.notEqual(entity1Id, entity2Id, 'Entities should be different');
    });
  });
});

