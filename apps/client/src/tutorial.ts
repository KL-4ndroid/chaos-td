export type TutorialStep = 'build' | 'send' | 'upgrade' | 'result' | 'complete';

export interface TutorialState {
  step: TutorialStep;
  skipped: boolean;
}

export function createTutorialState(): TutorialState {
  return { step: 'build', skipped: false };
}

export function advanceTutorial(state: TutorialState, action: 'build' | 'send' | 'upgrade' | 'result'): TutorialState {
  if (state.skipped || state.step === 'complete') return state;
  const transitions: Record<Exclude<TutorialStep, 'complete'>, Partial<Record<typeof action, TutorialStep>>> = {
    build: { build: 'send' },
    send: { send: 'upgrade' },
    upgrade: { upgrade: 'result' },
    result: { result: 'complete' },
  };
  const next = transitions[state.step][action];
  return next ? { ...state, step: next } : state;
}

export function skipTutorial(_state: TutorialState): TutorialState {
  return { step: 'complete', skipped: true };
}
