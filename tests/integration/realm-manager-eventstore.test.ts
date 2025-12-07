/**
 * REALM MANAGER EVENT-STORE TESTS
 * 
 * Fase 5: REALM MANAGER 100% EVENT-STORE
 * 
 * Tests to ensure that Realm Manager is 100% based on event store:
 * - Rebuild from events works correctly
 * - Primordial Realm is always from event store
 * - No Realm exists without RealmCreated event
 * - Cache is derived, not source of truth
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createInMemoryEventStore } from '../../core/store/event-store.js';
import { createRealmManager } from '../../core/universal/realm-manager.js';
import {
  PRIMORDIAL_REALM_ID,
  GENESIS_AGREEMENT_ID,
  PRIMORDIAL_SYSTEM_ID,
  Ids,
} from '../../core/shared/types.js';
import type { EventStore } from '../../core/store/event-store.js';
import type { RealmManager } from '../../core/universal/realm-manager.js';
import type { Realm } from '../../core/universal/primitives.js';

describe('Realm Manager - Event Store Integration', () => {
  let eventStore: EventStore;
  let realmManager: RealmManager;

  before(async () => {
    eventStore = createInMemoryEventStore();
    realmManager = createRealmManager(eventStore);
    // Bootstrap to ensure Primordial Realm exists
    await realmManager.bootstrap();
  });

  describe('1. Rebuild Realm from Events', () => {
    it('should rebuild an existing Realm from events', async () => {
      // Create a new realm via the official API
      const agreementId = Ids.agreement();
      const realm = await realmManager.createRealm(
        'Test Realm for Rebuild',
        { isolation: 'Full', crossRealmAllowed: false },
        agreementId
      );

      assert.ok(realm, 'Realm should be created');
      const realmId = realm.id;

      // Clear cache by creating a new manager instance
      const freshManager = createRealmManager(eventStore);

      // Rebuild from events
      const rebuilt = await freshManager.rebuildRealmFromEvents(realmId);

      assert.ok(rebuilt, 'Realm should be rebuilt from events');
      assert.strictEqual(rebuilt.id, realmId, 'Rebuilt realm ID should match');
      assert.strictEqual(rebuilt.name, 'Test Realm for Rebuild', 'Rebuilt realm name should match');
      assert.strictEqual(rebuilt.establishedBy, agreementId, 'Rebuilt realm establishedBy should match');
      assert.deepStrictEqual(rebuilt.config, realm.config, 'Rebuilt realm config should match');
    });

    it('should return null for non-existent Realm', async () => {
      const nonExistentId = Ids.realm();
      const rebuilt = await realmManager.rebuildRealmFromEvents(nonExistentId);

      assert.strictEqual(rebuilt, null, 'Non-existent Realm should return null');
    });
  });

  describe('2. Primordial Realm from Event Store', () => {
    it('should get Primordial Realm from event store', async () => {
      const primordial = await realmManager.getPrimordialRealm();

      assert.ok(primordial, 'Primordial Realm should exist');
      assert.strictEqual(primordial.id, PRIMORDIAL_REALM_ID, 'Primordial Realm ID should match');
      assert.strictEqual(primordial.name, 'Primordial Realm', 'Primordial Realm name should match');
      assert.strictEqual(primordial.establishedBy, GENESIS_AGREEMENT_ID, 'Primordial Realm establishedBy should match');
      assert.strictEqual(primordial.config.isolation, 'Full', 'Primordial Realm isolation should be Full');
      assert.strictEqual(primordial.config.crossRealmAllowed, true, 'Primordial Realm crossRealmAllowed should be true');
    });

    it('should rebuild Primordial Realm from events in fresh manager', async () => {
      // Create a fresh manager (no cache)
      const freshManager = createRealmManager(eventStore);

      // Rebuild Primordial Realm from events
      const primordial = await freshManager.rebuildRealmFromEvents(PRIMORDIAL_REALM_ID);

      assert.ok(primordial, 'Primordial Realm should be rebuilt from events');
      assert.strictEqual(primordial.id, PRIMORDIAL_REALM_ID, 'Rebuilt Primordial Realm ID should match');
      assert.strictEqual(primordial.name, 'Primordial Realm', 'Rebuilt Primordial Realm name should match');
      assert.strictEqual(primordial.establishedBy, GENESIS_AGREEMENT_ID, 'Rebuilt Primordial Realm establishedBy should match');
    });
  });

  describe('3. getRealm uses Event Store', () => {
    it('should get Realm from cache if available', async () => {
      // Create a realm (will be in cache)
      const agreementId = Ids.agreement();
      const realm = await realmManager.createRealm(
        'Cached Realm',
        { isolation: 'Full', crossRealmAllowed: false },
        agreementId
      );

      // getRealm should return from cache
      const retrieved = await realmManager.getRealm(realm.id);

      assert.ok(retrieved, 'Realm should be retrieved');
      assert.strictEqual(retrieved.id, realm.id, 'Retrieved realm ID should match');
    });

    it('should rebuild Realm from events if not in cache', async () => {
      // Create a realm
      const agreementId = Ids.agreement();
      const realm = await realmManager.createRealm(
        'Uncached Realm',
        { isolation: 'Full', crossRealmAllowed: false },
        agreementId
      );

      // Create a fresh manager (no cache)
      const freshManager = createRealmManager(eventStore);

      // getRealm should rebuild from events
      const retrieved = await freshManager.getRealm(realm.id);

      assert.ok(retrieved, 'Realm should be retrieved from events');
      assert.strictEqual(retrieved.id, realm.id, 'Retrieved realm ID should match');
      assert.strictEqual(retrieved.name, 'Uncached Realm', 'Retrieved realm name should match');
    });

    it('should return null for non-existent Realm', async () => {
      const nonExistentId = Ids.realm();
      const retrieved = await realmManager.getRealm(nonExistentId);

      assert.strictEqual(retrieved, null, 'Non-existent Realm should return null');
    });
  });

  describe('4. Bootstrap Idempotency', () => {
    it('should be idempotent when bootstrap is called multiple times', async () => {
      // First bootstrap
      const result1 = await realmManager.bootstrap();
      const primordial1 = result1.primordialRealm;

      // Second bootstrap
      const result2 = await realmManager.bootstrap();
      const primordial2 = result2.primordialRealm;

      // Should return the same realm
      assert.deepStrictEqual(primordial1, primordial2, 'Bootstrap should be idempotent');

      // Verify only one RealmCreated event exists
      const events: any[] = [];
      for await (const event of eventStore.getByAggregate('Realm', PRIMORDIAL_REALM_ID)) {
        if (event.type === 'RealmCreated') {
          events.push(event);
        }
      }

      assert.strictEqual(events.length, 1, 'Only one RealmCreated event should exist for Primordial Realm');
    });
  });

  describe('5. Cache Consistency', () => {
    it('should keep cache consistent with event store', async () => {
      // Create a realm
      const agreementId = Ids.agreement();
      const realm = await realmManager.createRealm(
        'Consistency Test Realm',
        { isolation: 'Full', crossRealmAllowed: false },
        agreementId
      );

      // Get from cache
      const fromCache = await realmManager.getRealm(realm.id);

      // Rebuild from events
      const fromEvents = await realmManager.rebuildRealmFromEvents(realm.id);

      // Should be the same (compare key fields, createdAt may differ slightly)
      assert.ok(fromCache, 'Realm should be in cache');
      assert.ok(fromEvents, 'Realm should be rebuilt from events');
      assert.strictEqual(fromCache.id, fromEvents.id, 'IDs should match');
      assert.strictEqual(fromCache.name, fromEvents.name, 'Names should match');
      assert.strictEqual(fromCache.establishedBy, fromEvents.establishedBy, 'establishedBy should match');
      assert.deepStrictEqual(fromCache.config, fromEvents.config, 'Configs should match');
    });
  });

  describe('6. No Realm Without Event', () => {
    it('should not return Realm that does not have RealmCreated event', async () => {
      const fakeRealmId = Ids.realm();

      // Try to get a realm that doesn't exist
      const realm = await realmManager.getRealm(fakeRealmId);

      assert.strictEqual(realm, null, 'Realm without RealmCreated event should not exist');
    });
  });
});

