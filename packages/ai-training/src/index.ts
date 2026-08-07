export {
  AI_TRAINING_SMOKE_CONFIG,
  createSelfPlayLanes,
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
  MUTABLE_FIELDS,
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
  createInitialPopulation,
  getInitialPopulationArchetypes,
  AI_TRAINING_CONTENT_VERSION,
  type EvolutionArchetype,
  type InitialPopulationConfig,
} from './population.js';
export {
  createGenerationSchedule,
  participantPolicySeed,
  type EvolutionMatch,
  type GenerationScheduleConfig,
} from './schedule.js';
export {
  checkPoolCompatibility,
  checkStrategyCompatibility,
  type CompatibilityCheck,
  type CompatibilityResult,
  type PoolCompatibilityReport,
} from './compat.js';
export {
  collectLeagueTelemetry,
  runSelfPlayWithTelemetry,
  serializeTelemetryRecord,
  type LeagueTelemetryRecord,
  type SelfPlayTelemetryObserver,
  TELEMETRY_CORRECTNESS_FLAGS,
} from './telemetry.js';
export {
  evaluateGenome,
  populationBehaviorDiversity,
  updateEloFromGenomes,
  type EvaluatedGenome,
  type GenomeAggregateInput,
  type MatchRecord,
} from './evaluator.js';
export {
  runEvolutionTraining,
  continueEvolution,
  type TrainerConfig,
  type GenerationRecord,
  type TrainingRunReport,
  type TrainingProgressObserver,
} from './trainer.js';
export { createHumanBenchmarkGenome } from './human-benchmark.js';
export {
  validateTrainingRunReport,
  validateTrainingSnapshot,
  hashTrainingRunReport,
  createTrainingSnapshot,
  type TrainingSnapshot,
  type ValidationIssue,
} from './validation.js';
export {
  buildCheckpoint,
  parseTrainingReport,
  readCheckpoint,
  resumeTraining,
  serializeTrainingReport,
  verifyCheckpoint,
  writeCheckpoint,
  type CheckpointPaths,
  type CheckpointWrite,
} from './checkpoint.js';
export {
  aggregateTelemetryForRun,
  renderHallOfFameJson,
  renderTrainingSummaryMarkdown,
  summarizeGeneration,
  summarizeHallOfFame,
  summarizeTrainingRun,
  type HallOfFameSummaryEntry,
  type ReportSummary,
  type TelemetryAggregate,
} from './report.js';
