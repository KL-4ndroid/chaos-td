import {
  calculatePathLength,
  createPathSegments,
  createSimulation,
  calculateLaneThreat,
  createAIStates,
  processAIDecision,
  updateAIState,
  type DomainEvent,
  type GameCommand,
  type LaneRuntimeState,
  type PlayerSlot,
  type MatchEndedEvent,
} from '@chaos-td/game-core';
import {
  CONFIG_VERSION,
  GLOBAL_CONFIG,
  MONSTER_BY_ID,
  MVP_MIRROR_01,
  TOWER_BY_ID,
  type TowerId,
} from '@chaos-td/game-data';
import { decideBalanceStrategyCommand } from './strategy-adapter.js';
import type {
  BalanceSimulationOptions,
  BalanceSimulationResult,
  BalanceTimeSample,
  MonsterBalanceSummary,
  PlayerBalanceSummary,
  TowerBalanceSummary,
  WaveBalanceSummary,
} from './types.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutablePlayerSummary = Mutable<PlayerBalanceSummary> & { rejectionReasons: Record<string, number> };
type MutableTowerSummary = Mutable<TowerBalanceSummary>;
type MutableMonsterSummary = Mutable<MonsterBalanceSummary>;
type MutableWaveSummary = Mutable<WaveBalanceSummary>;

function createLanes(): Record<'lane_p1' | 'lane_p2', LaneRuntimeState> {
  const createLane = (laneId: 'lane_p1' | 'lane_p2'): LaneRuntimeState => {
    const definition = MVP_MIRROR_01.lanes.find((candidate) => candidate.id === laneId);
    if (!definition) throw new Error(`Missing lane definition: ${laneId}`);
    const waypoints = definition.waypoints;
    return {
      laneId,
      battlefieldId: laneId,
      defenderId: definition.defenderPlayerId,
      attackerId: definition.attackerPlayerId,
      waypoints,
      spawnPosition: definition.spawnPosition,
      endPosition: definition.endPosition,
      segments: createPathSegments(waypoints),
      totalPathLength: calculatePathLength(waypoints),
      spawnQueue: [],
      monsters: [],
      pendingLeaks: [],
      spawnCooldownTicks: 0,
    };
  };
  return { lane_p1: createLane('lane_p1'), lane_p2: createLane('lane_p2') };
}

function emptyPlayerSummary(): MutablePlayerSummary {
  return {
    startingHp: GLOBAL_CONFIG.startingHp,
    startingGold: GLOBAL_CONFIG.startingGold,
    startingIncome: GLOBAL_CONFIG.startingIncome,
    hp: GLOBAL_CONFIG.startingHp,
    gold: GLOBAL_CONFIG.startingGold,
    income: GLOBAL_CONFIG.startingIncome,
    netWorth: GLOBAL_CONFIG.startingGold,
    totalIncomePaid: 0,
    towerSpend: 0,
    monsterSendSpend: 0,
    sellRefund: 0,
    commandsAccepted: 0,
    commandsRejected: 0,
    rejectionReasons: {},
    waveLeakDamage: 0,
    opponentSendLeakDamage: 0,
  };
}

function towerKey(towerId: string, level: number): string {
  return `${towerId}:L${level}`;
}

function monsterKey(monsterId: string, source: 'player' | 'wave'): string {
  return `${monsterId}:${source}`;
}

function waveKey(battlefieldId: 'lane_p1' | 'lane_p2', waveNumber: number): string {
  return `${battlefieldId}:${waveNumber}`;
}

export function runBalanceSimulation(options: BalanceSimulationOptions): BalanceSimulationResult {
  const simulation = createSimulation({ seed: options.seed, configVersion: CONFIG_VERSION }, createLanes());
  const players: Record<PlayerSlot, MutablePlayerSummary> = { p1: emptyPlayerSummary(), p2: emptyPlayerSummary() };
  const towers = new Map<string, MutableTowerSummary>();
  const monsters = new Map<string, MutableMonsterSummary>();
  const waves = new Map<string, MutableWaveSummary>();
  const entities = new Map<number, { monsterId: string; source: 'player' | 'wave'; battlefieldId: 'lane_p1' | 'lane_p2'; waveNumber?: number; movement: 'ground' | 'flying'; tags: readonly string[] }>();
  const towerEntities = new Map<number, { towerId: string; level: number }>();
  const samples: BalanceTimeSample[] = [];
  const commandLog: string[] = [];
  const eventLog: string[] = [];
  const matchEndObservation: { value: MatchEndedEvent | null } = { value: null };
  let aiStates = createAIStates(options.seed);
  const waveActiveCounts = new Map<string, number>();
  const playerSentActiveCounts: Record<PlayerSlot, number> = { p1: 0, p2: 0 };
  const maximumTicks = options.maxTicks ?? GLOBAL_CONFIG.maxRunningTicks + GLOBAL_CONFIG.countdownTicks + GLOBAL_CONFIG.maxResolvingTicks;

  function getTower(towerId: string, level: number): MutableTowerSummary {
    const key = towerKey(towerId, level);
    let value = towers.get(key);
    if (!value) {
      value = { towerId, level, buildCount: 0, upgradeCount: 0, sellCount: 0, attackCount: 0, rawDamage: 0, bonusDamage: 0, resistanceReduction: 0, armorReduction: 0, shieldDamage: 0, hpDamage: 0, killCount: 0, groundTargetCount: 0, flyingTargetCount: 0, bossDamage: 0, splashSecondaryDamage: 0, slowApplications: 0 };
      towers.set(key, value);
    }
    return value;
  }

  function getMonster(monsterId: string, source: 'player' | 'wave'): MutableMonsterSummary {
    const key = monsterKey(monsterId, source);
    let value = monsters.get(key);
    if (!value) {
      value = { monsterId, source, spawnCount: 0, deathCount: 0, leakCount: 0, damageTaken: 0, shieldDamageTaken: 0, leakDamage: 0 };
      monsters.set(key, value);
    }
    return value;
  }

  function consume(event: DomainEvent): void {
    if (options.captureEventLog) eventLog.push(JSON.stringify(event));
    switch (event.type) {
      case 'match_ended': matchEndObservation.value = event; break;
      case 'command_accepted': players[event.playerId].commandsAccepted += 1; break;
      case 'command_rejected': {
        const summary = players[event.playerId];
        summary.commandsRejected += 1;
        summary.rejectionReasons[event.reason] = (summary.rejectionReasons[event.reason] ?? 0) + 1;
        break;
      }
      case 'income_paid': players[event.playerId].totalIncomePaid += event.amount; break;
      case 'tower_built': {
        const definition = TOWER_BY_ID.get(event.towerType);
        const firstLevel = definition?.levels[0];
        if (definition && firstLevel) {
          players[event.playerId].towerSpend += firstLevel.cost;
          getTower(event.towerType, 1).buildCount += 1;
          towerEntities.set(event.towerEntityId, { towerId: event.towerType, level: 1 });
        }
        break;
      }
      case 'tower_upgraded': {
        const tower = towerEntities.get(event.towerEntityId);
        if (tower) {
          const definition = TOWER_BY_ID.get(tower.towerId);
          const nextLevel = definition?.levels[event.newLevel - 1];
          if (nextLevel) players[event.playerId].towerSpend += nextLevel.cost;
          tower.level = event.newLevel;
          getTower(tower.towerId, event.newLevel).upgradeCount += 1;
        }
        break;
      }
      case 'tower_sold': players[event.playerId].sellRefund += event.refund; break;
      case 'monster_queued': {
        const definition = MONSTER_BY_ID.get(event.monsterType);
        if (definition) players[event.playerId].monsterSendSpend += definition.sendCost * event.quantity;
        break;
      }
      case 'monster_spawned': {
        const definition = MONSTER_BY_ID.get(event.monsterType);
        if (definition && event.source.type === 'player') {
          const battlefieldId = event.source.playerId === 'p1' ? 'lane_p2' : 'lane_p1';
          entities.set(event.monsterEntityId, { monsterId: event.monsterType, source: 'player', battlefieldId, movement: definition.movementType, tags: definition.tags });
          getMonster(event.monsterType, 'player').spawnCount += 1;
          const defenderId = battlefieldId === 'lane_p1' ? 'p1' : 'p2';
          playerSentActiveCounts[defenderId] += 1;
          for (const wave of waves.values()) {
            if (wave.battlefieldId !== battlefieldId) continue;
            const activeWaveCount = waveActiveCounts.get(waveKey(wave.battlefieldId, wave.waveNumber)) ?? 0;
            wave.peakPlayerSentOverlap = Math.max(wave.peakPlayerSentOverlap, playerSentActiveCounts[defenderId]);
            wave.peakTotalBattlefieldPressure = Math.max(wave.peakTotalBattlefieldPressure, activeWaveCount + playerSentActiveCounts[defenderId]);
          }
        }
        break;
      }
      case 'wave_monster_spawned': {
        const entity = simulation.state.lanes[event.battlefieldId].monsters.find((monster) => monster.entityId === event.monsterEntityId);
        if (entity) {
          entities.set(event.monsterEntityId, { monsterId: event.monsterType, source: 'wave', battlefieldId: event.battlefieldId, waveNumber: event.waveNumber, movement: entity.movementType, tags: entity.tags });
          getMonster(event.monsterType, 'wave').spawnCount += 1;
        }
        const key = waveKey(event.battlefieldId, event.waveNumber);
        const wave = waves.get(key) ?? { battlefieldId: event.battlefieldId, waveNumber: event.waveNumber, actualSpawnCount: 0, spawningStartTick: event.tick, spawningEndTick: null, deaths: 0, leaks: 0, peakConcurrentMonsterCount: 0, peakPlayerSentOverlap: 0, peakTotalBattlefieldPressure: 0 };
        wave.actualSpawnCount += 1;
        const activeCount = (waveActiveCounts.get(key) ?? 0) + 1;
        waveActiveCounts.set(key, activeCount);
        wave.peakConcurrentMonsterCount = Math.max(wave.peakConcurrentMonsterCount, activeCount);
        const defenderId = event.battlefieldId === 'lane_p1' ? 'p1' : 'p2';
        const playerSentCount = playerSentActiveCounts[defenderId];
        wave.peakPlayerSentOverlap = Math.max(wave.peakPlayerSentOverlap, playerSentCount);
        wave.peakTotalBattlefieldPressure = Math.max(wave.peakTotalBattlefieldPressure, activeCount + playerSentCount);
        waves.set(key, wave);
        break;
      }
      case 'wave_ended': {
        const wave = waves.get(waveKey(event.battlefieldId, event.waveNumber));
        if (wave) wave.spawningEndTick = event.tick;
        break;
      }
      case 'damage_resolved': {
        const tower = towerEntities.get(event.towerEntityId);
        const entity = entities.get(event.monsterEntityId);
        if (tower) {
          const summary = getTower(tower.towerId, tower.level);
          summary.attackCount += event.isSplash ? 0 : 1;
          summary.rawDamage += event.rawDamage;
          summary.bonusDamage += event.bonusDamage;
          summary.resistanceReduction += event.resistanceReduction;
          summary.armorReduction += event.armorReduction;
          summary.shieldDamage += event.shieldDamage;
          summary.hpDamage += event.hpDamage;
          if (event.isSplash) summary.splashSecondaryDamage += event.hpDamage;
          if (entity?.movement === 'ground') summary.groundTargetCount += 1;
          if (entity?.movement === 'flying') summary.flyingTargetCount += 1;
          if (entity?.tags.includes('boss')) summary.bossDamage += event.hpDamage;
        }
        if (entity) {
          const summary = getMonster(entity.monsterId, entity.source);
          summary.damageTaken += event.hpDamage;
          summary.shieldDamageTaken += event.shieldDamage;
        }
        break;
      }
      case 'slow_applied': {
        const tower = event.towerEntityId === undefined ? undefined : towerEntities.get(event.towerEntityId);
        if (tower) getTower(tower.towerId, tower.level).slowApplications += 1;
        break;
      }
      case 'monster_died': {
        const entity = entities.get(event.monsterEntityId);
        if (entity) {
          getMonster(entity.monsterId, entity.source).deathCount += 1;
          if (entity.source === 'wave' && entity.waveNumber !== undefined) {
            const key = waveKey(entity.battlefieldId, entity.waveNumber);
            const wave = waves.get(key);
            if (wave) wave.deaths += 1;
            waveActiveCounts.set(key, Math.max(0, (waveActiveCounts.get(key) ?? 0) - 1));
          } else {
            const defenderId = entity.battlefieldId === 'lane_p1' ? 'p1' : 'p2';
            playerSentActiveCounts[defenderId] = Math.max(0, playerSentActiveCounts[defenderId] - 1);
          }
          const killer = event.killerTowerEntityId === undefined ? undefined : towerEntities.get(event.killerTowerEntityId);
          if (killer) getTower(killer.towerId, killer.level).killCount += 1;
        }
        break;
      }
      case 'monster_leaked': {
        const entity = entities.get(event.monsterEntityId);
        if (entity) {
          const summary = getMonster(entity.monsterId, entity.source);
          summary.leakCount += 1;
          summary.leakDamage += event.leakDamage;
          if (entity.source === 'wave' && entity.waveNumber !== undefined) {
            const key = waveKey(entity.battlefieldId, entity.waveNumber);
            const wave = waves.get(key);
            if (wave) wave.leaks += 1;
            waveActiveCounts.set(key, Math.max(0, (waveActiveCounts.get(key) ?? 0) - 1));
          } else {
            const defenderId = entity.battlefieldId === 'lane_p1' ? 'p1' : 'p2';
            playerSentActiveCounts[defenderId] = Math.max(0, playerSentActiveCounts[defenderId] - 1);
          }
          if (entity.source === 'wave') players[event.defenderId].waveLeakDamage += event.leakDamage;
          else players[event.defenderId].opponentSendLeakDamage += event.leakDamage;
        }
        break;
      }
    }
  }

  simulation.start();
  while (simulation.state.phase !== 'result' && simulation.state.tick < maximumTicks) {
    for (const [playerId, profile] of [['p1', options.p1Controller], ['p2', options.p2Controller]] as const) {
      if (profile.kind === 'none' || simulation.state.phase !== 'running') continue;
      if (profile.kind === 'strategy_ai') {
        const command = decideBalanceStrategyCommand(simulation.state, playerId, profile.genome);
        if (command) {
          simulation.submitCommand(command);
          commandLog.push(JSON.stringify(command));
        }
        continue;
      }
      const battlefieldId = playerId === 'p1' ? 'lane_p1' : 'lane_p2';
      const lane = simulation.state.lanes[battlefieldId];
      const monstersAtRisk = lane.monsters.filter((monster) => monster.pathProgressMilliTiles * 4 >= lane.totalPathLength * 3).length;
      const threat = calculateLaneThreat(lane.monsters.length, monstersAtRisk, 0, lane.totalPathLength);
      const decision = processAIDecision(
        playerId,
        aiStates[playerId],
        simulation.state.tick,
        simulation.state.players[playerId].gold,
        threat,
        simulation.state.towers.filter((tower) => tower.ownerId === playerId).map((tower) => `${tower.cellX},${tower.cellY}`),
        simulation.state.lanes[playerId === 'p1' ? 'lane_p2' : 'lane_p1'].spawnQueue.length,
        GLOBAL_CONFIG.sendQueueLimit,
        MONSTER_BY_ID.get('sheep')?.sendCost ?? 0,
        ['archer', 'mage', 'frost', 'sniper'],
        MVP_MIRROR_01.lanes.find((candidate) => candidate.defenderPlayerId === playerId)?.aiBuildPriorityCells.map((cell) => ({ cellX: cell.col, cellY: cell.row })) ?? [],
      );
      if (decision.reason !== 'not_decision_tick') {
        aiStates = { ...aiStates, [playerId]: updateAIState(aiStates[playerId], simulation.state.tick) };
      }
      const params = decision.params;
      let command: GameCommand | null = null;
      if (decision.action === 'build_tower' && params?.towerType && params.cellX !== undefined && params.cellY !== undefined && TOWER_BY_ID.has(params.towerType)) {
        command = { type: 'build_tower', commandId: simulation.getNextCommandId(playerId), playerId, towerTypeId: params.towerType as TowerId, cellX: params.cellX, cellY: params.cellY };
      } else if (decision.action === 'queue_monster' && params?.monsterType && params.quantity !== undefined && MONSTER_BY_ID.has(params.monsterType)) {
        command = { type: 'queue_monster', commandId: simulation.getNextCommandId(playerId), playerId, monsterTypeId: params.monsterType, quantity: params.quantity };
      }
      if (command) {
        simulation.submitCommand(command);
        commandLog.push(JSON.stringify(command));
      }
    }
    const step = simulation.step();
    for (const event of step.events) consume(event);
    if (step.state.tick % options.samplingIntervalTicks === 0 || step.state.phase === 'result') {
      const snapshot = (playerId: PlayerSlot) => {
        const player = step.state.players[playerId];
        const invested = step.state.towers.filter((tower) => tower.ownerId === playerId).reduce((total, tower) => total + tower.totalInvested, 0);
        return { hp: player.hp, gold: player.gold, income: player.income, netWorth: player.gold + Math.floor(invested * GLOBAL_CONFIG.sellRefundPermille / 1000) };
      };
      samples.push({ tick: step.state.tick, wave: step.state.waveScheduler.currentWaveNumber, p1: snapshot('p1'), p2: snapshot('p2') });
    }
  }

  for (const playerId of ['p1', 'p2'] as const) {
    const final = simulation.state.players[playerId];
    const invested = simulation.state.towers.filter((tower) => tower.ownerId === playerId).reduce((total, tower) => total + tower.totalInvested, 0);
    players[playerId].hp = final.hp;
    players[playerId].gold = final.gold;
    players[playerId].income = final.income;
    players[playerId].netWorth = final.gold + Math.floor(invested * GLOBAL_CONFIG.sellRefundPermille / 1000);
  }

  const result = matchEndObservation.value;
  return {
    match: {
      seed: options.seed,
      configVersion: CONFIG_VERSION,
      finalTick: simulation.state.tick,
      finalWave: simulation.state.waveScheduler.currentWaveNumber,
      completion: result ? 'result' : 'tick_guard',
      winnerId: result?.winnerId ?? null,
      outcome: result?.outcome ?? 'draw',
      reason: result?.reason ?? 'tick_guard',
      commandLog,
      eventLog,
    },
    players,
    towers: [...towers.values()].sort((left, right) => towerKey(left.towerId, left.level).localeCompare(towerKey(right.towerId, right.level))),
    monsters: [...monsters.values()].sort((left, right) => monsterKey(left.monsterId, left.source).localeCompare(monsterKey(right.monsterId, right.source))),
    waves: [...waves.values()].sort((left, right) => waveKey(left.battlefieldId, left.waveNumber).localeCompare(waveKey(right.battlefieldId, right.waveNumber))),
    samples,
    finalStateHash: simulation.state.stateHash,
  };
}
