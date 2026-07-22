import { describe, expect, it } from 'vitest';
import { advanceTutorial, createTutorialState, skipTutorial } from './tutorial';

describe('tutorial state', () => {
  it('progresses through the four contextual steps', () => {
    let state = createTutorialState();
    state = advanceTutorial(state, 'build');
    expect(state.step).toBe('send');
    state = advanceTutorial(state, 'send');
    expect(state.step).toBe('upgrade');
    state = advanceTutorial(state, 'upgrade');
    expect(state.step).toBe('result');
    state = advanceTutorial(state, 'result');
    expect(state.step).toBe('complete');
  });

  it('does not progress on unrelated actions', () => {
    const state = createTutorialState();
    expect(advanceTutorial(state, 'send')).toEqual(state);
  });

  it('supports skipping', () => {
    expect(skipTutorial(createTutorialState())).toEqual({ step: 'complete', skipped: true });
  });
});
