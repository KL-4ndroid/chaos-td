# M5-001｜Replay System

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

實作完整的回放系統，支援重播匯出、匯入、與完整重現。

## Required Reading

- `docs/02_CORE_GAME_RULES.md`
- `packages/game-core/src/simulation.ts`

## Dependencies

M4 Gate Passed

## In Scope

- Replay event capture
- Replay serialization format
- Replay import and playback
- Hash checkpoint verification

## Out of Scope

- Server-side replay storage
- Replay compression
- Multiple replay formats

## Acceptance Criteria

- [ ] Replay captures all game events
- [ ] Replay can be exported to JSON
- [ ] Replay can be imported and replayed exactly
- [ ] Hash checkpoints verified

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
