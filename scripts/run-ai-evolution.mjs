import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  aggregateTelemetryForRun,
  renderHallOfFameJson,
  renderTrainingSummaryMarkdown,
  readCheckpoint,
  resumeTraining,
  runEvolutionTraining,
  serializeTrainingReport,
  summarizeHallOfFame,
  summarizeTrainingRun,
  validateTrainingRunReport,
  writeCheckpoint,
} from '@chaos-td/ai-training';
import { CONFIG_VERSION } from '@chaos-td/game-data';

const operation = process.argv[2] ?? 'train';
const mode = process.argv[3] ?? 'smoke';
const configs = {
  smoke: { populationSize: 16, generations: 2, evaluationSeeds: ['smoke-001', 'smoke-002', 'smoke-003'], maxTicksPerMatch: 300, eliteCount: 2, hallOfFameOpponentCount: 2, mutationRatePermille: 120, crossoverRatePermille: 500 },
  local: { populationSize: 32, generations: 5, evaluationSeeds: Array.from({ length: 10 }, (_, i) => `local-${String(i + 1).padStart(3, '0')}`), maxTicksPerMatch: 800, eliteCount: 4, hallOfFameOpponentCount: 4, mutationRatePermille: 120, crossoverRatePermille: 500 },
  full: { populationSize: 128, generations: 50, evaluationSeeds: Array.from({ length: 30 }, (_, i) => `full-${String(i + 1).padStart(3, '0')}`), maxTicksPerMatch: 12000, eliteCount: 8, hallOfFameOpponentCount: 8, mutationRatePermille: 120, crossoverRatePermille: 500 },
};
const base = configs[mode] ?? configs.smoke;
const generationsOverride = Number.parseInt(process.env.AI_TRAINING_GENERATIONS ?? '', 10);
const runId = process.env.AI_TRAINING_RUN_ID ?? `p1-6-011-${mode}`;
const config = {
  ...base,
  ...(Number.isFinite(generationsOverride) && generationsOverride >= base.generations ? { generations: generationsOverride } : {}),
  matchesPerGenome: 1,
  trainingSeed: process.env.AI_TRAINING_SEED ?? `ai-training-${mode}`,
  contentVersion: CONFIG_VERSION,
  canonicalTag: 'evolution-v1',
};
const root = resolve(process.cwd(), 'reports', 'ai', 'runs', runId);
const checkpointRoot = resolve(process.cwd(), 'data', 'ai', 'training', 'checkpoints', runId);
const reportFile = resolve(checkpointRoot, 'training-report.json');
const snapshotFile = resolve(checkpointRoot, 'checkpoint.json');
if (operation === 'evaluate') {
  if (!existsSync(reportFile)) throw new Error(`Missing training report: ${reportFile}`);
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const issues = validateTrainingRunReport(report);
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, 'validation-summary.json'), JSON.stringify({ valid: issues.length === 0, issues }, null, 2));
  console.log(JSON.stringify({ runId, operation, valid: issues.length === 0, issues }, null, 2));
  process.exit(issues.length === 0 ? 0 : 1);
}
const report = operation === 'resume'
  ? resumeTraining(config, readCheckpoint({ reportFile, snapshotFile }))
  : runEvolutionTraining(config);
const issues = validateTrainingRunReport(report);
if (issues.length > 0) throw new Error(`Training validation failed: ${JSON.stringify(issues)}`);
mkdirSync(root, { recursive: true });
mkdirSync(checkpointRoot, { recursive: true });
const summary = summarizeTrainingRun(report);
const telemetry = aggregateTelemetryForRun(report);
// Replays are emitted as individual viewer files below. Keeping them inside
// every historical checkpoint makes long-running evolution hit V8's JSON size
// limit, while the trainer itself only needs records and telemetry to resume.
const checkpointReport = {
  ...report,
  generations: report.generations.map((generation) => ({
    ...generation,
    matchRecords: generation.matchRecords.map(({ replay: _replay, ...match }) => match),
  })),
};
writeFileSync(resolve(root, 'training-config.json'), JSON.stringify(config, null, 2));
writeFileSync(resolve(root, 'generation-summary.jsonl'), report.generations.map((g) => JSON.stringify({ generation: g.generation, matches: g.matchRecords.length, evaluations: g.evaluated })).join('\n') + '\n');
writeFileSync(resolve(root, 'match-summary.jsonl'), report.generations.flatMap((g) => g.matchRecords).map((m) => JSON.stringify(m.summary)).join('\n') + '\n');
for (const generation of report.generations) {
  const representative = generation.matchRecords.find((match) => !match.mirrored && match.replay);
  if (representative?.replay) writeFileSync(resolve(root, `replay-generation-${generation.generation}.json`), JSON.stringify(representative.replay));
}
writeFileSync(resolve(root, 'final-rankings.csv'), 'strategyId,generation,fitnessScore,pressureScore,benchmarkScore,benchmarkWins,benchmarkLosses,benchmarkDraws,benchmarkNetLeakDamage,championWins,championLosses,elo,winRate,slotAdjustedScore,invalidCommandRate\n' + report.generations.at(-1).evaluated.slice().sort((a, b) => b.evaluation.totalScore - a.evaluation.totalScore || b.evaluation.benchmarkScore - a.evaluation.benchmarkScore || a.strategyId.localeCompare(b.strategyId)).map((e) => `${e.strategyId},${e.generation},${e.evaluation.totalScore},${e.evaluation.pressureScore},${e.evaluation.benchmarkScore},${e.benchmark.wins},${e.benchmark.losses},${e.benchmark.draws},${e.benchmark.netLeakDamage},${e.champion.wins},${e.champion.losses},${e.evaluation.elo},${e.evaluation.winRate},${e.evaluation.slotAdjustedScore},${e.evaluation.invalidCommandRate}`).join('\n') + '\n');
writeFileSync(resolve(root, 'hall-of-fame.json'), renderHallOfFameJson(summarizeHallOfFame(report)));
writeFileSync(resolve(root, 'diversity-report.csv'), 'generation,behaviorDiversity\n' + report.generations.map((g) => `${g.generation},${g.evaluated[0]?.evaluation.diversityScore ?? 0}`).join('\n') + '\n');
writeFileSync(resolve(root, 'validation-summary.json'), JSON.stringify({ valid: issues.length === 0, issues }, null, 2));
writeFileSync(resolve(root, 'training-summary.json'), JSON.stringify({ ...summary, telemetry }, null, 2));
writeCheckpoint({ reportFile: resolve(checkpointRoot, 'training-report.json'), snapshotFile: resolve(checkpointRoot, 'checkpoint.json') }, checkpointReport);
writeFileSync(resolve(process.cwd(), 'docs', 'generated', 'AI_EVOLUTION_TRAINING_REPORT.md'), renderTrainingSummaryMarkdown(summary));
writeFileSync(resolve(root, 'training-report.json'), serializeTrainingReport(checkpointReport));
console.log(JSON.stringify({ runId, mode, generations: report.generations.length, matches: report.matchCount, hash: report.finalCanonicalHash, hallOfFame: report.hallOfFame.length }, null, 2));
