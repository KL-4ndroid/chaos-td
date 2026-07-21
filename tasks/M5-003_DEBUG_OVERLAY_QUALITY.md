# M5-003｜Debug Overlay and Quality

## Status

- [ ] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

實作調試覆蓋層和品質改進功能。

## Required Reading

- `docs/08_CLIENT_UX_SPEC.md`

## Dependencies

M4 Gate Passed

## In Scope

- Debug overlay (FPS, tick, state hash)
- Reduced motion support
- Console error prevention
- Performance optimization

## Out of Scope

- Production profiling tools
- Crash reporting
- Memory leak detection

## Acceptance Criteria

- [ ] Debug overlay toggleable
- [ ] Reduced motion respected
- [ ] No console errors
- [ ] Render FPS independent of simulation

## Verification

```bash
npm run test
npm run typecheck
npm run lint
```
