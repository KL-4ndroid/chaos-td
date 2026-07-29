# Balance Simulation Report

## Measured Facts

- Mode: smoke
- Seeds: 3
- Scenarios: 4
- Matches: 12
- Final tick range: 800-800
- Outcomes: draw=12
- Every reported source is explicit: system wave monsters use `wave`; queued opponent sends use `player`.

## Derived Metrics

- Determinism checks: medium-vs-medium, aggressive-vs-defensive, defensive-vs-aggressive, none-vs-none.
- Machine-readable output includes sampled HP, Gold, Income, command acceptance, per-level tower combat, monster source attribution, and per-battlefield wave telemetry.
- System-wave equality, non-negative gold, final state hashes, command logs, event logs, and summaries are technical invariants.

## Balance Warnings

- A smoke run ends at its configured tick guard; its outcome distribution is not a full-match balance conclusion.
- Results measure controller behavior, not an automatic balance decision.
- Tower and monster effectiveness should be reviewed across full scenarios before modifying data.

## Human Decisions Required

- Define acceptance thresholds for outcome distribution and slot fairness after representative profile runs.
- Review full-length Wave 1-30 telemetry before changing tower, monster, economy, resistance, or wave values.
