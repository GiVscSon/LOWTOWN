# LOWTOWN AI integration gate

The AI Driver is the primary autonomous driving brain in the browser game. Validation is layered rather than relying on a single judge.

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
