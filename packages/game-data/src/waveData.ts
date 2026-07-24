/**
 * @chaos-td/game-data - Wave Definitions
 *
 * Auto-generated wave definitions for single-player / wave-defense mode.
 *
 * Design rules:
 * - Wave 1: introductory basic monsters only.
 * - Every 5th wave (5, 10, 15…): introduces swift monsters.
 * - Every 10th wave (10, 20, 30…): introduces a boss monster.
 * - Every 10th wave also: siege monsters appear.
 * - Flying monsters: appear from wave 6 onward, every 6 waves.
 * - Difficulty multiplier scales monster HP and leak damage as waves progress.
 *
 * These waves are generated procedurally and are the authoritative source
 * for the WaveScheduler in game-core.
 */

import type { WaveDefinition, WaveGroup } from './types.js';

const TICKS_BETWEEN_SPAWNS = 20 as const;  // 1 second at 20 TPS

/**
 * Build a single WaveGroup for a given monster type.
 */
function makeGroup(
  monsterType: 'basic' | 'swift' | 'flying' | 'siege' | 'boss',
  count: number,
  difficulty: number,
): WaveGroup {
  return Object.freeze({ monsterType, count, difficultyMultiplier: difficulty });
}

/**
 * Compute the difficulty multiplier for a given wave number.
 * Scales by +5% every 5 waves, starting from 1.0.
 */
function waveMultiplier(waveNumber: number): number {
  return 1 + Math.floor(waveNumber / 5) * 0.05;
}

/**
 * Calculate total duration in ticks for a wave.
 * Duration = sum of (spawnGap for each group) + TICKS_BETWEEN_SPAWNS per extra monster.
 */
function totalDuration(groups: readonly WaveGroup[]): number {
  // Each group spawns its count members with TICKS_BETWEEN_SPAWNS gap
  const totalSpawns = groups.reduce((sum, g) => sum + g.count, 0);
  // First spawn at tick 0, so duration = (totalSpawns - 1) * gap
  return Math.max(TICKS_BETWEEN_SPAWNS, (totalSpawns - 1) * TICKS_BETWEEN_SPAWNS);
}

/**
 * Generate WaveDefinitions for waves 1 through maxWave.
 * This function is deterministic given the same maxWave.
 */
export function generateWaveDefinitions(maxWave: number): readonly WaveDefinition[] {
  const waves: WaveDefinition[] = [];

  for (let wave = 1; wave <= maxWave; wave += 1) {
    const mult = waveMultiplier(wave);
    const groups: WaveGroup[] = [];

    // Basic sheep: always present, count increases with wave
    const basicCount = Math.min(3 + Math.floor(wave / 3), 8);
    groups.push(makeGroup('basic', basicCount, mult));

    // Swift (wolf) every 5th wave
    if (wave % 5 === 0) {
      const swiftCount = Math.min(2 + Math.floor(wave / 10), 5);
      groups.push(makeGroup('swift', swiftCount, mult));
    }

    // Flying (ghost) from wave 6, every 6 waves
    if (wave >= 6 && wave % 6 === 0) {
      const flyingCount = Math.min(2 + Math.floor((wave - 6) / 12), 4);
      groups.push(makeGroup('flying', flyingCount, mult));
    }

    // Siege every 10th wave
    if (wave % 10 === 0) {
      groups.push(makeGroup('siege', 1, mult));
    }

    // Boss every 10th wave
    if (wave % 10 === 0) {
      groups.push(makeGroup('boss', 1, mult));
    }

    waves.push(Object.freeze({
      waveNumber: wave,
      groups: Object.freeze(groups),
      totalDurationTicks: totalDuration(groups),
    }));
  }

  return Object.freeze(waves);
}

/**
 * Pre-generated waves for the first 100 waves.
 * Use generateWaveDefinitions(100) to produce these.
 */
export const WAVE_DEFINITIONS: readonly WaveDefinition[] = generateWaveDefinitions(100);
