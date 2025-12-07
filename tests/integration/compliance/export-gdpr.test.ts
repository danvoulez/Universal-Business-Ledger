/**
 * FASE 10 - TESTE COMO DOCUMENTAÇÃO
 * 
 * Este arquivo também funciona como "guia de uso" para humanos + IAs.
 * Ao alterar, preserve a clareza dos cenários e dados de exemplo.
 * 
 * FASE 8 - Tests for export and GDPR compliance
 * 
 * Este teste serve como roteiro de como export e compliance funcionam.
 * Demonstra o fluxo assíncrono de export (request → processing → ready).
 */

import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import { Pool } from 'pg';
import { createInMemoryEventStore } from '../../../core/store/event-store';
import { createExportService } from '../../../core/operational/export-service';
import type { ExportRequest } from '../../../core/operational/governance';

describe('Export & GDPR Compliance', () => {
  let pool: Pool;
  let exportService: ReturnType<typeof createExportService>;
  let eventStore: ReturnType<typeof createInMemoryEventStore>;
  
  before(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ubl_test',
      max: 5,
    });
    
    eventStore = createInMemoryEventStore();
    exportService = createExportService({
      pool,
      eventStore,
    });
  });
  
  after(async () => {
    await pool.end();
  });
  
  it('should create export request', async () => {
    const request = await exportService.request({
      type: 'EntityData',
      scope: {
        entityId: 'entity-1' as any,
        realmId: 'realm-1' as any,
      },
      format: 'JSON',
      requestedBy: 'user-1' as any,
    });
    
    assert.ok(request.id, 'Should have an ID');
    assert.strictEqual(request.state, 'Pending', 'Should start as Pending');
    assert.strictEqual(request.type, 'EntityData', 'Should have correct type');
  });
  
  it('should get export status', async () => {
    const request = await exportService.request({
      type: 'EntityData',
      scope: {
        entityId: 'entity-2' as any,
      },
      format: 'JSON',
      requestedBy: 'user-1' as any,
    });
    
    const status = await exportService.getStatus(request.id);
    
    assert.ok(status, 'Should return status');
    assert.strictEqual(status!.id, request.id, 'Should match request ID');
  });
  
  it('should get exports for entity', async () => {
    const request = await exportService.request({
      type: 'EntityData',
      scope: {
        entityId: 'entity-3' as any,
      },
      format: 'JSON',
      requestedBy: 'user-1' as any,
    });
    
    const exports = await exportService.getForEntity('entity-3' as any);
    
    assert.ok(exports.length > 0, 'Should return exports');
    assert.ok(exports.some(e => e.id === request.id), 'Should include created export');
  });
  
  it('should cancel pending export', async () => {
    const request = await exportService.request({
      type: 'EntityData',
      scope: {
        entityId: 'entity-4' as any,
      },
      format: 'JSON',
      requestedBy: 'user-1' as any,
    });
    
    await exportService.cancel(request.id);
    
    const status = await exportService.getStatus(request.id);
    assert.strictEqual(status!.state, 'Failed', 'Should be marked as Failed');
  });
});

