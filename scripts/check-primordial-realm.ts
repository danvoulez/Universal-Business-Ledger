#!/usr/bin/env node
/**
 * Spot-check do Primordial Realm
 * 
 * Verifica que o Primordial Realm está correto conforme o contrato.
 */

import { createInMemoryEventStore } from '../core/store/event-store.js';
import { createRealmManager } from '../core/universal/realm-manager.js';
import { 
  PRIMORDIAL_REALM_ID, 
  GENESIS_AGREEMENT_ID 
} from '../core/universal/primitives.js';

async function checkPrimordialRealm() {
  console.log('🔍 Verificando Primordial Realm...\n');
  
  const eventStore = createInMemoryEventStore();
  const realmManager = createRealmManager(eventStore);
  
  // Bootstrap
  await realmManager.bootstrap();
  
  // Get Primordial Realm
  const primordial = await realmManager.getRealm(PRIMORDIAL_REALM_ID);
  
  if (!primordial) {
    console.error('❌ Primordial Realm não existe!');
    process.exit(1);
  }
  
  console.log('✅ Primordial Realm existe\n');
  console.log('Propriedades:');
  console.log(`  id: ${primordial.id}`);
  console.log(`  Esperado: ${PRIMORDIAL_REALM_ID}`);
  console.log(`  ✅ ${primordial.id === PRIMORDIAL_REALM_ID ? 'CORRETO' : '❌ ERRADO'}\n`);
  
  console.log(`  name: "${primordial.name}"`);
  console.log(`  Esperado: "Primordial Realm"`);
  console.log(`  ✅ ${primordial.name === 'Primordial Realm' ? 'CORRETO' : '❌ ERRADO'}\n`);
  
  console.log(`  establishedBy: ${primordial.establishedBy}`);
  console.log(`  Esperado: ${GENESIS_AGREEMENT_ID}`);
  console.log(`  ✅ ${primordial.establishedBy === GENESIS_AGREEMENT_ID ? 'CORRETO' : '❌ ERRADO'}\n`);
  
  console.log(`  config.isolation: "${primordial.config.isolation}"`);
  console.log(`  Esperado: "Full"`);
  console.log(`  ✅ ${primordial.config.isolation === 'Full' ? 'CORRETO' : '❌ ERRADO'}\n`);
  
  console.log(`  config.crossRealmAllowed: ${primordial.config.crossRealmAllowed}`);
  console.log(`  Esperado: true`);
  console.log(`  ✅ ${primordial.config.crossRealmAllowed === true ? 'CORRETO' : '❌ ERRADO'}\n`);
  
  // Summary
  const allCorrect = 
    primordial.id === PRIMORDIAL_REALM_ID &&
    primordial.name === 'Primordial Realm' &&
    primordial.establishedBy === GENESIS_AGREEMENT_ID &&
    primordial.config.isolation === 'Full' &&
    primordial.config.crossRealmAllowed === true;
  
  if (allCorrect) {
    console.log('🎉 Primordial Realm está CORRETO conforme o contrato!');
    process.exit(0);
  } else {
    console.error('❌ Primordial Realm NÃO está conforme o contrato!');
    process.exit(1);
  }
}

checkPrimordialRealm().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});

