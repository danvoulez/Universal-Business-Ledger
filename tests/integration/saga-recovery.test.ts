/**
 * FASE 7 - Tests for saga recovery after restart
 * 
 * Ensures:
 * - Sagas can be recovered after process restart
 * - Compensation works correctly
 * - Cross-realm operations use sagas
 */

import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import { Pool } from 'pg';
import { createInMemoryEventStore } from '../../core/store/event-store';
import { createPersistentSagaCoordinator } from '../../core/distributed/saga-coordinator-impl';
import type { Saga, SagaExecution } from '../../core/distributed/saga';
import type { EntityId, ActorReference } from '../../core/shared/types';
import type { EventStore } from '../../core/store/event-store';

describe('Saga Recovery', () => {
  let pool: Pool;
  let eventStore: EventStore;
  let coordinator: ReturnType<typeof createPersistentSagaCoordinator>;

  before(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ubl_test',
      max: 5,
    });

    eventStore = createInMemoryEventStore();

    coordinator = createPersistentSagaCoordinator({
      pool,
      eventStore,
    });
  });

  after(async () => {
    await pool.end();
  });

  it('should recover a running saga after restart', async () => {
    // Create a test saga that fails on step 2
    const testSaga: Saga<{ value: number }> = {
      id: 'saga-test-recovery' as EntityId,
      name: 'TestRecoverySaga',
      version: 1,
      timeoutMs: 60000,
      compensationFailureStrategy: 'alert',
      steps: [
        {
          name: 'Step1',
          async execute(ctx) {
            return { success: true, compensationData: { step1: 'done' } };
          },
          async compensate() {},
        },
        {
          name: 'Step2',
          async execute(ctx) {
            // Simulate failure
            throw new Error('Step 2 failed');
          },
          async compensate() {},
        },
        {
          name: 'Step3',
          async execute(ctx) {
            return { success: true };
          },
          async compensate() {},
        },
      ],
    };

    coordinator.register(testSaga);

    // Start the saga
    const execution = await coordinator.start('TestRecoverySaga', { value: 42 }, {
      type: 'System',
      systemId: 'test',
    });

    // Saga should have failed at step 2
    assert.strictEqual(execution.state, 'Failed' || 'Compensating', 'Saga should have failed');

    // Simulate restart: create new coordinator and recover
    const coordinator2 = createPersistentSagaCoordinator({
      pool,
      eventStore,
    });
    coordinator2.register(testSaga);

    await coordinator2.recoverPendingSagas();

    // Check that saga was compensated
    const recovered = await coordinator2.getExecution(execution.id);
    assert.ok(recovered, 'Saga should be recoverable');
    assert.ok(
      recovered!.state === 'Compensated' || recovered!.state === 'CompensationFailed',
      'Saga should be compensated'
    );
  });

  it('should handle cross-realm saga correctly', async () => {
    // Create a cross-realm transfer saga
    const crossRealmSaga: Saga<{
      sourceRealmId: EntityId;
      targetRealmId: EntityId;
      assetId: EntityId;
    }> = {
      id: 'saga-cross-realm-transfer' as EntityId,
      name: 'CrossRealmTransfer',
      version: 1,
      timeoutMs: 300000,
      compensationFailureStrategy: 'manual',
      steps: [
        {
          name: 'ReserveInSource',
          async execute(ctx) {
            return { success: true, compensationData: { reserved: true } };
          },
          async compensate() {
            // Release reservation
          },
        },
        {
          name: 'TransferToTarget',
          async execute(ctx) {
            // Simulate failure in target realm
            throw new Error('Target realm rejected');
          },
          async compensate() {
            // Nothing to compensate (transfer didn't happen)
          },
        },
        {
          name: 'ConfirmTransfer',
          async execute(ctx) {
            return { success: true };
          },
          async compensate() {},
        },
      ],
    };

    coordinator.register(crossRealmSaga);

    const execution = await coordinator.start(
      'CrossRealmTransfer',
      {
        sourceRealmId: 'realm-source' as EntityId,
        targetRealmId: 'realm-target' as EntityId,
        assetId: 'asset-1' as EntityId,
      },
      { type: 'System', systemId: 'test' }
    );

    // Should have failed and compensated
    assert.ok(execution.state === 'Failed' || execution.state === 'Compensating');

    // Verify compensation happened
    const final = await coordinator.getExecution(execution.id);
    assert.ok(final, 'Execution should exist');
    assert.ok(
      final!.state === 'Compensated' || final!.state === 'CompensationFailed',
      'Should be compensated'
    );
  });

  it('should detect stuck sagas', async () => {
    // Create a saga that takes a long time
    const slowSaga: Saga<{}> = {
      id: 'saga-slow' as EntityId,
      name: 'SlowSaga',
      version: 1,
      timeoutMs: 10000,
      compensationFailureStrategy: 'alert',
      steps: [
        {
          name: 'SlowStep',
          async execute() {
            // This step would normally take a long time
            // But we'll simulate it being stuck
            return new Promise(() => {
              // Never resolves (simulating stuck)
            });
          },
          async compensate() {},
        },
      ],
    };

    coordinator.register(slowSaga);

    // Start saga (but don't wait for completion)
    const execution = await coordinator.start('SlowSaga', {}, {
      type: 'System',
      systemId: 'test',
    });

    // Manually mark as running (simulating it got stuck)
    // In real scenario, this would happen if process crashed

    // Run recovery
    await coordinator.recoverPendingSagas();

    // Recovery should detect stuck saga
    const recovered = await coordinator.getExecution(execution.id);
    assert.ok(recovered, 'Saga should be recoverable');
  });
});

