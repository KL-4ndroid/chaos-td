# ADR-001｜Deterministic Fixed-Step Simulation

- Status：Accepted
- Date：2026-07-20

## Context

Frame Delta、Browser Background 與不同裝置會造成時間不穩。Replay、AI、Balance Sim、Server 需要同一規則。

## Decision

- Core 使用 20 TPS。
- 規則只用 Tick 與整數 Fixed-point。
- Render 插值。
- Backlog 不靜默丟棄。
- Random 使用版本化 Seeded PRNG。

## Consequences

可重播、可測、可 Server 共用；代價是需維護 Accumulator、穩定順序與動畫分離。
