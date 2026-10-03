# LOWTOWN in Three.js and as a PWA

The default renderer uses Three.js 0.185.1 and WebGL. It reads the same city,
vehicle, resident, incident and weather state as the driving simulation. The
radar, city map, garage, save data, keyboard and touch controls continue using
that state. `?renderer=canvas` selects the original renderer, and an unavailable
WebGL context automatically selects it.

The Three scene includes the authored coastlines, roads and crosswalks, curved
motor bridges and wooden footways, parks, piers, runways, buildings, rooftop
equipment, signs, trees, stops, shelters, lamps and cranes. Road markings use
the shared street union, so crossings do not receive overlapping centre lines.
Bridge curve radii stay within the actual overlapping collision decks; their
parapets run along the sides and keep both entrances open.

Land vehicles reuse the existing original polygon models, including their
wheels, glass and service equipment. Each becomes one vertex-colored mesh;
geometry is cached rather than reconstructed during turns. Aircraft and boats
have separate models. Residents are instanced with a walking gait and a prone
pose after a knockdown. Dynamic bins, hydrants, incident wrecks and collectible
parts update from the live simulation. Rain, fog, wind in tree crowns,
headlights, wetness, lightning and fire/smoke follow current weather/incidents.

Static buildings, windows, trees, street furniture and markings are batched.
Rendering resolution is capped at 1.5 device pixels per CSS pixel and can fall
to half resolution under sustained load; software WebGL starts at that level. Nearby
scenery queries also reduce the simulation's collision and walking search
cost. This does not establish a frame-rate guarantee for every phone.

## Install and launch offline

Open the published game over HTTPS. On supported Chromium browsers, use
**Установить** when the browser offers installation, or its **Install app /
Add to Home screen** menu. On iOS, use Safari's **Share → Add to Home Screen**.
The manifest requests a standalone landscape application. Browser and OS
policies determine whether orientation is enforced.

The build emits raster 192×192 and 512×512 icons and a worker containing all
hashed application assets. Its first installation caches a complete release;
an additional online reload is not required before an offline restart.
Wait for the initial download to finish before disconnecting. Saves remain in
the same browser-origin local storage.

Each release has a separate cache version. Updates install a complete bundle
before exposing **Обновить**; pressing it saves progress and activates the new
worker. The cache and worker scope follow the deployment subdirectory.

## Verification

- `npm run build`
- `npm run test:three-pwa-contract`
- `node tests/three-city-geometry.mjs`
- `node tests/spatial-collision-regression.mjs`
- `npm run test:three-pwa-browser`
- `npm run test:aerial-visual`
- Existing vehicle, street, resident and emergency-response checks.

The browser check requires live Three frames, decoded install icons, first-load
worker installation, a network-disconnected reload and preserved save data.
The city geometry check also verifies every visible bridge edge against the
actual road-support surfaces, rather than just inspecting a curve in isolation.
