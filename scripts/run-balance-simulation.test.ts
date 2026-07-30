import { mkdir, rm, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BALANCE_SCENARIOS,
  BALANCE_SEEDS,
  renderBalanceReport,
  runBalanceSimulation,
  summarizeBalanceRuns,
} from '../packages/balance-sim/src/index.js';

const mode = process.env['BALANCE_MODE'] === 'full' ? 'full' : 'smoke';
const seeds = mode === 'smoke' ? BALANCE_SEEDS.slice(0, 3) : BALANCE_SEEDS;
const scenarios = BALANCE_SCENARIOS;
const maxTicks = mode === 'smoke' ? 800 : 12_600;

describe(`balance ${mode} simulation`, () => {
  it('produces deterministic reports and preserves match invariants', async () => {
    const startedAt = performance.now();
    const runs = seeds.flatMap((seed) => scenarios.map((scenario) => ({
      scenario: scenario.id,
      result: runBalanceSimulation({ seed, maxTicks, samplingIntervalTicks: 100, p1Controller: scenario.p1Controller, p2Controller: scenario.p2Controller }),
    })));
    const elapsedMilliseconds = Math.round(performance.now() - startedAt);
    const totalSimulatedTicks = runs.reduce((total, run) => total + run.result.match.finalTick, 0);
    const deterministic = scenarios.map((scenario) => {
      const options = { seed: seeds[0] ?? 'balance-001', maxTicks, samplingIntervalTicks: 100, captureEventLog: true, p1Controller: scenario.p1Controller, p2Controller: scenario.p2Controller };
      const first = runBalanceSimulation(options);
      const second = runBalanceSimulation(options);
      expect(second.finalStateHash).toBe(first.finalStateHash);
      expect(second.match.commandLog).toEqual(first.match.commandLog);
      expect(second.match.eventLog).toEqual(first.match.eventLog);
      expect(second.players).toEqual(first.players);
      return scenario.id;
    });

    for (const run of runs) {
      expect(run.result.players.p1.gold).toBeGreaterThanOrEqual(0);
      expect(run.result.players.p2.gold).toBeGreaterThanOrEqual(0);
      const waveCounts = new Map<number, number[]>();
      for (const wave of run.result.waves) {
        const counts = waveCounts.get(wave.waveNumber) ?? [];
        counts.push(wave.actualSpawnCount);
        waveCounts.set(wave.waveNumber, counts);
      }
      for (const counts of waveCounts.values()) {
        if (counts.length === 2) expect(counts[0]).toBe(counts[1]);
      }
    }

    const summary = summarizeBalanceRuns(mode, seeds.length, scenarios.length, runs);
    const reportDirectory = resolve(`reports/balance/${mode}`);
    await rm(reportDirectory, { recursive: true, force: true });
    await mkdir(reportDirectory, { recursive: true });
    await writeFile(resolve(reportDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(resolve(reportDirectory, 'performance.json'), `${JSON.stringify({ elapsedMilliseconds, totalSimulatedTicks, averageSimulatedTicksPerSecond: elapsedMilliseconds === 0 ? null : Math.floor(totalSimulatedTicks * 1000 / elapsedMilliseconds), approximatePeakMemory: 'unavailable' }, null, 2)}\n`);
    await writeFile(resolve(reportDirectory, 'matches.jsonl'), `${runs.map((run) => JSON.stringify({ scenario: run.scenario, match: run.result.match, players: run.result.players, finalStateHash: run.result.finalStateHash })).join('\n')}\n`);
    const csv = (header: string, rows: readonly string[]) => `${header}\n${rows.join('\n')}\n`;
    await writeFile(resolve(reportDirectory, 'waves.csv'), csv('scenario,battlefieldId,waveNumber,actualSpawnCount,spawningStartTick,spawningEndTick,deaths,leaks,peakConcurrentMonsterCount,peakPlayerSentOverlap,peakTotalBattlefieldPressure', runs.flatMap((run) => run.result.waves.map((wave) => [run.scenario, wave.battlefieldId, wave.waveNumber, wave.actualSpawnCount, wave.spawningStartTick ?? '', wave.spawningEndTick ?? '', wave.deaths, wave.leaks, wave.peakConcurrentMonsterCount, wave.peakPlayerSentOverlap, wave.peakTotalBattlefieldPressure].join(',')))));
    await writeFile(resolve(reportDirectory, 'towers.csv'), csv('scenario,towerId,level,buildCount,upgradeCount,attackCount,hpDamage,killCount,slowApplications', runs.flatMap((run) => run.result.towers.map((tower) => [run.scenario, tower.towerId, tower.level, tower.buildCount, tower.upgradeCount, tower.attackCount, tower.hpDamage, tower.killCount, tower.slowApplications].join(',')))));
    await writeFile(resolve(reportDirectory, 'monsters.csv'), csv('scenario,monsterId,source,spawnCount,deathCount,leakCount,damageTaken,leakDamage', runs.flatMap((run) => run.result.monsters.map((monster) => [run.scenario, monster.monsterId, monster.source, monster.spawnCount, monster.deathCount, monster.leakCount, monster.damageTaken, monster.leakDamage].join(',')))));
    await writeFile(resolve(`docs/generated/BALANCE_SIMULATION_REPORT_${mode.toUpperCase()}.md`), renderBalanceReport(summary, deterministic));
    expect(summary.matchCount).toBe(seeds.length * scenarios.length);
  }, mode === 'full' ? 7_200_000 : 120_000);
});
