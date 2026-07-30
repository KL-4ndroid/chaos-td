export {
  AI_TRAINING_SMOKE_CONFIG,
  createSmokePopulation,
  decideStrategyCommand,
  runSelfPlayMatch,
  type SelfPlayMatchSummary,
  type TrainingConfig,
} from './league.js';
export {
  calculateEvaluation,
  expectedEloScore,
  updateElo,
  type EloUpdate,
  type GenomeEvaluation,
} from './fitness.js';
export {
  classifyArchetype,
  crossoverGenomes,
  detectDuplicateStrategies,
  genomeDistance,
  mutateGenome,
} from './evolution.js';
export {
  admitHallOfFameCandidates,
  behaviorFingerprint,
  HALL_OF_FAME_SCHEMA,
  type HallOfFameCandidate,
  type HallOfFameEntry,
} from './hall-of-fame.js';
export {
  checkPoolCompatibility,
  checkStrategyCompatibility,
  type CompatibilityCheck,
  type CompatibilityResult,
  type PoolCompatibilityReport,
} from './compat.js';
