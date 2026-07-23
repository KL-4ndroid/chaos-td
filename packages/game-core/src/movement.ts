/**
 * @chaos-td/game-core - Movement and Path
 *
 * Waypoint-based integer movement for monsters.
 * All positions use milli-tiles (1 tile = 1000 milli-tiles).
 * No floating-point positions allowed.
 */

import type { FixedPointPosition, GridCell } from '@chaos-td/game-data';

export const MILLI_TILES_PER_TILE = 1000 as const;

const GRID_NEIGHBORS: readonly GridCell[] = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

function cellKey(cell: GridCell): string {
  return `${cell.col},${cell.row}`;
}

export function findGridPath(
  gridColumns: number,
  gridRows: number,
  start: GridCell,
  end: GridCell,
  occupiedCells: readonly GridCell[],
  navigationCells?: readonly GridCell[],
): readonly GridCell[] | null {
  const occupied = new Set(occupiedCells.map(cellKey));
  const navigation = navigationCells === undefined ? null : new Set(navigationCells.map(cellKey));
  const startKey = cellKey(start);
  const endKey = cellKey(end);
  occupied.delete(startKey);
  occupied.delete(endKey);

  const queue: GridCell[] = [start];
  const parents = new Map<string, string | null>([[startKey, null]]);
  const cellsByKey = new Map<string, GridCell>([[startKey, start]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    if (cellKey(current) === endKey) break;

    for (const direction of GRID_NEIGHBORS) {
      const next = { col: current.col + direction.col, row: current.row + direction.row };
      const key = cellKey(next);
      const inBounds = next.col >= 0 && next.col < gridColumns && next.row >= 0 && next.row < gridRows;
      const navigable = navigation === null || navigation.has(key);
      if (!inBounds || !navigable || occupied.has(key) || parents.has(key)) continue;
      parents.set(key, cellKey(current));
      cellsByKey.set(key, next);
      queue.push(next);
    }
  }

  if (!parents.has(endKey)) return null;

  const reversed: GridCell[] = [];
  let key: string | null = endKey;
  while (key !== null) {
    const cell = cellsByKey.get(key);
    if (!cell) return null;
    reversed.push(cell);
    key = parents.get(key) ?? null;
  }
  return reversed.reverse();
}

export function gridPathToWaypoints(path: readonly GridCell[]): readonly FixedPointPosition[] {
  return path.map((cell) => ({
    xMilliTiles: cell.col * MILLI_TILES_PER_TILE + MILLI_TILES_PER_TILE / 2,
    yMilliTiles: cell.row * MILLI_TILES_PER_TILE + MILLI_TILES_PER_TILE / 2,
  }));
}

/**
 * A segment of the path between two waypoints.
 */
export interface PathSegment {
  /** Index of the starting waypoint */
  readonly startIndex: number;
  /** Start position */
  readonly start: FixedPointPosition;
  /** End position */
  readonly end: FixedPointPosition;
  /** Segment length in milli-tiles (integer) */
  readonly lengthMilliTiles: number;
  /** Normalized direction: dx */
  readonly dirX: number;
  /** Normalized direction: dy */
  readonly dirY: number;
}

/**
 * Create path segments from waypoints.
 */
export function createPathSegments(waypoints: readonly FixedPointPosition[]): readonly PathSegment[] {
  if (waypoints.length < 2) {
    return [];
  }

  const segments: PathSegment[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    if (!start || !end) {
      continue;
    }

    const dx = end.xMilliTiles - start.xMilliTiles;
    const dy = end.yMilliTiles - start.yMilliTiles;

    // Calculate segment length (integer)
    // Use integer math: sqrt(dx^2 + dy^2) approximated for grid-aligned paths
    const lengthMilliTiles = Math.abs(dx) + Math.abs(dy);

    // Normalized direction (integer, can be -1, 0, or 1 for grid-aligned paths)
    const dirX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const dirY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

    segments.push({
      startIndex: i,
      start,
      end,
      lengthMilliTiles,
      dirX,
      dirY,
    });
  }

  return segments;
}

/**
 * Calculate position on path given progress.
 */
export function calculatePosition(
  waypoints: readonly FixedPointPosition[],
  segments: readonly PathSegment[],
  pathProgressMilliTiles: number,
): { segmentIndex: number; distanceOnSegment: number; x: number; y: number } {
  if (segments.length === 0 || waypoints.length < 2) {
    const pos = waypoints[0] ?? { xMilliTiles: 0, yMilliTiles: 0 };
    return {
      segmentIndex: 0,
      distanceOnSegment: 0,
      x: pos.xMilliTiles,
      y: pos.yMilliTiles,
    };
  }

  let remaining = pathProgressMilliTiles;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) {
      continue;
    }

    if (remaining <= segment.lengthMilliTiles) {
      // Position is within this segment
      const x = segment.start.xMilliTiles + segment.dirX * remaining;
      const y = segment.start.yMilliTiles + segment.dirY * remaining;
      return {
        segmentIndex: i,
        distanceOnSegment: remaining,
        x,
        y,
      };
    }

    remaining -= segment.lengthMilliTiles;
  }

  // Past the end - return end position
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) {
    return { segmentIndex: 0, distanceOnSegment: 0, x: 0, y: 0 };
  }
  return {
    segmentIndex: segments.length - 1,
    distanceOnSegment: lastSegment.lengthMilliTiles,
    x: lastSegment.end.xMilliTiles,
    y: lastSegment.end.yMilliTiles,
  };
}

/**
 * Calculate total path length.
 */
export function calculatePathLength(waypoints: readonly FixedPointPosition[]): number {
  if (waypoints.length < 2) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    if (!start || !end) {
      continue;
    }
    const dx = Math.abs(end.xMilliTiles - start.xMilliTiles);
    const dy = Math.abs(end.yMilliTiles - start.yMilliTiles);
    total += dx + dy;
  }

  return total;
}

/**
 * Check if path progress has reached the end.
 */
export function hasReachedEnd(
  pathProgressMilliTiles: number,
  totalPathLength: number,
): boolean {
  return pathProgressMilliTiles >= totalPathLength;
}
