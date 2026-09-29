# LOWTOWN world and transport pass — 2026-09-27

The images in this directory are rendered by the actual game Canvas functions using @napi-rs/canvas. They are not generated concept art and are not screenshots of a browser session. DOM layout, Web Audio and actual browser frame rate are outside this evidence.

Implemented:

- Corrected the two eastern district road offsets and adjusted their building parcels; all sixteen developed districts have a connected road path.
- Added 23 rounded terminal courts; endpoints are attached to another road, a bridge or a court. Retained 24 usable bridges and 16 curved waterfront lanes.
- Added seven irregular natural islets, varied mainland coves/capes, denser waterfront vegetation, physical piers and small sea wavelets.
- Assigned all 108 pedestrians to clear sidewalk or park routes. Stationary figures retain fixed body scale. Ordinary cars passing on the road no longer trigger sidewalk panic.
- Corrected walking to match screen directions. Checked real keyboard and touch handlers, exit, return, throttle, steering and focus loss.
- Preserved vehicle appearance and health when parking/boarding; van, truck and bike keep their own models when driven. Added different acceleration/steering profiles and more visible body height, motorcycle rider, helicopter skids/rotor and aircraft details.
- Added roof clearance during flight and descent. Boats collide with shore/pier geometry and can pass below bridge decks.
- Police spawn attempts are bounded and follow the connected road graph.
- Added brick joints/sills, subdued amber signs, upright lamps/billboards, volumetric trees and furniture, and shared depth ordering of buildings, vehicles and actors.

Verification:

- `node tests/huge-world-smoke.mjs`: 16 districts, 7 natural islets, 24 bridges, 141 road rectangles, 232 buildings, 24 parks, 23 terminal courts; zero road/building intersections, zero unfinished road ends, every district connected.
- `node tests/human-controls-regression.mjs`: keyboard/touch input, screen-relative walking, exit/entry, all eight transport profiles, actual boat passage below a bridge, helicopter takeoff/landing, roof descent guard, police on-road motion.
- `node tests/live-traffic-regression.mjs`: 61 cars, 1,800 fixed steps (30 game seconds); zero water samples, zero off-road centre samples, zero nonfinite states, zero pedestrian/scenery overlaps; player collision damage observed. Signals advance with simulated time.
- `node tests/private-drive-smoke.mjs`: 8 route segments over 46.9 game seconds, no collisions or drowning on the accepted route; respawn passes.
- `node tests/traffic-turns-regression.mjs`, `node tests/pedestrian-motion-regression.mjs`, `node tests/free-roam-render-smoke.mjs`: passed.
- Production Vite build: passed.

Known limits:

- The primary district arrangement still follows an orthogonal metropolitan grid. A geographically irregular district layout requires a subsequent change to placement and traffic routing.
- BrowserAct's command daemon failed to become ready. No live browser screenshot or real-device FPS claim is made. The private Site's authentication was not changed.
- GitHub main and the private Sites engine have different entrypoints. This pass updates the private Sites engine; it does not replace the GitHub gameplay branch.
