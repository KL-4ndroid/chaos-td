/**
 * @chaos-td/game-core - Movement Tests
 *
 * Tests for waypoint-based integer movement.
 */

import { describe, it, expect } from 'vitest';
import {
  createPathSegments,
  calculatePosition,
  calculatePathLength,
  hasReachedEnd,
  MILLI_TILES_PER_TILE,
} from './movement';
import type { FixedPointPosition } from '@chaos-td/game-data';

describe('Movement', () => {
  describe('MILLI_TILES_PER_TILE', () => {
    it('should be 1000', () => {
      expect(MILLI_TILES_PER_TILE).toBe(1000);
    });
  });

  describe('createPathSegments', () => {
    it('should create segments from waypoints', () => {
      const waypoints: readonly FixedPointPosition[] = [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 3000, yMilliTiles: 0 },
        { xMilliTiles: 3000, yMilliTiles: 5000 },
      ];

      const segments = createPathSegments(waypoints);

      expect(segments.length).toBe(2);

      // First segment: horizontal
      expect(segments[0]).toMatchObject({
        startIndex: 0,
        lengthMilliTiles: 3000,
        dirX: 1,
        dirY: 0,
      });

      // Second segment: vertical
      expect(segments[1]).toMatchObject({
        startIndex: 1,
        lengthMilliTiles: 5000,
        dirX: 0,
        dirY: 1,
      });
    });

    it('should return empty array for less than 2 waypoints', () => {
      const singlePoint: readonly FixedPointPosition[] = [
        { xMilliTiles: 0, yMilliTiles: 0 },
      ];

      expect(createPathSegments(singlePoint).length).toBe(0);
      expect(createPathSegments([]).length).toBe(0);
    });

    it('should handle negative direction', () => {
      const waypoints: readonly FixedPointPosition[] = [
        { xMilliTiles: 5000, yMilliTiles: 5000 },
        { xMilliTiles: 2000, yMilliTiles: 5000 },
      ];

      const segments = createPathSegments(waypoints);

      expect(segments[0]).toMatchObject({
        lengthMilliTiles: 3000,
        dirX: -1,
        dirY: 0,
      });
    });
  });

  describe('calculatePosition', () => {
    const waypoints: readonly FixedPointPosition[] = [
      { xMilliTiles: 0, yMilliTiles: 0 },
      { xMilliTiles: 3000, yMilliTiles: 0 },
      { xMilliTiles: 3000, yMilliTiles: 5000 },
    ];

    const segments = createPathSegments(waypoints);

    it('should return start position at progress 0', () => {
      const pos = calculatePosition(waypoints, segments, 0);

      expect(pos.x).toBe(0);
      expect(pos.y).toBe(0);
      expect(pos.segmentIndex).toBe(0);
      expect(pos.distanceOnSegment).toBe(0);
    });

    it('should move along first segment', () => {
      const pos = calculatePosition(waypoints, segments, 1000);

      expect(pos.x).toBe(1000);
      expect(pos.y).toBe(0);
      expect(pos.segmentIndex).toBe(0);
      expect(pos.distanceOnSegment).toBe(1000);
    });

    it('should handle segment transition', () => {
      const pos = calculatePosition(waypoints, segments, 3000);

      expect(pos.x).toBe(3000);
      expect(pos.y).toBe(0);
      // At exactly segment length, we've completed segment 0
      expect(pos.segmentIndex).toBe(0);
      expect(pos.distanceOnSegment).toBe(3000);
    });

    it('should move along second segment', () => {
      const pos = calculatePosition(waypoints, segments, 4000);

      expect(pos.x).toBe(3000);
      expect(pos.y).toBe(1000);
      expect(pos.segmentIndex).toBe(1);
      expect(pos.distanceOnSegment).toBe(1000);
    });

    it('should return end position past path length', () => {
      const pos = calculatePosition(waypoints, segments, 10000);

      expect(pos.x).toBe(3000);
      expect(pos.y).toBe(5000);
    });
  });

  describe('calculatePathLength', () => {
    it('should calculate total path length', () => {
      const waypoints: readonly FixedPointPosition[] = [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 3000, yMilliTiles: 0 },
        { xMilliTiles: 3000, yMilliTiles: 5000 },
      ];

      // 3000 (horizontal) + 5000 (vertical) = 8000
      expect(calculatePathLength(waypoints)).toBe(8000);
    });

    it('should return 0 for single waypoint', () => {
      const waypoints: readonly FixedPointPosition[] = [
        { xMilliTiles: 0, yMilliTiles: 0 },
      ];

      expect(calculatePathLength(waypoints)).toBe(0);
    });

    it('should return 0 for empty waypoints', () => {
      expect(calculatePathLength([])).toBe(0);
    });
  });

  describe('hasReachedEnd', () => {
    it('should return false before end', () => {
      expect(hasReachedEnd(500, 1000)).toBe(false);
    });

    it('should return true at end', () => {
      expect(hasReachedEnd(1000, 1000)).toBe(true);
    });

    it('should return true past end', () => {
      expect(hasReachedEnd(1500, 1000)).toBe(true);
    });
  });

  describe('Determinism', () => {
    it('should produce same position for same progress', () => {
      const waypoints: readonly FixedPointPosition[] = [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 1000, yMilliTiles: 1000 },
      ];

      const segments = createPathSegments(waypoints);

      const pos1 = calculatePosition(waypoints, segments, 500);
      const pos2 = calculatePosition(waypoints, segments, 500);

      expect(pos1.x).toBe(pos2.x);
      expect(pos1.y).toBe(pos2.y);
      expect(pos1.segmentIndex).toBe(pos2.segmentIndex);
    });

    it('should produce integer positions only', () => {
      const waypoints: readonly FixedPointPosition[] = [
        { xMilliTiles: 0, yMilliTiles: 0 },
        { xMilliTiles: 999, yMilliTiles: 999 },
      ];

      const segments = createPathSegments(waypoints);

      // Test multiple progress values
      for (let progress = 0; progress <= 2000; progress += 100) {
        const pos = calculatePosition(waypoints, segments, progress);
        expect(Number.isInteger(pos.x)).toBe(true);
        expect(Number.isInteger(pos.y)).toBe(true);
      }
    });
  });
});
