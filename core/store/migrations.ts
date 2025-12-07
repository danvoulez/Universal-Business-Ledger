/**
 * DATABASE MIGRATIONS
 * 
 * Versioned database migrations for PostgreSQL.
 * Run migrations in order to set up the database schema.
 */

import type { EventStoreAdapter } from '../api/event-store';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================================
// MIGRATION SYSTEM
// ============================================================================

export interface Migration {
  version: number;
  name: string;
  up: string; // SQL to apply migration
  down?: string; // SQL to rollback (optional)
}

// Load schema from SQL file
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple paths (dist, source, process.cwd)
let fullSchema: string | null = null;
const possiblePaths = [
  join(__dirname, 'postgres-schema.sql'), // dist/core/store/
  join(__dirname, '../../core/store/postgres-schema.sql'), // source
  join(process.cwd(), 'core/store/postgres-schema.sql'), // from project root
  join(process.cwd(), 'dist/core/store/postgres-schema.sql'), // dist from root
];

for (const schemaPath of possiblePaths) {
  try {
    fullSchema = readFileSync(schemaPath, 'utf-8');
    break;
  } catch (e) {
    // Try next path
  }
}

if (!fullSchema) {
  console.warn('Could not load postgres-schema.sql from any location');
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_schema',
    up: fullSchema || `
      -- Initial schema
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sequence BIGSERIAL UNIQUE NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        event_type TEXT NOT NULL,
        aggregate_id UUID NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_version INT NOT NULL,
        payload JSONB NOT NULL,
        actor_type TEXT NOT NULL,
        actor_id TEXT,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_aggregate 
        ON events(aggregate_type, aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_events_type 
        ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp 
        ON events(timestamp);
    `,
  },
];

// ============================================================================
// MIGRATION TRACKING
// ============================================================================

/**
 * Create migrations table to track applied migrations
 */
export async function createMigrationsTable(adapter: any): Promise<void> {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  
  // Execute via adapter (needs to support raw SQL)
  if (adapter.execute) {
    await adapter.execute(createTableSQL);
  } else {
    console.warn('Adapter does not support raw SQL execution');
  }
}

/**
 * Get applied migrations
 */
export async function getAppliedMigrations(adapter: any): Promise<number[]> {
  try {
    if (adapter.query) {
      const result = await adapter.query('SELECT version FROM schema_migrations ORDER BY version');
      return result.rows?.map((r: any) => r.version) || [];
    }
  } catch (e) {
    // Table doesn't exist yet
    return [];
  }
  return [];
}

/**
 * Mark migration as applied
 */
export async function markMigrationApplied(
  adapter: any,
  migration: Migration
): Promise<void> {
  const sql = `
    INSERT INTO schema_migrations (version, name)
    VALUES ($1, $2)
    ON CONFLICT (version) DO NOTHING;
  `;
  
  if (adapter.query) {
    await adapter.query(sql, [migration.version, migration.name]);
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(adapter: any): Promise<void> {
  console.log('🔄 Running database migrations...');
  
  // Create migrations table
  await createMigrationsTable(adapter);
  
  // Get applied migrations
  const applied = await getAppliedMigrations(adapter);
  
  // Find pending migrations
  const pending = MIGRATIONS.filter(m => !applied.includes(m.version));
  
  if (pending.length === 0) {
    console.log('✅ Database is up to date');
    return;
  }
  
  console.log(`📦 Found ${pending.length} pending migration(s)`);
  
  // Apply each migration
  for (const migration of pending) {
    console.log(`  → Applying migration ${migration.version}: ${migration.name}`);
    
    try {
      // Execute migration SQL
      if (adapter.execute) {
        await adapter.execute(migration.up);
      } else if (adapter.query) {
        // Split by semicolon and execute each statement
        const statements = migration.up
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        for (const statement of statements) {
          await adapter.query(statement);
        }
      }
      
      // Mark as applied
      await markMigrationApplied(adapter, migration);
      
      console.log(`  ✅ Migration ${migration.version} applied`);
    } catch (error: any) {
      console.error(`  ❌ Migration ${migration.version} failed:`, error.message);
      throw error;
    }
  }
  
  console.log('✅ All migrations applied');
}

/**
 * Run migrations from SQL file directly (for initial setup)
 */
export async function runSchemaFromFile(
  adapter: any,
  schemaSQL: string
): Promise<void> {
  console.log('🔄 Running schema from file...');
  
  // Split by semicolon and execute
  const statements = schemaSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.length > 0) {
      try {
        if (adapter.execute) {
          await adapter.execute(statement);
        } else if (adapter.query) {
          await adapter.query(statement);
        }
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          console.warn('SQL warning:', error.message);
        }
      }
    }
  }
  
  console.log('✅ Schema applied');
}

