/**
 * MIGRATION CLI
 * 
 * Run database migrations from command line.
 * 
 * Usage:
 *   npm run migrate
 *   node dist/cli/migrate.js
 */

import { runMigrations, runSchemaFromFile } from '../core/store/migrations';
import { createPostgresAdapter } from '../sdk/postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.log('\nSet it in .env or export it:');
    console.log('  export DATABASE_URL=postgresql://user:pass@host:port/db');
    process.exit(1);
  }
  
  console.log('🔄 Connecting to database...');
  
  // Create adapter
  const adapter = createPostgresAdapter();
  await adapter.initialize({
    connectionString: databaseUrl,
  });
  
  // Check if we should run full schema or migrations
  const useFullSchema = process.argv.includes('--full-schema');
  
  if (useFullSchema) {
    // Run full schema from file
    const schemaPath = join(__dirname, '../core/store/postgres-schema.sql');
    try {
      const schema = readFileSync(schemaPath, 'utf-8');
      await runSchemaFromFile(adapter, schema);
    } catch (error: any) {
      console.error('❌ Failed to load schema file:', error.message);
      process.exit(1);
    }
  } else {
    // Run migrations
    await runMigrations(adapter);
  }
  
  await adapter.shutdown();
  console.log('✅ Done!');
}

main().catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

