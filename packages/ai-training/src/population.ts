import { CONFIG_VERSION } from '@chaos-td/game-data';
import { createFromString, nextInt } from '@chaos-td/game-core';
import { assertValidAIStrategyGenome, createDefaultAIStrategyGenome, type AIStrategyGenome } from '@chaos-td/ai-strategy';

export type EvolutionArchetype = 'economic' | 'rush' | 'defensive' | 'counter-play' | 'adaptive';

export interface InitialPopulationConfig {
  readonly size: number;
  readonly seed: string;
  readonly contentVersion: string;
}

const ARCHETYPES: readonly EvolutionArchetype[] = Object.freeze(['economic', 'rush', 'defensive', 'counter-play', 'adaptive']);

const ARCHETYPE_DELTAS: Readonly<Record<EvolutionArchetype, Readonly<Partial<Record<keyof AIStrategyGenome, number>>>>> = Object.freeze({
  economic: { economyWeight: 850, aggressionWeight: 300, incomeInvestmentRatio: 800, sendInvestmentRatio: 350, reserveGoldRatio: 500 },
  rush: { economyWeight: 350, aggressionWeight: 850, sendInvestmentRatio: 850, reserveGoldRatio: 150, pressureTimingWeight: 750 },
  defensive: { defenseWeight: 850, buildThreshold: 250, emergencyDefenseThreshold: 450, reserveGoldRatio: 550, aggressionWeight: 250 },
  'counter-play': { counterOpponentWeight: 850, antiAirPriority: 800, antiBossPriority: 800, splashPriority: 700, defenseWeight: 650 },
  adaptive: { economyWeight: 600, defenseWeight: 600, aggressionWeight: 600, counterOpponentWeight: 700, diversityPreference: 700 },
});

function clamp(value: number): number {
  return Math.max(0, Math.min(1000, value));
}

export function getInitialPopulationArchetypes(): readonly EvolutionArchetype[] {
  return ARCHETYPES;
}

export function createInitialPopulation(config: InitialPopulationConfig): readonly AIStrategyGenome[] {
  if (!Number.isInteger(config.size) || config.size < ARCHETYPES.length) throw new Error(`Initial population size must be at least ${ARCHETYPES.length}`);
  const rng = createFromString(`${config.seed}:initial-population:v1`);
  return Array.from({ length: config.size }, (_, index) => {
    const archetype = ARCHETYPES[index % ARCHETYPES.length] ?? 'adaptive';
    const base = createDefaultAIStrategyGenome(`evo-${String(index + 1).padStart(3, '0')}`, config.contentVersion);
    const template = ARCHETYPE_DELTAS[archetype];
    const varied = Object.fromEntries(Object.entries(template).map(([field, value]) => {
      const delta = nextInt(rng, -75, 75).value;
      return [field, clamp((value ?? 0) + delta)];
    }));
    return assertValidAIStrategyGenome({ ...base, ...varied }, config.contentVersion);
  });
}

export const AI_TRAINING_CONTENT_VERSION = CONFIG_VERSION;
