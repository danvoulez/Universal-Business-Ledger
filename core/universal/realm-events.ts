/**
 * REALM EVENT BUILDERS
 * 
 * Canonical helpers for creating Realm-related events.
 * This ensures all RealmCreated events follow the exact contract defined in docs/REALM-CONTRACT.md.
 * 
 * ⚠️ CANONICAL SOURCE: This is the ONLY place where RealmCreated events are built.
 * All code that creates RealmCreated events should use these helpers.
 * 
 * @see docs/REALM-CONTRACT.md for the complete contract.
 */

import type { EntityId, Timestamp, ActorReference } from '../schema/ledger';
import type { Event, EventInput } from '../schema/ledger';
import type { RealmConfig, RealmCreated } from './primitives';
import { generateId } from '../shared/types';

/**
 * Builds a RealmCreated event following the canonical contract.
 * 
 * Contract requirements:
 * - aggregateType MUST be "Realm" (not "Flow" or anything else)
 * - payload.type MUST be "Realm" (not "RealmCreated")
 * - payload must contain: name, establishedBy, config
 * 
 * @param realmId - The ID of the realm being created
 * @param name - The name of the realm
 * @param establishedBy - The Agreement ID that establishes this realm
 * @param config - The RealmConfig for this realm
 * @param actor - Who is creating this realm
 * @param timestamp - When this event occurred (defaults to now)
 * @param aggregateVersion - Version of the aggregate (defaults to 1)
 * 
 * @returns EventInput ready to be appended to the event store
 */
export function buildRealmCreatedEvent(
  realmId: EntityId,
  name: string,
  establishedBy: EntityId,
  config: RealmConfig,
  actor: ActorReference,
  timestamp?: Timestamp,
  aggregateVersion: number = 1
): EventInput {
  const now = timestamp ?? Date.now();
  
  const payload: RealmCreated = {
    type: 'RealmCreated',
    name,
    establishedBy,
    config,
  };
  
  return {
    type: 'RealmCreated',
    aggregateId: realmId,
    aggregateType: 'Realm', // ⚠️ CANONICAL: Always "Realm", never "Flow"
    aggregateVersion,
    payload,
    actor,
    timestamp: now,
  };
}

/**
 * Validates that an event matches the RealmCreated contract.
 * 
 * @param event - The event to validate
 * @returns true if valid, throws error if invalid
 */
export function validateRealmCreatedEvent(event: Event): boolean {
  if (event.type !== 'RealmCreated') {
    throw new Error(`Expected event type 'RealmCreated', got '${event.type}'`);
  }
  
  if (event.aggregateType !== 'Realm') {
    throw new Error(
      `RealmCreated event must have aggregateType='Realm', got '${event.aggregateType}'. ` +
      `This violates the contract in docs/REALM-CONTRACT.md`
    );
  }
  
  const payload = event.payload as RealmCreated;
  if (!payload || payload.type !== 'RealmCreated') {
    throw new Error('RealmCreated event payload must have type="RealmCreated"');
  }
  
  if (!payload.name) {
    throw new Error('RealmCreated event payload must have a name');
  }
  
  if (!payload.establishedBy) {
    throw new Error('RealmCreated event payload must have establishedBy (Agreement ID)');
  }
  
  if (!payload.config) {
    throw new Error('RealmCreated event payload must have config (RealmConfig)');
  }
  
  if (!payload.config.isolation) {
    throw new Error('RealmConfig must have isolation property');
  }
  
  if (typeof payload.config.crossRealmAllowed !== 'boolean') {
    throw new Error('RealmConfig must have crossRealmAllowed as boolean');
  }
  
  return true;
}

