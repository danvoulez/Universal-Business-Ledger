#!/usr/bin/env node

/**
 * DEPLOY AUTOMÁTICO NO RENDER VIA API
 * 
 * Cria todos os serviços automaticamente
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
          console.log(`[${res.statusCode}] ${method} ${endpoint}`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error(`Error response: ${body}`);
            reject(new Error(`API Error ${res.statusCode}: ${body.substring(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Parse Error: ${body.substring(0, 200)}`));
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

async function getOwnerId() {
  console.log('📡 Getting owner ID...');
  try {
    const owners = await apiRequest('GET', '/owners');
    if (owners && owners.length > 0) {
      return owners[0].id;
    }
    // Try alternative endpoint
    const user = await apiRequest('GET', '/user');
    return user?.user?.id || user?.id;
  } catch (e) {
    console.log('⚠️  Could not get owner ID, will try without it');
    return null;
  }
}

async function deploy() {
  console.log('🚀 Deploying Universal Business Ledger to Render...\n');

  try {
    const ownerId = await getOwnerId();
    console.log(`✅ Owner ID: ${ownerId || 'using default'}\n`);

    // 1. Create PostgreSQL Database
    console.log('📦 Step 1/4: Creating PostgreSQL database...');
    const dbData = {
      name: 'ledger-db',
      databaseName: 'ledger',
      user: 'ledger_user',
      planId: 'starter',
      region: 'oregon',
    };
    if (ownerId) dbData.ownerId = ownerId;

    let db;
    try {
      db = await apiRequest('POST', '/databases', dbData);
      console.log(`✅ Database created: ${db.database?.name || db.name || 'created'}\n`);
    } catch (e) {
      console.log(`⚠️  Database creation: ${e.message}`);
      console.log('   (May already exist or need manual creation)\n');
    }

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Create Redis
    console.log('📦 Step 2/4: Creating Redis cache...');
    const redisData = {
      name: 'ledger-redis',
      planId: 'starter',
      region: 'oregon',
    };
    if (ownerId) redisData.ownerId = ownerId;

    let redis;
    try {
      redis = await apiRequest('POST', '/redis', redisData);
      console.log(`✅ Redis created: ${redis.redis?.name || redis.name || 'created'}\n`);
    } catch (e) {
      console.log(`⚠️  Redis creation: ${e.message}`);
      console.log('   (May already exist or need manual creation)\n');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Create Web Service
    console.log('📦 Step 3/4: Creating Web Service (Antenna)...');
    const webServiceData = {
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
        { key: 'OPENAI_API_KEY', value: API_KEYS.OPENAI_API_KEY },
        { key: 'ANTHROPIC_API_KEY', value: API_KEYS.ANTHROPIC_API_KEY },
        { key: 'GEMINI_API_KEY', value: API_KEYS.GEMINI_API_KEY },
      ],
      healthCheckPath: '/health',
    };
    if (ownerId) webServiceData.ownerId = ownerId;

    let webService;
    try {
      webService = await apiRequest('POST', '/services', webServiceData);
      console.log(`✅ Web Service created: ${webService.service?.name || webService.name || 'created'}\n`);
    } catch (e) {
      console.log(`⚠️  Web Service creation: ${e.message}`);
      console.log('   (May need to connect repo manually)\n');
    }

    // 4. Create Worker
    console.log('📦 Step 4/4: Creating Background Worker...');
    const workerData = {
      type: 'worker',
      name: 'workspace-worker',
      runtime: 'node',
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm run worker',
      planId: 'starter',
      region: 'oregon',
      envVars: [
        { key: 'OPENAI_API_KEY', value: API_KEYS.OPENAI_API_KEY },
        { key: 'ANTHROPIC_API_KEY', value: API_KEYS.ANTHROPIC_API_KEY },
        { key: 'GEMINI_API_KEY', value: API_KEYS.GEMINI_API_KEY },
      ],
    };
    if (ownerId) workerData.ownerId = ownerId;

    let worker;
    try {
      worker = await apiRequest('POST', '/services', workerData);
      console.log(`✅ Worker created: ${worker.service?.name || worker.name || 'created'}\n`);
    } catch (e) {
      console.log(`⚠️  Worker creation: ${e.message}`);
      console.log('   (May need to connect repo manually)\n');
    }

    console.log('\n✅ Deployment process completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Go to https://dashboard.render.com');
    console.log('   2. Find your services');
    console.log('   3. Connect your GitHub repo to each service');
    console.log('   4. Services will auto-deploy');
    console.log('\n⚠️  Note: You need to connect a Git repo for services to actually run.');
    console.log('   The database and Redis should be ready to use.');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    console.log('\n💡 Tip: Some services may need to be created manually via dashboard.');
    console.log('   Go to: https://dashboard.render.com');
    process.exit(1);
  }
}

deploy();

