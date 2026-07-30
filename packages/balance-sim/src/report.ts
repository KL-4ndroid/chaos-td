import type {
  BalanceSimulationResult,
  MonsterBalanceSummary,
  TowerBalanceSummary,
} from './types.js';

export interface BalanceReportRun {
  readonly scenario: string;
  readonly result: BalanceSimulationResult;
}

export interface BalanceReportSummary {
  readonly schemaVersion: number;
  readonly mode: 'smoke' | 'full';
  readonly seedCount: number;
  readonly scenarioCount: number;
  readonly matchCount: number;
  readonly outcomeCounts: Readonly<Record<string, number>>;
  readonly scenarioOutcomeCounts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly finalTickMinimum: number;
  readonly finalTickMedian: number;
  readonly finalTickP90: number;
  readonly finalTickMaximum: number;
  readonly finalWaveCounts: Readonly<Record<string, number>>;
  readonly p1HpTotal: number;
  readonly p2HpTotal: number;
  readonly p1NetWorthTotal: number;
  readonly p2NetWorthTotal: number;
  readonly towerTotals: readonly TowerBalanceSummary[];
  readonly monsterTotals: readonly MonsterBalanceSummary[];
}

function median(sorted: readonly number[]): number {
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

function p90(sorted: readonly number[]): number {
  return sorted[Math.ceil(sorted.length * 0.9) - 1] ?? 0;
}

function tally(record: Record<string, number>, key: string, value = 1): void {
  record[key] = (record[key] ?? 0) + value;
}

function mergeTowers(runs: readonly BalanceReportRun[]): TowerBalanceSummary[] {
  const totals = new Map<string, TowerBalanceSummary>();
  for (const tower of runs.flatMap((run) => run.result.towers)) {
    const key = `${tower.towerId}:L${tower.level}`;
    const current = totals.get(key);
    if (!current) {
      totals.set(key, { ...tower });
      continue;
    }
    totals.set(key, {
      ...current,
      buildCount: current.buildCount + tower.buildCount,
      upgradeCount: current.upgradeCount + tower.upgradeCount,
      sellCount: current.sellCount + tower.sellCount,
      attackCount: current.attackCount + tower.attackCount,
      rawDamage: current.rawDamage + tower.rawDamage,
      bonusDamage: current.bonusDamage + tower.bonusDamage,
      resistanceReduction: current.resistanceReduction + tower.resistanceReduction,
      armorReduction: current.armorReduction + tower.armorReduction,
      shieldDamage: current.shieldDamage + tower.shieldDamage,
      hpDamage: current.hpDamage + tower.hpDamage,
      killCount: current.killCount + tower.killCount,
      groundTargetCount: current.groundTargetCount + tower.groundTargetCount,
      flyingTargetCount: current.flyingTargetCount + tower.flyingTargetCount,
      bossDamage: current.bossDamage + tower.bossDamage,
      splashSecondaryDamage: current.splashSecondaryDamage + tower.splashSecondaryDamage,
      slowApplications: current.slowApplications + tower.slowApplications,
    });
  }
  return [...totals.values()].sort((left, right) => `${left.towerId}:${left.level}`.localeCompare(`${right.towerId}:${right.level}`));
}

function mergeMonsters(runs: readonly BalanceReportRun[]): MonsterBalanceSummary[] {
  const totals = new Map<string, MonsterBalanceSummary>();
  for (const monster of runs.flatMap((run) => run.result.monsters)) {
    const key = `${monster.monsterId}:${monster.source}`;
    const current = totals.get(key);
    if (!current) {
      totals.set(key, { ...monster });
      continue;
    }
    totals.set(key, {
      ...current,
      spawnCount: current.spawnCount + monster.spawnCount,
      deathCount: current.deathCount + monster.deathCount,
      leakCount: current.leakCount + monster.leakCount,
      damageTaken: current.damageTaken + monster.damageTaken,
      shieldDamageTaken: current.shieldDamageTaken + monster.shieldDamageTaken,
      leakDamage: current.leakDamage + monster.leakDamage,
    });
  }
  return [...totals.values()].sort((left, right) => `${left.monsterId}:${left.source}`.localeCompare(`${right.monsterId}:${right.source}`));
}

export function summarizeBalanceRuns(
  mode: 'smoke' | 'full',
  seedCount: number,
  scenarioCount: number,
  runs: readonly BalanceReportRun[],
): BalanceReportSummary {
  const outcomeCounts: Record<string, number> = {};
  const scenarioOutcomeCounts: Record<string, Record<string, number>> = {};
  const finalWaveCounts: Record<string, number> = {};
  const finalTicks = runs.map((run) => run.result.match.finalTick).sort((left, right) => left - right);
  for (const run of runs) {
    const outcome = run.result.match.completion === 'tick_guard'
      ? 'tick_guard_incomplete'
      : run.result.match.winnerId ?? 'draw';
    tally(outcomeCounts, outcome);
    const scenarioCounts = scenarioOutcomeCounts[run.scenario] ?? {};
    tally(scenarioCounts, outcome);
    scenarioOutcomeCounts[run.scenario] = scenarioCounts;
    tally(finalWaveCounts, String(run.result.match.finalWave));
  }
  return {
    schemaVersion: 2,
    mode,
    seedCount,
    scenarioCount,
    matchCount: runs.length,
    outcomeCounts,
    scenarioOutcomeCounts,
    finalTickMinimum: finalTicks[0] ?? 0,
    finalTickMedian: median(finalTicks),
    finalTickP90: p90(finalTicks),
    finalTickMaximum: finalTicks.at(-1) ?? 0,
    finalWaveCounts,
    p1HpTotal: runs.reduce((total, run) => total + run.result.players.p1.hp, 0),
    p2HpTotal: runs.reduce((total, run) => total + run.result.players.p2.hp, 0),
    p1NetWorthTotal: runs.reduce((total, run) => total + run.result.players.p1.netWorth, 0),
    p2NetWorthTotal: runs.reduce((total, run) => total + run.result.players.p2.netWorth, 0),
    towerTotals: mergeTowers(runs),
    monsterTotals: mergeMonsters(runs),
  };
}

function renderOutcomes(counts: Readonly<Record<string, number>>): string {
  return `- p1 wins: ${counts['p1'] ?? 0}\n- p2 wins: ${counts['p2'] ?? 0}\n- draws: ${counts['draw'] ?? 0}\n- tick-guard incomplete: ${counts['tick_guard_incomplete'] ?? 0}`;
}

export function renderBalanceReport(summary: BalanceReportSummary, deterministicScenarios: readonly string[]): string {
  const scenarioOutcomes = Object.entries(summary.scenarioOutcomeCounts)
    .map(([scenario, counts]) => `- ${scenario}: ${Object.entries(counts).map(([outcome, count]) => `${outcome}=${count}`).join(', ')}`)
    .join('\n') || '- unavailable';
  const towers = summary.towerTotals.map((tower) => {
    const spendUnavailable = 'unavailable';
    return `- ${tower.towerId} L${tower.level}: build=${tower.buildCount}; damage=${tower.hpDamage}; damage per gold=${spendUnavailable}; kills=${tower.killCount}; bonus=${tower.bonusDamage}; resistance reduction=${tower.resistanceReduction}; shield=${tower.shieldDamage}; boss=${tower.bossDamage}; slow=${tower.slowApplications}; splash secondary=${tower.splashSecondaryDamage}`;
  }).join('\n') || '- unavailable';
  const monsters = summary.monsterTotals.map((monster) => {
    const survivalRate = monster.spawnCount === 0 ? 'unavailable' : `${Math.max(0, monster.spawnCount - monster.deathCount - monster.leakCount)}/${monster.spawnCount}`;
    return `- ${monster.monsterId} (${monster.source}): spawn=${monster.spawnCount}; death=${monster.deathCount}; leak=${monster.leakCount}; survival=${survivalRate}; leak damage=${monster.leakDamage}; resistance damage reduction=unavailable`;
  }).join('\n') || '- unavailable';
  const warnings: string[] = [];
  if ((summary.outcomeCounts['tick_guard_incomplete'] ?? 0) > 0) warnings.push(`- ${summary.outcomeCounts['tick_guard_incomplete']} match(es) reached the tick guard and are excluded from formal draw attribution.`);
  if ((summary.outcomeCounts['p1'] ?? 0) !== (summary.outcomeCounts['p2'] ?? 0)) warnings.push(`- Slot win distribution differs: p1=${summary.outcomeCounts['p1'] ?? 0}, p2=${summary.outcomeCounts['p2'] ?? 0}.`);
  if (warnings.length === 0) warnings.push('- No threshold-based warning is configured for the measured distribution.');
  return `# Balance Simulation Report\n\n## Measured Facts\n\n- Mode: ${summary.mode}\n- Seeds: ${summary.seedCount}\n- Scenarios: ${summary.scenarioCount}\n- Matches: ${summary.matchCount}\n- Determinism checks: ${deterministicScenarios.join(', ') || 'none'}\n- Previous 270-match output: invalid_for_profile_comparison (scenario labels did not represent distinct AI behavior).\n\n## Outcomes\n\n${renderOutcomes(summary.outcomeCounts)}\n\n### Per Scenario\n\n${scenarioOutcomes}\n\n## Duration\n\n- min: ${summary.finalTickMinimum}\n- median: ${summary.finalTickMedian}\n- p90: ${summary.finalTickP90}\n- max: ${summary.finalTickMaximum}\n- final wave distribution: ${Object.entries(summary.finalWaveCounts).map(([wave, count]) => `wave ${wave}=${count}`).join(', ') || 'unavailable'}\n\n## Slot Fairness\n\n- Same-controller mirror results: see the normal-ai-vs-normal-ai scenario.\n- p1/p2 HP difference: ${summary.p1HpTotal - summary.p2HpTotal}\n- p1/p2 Net Worth difference: ${summary.p1NetWorthTotal - summary.p2NetWorthTotal}\n- p1/p2 Win Difference: ${(summary.outcomeCounts['p1'] ?? 0) - (summary.outcomeCounts['p2'] ?? 0)}\n\n## Towers\n\n${towers}\n\n## Monsters\n\n${monsters}\n\n## Warnings\n\n${warnings.join('\n')}\n`;
}
