/**
 * Smoke test for game-core package.
 * Ensures the package can be imported without errors.
 */

import { describe, it, expect } from 'vitest';
import * as indexModule from './index';

describe('game-core smoke test', () => {
  it('should export nothing in bootstrap state', () => {
    expect(indexModule).toBeDefined();
  });
});
