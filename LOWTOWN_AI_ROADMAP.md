# LOWTOWN AI driver roadmap

This document is the isolated AI-driver/testing track. It does **not** define the gameplay priority. Gameplay work is tracked in `ROADMAP_GAMEPLAY.md`.

## Gate

1. Build must pass.
2. Navigation, safety, diagnostics and expansion smoke tests must pass.
3. Deterministic scenario generation must produce reproducible, diverse suites.
4. Scenario benchmark must pass.
5. Browser autopilot must demonstrate real position movement, speed, route decisions and bounded collisions/recovery.
6. Black Box telemetry remains an independent observer and is not part of the driving control loop.

## Scale

The scenario generator creates reproducible suites from a seed and supports 1,000+ combinations covering traffic density, lead speed, obstacle timing, curvature, target distance, spawn offsets, pedestrian density, overtaking pressure and recovery conditions.

## Integration principle

`AI Driver -> safety/prediction -> game physics` is the control path.

`Black Box -> analysts -> benchmark` is the evaluation path.

The evaluator must not secretly steer the vehicle or replace failures with synthetic success.

## Work policy

- Do not spend a work session on this track unless explicitly requested.
- Gameplay has priority until `ROADMAP_GAMEPLAY.md` Prototype 0.2 ships and reaches parity with the gameplay layer described by the project status.
- AI-driver tests may continue to run in CI as regression protection, but they are not a reason to expand AI-driver scope during gameplay work.
