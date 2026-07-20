/**
 * @chaos-td/game-data - Map Definitions
 *
 * Authoritative map definitions for MVP.
 *
 * Map Layout (16x9 grid):
 * - Row 0: Screen edge (blocked)
 * - Row 1: Lane 2 path (blocked)
 * - Row 2: Lane 2 path adjacent (blocked)
 * - Rows 3-6: Buildable area with path corridors
 * - Row 7: Lane 1 path adjacent (blocked)
 * - Row 8: Lane 1 path (blocked)
 *
 * Path corridors at columns 2, 4, 6, 8, 10, 12, 14
 */

import type { MapDefinition, GridCell, FixedPointPosition, LaneDefinition } from './types.js';

// ============================================================================
// Constants
// ============================================================================

const GRID_COLS = 16;
const GRID_ROWS = 9;

/**
 * Helper: Create grid cells
 */
function cells(...coords: readonly (readonly [number, number])[]): readonly GridCell[] {
  return coords.map(([col, row]) => ({ col, row })) as readonly GridCell[];
}

/**
 * Helper: Mirror cells for lane 2
 */
function mirrorCells(cellsToMirror: readonly GridCell[]): readonly GridCell[] {
  return cellsToMirror.map(c => ({ col: GRID_COLS - 1 - c.col, row: GRID_ROWS - 1 - c.row })) as readonly GridCell[];
}

// ============================================================================
// Lane 1 (p1 defends, p2 attacks)
// Path: horizontal at row 8, with vertical segments
// ============================================================================

const LANE1_WAYPOINTS: readonly FixedPointPosition[] = Object.freeze([
  { xMilliTiles: 0, yMilliTiles: 8000 },           // spawn (off-screen left)
  { xMilliTiles: 2000, yMilliTiles: 8000 },        // waypoint 1
  { xMilliTiles: 2000, yMilliTiles: 6000 },        // waypoint 2 (turn up)
  { xMilliTiles: 6000, yMilliTiles: 6000 },        // waypoint 3
  { xMilliTiles: 6000, yMilliTiles: 8000 },        // waypoint 4 (turn down)
  { xMilliTiles: 10000, yMilliTiles: 8000 },       // waypoint 5
  { xMilliTiles: 10000, yMilliTiles: 6000 },       // waypoint 6 (turn up)
  { xMilliTiles: 14000, yMilliTiles: 6000 },       // waypoint 7
  { xMilliTiles: 14000, yMilliTiles: 8000 },       // waypoint 8
  { xMilliTiles: 16000, yMilliTiles: 8000 },       // end (off-screen right)
]);

// Buildable cells: rows 3-6, avoiding path columns
const LANE1_BUILDABLE: readonly GridCell[] = Object.freeze([
  // Row 3 (y: 3000-4000) - only odd columns
  ...cells([1, 3], [3, 3], [5, 3], [7, 3], [9, 3], [11, 3], [13, 3]),
  // Row 4 (y: 4000-5000) - only odd columns, avoiding path corridors
  ...cells([1, 4], [3, 4], [5, 4], [7, 4], [9, 4], [11, 4], [13, 4]),
  // Row 5 (y: 5000-6000) - avoid vertical path columns
  ...cells([1, 5], [3, 5], [5, 5], [7, 5], [9, 5], [11, 5], [13, 5]),
  // Row 6 (y: 6000-7000) - avoid vertical path columns
  ...cells([1, 6], [3, 6], [5, 6], [7, 6], [9, 6], [11, 6], [13, 6]),
]);

// Blocked cells: path + edges + path corridors
const LANE1_BLOCKED: readonly GridCell[] = Object.freeze([
  // Row 8: horizontal path
  ...cells([0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [15, 8]),
  // Row 7: path adjacent
  ...cells([0, 7], [2, 7], [4, 7], [6, 7], [8, 7], [10, 7], [12, 7], [14, 7], [15, 7]),
  // Vertical path segments at columns 2, 6, 10, 14 (y: 6000)
  ...cells([2, 6], [6, 6], [10, 6], [14, 6]),
  // Vertical path segments at columns 4, 8, 12 (y: 6000)
  ...cells([4, 6], [8, 6], [12, 6]),
  // Screen edges
  ...cells([0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6]),
  ...cells([15, 0], [15, 1], [15, 2], [15, 3], [15, 4], [15, 5], [15, 6]),
  ...cells([1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [13, 0], [14, 0]),
  // Path corridors (columns 2, 4, 6, 8, 10, 12, 14 at rows 3-5)
  ...cells([2, 3], [4, 3], [6, 3], [8, 3], [10, 3], [12, 3], [14, 3]),
  ...cells([2, 4], [4, 4], [6, 4], [8, 4], [10, 4], [12, 4], [14, 4]),
  ...cells([2, 5], [4, 5], [6, 5], [8, 5], [10, 5], [12, 5], [14, 5]),
]);

const LANE1_AI_PRIORITY: readonly GridCell[] = Object.freeze([
  // Strategic positions at path crossings
  { col: 3, row: 4 },
  { col: 7, row: 4 },
  { col: 11, row: 4 },
  { col: 1, row: 6 },
  { col: 5, row: 6 },
  { col: 9, row: 6 },
  { col: 13, row: 6 },
]);

// ============================================================================
// Lane 2 (p2 defends, p1 attacks)
// Path: horizontal at row 0, mirrored
// ============================================================================

const LANE2_WAYPOINTS: readonly FixedPointPosition[] = Object.freeze([
  { xMilliTiles: 16000, yMilliTiles: 1000 },       // spawn (off-screen right)
  { xMilliTiles: 14000, yMilliTiles: 1000 },       // waypoint 1
  { xMilliTiles: 14000, yMilliTiles: 3000 },       // waypoint 2 (turn down)
  { xMilliTiles: 10000, yMilliTiles: 3000 },        // waypoint 3
  { xMilliTiles: 10000, yMilliTiles: 1000 },        // waypoint 4 (turn up)
  { xMilliTiles: 6000, yMilliTiles: 1000 },          // waypoint 5
  { xMilliTiles: 6000, yMilliTiles: 3000 },          // waypoint 6 (turn down)
  { xMilliTiles: 2000, yMilliTiles: 3000 },          // waypoint 7
  { xMilliTiles: 2000, yMilliTiles: 1000 },          // waypoint 8
  { xMilliTiles: 0, yMilliTiles: 1000 },             // end (off-screen left)
]);

// Mirror lane 1
const LANE2_BUILDABLE: readonly GridCell[] = Object.freeze(mirrorCells(LANE1_BUILDABLE));
const LANE2_BLOCKED: readonly GridCell[] = Object.freeze(mirrorCells(LANE1_BLOCKED));
const LANE2_AI_PRIORITY: readonly GridCell[] = Object.freeze(mirrorCells(LANE1_AI_PRIORITY));

// ============================================================================
// Map Definition
// ============================================================================

const LANE1: LaneDefinition = {
  id: 'lane_p1',
  defenderPlayerId: 'p1',
  attackerPlayerId: 'p2',
  waypoints: LANE1_WAYPOINTS,
  spawnPosition: LANE1_WAYPOINTS[0] as FixedPointPosition,
  endPosition: LANE1_WAYPOINTS[LANE1_WAYPOINTS.length - 1] as FixedPointPosition,
  buildableCells: LANE1_BUILDABLE,
  blockedCells: LANE1_BLOCKED,
  aiBuildPriorityCells: LANE1_AI_PRIORITY,
};

const LANE2: LaneDefinition = {
  id: 'lane_p2',
  defenderPlayerId: 'p2',
  attackerPlayerId: 'p1',
  waypoints: LANE2_WAYPOINTS,
  spawnPosition: LANE2_WAYPOINTS[0] as FixedPointPosition,
  endPosition: LANE2_WAYPOINTS[LANE2_WAYPOINTS.length - 1] as FixedPointPosition,
  buildableCells: LANE2_BUILDABLE,
  blockedCells: LANE2_BLOCKED,
  aiBuildPriorityCells: LANE2_AI_PRIORITY,
};

export const MVP_MIRROR_01: MapDefinition = Object.freeze({
  id: 'mvp_mirror_01',
  schemaVersion: 1,
  displayName: 'MVP Mirror Arena',
  gridColumns: GRID_COLS,
  gridRows: GRID_ROWS,
  lanes: [LANE1, LANE2] as const,
});

// ============================================================================
// Map Registry
// ============================================================================

export const MAP_DEFINITIONS: readonly MapDefinition[] = Object.freeze([MVP_MIRROR_01]);

export const MAP_BY_ID: ReadonlyMap<string, MapDefinition> = Object.freeze(
  new Map(MAP_DEFINITIONS.map(m => [m.id, m])),
);
