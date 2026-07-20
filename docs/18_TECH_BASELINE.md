# 18｜Technology Baseline

**核對日期**：2026-07-20  
**用途**：M0 建議，不取代 Lockfile。

## 1. 基線

| Tool | Baseline |
|---|---|
| Node.js | 24.x LTS |
| npm | Node 24 支援版，Lockfile v3 |
| Phaser | 4.2.1 |
| Vite | 8.1.x |
| TypeScript | 6.0.x |
| ESLint | 10.x Flat Config |
| Prettier | 3.x，M0 固定精確版 |
| Vitest | 4.1.x |
| Playwright | M5 固定當時穩定版 |
| Zod | M0 固定當時穩定版，只用邊界驗證 |

## 2. 政策

- Lockfile Commit，CI 用 `npm ci`。
- Major Upgrade 需 ADR。
- Minor／Patch 不混入無關 Task。
- Phaser 4 若 M0 有實際阻塞，先記錄、建 ADR，才可降 Phaser 3.90.x。
- 不以 `latest` 作可重現規格。

## 3. 官方來源

- `https://phaser.io/download`
- `https://vite.dev/blog/announcing-vite8-1`
- `https://vite.dev/guide/`
- `https://nodejs.org/en/about/previous-releases`
- `https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html`
- `https://eslint.org/blog/2026/02/eslint-v10.0.0-released/`
- `https://eslint.org/docs/latest/use/configure/migration-guide`
- `https://vitest.dev/blog/vitest-4-1.html`

## 4. M0 驗證

- Node 24 執行 Workspace Scripts。
- Phaser 4＋Vite 8 啟動／Build。
- TypeScript 6 Strict 無 Deprecated Config。
- ESLint 10 Flat Config 可 Lint TS。
- Vitest 4.1 可測 ESM Workspace。
- Windows Path／Shell 正常。
