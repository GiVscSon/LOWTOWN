# Live vehicle physics, weather and street presentation — 2026-10-01

The live controller now sweeps rotating oriented chassis along each frame's movement, exchanges inelastic normal momentum using body mass, preserves sliding along walls, and lets parked cars, fleet vehicles, incident wrecks and dumpsters move. Ground and water use separate contact layers. Low aircraft share ground contacts; airborne aircraft do not hit street actors. The small-object broadphase uses the full chassis radius. Repeated projection handles cars squeezed against fixed geometry; nearby spatial cells keep populated-city contact checks bounded.

Actual pedestrian contact applies knockdown, health loss and a recovery delay, including the player on foot. Traffic anticipates pedestrians, and intentional player impacts raise wanted level. Dumpsters remain visible and solid when pushed; hydrants break on a sufficient chassis impact, rather than mere centre proximity. Bridge rails use full-body contacts.

Weather cycles smoothly through clear, haze, rain, storm and fog; the HUD weather button selects the next condition. Rain changes live braking and lateral grip, with gradual wetting/drying. Screen rain, ripples, drifting fog, gusts, swaying trees, spray, exhaust and fire flames/smoke/embers are bounded visual effects. Roof equipment scales to each roof and is clipped to the roof footprint. Signs fit one-storey facade heights and civic/service plaques match their building purpose. Precinct release requires a complete sampled walking connection to a street.

Validation uses the live source/controller and production browser. The in-game AutoTest button was not used:

- `test:vehicle-momentum`: 30/60/120 Hz pushing, momentum by mass, truck nose versus small props, high-speed thin-wall contact, glancing slides, a three-car pile-up at a wall, player-on-foot contact, actual city pushing and pedestrian knockdown/recovery.
- `test:world-driving-weather`: 117 non-service motor street/bridge segments, 234 drives in both directions, 468,761 world units, all 16 islands; no stuck/drowning runs. All 24 motor bridges are covered. This isolates transient traffic to measure static route geometry; populated traffic and responders are checked separately.
- `test:movement-stability`: populated emergency arrivals, work and base returns, including captured junction deadlocks, an ambulance ahead of a fire engine, and a returning police car yielding at the curb, with full-body safety checks.
- Production browser with real keyboard input: parked sedan moved about 55 units; movable bin moved about 198 units; pedestrian knocked down; five weather states; walk about 339 units away from the precinct. No page errors. This is a deterministic local scene, rather than proof that arbitrary gameplay has no collisions.

The two new acceptance scripts run in both Build and Sandbox Gameplay Gates. Existing controls, live traffic, custody, authored-world geometry and rendering checks remain enabled.

Vehicle source images: the original 19-model, 304-view SVG pack is connected to the garage preview; earlier six side-profile SVGs remain available as legacy sources. The official Kenney eight-direction CC0 archive was inspected; using it on the road would require a calibrated rotation atlas and a deliberate change from smooth to stepped body headings. See `ASSET_SOURCES.md`.
