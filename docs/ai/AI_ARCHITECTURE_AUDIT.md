# AI Architecture Audit

## Scope

Audit baseline: `main` at `ccfafac`. This document defines the P1.6 starting point; it does not change gameplay balance or create a second simulation.

## Formal AI Sources

- `packages/game-core/src/ai-runner.ts` exports the current runtime entrypoints: `createAIStates`, `processAIDecision`, and `updateAIState`.
- `packages/game-core/src/ai-core.ts` defines `AIState`, decision cadence, `calculateLaneThreat`, and the current rule-based scoring helpers.
- `packages/game-core/src/commands.ts` defines the only gameplay output contract: `GameCommand`.
- `packages/game-core/src/simulation.ts` is the authoritative command validator and state transition engine.

The P1.6 policy runtime must produce `GameCommand` values only. It may never mutate `SimulationState`, lane runtime state, player state, entities, queues, or PRNG state owned by the simulation.

## Existing Adapters

- `packages/balance-sim/src/runner.ts` independently adapts `processAIDecision()` into `GameCommand` values for both controller slots.
- The client adapter is not part of this baseline. The P1.6 runtime adapter therefore belongs in a headless package and must be used by both balance and training code before client integration.
- The existing adapters duplicate decision-input extraction and command conversion. P1.6 must extract one shared headless policy adapter.

## Observation Contract

A policy may observe the passed tick-start `SimulationState` only:

- Its own HP, Gold, Income, towers, queue, active monsters, and battlefield wave runtime.
- Public opponent state: HP, Gold, Income, visible towers and levels, active monsters, and queue pressure.
- Public immutable game-data definitions, map geometry, and current/past domain events supplied by the caller.

A policy must not read unsubmitted commands, future wave outcomes, any simulation PRNG state, opponent policy PRNG state, replay future events, a hidden strategy ID, or runtime handles. The P1.6 training adapter will receive the same tick-start snapshot for both policy decisions, then submit a deterministically sorted batch.

## Legal Action Contract

Legal actions map one-to-one to `build_tower`, `upgrade_tower`, `sell_tower`, `queue_monster`, or wait. Candidate generation may rule out obviously impossible actions using the tick-start snapshot, but `Simulation.step()` remains final authority and records acceptance or rejection through domain events.

## Determinism and Replay

- The simulation uses integer ticks and fixed-point values.
- `packages/game-core/src/prng.ts` provides versioned Mulberry32 state. Training uses only derived seeded streams; never `Math.random()`, time, browser timers, or frame delta.
- `packages/game-core/src/canonical.ts` computes canonical state hashes; replay utilities preserve seed, config version, ordered events, checkpoints, and final hash.
- Representative and failed training replays will store only accepted commands plus required checkpoints. Full event logs are opt-in and are not retained for every training match.

## Slot Fairness and PRNG Risks

Existing P1.5 regressions establish symmetric normal-AI scenarios. P1.6 must preserve this by creating independent policy runtime states and PRNG streams for p1 and p2. Decisions must be derived before either same-tick command is submitted. Batch sorting is semantic, using action kind and normalized mirrored action keys, never implicit player iteration order. Slot-swapped evaluation is mandatory.

## Current Limitations

- The formal normal AI has a small state and static tower/monster preferences.
- `createAIStates()` currently seeds both players identically and has no explicit strategy version.
- Existing `processAIDecision()` does not represent sell actions or semantic content coverage.
- Client and balance paths do not yet share one policy command adapter.
- Current role metadata supports `single_target`, `splash`, `slow`, and `heavy_hit`; anti-air and anti-boss are derived from attack targets and bonus tags.

## Reusable Modules

- `game-core`: simulation, command types, PRNG, canonical hashing, domain events, replay utilities, path geometry.
- `game-data`: immutable tower and monster definitions, tower roles, attack targets, damage type, monster movement type, monster tags, map build cells, config version.
- `balance-sim`: deterministic lane construction and match telemetry patterns.

## New Shared Modules

P1.6 adds a headless `packages/ai-strategy` workspace. It owns versioned strategy schemas, canonical serialization, feature extraction, legal candidate generation, scoring, opening preferences, policy command conversion, and frozen strategy selection. It depends on game-core and game-data, never the client.

A separate `packages/ai-training` workspace owns development-only self-play, evolutionary operations, ratings, reports, and compatibility checks. Runtime client code will import only validated frozen strategies and the lightweight policy adapter.

## Content Compatibility Risks

New towers may add roles, attack targets, damage types, or bonus tags. New monsters may add movement types or tags. Feature extraction must derive coverage from definitions rather than exhaustive tower IDs. Unsupported semantic values must produce an explicit compatibility result, not silently be treated as a known counter. Existing frozen pools need re-evaluation, not automatic invalidation, after compatible content changes.
