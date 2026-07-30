import { describe, expect, it } from 'vitest';
import { CONFIG_VERSION } from '@chaos-td/game-data';
import {
  assertValidAIStrategyGenome,
  canonicalSerializeAIStrategyGenome,
  createDefaultAIStrategyGenome,
  validateAIStrategyGenome,
} from './strategy';

describe('AIStrategyGenome', () => {
  it('validates the complete default strategy contract', () => {
    expect(validateAIStrategyGenome(createDefaultAIStrategyGenome('default'))).toEqual({
      ok: true,
      value: createDefaultAIStrategyGenome('default'),
    });
  });

  it('rejects missing fields, non-finite values, and values outside bounds', () => {
    const missing = { ...createDefaultAIStrategyGenome('missing') } as Record<string, unknown>;
    delete missing['economyWeight'];
    expect(validateAIStrategyGenome(missing)).toMatchObject({ ok: false, errors: expect.arrayContaining(['missing_field']) });

    expect(validateAIStrategyGenome({ ...createDefaultAIStrategyGenome('nan'), defenseWeight: Number.NaN })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['non_finite_number']),
    });
    expect(validateAIStrategyGenome({ ...createDefaultAIStrategyGenome('out-of-range'), aggressionWeight: 1001 })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['number_out_of_range']),
    });
  });

  it('rejects unsupported schemas and incompatible content versions', () => {
    expect(validateAIStrategyGenome({ ...createDefaultAIStrategyGenome('schema'), schemaVersion: 2 })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['unsupported_schema_version']),
    });
    expect(validateAIStrategyGenome(createDefaultAIStrategyGenome('content', 'other-content'))).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['incompatible_content_version']),
    });
  });

  it('serializes fields canonically regardless of insertion order', () => {
    const genome = createDefaultAIStrategyGenome('canonical', CONFIG_VERSION);
    const reverseInserted = Object.fromEntries(Object.entries(genome).reverse());

    expect(canonicalSerializeAIStrategyGenome(reverseInserted as typeof genome)).toBe(canonicalSerializeAIStrategyGenome(genome));
  });

  it('throws instead of silently accepting an incompatible strategy', () => {
    expect(() => assertValidAIStrategyGenome(createDefaultAIStrategyGenome('stale', 'old-content'))).toThrow('incompatible_content_version');
  });
});
