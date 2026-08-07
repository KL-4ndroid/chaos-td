import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  assertValidAIStrategyGenome,
  createDefaultAIStrategyGenome,
} from '@chaos-td/ai-strategy';
import {
  createHumanBenchmarkGenome,
  genomeDistance,
  mutateGenome,
  runSelfPlayWithTelemetry,
} from '@chaos-td/ai-training';

const root = process.cwd();
const guidanceRoot = resolve(root, 'data', 'ai', 'training', 'human-guidance');
const profilePath = resolve(guidanceRoot, 'latest-profile.json');
const championPath = resolve(root, 'data', 'ai', 'training', 'latest-champion.json');
const statusPath = resolve(guidanceRoot, 'fast-training-status.json');
mkdirSync(guidanceRoot, { recursive: true });

const writeStatus = (status) => writeFileSync(statusPath, JSON.stringify({ updatedAt: new Date().toISOString(), ...status }, null, 2));
const profile = existsSync(profilePath) ? JSON.parse(readFileSync(profilePath, 'utf8')) : null;
const fallbackReport = (() => {
  const checkpointRoot = resolve(root, 'data', 'ai', 'training', 'checkpoints');
  if (!existsSync(checkpointRoot)) return null;
  const latest = readdirSync(checkpointRoot)
    .map((name) => resolve(checkpointRoot, name, 'training-report.json'))
    .filter((path) => existsSync(path))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
  if (!latest) return null;
  const report = JSON.parse(readFileSync(latest, 'utf8'));
  return [...(report.hallOfFame ?? [])].sort((left, right) => right.eloAtAdmission - left.eloAtAdmission)[0]?.strategy ?? null;
})();
const storedChampion = existsSync(championPath) ? JSON.parse(readFileSync(championPath, 'utf8')).genome : fallbackReport;
const champion = assertValidAIStrategyGenome(storedChampion ?? createDefaultAIStrategyGenome('guided-champion-v1', CONFIG_VERSION), CONFIG_VERSION);
const human = createHumanBenchmarkGenome('human-v1', CONFIG_VERSION, profile?.genomeOverrides ?? {});
const counterHuman = assertValidAIStrategyGenome({
  ...champion,
  strategyId: `guided-counter-human-${champion.strategyVersion + 1}`,
  strategyVersion: champion.strategyVersion + 1,
  aggressionWeight: Math.max(champion.aggressionWeight, 820),
  sendInvestmentRatio: Math.max(champion.sendInvestmentRatio, 780),
  pressureTimingWeight: Math.max(champion.pressureTimingWeight, 760),
  counterOpponentWeight: Math.max(champion.counterOpponentWeight, 820),
  goldRetentionRatio: Math.min(champion.goldRetentionRatio, 220),
  defenseBaselineThreshold: Math.min(champion.defenseBaselineThreshold, 380),
}, CONFIG_VERSION);
const candidates = [champion, counterHuman, ...Array.from({ length: 6 }, (_, index) => mutateGenome(
  { ...champion, strategyId: `guided-candidate-${String(index + 1).padStart(2, '0')}`, strategyVersion: champion.strategyVersion + 1 },
  `human-guided:${profile?.recordedAt ?? 'default'}:${index}`,
  260,
  110,
))];

writeStatus({ status: 'running', completed: 0, total: candidates.length, humanSamples: profile?.samples ?? 0 });
const scored = [];
for (const [index, candidate] of candidates.entries()) {
  const match = {
    generation: 0,
    pairId: `human-guided-${index}`,
    seed: `human-guided:${profile?.recordedAt ?? 'default'}:${index}`,
    participantAId: candidate.strategyId,
    participantBId: human.strategyId,
    p1StrategyId: candidate.strategyId,
    p2StrategyId: human.strategyId,
    mirrored: false,
  };
  const { summary, telemetry } = runSelfPlayWithTelemetry(match, candidate, human, 30000);
  const win = summary.winnerId === 'p1' ? 1 : 0;
  const hpMargin = telemetry.p1FinalHp - telemetry.p2FinalHp;
  const pressure = telemetry.leakDamageByDefender.p2 - telemetry.leakDamageByDefender.p1;
  const speed = Math.max(0, 30_000 - summary.finalTick);
  scored.push({ candidate, summary, score: win * 1_000_000 + hpMargin * 100 + pressure * 10 + speed, distance: genomeDistance(candidate, champion) });
  writeStatus({ status: 'running', completed: index + 1, total: candidates.length, humanSamples: profile?.samples ?? 0, candidates: scored.map((entry) => ({ strategyId: entry.candidate.strategyId, winnerId: entry.summary.winnerId, finalTick: entry.summary.finalTick, score: entry.score, distance: entry.distance })) });
}
const best = [...scored].sort((left, right) => right.score - left.score || right.distance - left.distance || left.candidate.strategyId.localeCompare(right.candidate.strategyId))[0];
if (!best) throw new Error('Fast training produced no candidate');
// Never replace a champion with a candidate that did not formally defeat the human profile.
const selected = best.summary.winnerId === 'p1' ? best.candidate : champion;
writeFileSync(championPath, JSON.stringify({
  schemaVersion: 1,
  source: 'human_guided_fast_training',
  trainedAt: new Date().toISOString(),
  humanSamples: profile?.samples ?? 0,
  genome: selected,
  selectedScore: best.score,
  selectionReason: `formal win, score ${best.score}, genome distance ${best.distance}`,
}, null, 2));
writeStatus({ status: 'completed', completed: candidates.length, total: candidates.length, championStrategyId: selected.strategyId, humanSamples: profile?.samples ?? 0, candidates: scored.map((entry) => ({ strategyId: entry.candidate.strategyId, winnerId: entry.summary.winnerId, finalTick: entry.summary.finalTick, score: entry.score, distance: entry.distance })) });
console.log(JSON.stringify({ status: 'completed', championStrategyId: selected.strategyId }));
