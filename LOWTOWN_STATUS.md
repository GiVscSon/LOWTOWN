# LOWTOWN

## Vertical prototype 0.1

- GitHub read/write access verified.
- Vite project is present and configured with `npm run build`.
- Canvas-based isometric night city is playable.
- Car driving, follow camera, mission marker and job completion are implemented.
- World data is separated into `src/game/world.js`.
- Autonomous AI driver uses route planning, multi-horizon prediction, traffic prediction, tactical overtaking, avoidance and recovery.
- Autonomous smoke tests run headless in CI and publish telemetry artifacts.
- A black-box flight recorder captures the run timeline, decisions, hazards, near misses, contacts, recoveries and context immediately before important events.
- Black-box analysis converts observed failures into findings such as late avoidance, harsh braking, steering oscillation and recovery load.
- CI build and autonomous validation are configured in `.github/workflows/build.yml`.

## Next gameplay layer

Expand autonomous exploration memory and district diversity, then use black-box findings to tune driving policy. Continue with richer traffic interactions, police, mission chains and persistent world state.
