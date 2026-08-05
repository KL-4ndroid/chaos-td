# AI Genome Behavior Audit

P1.6-011 audit of `AIStrategyGenome` fields. Numeric values use the 0-1000 permille scale.

| Field | Status | Feature impact | Action impact | Score / threshold | Observable behavior | Tests | Mutable |
|---|---|---|---|---|---|---|---|
| `economyWeight` | ACTIVE | Income growth opportunity | Monster send candidate | Send income value | Prefers income-generating sends when affordable | policy sensitivity, evolution | Yes |
| `defenseWeight` | ACTIVE | Leak and pressure context | Build, upgrade | Build/upgrade score | Invests in defense | policy tests | Yes |
| `aggressionWeight` | ACTIVE | Opponent pressure | Monster send | Send score | Sends more aggressively | policy tests | Yes |
| `buildThreshold` | ACTIVE | Gold and pressure | Build eligibility score | Build score threshold | Higher threshold suppresses marginal builds | policy sensitivity | Yes |
| `upgradeThreshold` | ACTIVE | Active pressure | Upgrade | Upgrade score | Changes upgrade preference | policy tests | Yes |
| `sellThreshold` | ACTIVE | Pressure | Sell | Sell score | Changes sell preference | policy tests | Yes |
| `emergencyDefenseThreshold` | ACTIVE | Leak risk and pressure | Build, upgrade | Emergency override | Critical pressure can override reserve | policy sensitivity | Yes |
| `reserveGoldRatio` | ACTIVE | Current gold | Build and send budget | Reserve amount | Retains more gold in normal conditions | policy sensitivity | Yes |
| `incomeInvestmentRatio` | ACTIVE | Income growth opportunity | Build investment | Build score | Favors economic setup while income is low | policy sensitivity | Yes |
| `sendInvestmentRatio` | ACTIVE | Available gold after reserve | Monster send | Attack budget | Controls aggressive send spending | policy sensitivity | Yes |
| `antiAirPriority` | ACTIVE | Flying pressure | Build and send type choice | Counter score | Favors anti-air responses | policy tests | Yes |
| `splashPriority` | ACTIVE | Active pressure | Build type choice | Counter score | Favors splash coverage | policy tests | Yes |
| `slowPriority` | ACTIVE | Active pressure | Build type choice | Counter score | Favors slow coverage | policy tests | Yes |
| `antiBossPriority` | ACTIVE | Boss pressure | Build type choice | Counter score | Favors boss counters | policy tests | Yes |
| `pressureTimingWeight` | ACTIVE | Active pressure | Build and send | Pressure score | Responds to pressure earlier | policy tests | Yes |
| `counterOpponentWeight` | ACTIVE | Public opponent pressure | Monster send | Counter score | Reacts to visible pressure | policy tests | Yes |
| `diversityPreference` | ACTIVE | Tower role coverage | Build type choice | Role repetition penalty | Avoids repeating covered roles | policy tests | Yes |
| `openingBookId` | RESERVED | None in v1 policy | None | None | Reserved for a future explicit opening-book contract | validation | No |

## Contract Notes

- Policy receives `AIObservation` only. Evaluators may inspect full simulation state, but never pass it to policy.
- `openingBookId` is deliberately excluded from mutation until opening-book preferences are integrated into legal action scoring with dedicated tests.
- `MUTABLE_FIELDS` is exported from the training package and is derived from the active fields listed above.
- A parameter is ACTIVE only when changing that field can change a candidate score, eligibility, or selected action under a controlled observation.
