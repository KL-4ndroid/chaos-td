# ADR-002｜Data-Oriented Entities

- Status：Accepted
- Date：2026-07-20

## Context

每塔每怪子類別會造成大量重複、難序列化與難重播。

## Decision

- Tower／Monster 使用 Serializable State。
- 差異由 Definition、Role、Behavior Field、System 決定。
- 不建立 `ArcherTower extends Tower` 類別樹。

## Consequences

內容主要加 Data；Replay 容易。特殊單位優先建立明確 Behavior Module，不回到深繼承。
