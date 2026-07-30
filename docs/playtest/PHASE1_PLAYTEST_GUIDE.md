# Phase 1 Playtest Guide

## Environment

- Node.js 24 or later
- npm 11
- A current desktop browser with WebGL enabled

## Start

```bash
npm ci
npm run playtest
```

The client opens at `http://localhost:3000`. This is an offline local playtest: it starts no server, database, or online PvP service.

The initial seed is shown in the HUD. The match contract is fixed: p1 is Human and p2 is Normal AI. Both sides receive the same system waves on their own independent battlefields. Player sends enter the opponent battlefield.

## Play

- Click an empty cell in **YOUR DEFENSE | P1 HUMAN** and choose a tower.
- Click one of your towers to open its upgrade and sell controls.
- Use the four send controls to queue monsters against the rival. The controls show each cost.
- Press `Esc` or use `II` to pause locally.
- Press `F3` or `DBG` to open the read-only Playtest Debug panel.
- Monster labels use `W` for system wave and `P` for player send; `G` and `F` distinguish ground and flying; `B`, `S`, `PR`, and `MR` identify boss, siege, physical resistance, and magic resistance. The number is HP, with any shield shown as `+N`.

All command feedback comes from Core command result events. A rejected command is shown as `REJECTED` with the Core reason.

## Result and Restart

The result overlay reports outcome, result reason, final tick and wave, final player economy and tower counts, and final state hash. Use **RESTART SAME SEED** to reproduce the match or **RESTART NEW SEED** to start from the displayed deterministic replacement seed.
