# Legacy Migration Map

舊文件只作歷史參考，不得直接實作。

| Legacy | v2.0 |
|---|---|
| SPEC.md | Project Charter＋Product Scope |
| GAME_DESIGN.md | Core Rules＋Balance＋Deferred |
| TECH_ARCHITECTURE.md | Technical Architecture＋ADR |
| API_SPEC.md | Multiplayer Phase 2；其餘 Deprecated |
| ASSET_SPEC.md | Asset Pipeline |
| PROJECT_ROADMAP.md | Roadmap＋Tasks |
| PROJECT_CONFIG.md | Tech Baseline＋M0-001 |
| README.md | 新 Root README |

## 淘汰

- MVP 同時做 Roguelike、Idle、PvP。
- Client 提交 Gold Earned／Match Result。
- Socket.IO＋Colyseus 重複。
- 每塔／怪一個繼承子類。
- 大量預建 Scene／Manager 空殼。
- ESLint `.eslintrc`。
- Phaser 3.88／Vite 5／TypeScript 5.3 舊初始化。
