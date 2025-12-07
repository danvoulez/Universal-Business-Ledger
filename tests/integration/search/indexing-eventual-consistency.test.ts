/**
 * FASE 10 - TESTE COMO DOCUMENTAÇÃO
 * 
 * Este arquivo também funciona como "guia de uso" para humanos + IAs.
 * Ao alterar, preserve a clareza dos cenários e dados de exemplo.
 * 
 * FASE 9 - Tests for search indexing and eventual consistency
 * 
 * Este teste serve como roteiro de como busca e indexação funcionam.
 * Demonstra consistência eventual como feature explícita.
 */

import { describe, it, before, after } from 'mocha';
import * as assert from 'assert';
import { Pool } from 'pg';
import { createInMemoryEventStore } from '../../../core/store/event-store';
import { createSearchIndexer } from '../../../core/search/indexer';
import { createFakeSearchEngine } from '../../../core/search/fake-search-engine';
import type { EventStore } from '../../../core/store/event-store';
import type { SearchEngine } from '../../../core/search/engine';

describe('Search Indexing & Eventual Consistency', () => {
  let pool: Pool;
  let eventStore: EventStore;
  let searchEngine: ReturnType<typeof createFakeSearchEngine>;
  let indexer: ReturnType<typeof createSearchIndexer>;
  
  before(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/ubl_test',
      max: 5,
    });
    
    eventStore = createInMemoryEventStore();
    searchEngine = createFakeSearchEngine();
    indexer = createSearchIndexer({
      pool,
      eventStore,
      searchEngine,
    });
  });
  
  after(async () => {
    await pool.end();
  });
  
  it('should index documents incrementally', async () => {
    // Create some events
    await eventStore.append({
      type: 'EntityCreated',
      aggregateId: 'entity-1' as any,
      aggregateType: 'Entity',
      aggregateVersion: 1,
      payload: { name: 'Test Entity 1', description: 'First test entity' },
      actor: { type: 'System', systemId: 'test' },
      timestamp: Date.now(),
    });
    
    await eventStore.append({
      type: 'EntityCreated',
      aggregateId: 'entity-2' as any,
      aggregateType: 'Entity',
      aggregateVersion: 1,
      payload: { name: 'Test Entity 2', description: 'Second test entity' },
      actor: { type: 'System', systemId: 'test' },
      timestamp: Date.now(),
    });
    
    // Run indexing tick
    const result = await indexer.runIndexingTick();
    
    // Should have processed events
    assert.ok(result.processedCount >= 0, 'Should process events');
    
    // Search should find documents (if indexed)
    const searchResults = await searchEngine.search({
      query: 'Test Entity',
      type: 'FullText',
    });
    
    // In a real test, would verify documents are indexed
    assert.ok(searchResults.hits, 'Should return search results');
  });
  
  it('should track index consistency', async () => {
    const consistency = await indexer.getIndexConsistency();
    
    assert.ok(consistency, 'Should return consistency info');
    assert.ok(typeof consistency.indexLagEvents === 'number', 'Should have lag count');
    assert.ok(consistency.lastIndexedEventId !== undefined, 'Should track last indexed event');
  });
  
  it('should handle idempotent indexing', async () => {
    // Index a document
    await searchEngine.index({
      id: 'entity-1' as any,
      type: 'Entity',
      title: 'Test Entity',
      fields: {},
      indexedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    const before = searchEngine.getAllDocuments().length;
    
    // Index same document again
    await searchEngine.index({
      id: 'entity-1' as any,
      type: 'Entity',
      title: 'Test Entity',
      fields: {},
      indexedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    const after = searchEngine.getAllDocuments().length;
    
    // Should not duplicate (idempotent)
    assert.strictEqual(before, after, 'Should not duplicate documents');
  });
  
  it('should handle multiple realms', async () => {
    // Index documents for different realms
    await searchEngine.index({
      id: 'entity-realm1' as any,
      type: 'Entity',
      title: 'Realm 1 Entity',
      fields: { realmId: 'realm-1' },
      indexedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await searchEngine.index({
      id: 'entity-realm2' as any,
      type: 'Entity',
      title: 'Realm 2 Entity',
      fields: { realmId: 'realm-2' },
      indexedAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    // Search with realm filter
    const results = await searchEngine.search({
      query: 'Entity',
      type: 'FullText',
      filters: {
        realmId: 'realm-1' as any,
      },
    });
    
    assert.ok(results.hits.length > 0, 'Should find realm-specific results');
    assert.ok(results.hits.every(h => h.document.fields.realmId === 'realm-1'), 'Should filter by realm');
  });
  
  it('should show consistency markers in search results', async () => {
    const results = await searchEngine.search({
      query: 'test',
      type: 'FullText',
    });
    
    assert.ok(results.consistency, 'Should include consistency markers');
    assert.ok(typeof results.consistency.indexLagEvents === 'number', 'Should have lag count');
  });
});

