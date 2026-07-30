import { CONFIG_VERSION, TOWER_DEFINITIONS } from '@chaos-td/game-data';
import type { AIFeatures, LegalAIAction, ScoredAIAction } from './policy.js';

export interface AIOpeningPreference {
  readonly id: string;
  readonly maxWave: number;
  readonly kind: 'prefer_tower_role' | 'reserve_anti_air' | 'defer_sends_until_income';
  readonly weight: number;
}

export interface AIOpeningBook {
  readonly id: string;
  readonly contentVersion: string;
  readonly steps: readonly AIOpeningPreference[];
}

export function validateAIOpeningBook(book: AIOpeningBook, expectedContentVersion: string = CONFIG_VERSION): void {
  if (book.contentVersion !== expectedContentVersion) throw new Error(`Incompatible opening book content version: ${book.contentVersion}`);
  if (book.id.trim().length === 0) throw new Error('Opening book ID is required');
  for (const step of book.steps) {
    if (step.id.trim().length === 0 || !Number.isInteger(step.maxWave) || step.maxWave < 1 || !Number.isInteger(step.weight) || step.weight < 0 || step.weight > 1000) {
      throw new Error(`Invalid opening preference: ${step.id}`);
    }
  }
}

function currentWave(features: AIFeatures): number {
  return Math.max(1, Math.floor(features.tick / 400) + 1);
}

function matchesTowerRole(action: LegalAIAction, role: string): boolean {
  if (action.type !== 'build_tower') return false;
  return TOWER_DEFINITIONS.find((tower) => tower.id === action.towerTypeId)?.role === role;
}

export function applyOpeningBookPreferences(
  scoredActions: readonly ScoredAIAction[],
  features: AIFeatures,
  book: AIOpeningBook | undefined,
): ScoredAIAction[] {
  if (!book || currentWave(features) > Math.max(...book.steps.map((step) => step.maxWave), 0)) return [...scoredActions];
  validateAIOpeningBook(book, book.contentVersion);
  return scoredActions.map((candidate) => {
    let bonus = 0;
    for (const preference of book.steps) {
      if (currentWave(features) > preference.maxWave) continue;
      if (preference.kind === 'prefer_tower_role' && matchesTowerRole(candidate.action, 'single_target')) bonus += preference.weight;
      if (preference.kind === 'reserve_anti_air' && candidate.action.type === 'queue_monster' && features.flyingCoverage === 0) bonus -= preference.weight;
      if (preference.kind === 'defer_sends_until_income' && candidate.action.type === 'queue_monster' && features.income < preference.weight) bonus -= preference.weight;
    }
    return { ...candidate, score: candidate.score + bonus };
  });
}

export const ADAPTIVE_OPENING_BOOKS: readonly AIOpeningBook[] = Object.freeze([
  Object.freeze({
    id: 'baseline-adaptive-v1',
    contentVersion: CONFIG_VERSION,
    steps: Object.freeze([
      Object.freeze({ id: 'early-affordable-single-target', maxWave: 2, kind: 'prefer_tower_role', weight: 120 }),
      Object.freeze({ id: 'reserve-anti-air-before-coverage', maxWave: 4, kind: 'reserve_anti_air', weight: 150 }),
      Object.freeze({ id: 'income-before-early-send', maxWave: 3, kind: 'defer_sends_until_income', weight: 120 }),
    ]),
  }),
]);
