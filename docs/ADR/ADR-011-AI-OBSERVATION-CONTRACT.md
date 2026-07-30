# ADR-011: AI Observation Contract

## Status

Accepted

## Context

The P1.6 self-play training system required defining exactly what information a runtime AI policy may observe during a match. The original implementation accepted `SimulationState` directly, which would expose all internal state including exact opponent Gold and Income — information not available to a human player through the formal game UI.

## Decision

**Formal AI uses public-information parity. Exact opponent Gold and Income are hidden from the policy layer.**

### Contract

1. **Policy API boundary**: Policy functions (`scoreAIAction`, `selectAIAction`, `generateLegalActions`) accept `AIObservation` only. They never receive `SimulationState`.

2. **`buildAIObservation`**: Single shared entry point in `packages/ai-strategy/src/observation.ts`. Converts `BuildObservationInput` → sanitized `AIObservation`.

3. **Trainer boundary**: Training evaluator may read full `SimulationState` for Elo, fitness, telemetry. It must not pass `SimulationState` into policy functions.

4. **`OpponentEconomyEstimate`**: Reserved type for future estimation; all fields are zero / `hasEstimate: false` in v1. No estimation is implemented.

5. **Opponent Gold/Income**: Hidden. Observation includes `opponent.hp` but never `opponent.gold` or `opponent.income`.

6. **Visible opponent towers**: After a `tower_built` / `tower_upgraded` domain event is recorded, the opponent's tower type, level, and cell are visible to the policy through `opponent.visibleTowers`.

7. **Leak-prevention tests**: `packages/ai-strategy/src/leak-prevention.test.ts` verifies that changing opponent Gold or Income does not change `AIObservation` or produce different AI actions.

## Consequences

- All policy code refactored to use `AIObservation` instead of `SimulationState`.
- `extractAIFeatures` renamed to `extractAIFeaturesFromObservation`.
- `AIFeatures` no longer contains `opponentGold` or `opponentIncome` fields.
- `generateLegalActions` now accepts `(obs: AIObservation, towerEntityIds: ReadonlyMap<string, number>)`.
- `toGameCommand` is the only command output path; policy never calls `submitCommand`.
- Future client adapter must use the same `buildAIObservation` entry point.
- Future balance sim updates must use `buildAIObservation` instead of direct `extractAIFeatures(state, playerId)`.
