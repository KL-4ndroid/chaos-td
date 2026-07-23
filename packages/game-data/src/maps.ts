/**
 * @chaos-td/game-data - Authoritative MVP map definition.
 */

import type { MapDefinition, GridCell, FixedPointPosition, LaneDefinition } from './types.js';

const GRID_COLS = 8;
const GRID_ROWS = 21;

function createArea(minRow: number, maxRow: number): readonly GridCell[] {
  const result: GridCell[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) result.push({ col, row });
  }
  return result;
}

function withoutEndpoints(cells: readonly GridCell[], start: GridCell, end: GridCell): readonly GridCell[] {
  return cells.filter((cell) =>
    (cell.col !== start.col || cell.row !== start.row) &&
    (cell.col !== end.col || cell.row !== end.row));
}

function toPosition(cell: GridCell): FixedPointPosition {
  return { xMilliTiles: cell.col * 1000 + 500, yMilliTiles: cell.row * 1000 + 500 };
}

const P1_START: GridCell = { col: 3, row: 11 };
const P1_END: GridCell = { col: 3, row: 20 };
const P2_START: GridCell = { col: 4, row: 9 };
const P2_END: GridCell = { col: 4, row: 0 };
const P1_NAVIGATION = Object.freeze(createArea(11, 20));
const P2_NAVIGATION = Object.freeze(createArea(0, 9));
const MIDDLE_BLOCKED = Object.freeze(createArea(10, 10));

const LANE1: LaneDefinition = Object.freeze({
  id: 'lane_p1',
  defenderPlayerId: 'p1',
  attackerPlayerId: 'p2',
  waypoints: Object.freeze([toPosition(P1_START), toPosition(P1_END)]),
  spawnPosition: toPosition(P1_START),
  endPosition: toPosition(P1_END),
  navigationCells: P1_NAVIGATION,
  buildableCells: Object.freeze(withoutEndpoints(P1_NAVIGATION, P1_START, P1_END)),
  blockedCells: MIDDLE_BLOCKED,
  aiBuildPriorityCells: Object.freeze([
    { col: 3, row: 14 }, { col: 4, row: 16 }, { col: 3, row: 18 },
  ]),
});

const LANE2: LaneDefinition = Object.freeze({
  id: 'lane_p2',
  defenderPlayerId: 'p2',
  attackerPlayerId: 'p1',
  waypoints: Object.freeze([toPosition(P2_START), toPosition(P2_END)]),
  spawnPosition: toPosition(P2_START),
  endPosition: toPosition(P2_END),
  navigationCells: P2_NAVIGATION,
  buildableCells: Object.freeze(withoutEndpoints(P2_NAVIGATION, P2_START, P2_END)),
  blockedCells: MIDDLE_BLOCKED,
  aiBuildPriorityCells: Object.freeze([
    { col: 4, row: 6 }, { col: 3, row: 4 }, { col: 4, row: 2 },
  ]),
});

export const MVP_MIRROR_01: MapDefinition = Object.freeze({
  id: 'mvp_mirror_01',
  schemaVersion: 1,
  displayName: 'MVP Maze Arena',
  gridColumns: GRID_COLS,
  gridRows: GRID_ROWS,
  lanes: [LANE1, LANE2] as const,
});

export const MAP_DEFINITIONS: readonly MapDefinition[] = Object.freeze([MVP_MIRROR_01]);

export const MAP_BY_ID: ReadonlyMap<string, MapDefinition> = Object.freeze(
  new Map(MAP_DEFINITIONS.map((map) => [map.id, map])),
);
