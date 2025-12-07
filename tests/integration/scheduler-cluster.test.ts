/**
 * FASE 7 - Tests for cluster-safe scheduler
 * 
 * Ensures:
 * - Only one instance processes deadlines per tick
 * - Idempotency prevents duplicate events
 * - Lock contention is handled gracefully
 */

import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import { Pool } from 'pg';
import { createInMemoryEventStore } from '../../core/store/event-store';
import { createClusterSafeScheduler } from '../../core/scheduling/scheduler-impl';
import type { EventStore } from '../../core/store/event-store';

describe('Scheduler Cluster Safety', () => {
  let pool: Pool;
  let eventStore: EventStore;
  let scheduler1: ReturnType<typeof createClusterSafeScheduler>;
  let scheduler2: ReturnType<typeof createClusterSafeScheduler>;

  before(async () => {
    // Create test PostgreSQL pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ubl_test',
      max: 5,
    });

    // Create event store
    eventStore = createInMemoryEventStore();

    // Create two scheduler instances (simulating cluster)
    scheduler1 = createClusterSafeScheduler({
      pool,
      eventStore,
      tickIntervalMs: 1000,
    });

    scheduler2 = createClusterSafeScheduler({
      pool,
      eventStore,
      tickIntervalMs: 1000,
    });
  });

  after(async () => {
    await scheduler1.stop();
    await scheduler2.stop();
    await pool.end();
  });

  it('should allow only one instance to process deadlines per tick', async () => {
    // Create a deadline
    const deadline = await scheduler1.createDeadline({
      name: 'Test Deadline',
      subject: {
        type: 'Obligation',
        agreementId: 'agr-test' as any,
        obligationId: 'obl-1',
      },
      dueAt: Date.now() - 1000, // Already due
      stages: [
        {
          trigger: { type: 'At' },
          action: {
            type: 'EmitEvent',
            eventType: 'DeadlineTriggered',
            aggregateType: 'Agreement',
            aggregateId: 'agr-test' as any,
            payload: { deadlineId: 'deadline-1' },
          },
          label: 'Trigger deadline',
        },
      ],
    });

    // Run tick on both schedulers concurrently
    const [result1, result2] = await Promise.all([
      scheduler1.runSchedulingTick(),
      scheduler2.runSchedulingTick(),
    ]);

    // At least one should have processed, but not both
    // (one should have gotten the lock, the other should have been skipped)
    
    // Check events - should only have one DeadlineTriggered event
    const events = eventStore.getByAggregate('Agreement', 'agr-test' as any);
    const deadlineEvents: any[] = [];
    for await (const event of events) {
      if (event.type === 'DeadlineTriggered') {
        deadlineEvents.push(event);
      }
    }

    // Should have exactly one event (idempotency + lock)
    assert.strictEqual(deadlineEvents.length, 1, 'Should have exactly one deadline event');
  });

  it('should prevent duplicate events with idempotency', async () => {
    // Create a deadline
    const deadline = await scheduler1.createDeadline({
      name: 'Test Deadline 2',
      subject: {
        type: 'Obligation',
        agreementId: 'agr-test-2' as any,
        obligationId: 'obl-2',
      },
      dueAt: Date.now() - 1000,
      stages: [
        {
          trigger: { type: 'At' },
          action: {
            type: 'EmitEvent',
            eventType: 'DeadlineTriggered',
            aggregateType: 'Agreement',
            aggregateId: 'agr-test-2' as any,
            payload: { deadlineId: 'deadline-2' },
          },
          label: 'Trigger deadline',
        },
      ],
    });

    // Run tick multiple times
    await scheduler1.runSchedulingTick();
    await scheduler1.runSchedulingTick();
    await scheduler1.runSchedulingTick();

    // Check events - should still only have one
    const events = eventStore.getByAggregate('Agreement', 'agr-test-2' as any);
    const deadlineEvents: any[] = [];
    for await (const event of events) {
      if (event.type === 'DeadlineTriggered') {
        deadlineEvents.push(event);
      }
    }

    assert.strictEqual(deadlineEvents.length, 1, 'Idempotency should prevent duplicate events');
  });

  it('should handle lock contention gracefully', async () => {
    // Create a deadline
    await scheduler1.createDeadline({
      name: 'Test Deadline 3',
      subject: {
        type: 'Obligation',
        agreementId: 'agr-test-3' as any,
        obligationId: 'obl-3',
      },
      dueAt: Date.now() - 1000,
      stages: [
        {
          trigger: { type: 'At' },
          action: {
            type: 'EmitEvent',
            eventType: 'DeadlineTriggered',
            aggregateType: 'Agreement',
            aggregateId: 'agr-test-3' as any,
            payload: { deadlineId: 'deadline-3' },
          },
          label: 'Trigger deadline',
        },
      ],
    });

    // Run both schedulers at the same time
    const promises = [
      scheduler1.runSchedulingTick(),
      scheduler2.runSchedulingTick(),
      scheduler1.runSchedulingTick(),
      scheduler2.runSchedulingTick(),
    ];

    // All should complete without errors (even if some skip due to lock)
    await Promise.all(promises);

    // Should have at least one event, but not more than the number of successful locks
    const events = eventStore.getByAggregate('Agreement', 'agr-test-3' as any);
    const deadlineEvents: any[] = [];
    for await (const event of events) {
      if (event.type === 'DeadlineTriggered') {
        deadlineEvents.push(event);
      }
    }

    // Should have at least 1, but not more than 4 (one per successful lock acquisition)
    assert.ok(deadlineEvents.length >= 1, 'Should have at least one event');
    assert.ok(deadlineEvents.length <= 4, 'Should not have more events than lock acquisitions');
  });
});

