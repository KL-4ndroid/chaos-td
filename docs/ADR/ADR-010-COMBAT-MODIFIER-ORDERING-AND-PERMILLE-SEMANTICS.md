# ADR-010｜Combat Modifier Ordering and Permille Semantics

- Status：Accepted
- Date：2026-07-29

## Context

The prior combat implementation mixed the `bonusDamagePermille` name with a total multiplier value. Resistance tags also reused armor, so physical and magic resistance did not have independent data meaning.

## Decision

- `bonusDamagePermille` is additional damage. `500` means +50% and resolves as `floor(rawDamage * (1000 + bonusDamagePermille) / 1000)`.
- Armor is physical-only and resolves after physical resistance.
- `physical_resist` and `magic_resist` only reduce their matching damage type and use `physicalResistancePermille` and `magicResistancePermille` from the monster definition.
- Pure damage ignores type resistance and armor.
- Shield absorbs remaining post-reduction damage before HP.
- Splash resolves the complete sequence separately for each splash target, including that target's bonus tag check.
- The complete order is Base Damage → Tag Bonus → Type Resistance → Physical Armor → Shield → HP.

## Consequences

Combat values remain data-driven, deterministic, and independently unit-testable. This decision sets a contract only; it does not rebalance Wave difficulty.
