import type { BattlefieldId, PlayerSlot } from '@chaos-td/game-core';

export type ControllerProfile =
  | {
      readonly id: 'none';
      readonly kind: 'none';
    }
  | {
      readonly id: 'normal-ai';
      readonly kind: 'normal_ai';
    };

export interface BalanceSimulationOptions {
  readonly seed: string;
  readonly maxTicks?: number;
  readonly p1Controller: ControllerProfile;
  readonly p2Controller: ControllerProfile;
  readonly samplingIntervalTicks: number;
  /** Captures a complete domain event sequence for deterministic regression only. */
  readonly captureEventLog?: boolean;
}

export interface BalanceTimeSample {
  readonly tick: number;
  readonly wave: number;
  readonly p1: PlayerSnapshot;
  readonly p2: PlayerSnapshot;
}

export interface PlayerSnapshot {
  readonly hp: number;
  readonly gold: number;
  readonly income: number;
  readonly netWorth: number;
}

export interface PlayerBalanceSummary extends PlayerSnapshot {
  readonly startingHp: number;
  readonly startingGold: number;
  readonly startingIncome: number;
  readonly totalIncomePaid: number;
  readonly towerSpend: number;
  readonly monsterSendSpend: number;
  readonly sellRefund: number;
  readonly commandsAccepted: number;
  readonly commandsRejected: number;
  readonly rejectionReasons: Readonly<Record<string, number>>;
  readonly waveLeakDamage: number;
  readonly opponentSendLeakDamage: number;
}

export interface TowerBalanceSummary {
  readonly towerId: string;
  readonly level: number;
  readonly buildCount: number;
  readonly upgradeCount: number;
  readonly sellCount: number;
  readonly attackCount: number;
  readonly rawDamage: number;
  readonly bonusDamage: number;
  readonly resistanceReduction: number;
  readonly armorReduction: number;
  readonly shieldDamage: number;
  readonly hpDamage: number;
  readonly killCount: number;
  readonly groundTargetCount: number;
  readonly flyingTargetCount: number;
  readonly bossDamage: number;
  readonly splashSecondaryDamage: number;
  readonly slowApplications: number;
}

export interface MonsterBalanceSummary {
  readonly monsterId: string;
  readonly source: 'player' | 'wave';
  readonly spawnCount: number;
  readonly deathCount: number;
  readonly leakCount: number;
  readonly damageTaken: number;
  readonly shieldDamageTaken: number;
  readonly leakDamage: number;
}

export interface WaveBalanceSummary {
  readonly battlefieldId: BattlefieldId;
  readonly waveNumber: number;
  readonly actualSpawnCount: number;
  readonly spawningStartTick: number | null;
  readonly spawningEndTick: number | null;
  readonly deaths: number;
  readonly leaks: number;
  readonly peakConcurrentMonsterCount: number;
  readonly peakPlayerSentOverlap: number;
  readonly peakTotalBattlefieldPressure: number;
}

export type MatchCompletion = 'result' | 'tick_guard';

export interface MatchSummary {
  readonly seed: string;
  readonly configVersion: string;
  readonly finalTick: number;
  readonly finalWave: number;
  readonly completion: MatchCompletion;
  readonly winnerId: PlayerSlot | null;
  readonly outcome: 'win' | 'draw';
  readonly reason: string;
  readonly commandLog: readonly string[];
  readonly eventLog: readonly string[];
}

export interface BalanceSimulationResult {
  readonly match: MatchSummary;
  readonly players: Record<PlayerSlot, PlayerBalanceSummary>;
  readonly towers: readonly TowerBalanceSummary[];
  readonly monsters: readonly MonsterBalanceSummary[];
  readonly waves: readonly WaveBalanceSummary[];
  readonly samples: readonly BalanceTimeSample[];
  readonly finalStateHash: string;
}

export interface BalanceScenario {
  readonly id: string;
  readonly p1Controller: ControllerProfile;
  readonly p2Controller: ControllerProfile;
}
