# Offline Self-play AI Strategy Plan

## Guardrails

P1.6 uses the official game-core simulation and `GameCommand` API. Training is headless, deterministic, replayable, and never runs inside Phaser. Runtime strategies are frozen, versioned data and never learn during a player match. No game-data balance values are changed.

## Execution Order

1. Define and validate canonical `AIStrategyGenome` data.
2. Extract semantic features and generate scored legal action candidates.
3. Add opening preferences that defer to live scoring when no longer applicable.
4. Run independent policy runtimes through a same-snapshot, deterministic command batch self-play loop.
5. Evaluate Elo, reliability, slot adjustment, timeout behavior, participation, and diversity.
6. Evolve bounded genomes and retain representative hall-of-fame entries.
7. Validate, deduplicate, and freeze runtime opponents.
8. Select frozen opponents deterministically by match seed and requested tier.
9. Check frozen strategy compatibility against content semantics.

## Package Boundaries

- `@chaos-td/ai-strategy`: production-safe strategy schema, validation, policy features, scoring, opening books, frozen-pool loader, selector, and compatibility API.
- `@chaos-td/ai-training`: development-only league, mutation, crossover, fitness, Elo, hall of fame, report generation, and training CLI.
- `@chaos-td/game-core`: remains the only simulation and command authority.

## Policy Contract

Numeric genome values are integer permille or bounded integer scores. Canonical serialization emits fields in a declared order. A strategy identifies its schema, strategy version, compatible content version, and optional opening book. Validation rejects missing fields, non-finite numbers, unsupported schemas, and incompatible content versions.

## Observation Contract (ADR-011)

**Formal AI uses public-information parity. Exact opponent Gold and Income are hidden.**

- Policy functions (`scoreAIAction`, `selectAIAction`, `generateLegalActions`) accept `AIObservation`, never `SimulationState`.
- `buildAIObservation(playerId, BuildObservationInput)` is the single shared builder entry point for all consumers (balance sim, self-play, client adapter).
- `SelfAIObservation` includes precise HP, Gold, Income, towers, send queue, role coverage.
- `PublicOpponentObservation` includes HP, visible tower type/level/position, coverage, pressure. Exact opponent Gold and Income are excluded.
- `OpponentEconomyEstimate` is reserved (all fields zero / `hasEstimate: false`); no estimator implemented in v1.
- Training Evaluator may read full `SimulationState`; Policy Runtime never receives it.
- `leak-prevention.test.ts` verifies opponent Gold/Income changes do not affect observation or decisions.

## Self-play Contract

Each tick the trainer builds an `AIObservation` from the simulation state for each player. Both policies receive sanitized `AIObservation` (never raw `SimulationState`). Converted commands are accumulated before submission, then sorted by a symmetric normalized action key. The simulation validates all commands. Runtime state updates occur only in the policy runtimes after decision creation. Each player has independent seeded PRNG state.

## Training Configurations

- CI smoke: population 16, generations 2, seeds 3.
- Local initial: population 64, generations 10, seeds 30.
- Larger runs are opt-in after initial performance measurement.

## Frozen Runtime Contract

Training populations, checkpoints, hall-of-fame history, and mutation operators are never imported by the client runtime. A frozen pool contains only validated strategies, behavior fingerprints, ratings, tiers, archetypes, evaluation summaries, and final validation hashes. Selector output is reproducible from match seed and uses no player-slot value as an input.

## Validation and CI

`npm run ai:check` executes deterministic smoke training, slot swap checks, schema validation, frozen pool loading, and selector tests. `npm run ai:train`, `npm run ai:evaluate`, and `npm run ai:compatibility-check` run local development workloads. Generated checkpoints and large raw runs remain ignored; a small deterministic smoke baseline, candidate pool, hall-of-fame schema, summaries, and report are committed.

## Human Decisions Deferred

P1.6 will stop only for product decisions: public opponent information policy, visible skill tiers, acceptable local CPU budget, repetitive but high-Elo behavior, final frozen pool admission, player-experience exclusions, or retraining after future content changes.
