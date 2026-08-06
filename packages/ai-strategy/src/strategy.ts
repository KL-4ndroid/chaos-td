import { CONFIG_VERSION } from '@chaos-td/game-data';

export const AI_STRATEGY_SCHEMA_VERSION = 1 as const;
export const AI_STRATEGY_NUMERIC_MIN = 0;
export const AI_STRATEGY_NUMERIC_MAX = 1000;

export interface AIStrategyGenome {
  readonly schemaVersion: typeof AI_STRATEGY_SCHEMA_VERSION;
  readonly strategyId: string;
  readonly strategyVersion: number;
  readonly compatibleContentVersion: string;
  readonly economyWeight: number;
  readonly defenseWeight: number;
  readonly aggressionWeight: number;
  readonly buildThreshold: number;
  readonly upgradeThreshold: number;
  readonly sellThreshold: number;
  readonly emergencyDefenseThreshold: number;
  readonly reserveGoldRatio: number;
  readonly incomeInvestmentRatio: number;
  readonly sendInvestmentRatio: number;
  readonly antiAirPriority: number;
  readonly splashPriority: number;
  readonly slowPriority: number;
  readonly antiBossPriority: number;
  readonly pressureTimingWeight: number;
  readonly counterOpponentWeight: number;
  readonly diversityPreference: number;
  /** Evolved desired defense level (0..1000), replacing a hard-coded baseline. */
  readonly defenseBaselineThreshold: number;
  /** Evolved retained gold ratio in permille (0..900). */
  readonly goldRetentionRatio: number;
  readonly openingBookId?: string;
}

export type StrategyValidationError =
  | 'not_an_object'
  | 'unsupported_schema_version'
  | 'missing_field'
  | 'invalid_strategy_id'
  | 'invalid_strategy_version'
  | 'invalid_content_version'
  | 'incompatible_content_version'
  | 'non_finite_number'
  | 'number_out_of_range'
  | 'invalid_opening_book_id';

export type StrategyValidationResult =
  | { readonly ok: true; readonly value: AIStrategyGenome }
  | { readonly ok: false; readonly errors: readonly StrategyValidationError[] };

type GenomeNumberKey = Exclude<keyof AIStrategyGenome, 'schemaVersion' | 'strategyId' | 'compatibleContentVersion' | 'openingBookId'>;

const NUMBER_FIELDS: readonly GenomeNumberKey[] = Object.freeze([
  'strategyVersion',
  'economyWeight',
  'defenseWeight',
  'aggressionWeight',
  'buildThreshold',
  'upgradeThreshold',
  'sellThreshold',
  'emergencyDefenseThreshold',
  'reserveGoldRatio',
  'incomeInvestmentRatio',
  'sendInvestmentRatio',
  'antiAirPriority',
  'splashPriority',
  'slowPriority',
  'antiBossPriority',
  'pressureTimingWeight',
  'counterOpponentWeight',
  'diversityPreference',
  'defenseBaselineThreshold',
  'goldRetentionRatio',
]);

const CANONICAL_FIELDS: readonly (keyof AIStrategyGenome)[] = Object.freeze([
  'schemaVersion',
  'strategyId',
  'strategyVersion',
  'compatibleContentVersion',
  'economyWeight',
  'defenseWeight',
  'aggressionWeight',
  'buildThreshold',
  'upgradeThreshold',
  'sellThreshold',
  'emergencyDefenseThreshold',
  'reserveGoldRatio',
  'incomeInvestmentRatio',
  'sendInvestmentRatio',
  'antiAirPriority',
  'splashPriority',
  'slowPriority',
  'antiBossPriority',
  'pressureTimingWeight',
  'counterOpponentWeight',
  'diversityPreference',
  'openingBookId',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateAIStrategyGenome(value: unknown, expectedContentVersion: string = CONFIG_VERSION): StrategyValidationResult {
  if (!isRecord(value)) return { ok: false, errors: ['not_an_object'] };
  const errors: StrategyValidationError[] = [];
  if (value['schemaVersion'] !== AI_STRATEGY_SCHEMA_VERSION) errors.push('unsupported_schema_version');
  if (!hasNonEmptyString(value['strategyId'])) errors.push(value['strategyId'] === undefined ? 'missing_field' : 'invalid_strategy_id');
  if (!hasNonEmptyString(value['compatibleContentVersion'])) errors.push(value['compatibleContentVersion'] === undefined ? 'missing_field' : 'invalid_content_version');
  if (value['compatibleContentVersion'] !== expectedContentVersion) errors.push('incompatible_content_version');
  if (value['openingBookId'] !== undefined && !hasNonEmptyString(value['openingBookId'])) errors.push('invalid_opening_book_id');

  for (const field of NUMBER_FIELDS) {
    const fieldValue = value[field];
    if (fieldValue === undefined && (field === 'defenseBaselineThreshold' || field === 'goldRetentionRatio')) continue;
    if (fieldValue === undefined) {
      errors.push('missing_field');
      continue;
    }
    if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
      errors.push('non_finite_number');
      continue;
    }
    if (!Number.isInteger(fieldValue) || fieldValue < AI_STRATEGY_NUMERIC_MIN || fieldValue > AI_STRATEGY_NUMERIC_MAX) {
      errors.push('number_out_of_range');
    }
    if (field === 'goldRetentionRatio' && Number(fieldValue) > 900) errors.push('number_out_of_range');
  }

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)].sort() };
  return {
    ok: true,
    value: {
      schemaVersion: AI_STRATEGY_SCHEMA_VERSION,
      strategyId: String(value['strategyId']),
      strategyVersion: Number(value['strategyVersion']),
      compatibleContentVersion: String(value['compatibleContentVersion']),
      economyWeight: Number(value['economyWeight']),
      defenseWeight: Number(value['defenseWeight']),
      aggressionWeight: Number(value['aggressionWeight']),
      buildThreshold: Number(value['buildThreshold']),
      upgradeThreshold: Number(value['upgradeThreshold']),
      sellThreshold: Number(value['sellThreshold']),
      emergencyDefenseThreshold: Number(value['emergencyDefenseThreshold']),
      reserveGoldRatio: Number(value['reserveGoldRatio']),
      incomeInvestmentRatio: Number(value['incomeInvestmentRatio']),
      sendInvestmentRatio: Number(value['sendInvestmentRatio']),
      antiAirPriority: Number(value['antiAirPriority']),
      splashPriority: Number(value['splashPriority']),
      slowPriority: Number(value['slowPriority']),
      antiBossPriority: Number(value['antiBossPriority']),
      pressureTimingWeight: Number(value['pressureTimingWeight']),
      counterOpponentWeight: Number(value['counterOpponentWeight']),
      diversityPreference: Number(value['diversityPreference']),
      defenseBaselineThreshold: value['defenseBaselineThreshold'] === undefined ? 500 : Number(value['defenseBaselineThreshold']),
      goldRetentionRatio: value['goldRetentionRatio'] === undefined ? 450 : Number(value['goldRetentionRatio']),
      ...(value['openingBookId'] === undefined ? {} : { openingBookId: String(value['openingBookId']) }),
    },
  };
}

export function assertValidAIStrategyGenome(value: unknown, expectedContentVersion: string = CONFIG_VERSION): AIStrategyGenome {
  const result = validateAIStrategyGenome(value, expectedContentVersion);
  if (!result.ok) throw new Error(`Invalid AI strategy genome: ${result.errors.join(',')}`);
  return result.value;
}

export function canonicalSerializeAIStrategyGenome(value: AIStrategyGenome): string {
  assertValidAIStrategyGenome(value, value.compatibleContentVersion);
  const canonical: Record<string, string | number> = {};
  for (const field of CANONICAL_FIELDS) {
    const fieldValue = value[field];
    if (fieldValue !== undefined) canonical[field] = fieldValue;
  }
  return JSON.stringify(canonical);
}

export function createDefaultAIStrategyGenome(strategyId: string, compatibleContentVersion: string = CONFIG_VERSION): AIStrategyGenome {
  return {
    schemaVersion: AI_STRATEGY_SCHEMA_VERSION,
    strategyId,
    strategyVersion: 1,
    compatibleContentVersion,
    economyWeight: 500,
    defenseWeight: 550,
    aggressionWeight: 450,
    buildThreshold: 450,
    upgradeThreshold: 600,
    sellThreshold: 250,
    emergencyDefenseThreshold: 700,
    reserveGoldRatio: 350,
    incomeInvestmentRatio: 400,
    sendInvestmentRatio: 450,
    antiAirPriority: 600,
    splashPriority: 500,
    slowPriority: 450,
    antiBossPriority: 650,
    pressureTimingWeight: 500,
    counterOpponentWeight: 550,
    diversityPreference: 350,
    defenseBaselineThreshold: 500,
    goldRetentionRatio: 450,
  };
}
