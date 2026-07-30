# AI Architecture Audit

## Observation Contract

**Formal AI uses public-information parity. Exact opponent Gold and Income are hidden.**

The policy layer accepts `AIObservation` (defined in `packages/ai-strategy/src/observation.ts`) only. `SimulationState` is never passed to policy functions.

### Public (may observe)
- Own HP, Gold, Income, towers, send queue, active monsters, battlefield pressure
- Opponent HP (visible through their lane monsters / result)
- Opponent visible tower type, level, and position (after `tower_built` / `tower_upgraded` domain event is recorded)
- Public battlefield coverage derived from visible opponent towers: ground, flying, splash, slow, anti-boss
- Opponent active monster pressure (derived from opponent lane monsters)
- Wave number derived from tick

### Hidden (never exposed to policy)
- Exact opponent Gold or Income
- Opponent queued but not yet publicly-accepted commands
- Opponent AI state or strategy genome
- Future domain events or wave RNG outcomes
- Simulation PRNG state
- Any per-match internal randomness not derived from a seeded policy RNG

### Trainer Privilege Boundary
- **Training Evaluator** may read full `SimulationState` for: match result, Elo, fitness, diversity, invalid command rate, slot fairness, telemetry.
- **Policy Runtime** receives only `AIObservation` derived through `buildAIObservation()`.

## Observation Schema

```ts
AIObservation {
  schemaVersion: 1
  playerId, tick, phase, waveNumber
  self: SelfAIObservation { hp, gold, income, towers, sendQueueLength, roleCoverage }
  opponent: PublicOpponentObservation { hp, visibleTowers, estimatedEcon (always zero/false), coverage, pressure }
  ownBattlefield, opponentBattlefield: BattlefieldObservation
  selfActiveMonsterPressure, opponentActiveMonsterPressure, flyingPressure, bossPressure, leakRisk
  selfGroundCoverage, selfFlyingCoverage, opponentGroundCoverage, opponentFlyingCoverage
}

OpponentEconomyEstimate { hasEstimate: false, all fields = 0 }
```

## Formal AI Sources

- `packages/game-core/src/ai-runner.ts`: `createAIStates`, `processAIDecision`, `updateAIState`.
- `packages/game-core/src/ai-core.ts`: `AIState`, `calculateLaneThreat`, rule-based scoring helpers.
- `packages/game-core/src/commands.ts`: `GameCommand` — the only legal gameplay output.
- `packages/game-core/src/simulation.ts`: authoritative command validator.

## Shared Observation Builder

`packages/ai-strategy/src/observation.ts` exports `buildAIObservation(playerId, BuildObservationInput)`. This is the single entry point for both:
- `balance-sim`
- `ai-training` self-play
- Future client adapter

## Leak-Prevention Tests

`packages/ai-strategy/src/leak-prevention.test.ts` verifies:
1. Opponent Gold changes do not affect observation or decision
2. Opponent Income changes do not affect observation or decision
3. Opponent economy fields are always zero / absent
4. `toGameCommand` is the only command output path
5. Opponent visible tower info is correctly mirrored
