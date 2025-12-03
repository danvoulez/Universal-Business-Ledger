#!/usr/bin/env node

/**
 * DEPLOY TO RENDER VIA API
 * 
 * Deploys Universal Business Ledger to Render using API directly.
 * 
 * Usage:
 *   node deploy-render-api-direct.js
 */

import https from 'https';

const RENDER_API_KEY = 'rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o';
const RENDER_API_BASE = 'https://api.render.com/v1';

const API_KEYS = {
  OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY',
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
};

function apiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, RENDER_API_BASE);
    
    const options = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Parse Error: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function deploy() {
  console.log('🚀 Deploying Universal Business Ledger to Render...\n');

  try {
    // 1. Create PostgreSQL Database
    console.log('📦 Creating PostgreSQL database...');
    const db = await apiRequest('POST', '/databases', {
      name: 'ledger-db',
      databaseName: 'ledger',
      user: 'ledger_user',
      planId: 'starter',
      region: 'oregon',
    });
    console.log(`✅ Database created: ${db.database?.id || 'created'}`);
    const dbConnectionString = db.database?.connectionString || 'postgresql://...';

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 2. Create Redis
    console.log('📦 Creating Redis cache...');
    const redis = await apiRequest('POST', '/redis', {
      name: 'ledger-redis',
      planId: 'starter',
      region: 'oregon',
    });
    console.log(`✅ Redis created: ${redis.redis?.id || 'created'}`);
    const redisUrl = redis.redis?.connectionString || 'redis://...';

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Create Web Service
    console.log('📦 Creating Web Service (Antenna)...');
    const webService = await apiRequest('POST', '/services', {
      type: 'web_service',
      name: 'antenna',
      runtime: 'node',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
      planId: 'starter',
      region: 'oregon',
      envVars: [
        { key: 'PORT', value: '10000' },
        { key: 'NODE_ENV', value: 'production' },
        { key: 'DATABASE_URL', value: dbConnectionString },
        { key: 'OPENAI_API_KEY', value: API_KEYS.OPENAI_API_KEY },
        { key: 'ANTHROPIC_API_KEY', value: API_KEYS.ANTHROPIC_API_KEY },
        { key: 'GEMINI_API_KEY', value: API_KEYS.GEMINI_API_KEY },
      ],
      healthCheckPath: '/health',
    });
    console.log(`✅ Web Service created: ${webService.service?.id || 'created'}`);

    // 4. Create Worker
    console.log('📦 Creating Background Worker...');
    const worker = await apiRequest('POST', '/services', {
      type: 'worker',
      name: 'workspace-worker',
      runtime: 'node',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm run worker',
      planId: 'starter',
      region: 'oregon',
      envVars: [
        { key: 'DATABASE_URL', value: dbConnectionString },
        { key: 'REDIS_URL', value: redisUrl },
        { key: 'OPENAI_API_KEY', value: API_KEYS.OPENAI_API_KEY },
        { key: 'ANTHROPIC_API_KEY', value: API_KEYS.ANTHROPIC_API_KEY },
        { key: 'GEMINI_API_KEY', value: API_KEYS.GEMINI_API_KEY },
      ],
    });
    console.log(`✅ Worker created: ${worker.service?.id || 'created'}`);

    console.log('\n✅ Deployment initiated!');
    console.log('\n📋 Next steps:');
    console.log('   1. Go to https://dashboard.render.com');
    console.log('   2. Find your services');
    console.log('   3. Connect your GitHub repo or upload code manually');
    console.log('   4. Services will auto-deploy');
    console.log('\n⚠️  Note: You need to connect a Git repo or upload code for services to actually run.');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

deploy();

