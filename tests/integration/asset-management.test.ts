/**
 * INTEGRATION TESTS - Asset Management
 * 
 * Testa o fluxo completo de gerenciamento de assets:
 * - Criar asset
 * - Transferir asset (Sale Agreement)
 * - Ownership atualizado
 * - Estado do asset correto
 * - Rastreabilidade completa
 * 
 * Sprint 4 - Prioridade: MÉDIA
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createInMemoryEventStore } from '../../core/store/event-store.js';
import { Ids } from '../../core/shared/types.js';
import type { EventStore } from '../../core/store/event-store.js';
import type { Event } from '../../core/schema/ledger.js';
import {
  validateEventIntegrity,
  validateEventSequence,
  assertReasonableTimestamp
} from '../helpers/validation-helpers.js';

describe('Asset Management - Integration', () => {
  let eventStore: EventStore;
  
  before(() => {
    eventStore = createInMemoryEventStore();
  });
  
  describe('Asset Creation', () => {
    it('should create asset with owner', async () => {
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      const ownerId = Ids.entity();
      const assetId = Ids.asset();
      
      // Create owner
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'PartyRegistered',
        aggregateId: ownerId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Owner', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Create asset
      const assetEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'AssetCreated',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 1,
        payload: {
          assetType: 'Product',
          ownerId,
          properties: {
            name: 'Test Product',
            sku: 'PROD-001'
          },
          quantity: { amount: 1, unit: 'piece' as const }
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(assetEvent, 'Asset should be created');
      
      // Rigorous validation
      const integrity = validateEventIntegrity(assetEvent);
      assert(integrity.isValid, `Asset event integrity failed: ${integrity.errors.join(', ')}`);
      assertReasonableTimestamp(assetEvent.timestamp);
      
      const payload = assetEvent.payload as any;
      assert.equal(payload.ownerId, ownerId, 'Asset should have owner');
      assert.equal(payload.assetType, 'Product', 'Asset type should match');
    });
  });
  
  describe('Asset Transfer', () => {
    it('should transfer asset via sale agreement', async () => {
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      const sellerId = Ids.entity();
      const buyerId = Ids.entity();
      const assetId = Ids.asset();
      const agreementId = Ids.agreement();
      
      // Create parties
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'PartyRegistered',
        aggregateId: sellerId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Seller', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'PartyRegistered',
        aggregateId: buyerId,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Buyer', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Create asset
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 2,
        type: 'AssetCreated',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 1,
        payload: {
          assetType: 'Product',
          ownerId: sellerId,
          properties: { name: 'Product', sku: 'PROD-001' },
          quantity: { amount: 1, unit: 'piece' as const }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Create sale agreement
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 3,
        type: 'AgreementCreated',
        aggregateId: agreementId,
        aggregateType: 'Agreement' as const,
        aggregateVersion: 1,
        payload: {
          agreementType: 'Sale',
          parties: [
            { partyId: sellerId, role: 'Seller' },
            { partyId: buyerId, role: 'Buyer' }
          ],
          assets: [assetId],
          terms: { description: 'Sale of product', clauses: [] },
          validity: { effectiveFrom: Date.now() }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Transfer asset
      const transferEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 4,
        type: 'AssetTransferred',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 2,
        payload: {
          fromPartyId: sellerId,
          toPartyId: buyerId,
          agreementId,
          transferType: 'Ownership' as const
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(transferEvent, 'Asset should be transferred');
      const payload = transferEvent.payload as any;
      assert.equal(payload.toPartyId, buyerId, 'Asset should be transferred to buyer');
      assert.equal(payload.agreementId, agreementId, 'Transfer should reference agreement');
      assert.equal(payload.transferType, 'Ownership', 'Transfer type should be Ownership');
    });
    
    it('should update asset status when transferred', async () => {
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      const assetId = Ids.asset();
      const ownerId = Ids.entity();
      
      // Create asset
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'AssetCreated',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 1,
        payload: {
          assetType: 'Product',
          ownerId,
          properties: { name: 'Product' },
          quantity: { amount: 1, unit: 'piece' as const }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Change status
      const statusEvent = await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'AssetStatusChanged',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 2,
        payload: {
          previousStatus: 'Created' as const,
          newStatus: 'Sold' as const,
          reason: 'Sold via agreement',
          agreementId: Ids.agreement()
        },
        actor: systemActor,
        causation: {}
      });
      
      assert(statusEvent, 'Asset status should be changed');
      const payload = statusEvent.payload as any;
      assert.equal(payload.newStatus, 'Sold', 'Status should be Sold');
    });
  });
  
  describe('Asset Rastreability', () => {
    it('should maintain complete traceability for asset transfers', async () => {
      const systemActor = { type: 'System' as const, systemId: 'genesis' };
      const assetId = Ids.asset();
      const owner1Id = Ids.entity();
      const owner2Id = Ids.entity();
      const agreementId = Ids.agreement();
      
      // Create owners
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now(),
        type: 'PartyRegistered',
        aggregateId: owner1Id,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Owner 1', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 1,
        type: 'PartyRegistered',
        aggregateId: owner2Id,
        aggregateType: 'Party' as const,
        aggregateVersion: 1,
        payload: {
          partyType: 'Person' as const,
          identity: { name: 'Owner 2', identifiers: [], contacts: [] }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Create asset
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 2,
        type: 'AssetCreated',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 1,
        payload: {
          assetType: 'Product',
          ownerId: owner1Id,
          properties: { name: 'Product' },
          quantity: { amount: 1, unit: 'piece' as const }
        },
        actor: systemActor,
        causation: {}
      });
      
      // Transfer asset
      await eventStore.append({
        id: Ids.entity(),
        timestamp: Date.now() + 3,
        type: 'AssetTransferred',
        aggregateId: assetId,
        aggregateType: 'Asset' as const,
        aggregateVersion: 2,
        payload: {
          fromPartyId: owner1Id,
          toPartyId: owner2Id,
          agreementId,
          transferType: 'Ownership' as const
        },
        actor: systemActor,
        causation: {}
      });
      
      // Verify complete traceability
      const events: Event[] = [];
      for await (const event of eventStore.getByAggregate('Asset', assetId)) {
        events.push(event);
      }
      
      assert(events.length >= 2, 'Should have at least 2 events');
      assert(events.some(e => e.type === 'AssetCreated'), 'Should have AssetCreated');
      assert(events.some(e => e.type === 'AssetTransferred'), 'Should have AssetTransferred');
      
      // Rigorous validation
      const sequenceValidation = await validateEventSequence(events, eventStore);
      assert(sequenceValidation.isValid,
        `Asset event sequence validation failed: ${sequenceValidation.errors.join(', ')}`);
      
      // Verify all events have actors and integrity
      for (const event of events) {
        assert(event.actor, `Event ${event.id} must have actor`);
        const integrity = validateEventIntegrity(event);
        assert(integrity.isValid,
          `Asset event ${event.id} integrity failed: ${integrity.errors.join(', ')}`);
        assertReasonableTimestamp(event.timestamp);
      }
      
      // Verify transfer references agreement
      const transferEvent = events.find(e => e.type === 'AssetTransferred');
      if (transferEvent) {
        const payload = transferEvent.payload as any;
        assert(payload.agreementId, 'Transfer should reference agreement');
        assert.equal(payload.agreementId, agreementId, 'Transfer should reference correct agreement');
        
        // Validate hash chain continuity
        const createdEvent = events.find(e => e.type === 'AssetCreated');
        if (createdEvent) {
          assert.equal(transferEvent.previousHash, createdEvent.hash,
            'Transfer event should link to created event hash');
        }
      }
    });
  });
});

