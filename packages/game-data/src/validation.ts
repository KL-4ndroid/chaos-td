/**
 * @chaos-td/game-data - Runtime Validation
 *
 * Schema validation and cross-reference checks for game data.
 * Validation is performed at data load time, not in hot paths.
 */

// ============================================================================
// Validation Error Types
// ============================================================================

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

// ============================================================================
// Validation Helpers
// ============================================================================

function createError(code: string, message: string, path?: string): ValidationError {
  return { code, message, ...(path !== undefined ? { path } : {}) };
}

function createResult(errors: readonly ValidationError[]): ValidationResult {
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Global Config Validation
// ============================================================================

/**
 * Validate a GlobalConfig object
 */
export function validateGlobalConfig(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== 'object') {
    return createResult([createError('GLOBAL_NOT_OBJECT', 'Global config must be an object')]);
  }

  const c = config as Record<string, unknown>;

  // Required number fields
  const numberFields: Array<[keyof typeof c, string]> = [
    ['tickRate', 'tickRate must be positive'],
    ['countdownTicks', 'countdownTicks must be positive'],
    ['maxRunningTicks', 'maxRunningTicks must be positive'],
    ['maxResolvingTicks', 'maxResolvingTicks must be positive'],
    ['startingHp', 'startingHp must be non-negative'],
    ['startingGold', 'startingGold must be non-negative'],
    ['startingIncome', 'startingIncome must be non-negative'],
    ['incomeIntervalTicks', 'incomeIntervalTicks must be positive'],
    ['sellRefundPermille', 'sellRefundPermille must be 0-1000'],
    ['sendQueueLimit', 'sendQueueLimit must be positive'],
    ['slowCapPermille', 'slowCapPermille must be 0-1000'],
  ];

  for (const [field, errorMsg] of numberFields) {
    const value = c[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(createError(`GLOBAL_${field.toUpperCase()}_INVALID`, errorMsg, `global.${field}`));
    }
  }

  // Range validations
  const tickRate = c['tickRate'];
  if (typeof tickRate === 'number' && tickRate <= 0) {
    errors.push(createError('GLOBAL_TICKRATE_INVALID', 'tickRate must be positive', 'global.tickRate'));
  }
  const startingHp = c['startingHp'];
  if (typeof startingHp === 'number' && startingHp < 0) {
    errors.push(createError('GLOBAL_STARTINGHP_INVALID', 'startingHp must be non-negative', 'global.startingHp'));
  }
  const sellRefund = c['sellRefundPermille'];
  if (typeof sellRefund === 'number' && (sellRefund < 0 || sellRefund > 1000)) {
    errors.push(createError('GLOBAL_SELL_REFUND_OOB', 'sellRefundPermille must be 0-1000', 'global.sellRefundPermille'));
  }
  const slowCap = c['slowCapPermille'];
  if (typeof slowCap === 'number' && (slowCap < 0 || slowCap > 1000)) {
    errors.push(createError('GLOBAL_SLOW_CAP_OOB', 'slowCapPermille must be 0-1000', 'global.slowCapPermille'));
  }

  return createResult(errors);
}

// ============================================================================
// Tower Validation
// ============================================================================

/**
 * Validate a TowerLevelDefinition
 */
function validateTowerLevel(
  level: unknown,
  towerId: string,
  levelIndex: number,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!level || typeof level !== 'object') {
    return [createError('LEVEL_NOT_OBJECT', `Tower level must be an object`, `towers.${towerId}.levels[${levelIndex}]`)];
  }

  const l = level as Record<string, unknown>;

  const cost = l['cost'];
  if (typeof cost !== 'number' || cost < 0) {
    errors.push(createError('LEVEL_COST_NEGATIVE', `Level ${levelIndex + 1} cost must be non-negative`, `towers.${towerId}.levels[${levelIndex}].cost`));
  }

  const damage = l['damage'];
  if (typeof damage !== 'number' || damage < 0) {
    errors.push(createError('LEVEL_DAMAGE_NEGATIVE', `Level ${levelIndex + 1} damage must be non-negative`, `towers.${towerId}.levels[${levelIndex}].damage`));
  }

  const cooldown = l['cooldownTicks'];
  if (typeof cooldown !== 'number' || cooldown <= 0) {
    errors.push(createError('LEVEL_COOLDOWN_INVALID', `Level ${levelIndex + 1} cooldownTicks must be positive`, `towers.${towerId}.levels[${levelIndex}].cooldownTicks`));
  }

  const range = l['rangeMilliTiles'];
  if (typeof range !== 'number' || range <= 0) {
    errors.push(createError('LEVEL_RANGE_INVALID', `Level ${levelIndex + 1} rangeMilliTiles must be positive`, `towers.${towerId}.levels[${levelIndex}].rangeMilliTiles`));
  }

  const splashFactor = l['splashFactorPermille'];
  if (splashFactor !== undefined && (typeof splashFactor !== 'number' || splashFactor < 0 || splashFactor > 1000)) {
    errors.push(createError('LEVEL_SPLASH_FACTOR_OOB', `Level ${levelIndex + 1} splashFactorPermille must be 0-1000`, `towers.${towerId}.levels[${levelIndex}].splashFactorPermille`));
  }

  const slowPermille = l['slowPermille'];
  if (slowPermille !== undefined && (typeof slowPermille !== 'number' || slowPermille < 0 || slowPermille > 1000)) {
    errors.push(createError('LEVEL_SLOW_OOB', `Level ${levelIndex + 1} slowPermille must be 0-1000`, `towers.${towerId}.levels[${levelIndex}].slowPermille`));
  }

  return errors;
}

/**
 * Validate a TowerDefinition
 */
export function validateTowerDefinition(tower: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!tower || typeof tower !== 'object') {
    return createResult([createError('TOWER_NOT_OBJECT', 'Tower must be an object')]);
  }

  const t = tower as Record<string, unknown>;
  const towerId = String(t['id'] ?? 'unknown');

  if (typeof t['id'] !== 'string' || !t['id']) {
    errors.push(createError('TOWER_ID_MISSING', 'Tower id must be a non-empty string', 'towers'));
  }
  if (typeof t['displayName'] !== 'string' || !t['displayName']) {
    errors.push(createError('TOWER_DISPLAY_NAME_MISSING', 'Tower displayName must be a non-empty string', `towers.${towerId}`));
  }

  const validRoles = ['single_target', 'splash', 'slow', 'heavy_hit'];
  if (!validRoles.includes(t['role'] as string)) {
    errors.push(createError('TOWER_ROLE_INVALID', `Invalid tower role: ${t['role']}`, `towers.${towerId}.role`));
  }

  const validTargeting = ['first', 'strong'];
  if (!validTargeting.includes(t['targeting'] as string)) {
    errors.push(createError('TOWER_TARGETING_INVALID', `Invalid tower targeting: ${t['targeting']}`, `towers.${towerId}.targeting`));
  }

  const levels = t['levels'];
  if (!Array.isArray(levels) || levels.length !== 3) {
    errors.push(createError('TOWER_LEVELS_COUNT', `Tower must have exactly 3 levels, got ${Array.isArray(levels) ? levels.length : 0}`, `towers.${towerId}.levels`));
  } else {
    for (let i = 0; i < 3; i++) {
      const level = levels[i];
      if (level !== undefined) {
        errors.push(...validateTowerLevel(level, towerId, i));
      }
    }
  }

  return createResult(errors);
}

/**
 * Validate an array of TowerDefinitions (checks for duplicate IDs)
 */
export function validateTowerDefinitions(towers: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(towers)) {
    return createResult([createError('TOWERS_NOT_ARRAY', 'Towers must be an array')]);
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < towers.length; i++) {
    const tower = towers[i];
    const towerResult = validateTowerDefinition(tower);
    errors.push(...towerResult.errors.map(e => {
      if (e.path) {
        return { ...e, path: e.path.replace(/^towers\./, `towers[${i}].`) };
      }
      return e;
    }));

    if (tower && typeof tower === 'object') {
      const id = (tower as Record<string, unknown>)['id'];
      if (typeof id === 'string' && id) {
        if (seenIds.has(id)) {
          errors.push(createError('TOWER_ID_DUPLICATE', `Duplicate tower id: ${id}`, `towers[${i}].id`));
        }
        seenIds.add(id);
      }
    }
  }

  return createResult(errors);
}

// ============================================================================
// Monster Validation
// ============================================================================

/**
 * Validate a MonsterDefinition
 */
export function validateMonsterDefinition(monster: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!monster || typeof monster !== 'object') {
    return createResult([createError('MONSTER_NOT_OBJECT', 'Monster must be an object')]);
  }

  const m = monster as Record<string, unknown>;
  const monsterId = String(m['id'] ?? 'unknown');

  if (typeof m['id'] !== 'string' || !m['id']) {
    errors.push(createError('MONSTER_ID_MISSING', 'Monster id must be a non-empty string', 'monsters'));
  }
  if (typeof m['displayName'] !== 'string' || !m['displayName']) {
    errors.push(createError('MONSTER_DISPLAY_NAME_MISSING', 'Monster displayName must be a non-empty string', `monsters.${monsterId}`));
  }

  const sendCost = m['sendCost'];
  if (typeof sendCost !== 'number' || sendCost < 0) {
    errors.push(createError('MONSTER_SENDCOST_INVALID', 'sendCost must be non-negative', `monsters.${monsterId}.sendCost`));
  }

  const incomeGain = m['incomeGain'];
  if (typeof incomeGain !== 'number' || incomeGain < 0) {
    errors.push(createError('MONSTER_INCOMEGAIN_INVALID', 'incomeGain must be non-negative', `monsters.${monsterId}.incomeGain`));
  }

  const bounty = m['bounty'];
  if (typeof bounty !== 'number' || bounty < 0) {
    errors.push(createError('MONSTER_BOUNTY_INVALID', 'bounty must be non-negative', `monsters.${monsterId}.bounty`));
  }

  const hp = m['hp'];
  if (typeof hp !== 'number' || hp <= 0) {
    errors.push(createError('MONSTER_HP_INVALID', 'hp must be positive', `monsters.${monsterId}.hp`));
  }

  const shield = m['shield'];
  if (typeof shield !== 'number' || shield < 0) {
    errors.push(createError('MONSTER_SHIELD_INVALID', 'shield must be non-negative', `monsters.${monsterId}.shield`));
  }

  const armor = m['armorPermille'];
  if (typeof armor !== 'number' || armor < 0 || armor > 1000) {
    errors.push(createError('MONSTER_ARMOR_OOB', 'armorPermille must be 0-1000', `monsters.${monsterId}.armorPermille`));
  }

  const speed = m['speedMilliTilesPerTick'];
  if (typeof speed !== 'number' || speed <= 0) {
    errors.push(createError('MONSTER_SPEED_INVALID', 'speedMilliTilesPerTick must be positive', `monsters.${monsterId}.speedMilliTilesPerTick`));
  }

  const leak = m['leakDamage'];
  if (typeof leak !== 'number' || leak <= 0) {
    errors.push(createError('MONSTER_LEAK_INVALID', 'leakDamage must be positive', `monsters.${monsterId}.leakDamage`));
  }

  const unlock = m['availableAtRunningTick'];
  if (typeof unlock !== 'number' || unlock < 0) {
    errors.push(createError('MONSTER_UNLOCK_INVALID', 'availableAtRunningTick must be non-negative', `monsters.${monsterId}.availableAtRunningTick`));
  }

  const gap = m['spawnGapTicks'];
  if (typeof gap !== 'number' || gap <= 0) {
    errors.push(createError('MONSTER_SPAWN_GAP_INVALID', 'spawnGapTicks must be positive', `monsters.${monsterId}.spawnGapTicks`));
  }

  return createResult(errors);
}

/**
 * Validate an array of MonsterDefinitions (checks for duplicate IDs)
 */
export function validateMonsterDefinitions(monsters: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(monsters)) {
    return createResult([createError('MONSTERS_NOT_ARRAY', 'Monsters must be an array')]);
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < monsters.length; i++) {
    const monster = monsters[i];
    const monsterResult = validateMonsterDefinition(monster);
    errors.push(...monsterResult.errors.map(e => {
      if (e.path) {
        return { ...e, path: e.path.replace(/^monsters\./, `monsters[${i}].`) };
      }
      return e;
    }));

    if (monster && typeof monster === 'object') {
      const id = (monster as Record<string, unknown>)['id'];
      if (typeof id === 'string' && id) {
        if (seenIds.has(id)) {
          errors.push(createError('MONSTER_ID_DUPLICATE', `Duplicate monster id: ${id}`, `monsters[${i}].id`));
        }
        seenIds.add(id);
      }
    }
  }

  return createResult(errors);
}

// ============================================================================
// Map Validation
// ============================================================================

/**
 * Validate a GridCell
 */
function validateGridCell(cell: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!cell || typeof cell !== 'object') {
    return [createError('CELL_NOT_OBJECT', 'Grid cell must be an object', path)];
  }

  const c = cell as Record<string, unknown>;

  if (typeof c['col'] !== 'number' || !Number.isInteger(c['col']) || c['col'] < 0) {
    errors.push(createError('CELL_COL_INVALID', 'col must be a non-negative integer', `${path}.col`));
  }
  if (typeof c['row'] !== 'number' || !Number.isInteger(c['row']) || c['row'] < 0) {
    errors.push(createError('CELL_ROW_INVALID', 'row must be a non-negative integer', `${path}.row`));
  }

  return errors;
}

/**
 * Validate a FixedPointPosition
 */
function validatePosition(pos: unknown, path: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!pos || typeof pos !== 'object') {
    return [createError('POS_NOT_OBJECT', 'Position must be an object', path)];
  }

  const p = pos as Record<string, unknown>;

  if (typeof p['xMilliTiles'] !== 'number' || !Number.isFinite(p['xMilliTiles'])) {
    errors.push(createError('POS_X_INVALID', 'xMilliTiles must be a number', `${path}.xMilliTiles`));
  }
  if (typeof p['yMilliTiles'] !== 'number' || !Number.isFinite(p['yMilliTiles'])) {
    errors.push(createError('POS_Y_INVALID', 'yMilliTiles must be a number', `${path}.yMilliTiles`));
  }

  return errors;
}

/**
 * Validate a LaneDefinition
 */
function validateLane(lane: unknown, laneIndex: number, mapCols: number, mapRows: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!lane || typeof lane !== 'object') {
    return [createError('LANE_NOT_OBJECT', 'Lane must be an object', `maps.lanes[${laneIndex}]`)];
  }

  const l = lane as Record<string, unknown>;

  const validPlayerIds = ['p1', 'p2'];
  if (!validPlayerIds.includes(l['defenderPlayerId'] as string)) {
    errors.push(createError('LANE_DEFENDER_INVALID', `Invalid defender player id: ${l['defenderPlayerId']}`, `maps.lanes[${laneIndex}].defenderPlayerId`));
  }
  if (!validPlayerIds.includes(l['attackerPlayerId'] as string)) {
    errors.push(createError('LANE_ATTACKER_INVALID', `Invalid attacker player id: ${l['attackerPlayerId']}`, `maps.lanes[${laneIndex}].attackerPlayerId`));
  }

  if (l['defenderPlayerId'] === l['attackerPlayerId']) {
    errors.push(createError('LANE_SAME_PLAYER', 'Defender and attacker must be different players', `maps.lanes[${laneIndex}]`));
  }

  const waypoints = l['waypoints'];
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    errors.push(createError('LANE_WAYPOINTS_COUNT', 'Lane must have at least 2 waypoints', `maps.lanes[${laneIndex}].waypoints`));
  } else {
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      if (wp !== undefined) {
        errors.push(...validatePosition(wp, `maps.lanes[${laneIndex}].waypoints[${i}]`));

        const curr = wp as Record<string, unknown>;
        const x = curr['xMilliTiles'];
        const y = curr['yMilliTiles'];

        if (typeof x === 'number' && (x < 0 || x > mapCols * 1000)) {
          errors.push(createError('LANE_WAYPOINT_OOB', `Waypoint ${i} x is out of bounds`, `maps.lanes[${laneIndex}].waypoints[${i}]`));
        }
        if (typeof y === 'number' && (y < 0 || y > mapRows * 1000)) {
          errors.push(createError('LANE_WAYPOINT_OOB', `Waypoint ${i} y is out of bounds`, `maps.lanes[${laneIndex}].waypoints[${i}]`));
        }

        if (i > 0) {
          const prevWp = waypoints[i - 1];
          if (prevWp !== undefined) {
            const prev = prevWp as Record<string, unknown>;
            if (curr['xMilliTiles'] === prev['xMilliTiles'] && curr['yMilliTiles'] === prev['yMilliTiles']) {
              errors.push(createError('LANE_WAYPOINT_DUPLICATE', `Adjacent waypoints ${i - 1} and ${i} are the same`, `maps.lanes[${laneIndex}].waypoints[${i}]`));
            }
          }
        }
      }
    }
  }

  const spawn = l['spawnPosition'];
  if (spawn !== undefined) {
    errors.push(...validatePosition(spawn, `maps.lanes[${laneIndex}].spawnPosition`));
  }
  const end = l['endPosition'];
  if (end !== undefined) {
    errors.push(...validatePosition(end, `maps.lanes[${laneIndex}].endPosition`));
  }

  const buildable = l['buildableCells'];
  const blocked = l['blockedCells'];
  const aiPriority = l['aiBuildPriorityCells'];

  if (Array.isArray(buildable)) {
    for (let i = 0; i < buildable.length; i++) {
      const cell = buildable[i];
      if (cell !== undefined) {
        errors.push(...validateGridCell(cell, `maps.lanes[${laneIndex}].buildableCells[${i}]`));
      }
    }
  }
  if (Array.isArray(blocked)) {
    for (let i = 0; i < blocked.length; i++) {
      const cell = blocked[i];
      if (cell !== undefined) {
        errors.push(...validateGridCell(cell, `maps.lanes[${laneIndex}].blockedCells[${i}]`));
      }
    }
  }
  if (Array.isArray(aiPriority)) {
    for (let i = 0; i < aiPriority.length; i++) {
      const cell = aiPriority[i];
      if (cell !== undefined) {
        errors.push(...validateGridCell(cell, `maps.lanes[${laneIndex}].aiBuildPriorityCells[${i}]`));
      }
    }
  }

  // Check for cell overlaps
  const buildableSet = new Set<string>();
  if (Array.isArray(buildable)) {
    for (const cell of buildable) {
      if (cell && typeof cell === 'object') {
        const c = cell as Record<string, unknown>;
        if (typeof c['col'] === 'number' && typeof c['row'] === 'number') {
          buildableSet.add(`${c['col']},${c['row']}`);
        }
      }
    }
  }

  if (Array.isArray(blocked)) {
    for (const cell of blocked) {
      if (cell && typeof cell === 'object') {
        const c = cell as Record<string, unknown>;
        const key = `${c['col']},${c['row']}`;
        if (buildableSet.has(key)) {
          errors.push(createError('MAP_CELL_OVERLAP', `Cell (${c['col']}, ${c['row']}) is both buildable and blocked`, `maps.lanes[${laneIndex}].blockedCells`));
        }
      }
    }
  }

  if (Array.isArray(aiPriority)) {
    for (const cell of aiPriority) {
      if (cell && typeof cell === 'object') {
        const c = cell as Record<string, unknown>;
        const key = `${c['col']},${c['row']}`;
        if (!buildableSet.has(key)) {
          errors.push(createError('MAP_AI_PRIORITY_NOT_BUILDABLE', `AI priority cell (${c['col']}, ${c['row']}) is not buildable`, `maps.lanes[${laneIndex}].aiBuildPriorityCells`));
        }
      }
    }
  }

  // Check for duplicate cells
  for (const [name, cells] of [['buildableCells', buildable], ['blockedCells', blocked], ['aiBuildPriorityCells', aiPriority]] as const) {
    if (Array.isArray(cells)) {
      const seenCells = new Set<string>();
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell && typeof cell === 'object') {
          const c = cell as Record<string, unknown>;
          const key = `${c['col']},${c['row']}`;
          if (seenCells.has(key)) {
            errors.push(createError('MAP_CELL_DUPLICATE', `Duplicate cell (${c['col']}, ${c['row']}) in ${name}`, `maps.lanes[${laneIndex}].${name}[${i}]`));
          }
          seenCells.add(key);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate a MapDefinition
 */
export function validateMapDefinition(map: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!map || typeof map !== 'object') {
    return createResult([createError('MAP_NOT_OBJECT', 'Map must be an object')]);
  }

  const m = map as Record<string, unknown>;
  const mapId = String(m['id'] ?? 'unknown');

  if (typeof m['id'] !== 'string' || !m['id']) {
    errors.push(createError('MAP_ID_MISSING', 'Map id must be a non-empty string'));
  }
  if (typeof m['displayName'] !== 'string' || !m['displayName']) {
    errors.push(createError('MAP_DISPLAY_NAME_MISSING', 'Map displayName must be a non-empty string', `maps.${mapId}`));
  }

  const cols = m['gridColumns'];
  const rows = m['gridRows'];

  if (typeof cols !== 'number' || cols <= 0) {
    errors.push(createError('MAP_COLS_INVALID', 'gridColumns must be positive', `maps.${mapId}.gridColumns`));
  }
  if (typeof rows !== 'number' || rows <= 0) {
    errors.push(createError('MAP_ROWS_INVALID', 'gridRows must be positive', `maps.${mapId}.gridRows`));
  }

  const lanes = m['lanes'];
  if (!Array.isArray(lanes) || lanes.length !== 2) {
    errors.push(createError('MAP_LANES_COUNT', 'Map must have exactly 2 lanes', `maps.${mapId}.lanes`));
  } else {
    const gridCols = typeof cols === 'number' ? cols : 16;
    const gridRows = typeof rows === 'number' ? rows : 9;

    const lane1 = lanes[0];
    const lane2 = lanes[1];
    if (lane1 !== undefined) {
      errors.push(...validateLane(lane1, 0, gridCols, gridRows));
    }
    if (lane2 !== undefined) {
      errors.push(...validateLane(lane2, 1, gridCols, gridRows));
    }

    // Check lane symmetry
    if (lane1 !== undefined && lane2 !== undefined) {
      const wp1 = (lane1 as Record<string, unknown>)['waypoints'];
      const wp2 = (lane2 as Record<string, unknown>)['waypoints'];

      if (Array.isArray(wp1) && Array.isArray(wp2)) {
        function calcPathLength(waypoints: unknown[]): number {
          let length = 0;
          for (let i = 1; i < waypoints.length; i++) {
            const prev = waypoints[i - 1] as Record<string, unknown>;
            const curr = waypoints[i] as Record<string, unknown>;
            const dx = (curr['xMilliTiles'] as number) - (prev['xMilliTiles'] as number);
            const dy = (curr['yMilliTiles'] as number) - (prev['yMilliTiles'] as number);
            length += Math.sqrt(dx * dx + dy * dy);
          }
          return length;
        }

        const len1 = calcPathLength(wp1);
        const len2 = calcPathLength(wp2);

        if (Math.abs(len1 - len2) > 1) {
          errors.push(createError('MAP_LANE_ASYMMETRY', `Lane path lengths differ by ${Math.abs(len1 - len2).toFixed(2)} milli-tiles (should be < 1)`, `maps.${mapId}.lanes`));
        }
      }
    }
  }

  return createResult(errors);
}

/**
 * Validate all map definitions
 */
export function validateMapDefinitions(maps: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!Array.isArray(maps)) {
    return createResult([createError('MAPS_NOT_ARRAY', 'Maps must be an array')]);
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    if (map !== undefined) {
      const mapResult = validateMapDefinition(map);
      errors.push(...mapResult.errors.map(e => {
        if (e.path) {
          return { ...e, path: e.path.replace(/^maps\./, `maps[${i}].`) };
        }
        return e;
      }));

      if (map && typeof map === 'object') {
        const id = (map as Record<string, unknown>)['id'];
        if (typeof id === 'string' && id) {
          if (seenIds.has(id)) {
            errors.push(createError('MAP_ID_DUPLICATE', `Duplicate map id: ${id}`, `maps[${i}].id`));
          }
          seenIds.add(id);
        }
      }
    }
  }

  return createResult(errors);
}

// ============================================================================
// AI Config Validation
// ============================================================================

/**
 * Validate an AiConfig
 */
export function validateAiConfig(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== 'object') {
    return createResult([createError('AI_NOT_OBJECT', 'AI config must be an object')]);
  }

  const c = config as Record<string, unknown>;
  const playerId = String(c['playerId'] ?? 'unknown');

  if (!['p1', 'p2'].includes(c['playerId'] as string)) {
    errors.push(createError('AI_PLAYER_INVALID', `AI playerId must be p1 or p2`, `aiConfigs.${playerId}.playerId`));
  }

  const validDifficulties = ['easy', 'medium', 'hard'];
  if (!validDifficulties.includes(c['difficulty'] as string)) {
    errors.push(createError('AI_DIFFICULTY_INVALID', `Invalid difficulty: ${c['difficulty']}`, `aiConfigs.${playerId}.difficulty`));
  }

  const validPersonalities = ['aggressive', 'balanced', 'defensive'];
  if (!validPersonalities.includes(c['personality'] as string)) {
    errors.push(createError('AI_PERSONALITY_INVALID', `Invalid personality: ${c['personality']}`, `aiConfigs.${playerId}.personality`));
  }

  return createResult(errors);
}

// ============================================================================
// Bundle Validation (Cross-reference)
// ============================================================================

/**
 * Validate a complete GameDataBundle with cross-reference checks
 */
export function validateGameDataBundle(bundle: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!bundle || typeof bundle !== 'object') {
    return createResult([createError('BUNDLE_NOT_OBJECT', 'GameDataBundle must be an object')]);
  }

  const b = bundle as Record<string, unknown>;

  const global = b['global'];
  if (global !== undefined) {
    const globalResult = validateGlobalConfig(global);
    errors.push(...globalResult.errors.map(e => {
      if (e.path) {
        return { ...e, path: `global${e.path.replace(/^global/, '')}` };
      }
      return e;
    }));
  }

  const towers = b['towers'];
  if (towers !== undefined) {
    const towerResult = validateTowerDefinitions(towers);
    errors.push(...towerResult.errors);
  }

  const monsters = b['monsters'];
  if (monsters !== undefined) {
    const monsterResult = validateMonsterDefinitions(monsters);
    errors.push(...monsterResult.errors);
  }

  const maps = b['maps'];
  if (maps !== undefined) {
    const mapResult = validateMapDefinitions(maps);
    errors.push(...mapResult.errors);
  }

  const aiConfigs = b['aiConfigs'];
  if (aiConfigs !== undefined) {
    if (!Array.isArray(aiConfigs)) {
      errors.push(createError('AI_CONFIGS_NOT_ARRAY', 'aiConfigs must be an array'));
    } else {
      for (let i = 0; i < aiConfigs.length; i++) {
        const config = aiConfigs[i];
        if (config !== undefined) {
          const aiResult = validateAiConfig(config);
          errors.push(...aiResult.errors.map(e => {
            if (e.path) {
              return { ...e, path: e.path.replace(/^aiConfigs\./, `aiConfigs[${i}].`) };
            }
            return e;
          }));
        }
      }
    }
  }

  return createResult(errors);
}

// ============================================================================
// Validation Summary
// ============================================================================

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  if (result.valid) {
    return 'Validation passed';
  }

  const lines: string[] = [`Validation failed with ${result.errors.length} error(s):`];
  for (const error of result.errors) {
    const path = error.path ? `[${error.path}] ` : '';
    lines.push(`  - ${error.code}: ${path}${error.message}`);
  }
  return lines.join('\n');
}
