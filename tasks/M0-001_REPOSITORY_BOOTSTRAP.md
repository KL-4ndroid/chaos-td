# M0-001｜Repository Bootstrap

## Status

- [x] Ready
- [ ] In Progress
- [ ] Blocked
- [ ] Done

## Goal

建立可在 Windows 與 CI 執行的 npm Workspaces 骨架，讓 Client、Core、Data、Shared、Fixtures 可獨立 Typecheck／Test／Build。

## Required Reading

- `docs/01_PRODUCT_SCOPE.md`
- `docs/06_TECHNICAL_ARCHITECTURE.md`
- `docs/10_TEST_STRATEGY.md`
- `docs/18_TECH_BASELINE.md`
- `docs/ADR/ADR-004-NPM-WORKSPACES.md`
- `docs/ADR/ADR-005-PHASER-4-BASELINE.md`
- `.cursor/rules/chaos-td.mdc`

## Dependencies

無。

## In Scope

- Root npm Workspace。
- `apps/client`。
- `packages/game-core`、`game-data`、`shared`、`test-fixtures`。
- TypeScript 6 Strict。
- ESLint 10 Flat Config。
- Prettier、Vitest。
- Phaser 4.2.1＋Vite 8.1。
- 空白 Phaser Scene。
- Root Scripts、Basic CI、Smoke Test。

## Out of Scope

遊戲規則、Map、Tower、Monster、Server、DB、UI Framework、Monorepo Orchestrator、正式資產。

## Required Scripts

```text
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Acceptance Criteria

- [ ] `npm ci` 成功。
- [ ] Lint、Typecheck、Test、Build 成功。
- [ ] Client 顯示 Phaser 空白畫布與版本。
- [ ] game-core Dependency 無 Phaser／DOM。
- [ ] TypeScript 不依賴已廢棄 `baseUrl`。
- [ ] 使用 `eslint.config.mjs`。
- [ ] Lockfile Commit。
- [ ] CI 使用 `npm ci`。
- [ ] 無大量未使用 Scene／Manager／Entity。
