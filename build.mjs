import * as esbuild from 'esbuild';

console.log('📦 Building Universal Business Ledger...');

// Build the antenna server as a bundle
await esbuild.build({
  entryPoints: ['antenna/server.ts'],
  outfile: 'dist/antenna/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  packages: 'external', // Don't bundle node_modules
  logLevel: 'info',
  banner: {
    js: '// Universal Business Ledger - Antenna Server\n'
  }
});

// Build the CLI as a bundle
await esbuild.build({
  entryPoints: ['cli/ledger.ts'],
  outfile: 'dist/cli/ledger.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
  banner: {
    js: '#!/usr/bin/env node\n// Universal Business Ledger - CLI\n'
  }
});

// Build the core library as a bundle
await esbuild.build({
  entryPoints: ['core/index.ts'],
  outfile: 'dist/core/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
});

// Build the SDK
await esbuild.build({
  entryPoints: ['sdk/index.ts'],
  outfile: 'dist/sdk/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
});

// Build the worker
await esbuild.build({
  entryPoints: ['workers/job-processor.ts'],
  outfile: 'dist/workers/job-processor.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
});

// Build the migrate CLI
await esbuild.build({
  entryPoints: ['cli/migrate.ts'],
  outfile: 'dist/cli/migrate.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  sourcemap: true,
  packages: 'external',
  logLevel: 'info',
  banner: {
    js: '#!/usr/bin/env node\n// Universal Business Ledger - Migration CLI\n'
  }
});

console.log('✅ Build complete!');

