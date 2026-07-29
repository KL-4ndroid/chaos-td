import type { BalanceScenario, ControllerProfile } from './types.js';

export const NO_COMMANDS: ControllerProfile = Object.freeze({ id: 'none', kind: 'none' });

export function aiProfile(
  difficulty: 'easy' | 'medium' | 'hard',
  personality: 'aggressive' | 'balanced' | 'defensive',
): ControllerProfile {
  return Object.freeze({ id: `${difficulty}-${personality}`, kind: 'ai', difficulty, personality });
}

const EASY = aiProfile('easy', 'balanced');
const MEDIUM = aiProfile('medium', 'balanced');
const HARD = aiProfile('hard', 'balanced');
const AGGRESSIVE = aiProfile('medium', 'aggressive');
const BALANCED = aiProfile('medium', 'balanced');
const DEFENSIVE = aiProfile('medium', 'defensive');

export const BALANCE_SCENARIOS: readonly BalanceScenario[] = Object.freeze([
  { id: 'easy-vs-easy', p1Controller: EASY, p2Controller: EASY },
  { id: 'medium-vs-medium', p1Controller: MEDIUM, p2Controller: MEDIUM },
  { id: 'hard-vs-hard', p1Controller: HARD, p2Controller: HARD },
  { id: 'aggressive-vs-defensive', p1Controller: AGGRESSIVE, p2Controller: DEFENSIVE },
  { id: 'defensive-vs-aggressive', p1Controller: DEFENSIVE, p2Controller: AGGRESSIVE },
  { id: 'balanced-vs-balanced', p1Controller: BALANCED, p2Controller: BALANCED },
  { id: 'none-vs-none', p1Controller: NO_COMMANDS, p2Controller: NO_COMMANDS },
  { id: 'none-vs-easy', p1Controller: NO_COMMANDS, p2Controller: EASY },
  { id: 'easy-vs-none', p1Controller: EASY, p2Controller: NO_COMMANDS },
]);

export const BALANCE_SEEDS: readonly string[] = Object.freeze(
  Array.from({ length: 30 }, (_, index) => `balance-${String(index + 1).padStart(3, '0')}`),
);
