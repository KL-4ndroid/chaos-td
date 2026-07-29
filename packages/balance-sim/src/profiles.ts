import type { BalanceScenario, ControllerProfile } from './types.js';

export const NO_COMMANDS: ControllerProfile = Object.freeze({ id: 'none', kind: 'none' });
export const NORMAL_AI: ControllerProfile = Object.freeze({ id: 'normal-ai', kind: 'normal_ai' });

export const BALANCE_SCENARIOS: readonly BalanceScenario[] = Object.freeze([
  { id: 'normal-ai-vs-normal-ai', p1Controller: NORMAL_AI, p2Controller: NORMAL_AI },
  { id: 'none-vs-none', p1Controller: NO_COMMANDS, p2Controller: NO_COMMANDS },
  { id: 'none-vs-normal-ai', p1Controller: NO_COMMANDS, p2Controller: NORMAL_AI },
  { id: 'normal-ai-vs-none', p1Controller: NORMAL_AI, p2Controller: NO_COMMANDS },
]);

export const BALANCE_SEEDS: readonly string[] = Object.freeze(
  Array.from({ length: 30 }, (_, index) => `balance-${String(index + 1).padStart(3, '0')}`),
);
