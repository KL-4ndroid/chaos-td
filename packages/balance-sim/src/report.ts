import type { BalanceSimulationResult } from './types.js';

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
  readonly finalTickMinimum: number;
  readonly finalTickMaximum: number;
}

export function summarizeBalanceRuns(
  mode: 'smoke' | 'full',
  seedCount: number,
  scenarioCount: number,
  runs: readonly BalanceReportRun[],
): BalanceReportSummary {
  const outcomeCounts: Record<string, number> = {};
  const finalTicks = runs.map((run) => run.result.match.finalTick);
  for (const run of runs) {
    const outcome = run.result.match.winnerId ?? 'draw';
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
  }
  return {
    schemaVersion: 1,
    mode,
    seedCount,
    scenarioCount,
    matchCount: runs.length,
    outcomeCounts,
    finalTickMinimum: Math.min(...finalTicks),
    finalTickMaximum: Math.max(...finalTicks),
  };
}

export function renderBalanceReport(summary: BalanceReportSummary, deterministicScenarios: readonly string[]): string {
  return `# Balance Simulation Report\n\n## Measured Facts\n\n- Mode: ${summary.mode}\n- Seeds: ${summary.seedCount}\n- Scenarios: ${summary.scenarioCount}\n- Matches: ${summary.matchCount}\n- Final tick range: ${summary.finalTickMinimum}-${summary.finalTickMaximum}\n- Outcomes: ${Object.entries(summary.outcomeCounts).map(([key, value]) => `${key}=${value}`).join(', ') || 'none'}\n- Every reported source is explicit: system wave monsters use \`wave\`; queued opponent sends use \`player\`.\n\n## Derived Metrics\n\n- Determinism checks: ${deterministicScenarios.join(', ')}.\n- Machine-readable output includes sampled HP, Gold, Income, command acceptance, per-level tower combat, monster source attribution, and per-battlefield wave telemetry.\n- System-wave equality, non-negative gold, final state hashes, command logs, event logs, and summaries are technical invariants.\n\n## Balance Warnings\n\n- A smoke run ends at its configured tick guard; its outcome distribution is not a full-match balance conclusion.\n- Results measure controller behavior, not an automatic balance decision.\n- Tower and monster effectiveness should be reviewed across full scenarios before modifying data.\n\n## Human Decisions Required\n\n- Define acceptance thresholds for outcome distribution and slot fairness after representative profile runs.\n- Review full-length Wave 1-30 telemetry before changing tower, monster, economy, resistance, or wave values.\n`;
}
