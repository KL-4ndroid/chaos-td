import { describe, expect, it } from 'vitest';
import { containsPoint } from './ui-hit-test';

describe('UI hit testing', () => {
  const rect = { x: 20, y: 30, width: 100, height: 60 };

  it('captures points across the full visible panel', () => {
    expect(containsPoint(rect, 20, 30)).toBe(true);
    expect(containsPoint(rect, 70, 60)).toBe(true);
    expect(containsPoint(rect, 120, 90)).toBe(true);
  });

  it('does not capture points outside the panel', () => {
    expect(containsPoint(rect, 19, 60)).toBe(false);
    expect(containsPoint(rect, 121, 60)).toBe(false);
    expect(containsPoint(rect, 70, 91)).toBe(false);
  });
});
