/**
 * @chaos-td/game-data - Balance Document Checker
 *
 * Cross-platform script to verify that docs/03_BALANCE_BASELINE.md
 * is consistent with packages/game-data.
 *
 * Usage:
 *   node scripts/check-balance.mjs
 *   npm run docs:check-balance
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Convert Windows path to file:// URL
const gameDataPath = 'file:///' + resolve(rootDir, 'packages/game-data/dist/index.js').replace(/\\/g, '/');

const { GLOBAL_CONFIG, TOWER_DEFINITIONS, MONSTER_DEFINITIONS } = await import(gameDataPath);

function parseBalanceDoc(docPath) {
  const content = readFileSync(docPath, 'utf-8');
  const lines = content.split('\n');

  const result = {
    global: {},
    towers: {},
    monsters: {},
  };

  let currentSection = null;
  let currentTowerName = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Section detection
    if (trimmed === '## 1. 全局') {
      currentSection = 'global';
      currentTowerName = null;
      continue;
    }
    if (trimmed === '## 2. 塔') {
      currentSection = 'towers';
      currentTowerName = null;
      continue;
    }
    if (trimmed === '## 3. 怪物') {
      currentSection = 'monsters';
      currentTowerName = null;
      continue;
    }

    // Parse tower headers
    if (trimmed.startsWith('### ')) {
      currentTowerName = trimmed.replace('### ', '').trim().toLowerCase();
      result.towers[currentTowerName] = [];
      continue;
    }

    // Parse tower data rows
    if (currentSection === 'towers' && currentTowerName && trimmed.startsWith('|')) {
      const parts = trimmed.split('|').filter(p => p.trim()).map(p => p.trim());
      if (parts.length >= 5 && !parts[0].includes('-')) {
        const levelData = {
          cost: parseInt(parts[1], 10),
          damage: parseInt(parts[2], 10),
          cooldown: parseInt(parts[3].replace(' ticks', ''), 10),
          range: parseInt(parts[4], 10),
        };
        if (!isNaN(levelData.cost)) {
          result.towers[currentTowerName].push(levelData);
        }
      }
      continue;
    }

    // Parse monster rows (skip header)
    const validMonsterIds = ['sheep', 'wolf', 'treant', 'ghost'];
    if (currentSection === 'monsters' && trimmed.startsWith('|') && validMonsterIds.some(id => trimmed.includes(id))) {
      // Check if it's the header or separator
      if (trimmed.includes('ID') || trimmed.includes('---')) continue;
      
      const parts = trimmed.split('|').filter(p => p.trim()).map(p => p.trim());
      if (parts.length >= 10) {
        const id = parts[0].toLowerCase();
        if (id && validMonsterIds.includes(id)) {
          result.monsters[id] = {
            cost: parseInt(parts[1], 10),
            income: parseInt(parts[2], 10),
            bounty: parseInt(parts[3], 10),
            hp: parseInt(parts[4], 10),
            shield: parseInt(parts[5], 10),
            armor: parseInt(parts[6].replace('‰', ''), 10),
            speed: parseInt(parts[7], 10),
            leak: parseInt(parts[8], 10),
            gap: parseInt(parts[9], 10),
            unlock: parts[10] ? parseInt(parts[10], 10) : 0,
          };
        }
      }
    }
  }

  return result;
}

function compareGlobal(doc, runtime) {
  const errors = [];
  const checks = [
    ['tickRate', 'tickRate'],
    ['countdownTicks', 'countdownTicks'],
    ['maxRunningTicks', 'maxRunningTicks'],
    ['maxResolvingTicks', 'maxResolvingTicks'],
    ['startingHp', 'startingHp'],
    ['startingGold', 'startingGold'],
    ['startingIncome', 'startingIncome'],
    ['incomeIntervalTicks', 'incomeIntervalTicks'],
    ['sellRefundPermille', 'sellRefundPermille'],
    ['sendQueueLimit', 'sendQueueLimit'],
    ['slowCapPermille', 'slowCapPermille'],
  ];

  for (const [docKey, runtimeKey] of checks) {
    if (doc.global[docKey] !== undefined && doc.global[docKey] !== runtime[runtimeKey]) {
      errors.push(`Global.${runtimeKey}: doc=${doc.global[docKey]}, runtime=${runtime[runtimeKey]}`);
    }
  }
  return errors;
}

function compareTowers(doc, runtime) {
  const errors = [];
  for (const tower of runtime) {
    const towerName = tower.id;
    const docTower = doc.towers[towerName];
    if (!docTower || !Array.isArray(docTower) || docTower.length === 0) {
      errors.push(`Tower ${towerName}: not found in document`);
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const runtimeLevel = tower.levels[i];
      const docLevel = docTower[i];
      if (!docLevel) continue;
      if (docLevel.cost !== runtimeLevel.cost) errors.push(`Tower ${towerName} L${i + 1} cost: doc=${docLevel.cost}, runtime=${runtimeLevel.cost}`);
      if (docLevel.damage !== runtimeLevel.damage) errors.push(`Tower ${towerName} L${i + 1} damage: doc=${docLevel.damage}, runtime=${runtimeLevel.damage}`);
      if (docLevel.cooldown !== runtimeLevel.cooldownTicks) errors.push(`Tower ${towerName} L${i + 1} cooldown: doc=${docLevel.cooldown}, runtime=${runtimeLevel.cooldownTicks}`);
      if (docLevel.range !== runtimeLevel.rangeMilliTiles) errors.push(`Tower ${towerName} L${i + 1} range: doc=${docLevel.range}, runtime=${runtimeLevel.rangeMilliTiles}`);
    }
  }
  return errors;
}

function compareMonsters(doc, runtime) {
  const errors = [];
  for (const monster of runtime) {
    const docMonster = doc.monsters[monster.id];
    if (!docMonster) {
      errors.push(`Monster ${monster.id}: not found in document`);
      continue;
    }
    if (docMonster.cost !== monster.sendCost) errors.push(`Monster ${monster.id} sendCost: doc=${docMonster.cost}, runtime=${monster.sendCost}`);
    if (docMonster.income !== monster.incomeGain) errors.push(`Monster ${monster.id} incomeGain: doc=${docMonster.income}, runtime=${monster.incomeGain}`);
    if (docMonster.bounty !== monster.bounty) errors.push(`Monster ${monster.id} bounty: doc=${docMonster.bounty}, runtime=${monster.bounty}`);
    if (docMonster.hp !== monster.hp) errors.push(`Monster ${monster.id} hp: doc=${docMonster.hp}, runtime=${monster.hp}`);
    if (docMonster.shield !== monster.shield) errors.push(`Monster ${monster.id} shield: doc=${docMonster.shield}, runtime=${monster.shield}`);
    if (docMonster.armor !== monster.armorPermille) errors.push(`Monster ${monster.id} armorPermille: doc=${docMonster.armor}, runtime=${monster.armorPermille}`);
    if (docMonster.speed !== monster.speedMilliTilesPerTick) errors.push(`Monster ${monster.id} speed: doc=${docMonster.speed}, runtime=${monster.speedMilliTilesPerTick}`);
    if (docMonster.leak !== monster.leakDamage) errors.push(`Monster ${monster.id} leakDamage: doc=${docMonster.leak}, runtime=${monster.leakDamage}`);
    if (docMonster.gap !== monster.spawnGapTicks) errors.push(`Monster ${monster.id} spawnGapTicks: doc=${docMonster.gap}, runtime=${monster.spawnGapTicks}`);
    if (docMonster.unlock !== monster.availableAtRunningTick) errors.push(`Monster ${monster.id} availableAtRunningTick: doc=${docMonster.unlock}, runtime=${monster.availableAtRunningTick}`);
  }
  return errors;
}

function main() {
  console.log('Checking balance document consistency...\n');
  const docPath = resolve(rootDir, 'docs/03_BALANCE_BASELINE.md');
  const doc = parseBalanceDoc(docPath);
  
  const errors = [
    ...compareGlobal(doc, GLOBAL_CONFIG),
    ...compareTowers(doc, TOWER_DEFINITIONS),
    ...compareMonsters(doc, MONSTER_DEFINITIONS),
  ];

  if (errors.length === 0) {
    console.log('\n✓ Balance document is consistent with game-data');
    process.exit(0);
  } else {
    console.log(`\n✗ Found ${errors.length} inconsistency(ies):\n`);
    for (const error of errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }
}

main();
