# LOWTOWN Gameplay Roadmap

Gameplay is the priority track. AI-driver research and tuning are maintained separately in `LOWTOWN_AI_ROADMAP.md` and are not part of the gameplay milestone unless explicitly requested.

## Prototype 0.2

Ship in this order:

1. **Static world collision**
   - Player vehicle collides with buildings and curbs.
   - Visual road geometry and collision geometry use the same world coordinates.
   - Collision response is stable and does not fight player control.

2. **Three chained jobs + simple economy/score**
   - Job 1 completes and unlocks Job 2.
   - Job 2 completes and unlocks Job 3.
   - Job 3 completes the prototype chain.
   - Each job has a clear trigger, destination/goal, completion condition and reward.
   - Money/score changes are visible and deterministic.

3. **One persistent save state**
   - Progress and economy/score survive a page reload through `localStorage` or equivalent browser persistence.
   - Reset remains available for starting a fresh prototype state.

4. **Scripted pedestrian/police reactions**
   - Add 1–2 deterministic reactions tied to gameplay events, not autonomous-driver research.
   - Reactions have explicit triggers and bounded state changes.

5. **Gameplay CI smoke test**
   - A headless smoke test must complete Job 1 -> Job 2 -> Job 3.
   - The build fails if any transition or completion condition cannot be reached.

## Guardrails

- Top-down world view is authoritative for gameplay presentation.
- Rendering, player movement, traffic, pedestrians, collisions and mission targets share one world-coordinate contract.
- Do not add further AI-driver features before Prototype 0.2 gameplay ships.
- Do not weaken tests to make CI pass.
- Empty GitHub issues require an explicit scope/acceptance-criteria comment and confirmation before implementation.
