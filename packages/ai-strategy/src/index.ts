// Strategy schema and validation
export {
  AI_STRATEGY_SCHEMA_VERSION,
  AI_STRATEGY_NUMERIC_MIN,
  AI_STRATEGY_NUMERIC_MAX,
  assertValidAIStrategyGenome,
  canonicalSerializeAIStrategyGenome,
  createDefaultAIStrategyGenome,
  validateAIStrategyGenome,
  type AIStrategyGenome,
  type StrategyValidationError,
  type StrategyValidationResult,
} from './strategy.js';

// Observation contract
export {
  AI_OBSERVATION_SCHEMA_VERSION,
  buildAIObservation,
  observationFromDomainEvents,
  type AIObservation,
  type BattlefieldObservation,
  type BuildObservationInput,
  type GamePhase,
  type OpponentEconomyEstimate,
  type PublicOpponentObservation,
  type SelfAIObservation,
  type VisibleTower,
} from './observation.js';

// Policy (accepts AIObservation, never SimulationState)
export {
  extractAIFeaturesFromObservation,
  generateLegalActions,
  scoreAIAction,
  selectAIAction,
  toGameCommand,
  type AIFeatures,
  type LegalAIAction,
  type ScoredAIAction,
} from './policy.js';

// Opening books
export {
  ADAPTIVE_OPENING_BOOKS,
  applyOpeningBookPreferences,
  validateAIOpeningBook,
  type AIOpeningBook,
  type AIOpeningPreference,
} from './opening-book.js';

// Frozen strategy pool
export {
  selectOpponentStrategy,
  validateFrozenStrategyPool,
  type AIArchetype,
  type AISkillTier,
  type FrozenAIStrategy,
  type FrozenStrategyPool,
} from './frozen-pool.js';
