#!/usr/bin/env node

/**
 * DEPLOY TO RENDER VIA API
 * 
 * Deploys Universal Business Ledger to Render without GitHub.
 * Uses Render API to create services directly.
 * 
 * Usage:
 *   node deploy-render-api.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURATION
// ============================================================================

const RENDER_API_KEY = 'rnd_d9tCMTz08g3LXTVr4wOwuBU5Vz1o';
const RENDER_API_BASE = 'https://api.render.com/v1';

const API_KEYS = {
  OPENAI_API_KEY: 'YOUR_OPENAI_API_KEY',
  ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY',
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
};

// ============================================================================
// API HELPERS
// ============================================================================

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

// ============================================================================
// DEPLOY FUNCTIONS
// ============================================================================

async function createDatabase() {
  console.log('📦 Creating PostgreSQL database...');
  
  const db = await apiRequest('POST', '/databases', {
    name: 'ledger-db',
    databaseName: 'ledger',
    user: 'ledger_user',
    planId: 'starter', // $7/month
    region: 'oregon', // us-west-2
  });

  console.log(`✅ Database created: ${db.database.id}`);
  return db.database;
}

async function createRedis() {
  console.log('📦 Creating Redis cache...');
  
  const redis = await apiRequest('POST', '/redis', {
    name: 'ledger-redis',
    planId: 'starter', // $7/month
    region: 'oregon',
  });

  console.log(`✅ Redis created: ${redis.redis.id}`);
  return redis.redis;
}

async function createWebService(dbConnectionString) {
  console.log('📦 Creating Web Service (Antenna)...');
  
  // First, we need to create a repo or use direct deploy
  // For now, we'll create the service and you can deploy manually
  
  const service = await apiRequest('POST', '/services', {
    type: 'web_service',
    name: 'antenna',
    repo: null, // No GitHub repo
    branch: null,
    rootDir: null,
    runtime: 'node',
    buildCommand: 'npm install && npm run build',
    startCommand: 'npm start',
    planId: 'starter', // $7/month
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

  console.log(`✅ Web Service created: ${service.service.id}`);
  return service.service;
}

async function createWorkerService(dbConnectionString, redisUrl) {
  console.log('📦 Creating Background Worker...');
  
  const service = await apiRequest('POST', '/services', {
    type: 'worker',
    name: 'workspace-worker',
    repo: null,
    branch: null,
    rootDir: null,
    runtime: 'node',
    buildCommand: 'npm install && npm run build',
    startCommand: 'npm run worker',
    planId: 'starter', // $7/month
    region: 'oregon',
    envVars: [
      { key: 'DATABASE_URL', value: dbConnectionString },
      { key: 'REDIS_URL', value: redisUrl },
      { key: 'OPENAI_API_KEY', value: API_KEYS.OPENAI_API_KEY },
      { key: 'ANTHROPIC_API_KEY', value: API_KEYS.ANTHROPIC_API_KEY },
      { key: 'GEMINI_API_KEY', value: API_KEYS.GEMINI_API_KEY },
    ],
  });

  console.log(`✅ Worker created: ${service.service.id}`);
  return service.service;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Deploying Universal Business Ledger to Render...\n');

  try {
    // 1. Create Database
    const db = await createDatabase();
    const dbConnectionString = db.connectionString || `postgresql://${db.user}:${db.password}@${db.host}:${db.port}/${db.database}`;
    
    // Wait a bit for DB to be ready
    console.log('⏳ Waiting for database to be ready...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 2. Create Redis
    const redis = await createRedis();
    const redisUrl = redis.connectionString || `redis://${redis.host}:${redis.port}`;
    
    // Wait a bit for Redis to be ready
    console.log('⏳ Waiting for Redis to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Create Web Service
    const webService = await createWebService(dbConnectionString);

    // 4. Create Worker
    const worker = await createWorkerService(dbConnectionString, redisUrl);

    console.log('\n✅ Deployment complete!');
    console.log('\n📋 Services created:');
    console.log(`   - Database: ${db.id}`);
    console.log(`   - Redis: ${redis.id}`);
    console.log(`   - Web Service: ${webService.id}`);
    console.log(`   - Worker: ${worker.id}`);
    console.log('\n⚠️  Note: You need to deploy code manually via Render dashboard');
    console.log('   or use Render CLI to deploy from local directory.\n');

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };

