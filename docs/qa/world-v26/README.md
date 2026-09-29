# LOWTOWN shoreline pass — 2026-09-28

The PNG files are frames rendered by the game's Canvas functions with `@napi-rs/canvas`; they show the current source rendering, not generated concept art.

This pass adds deterministic coastline details sampled from the actual curved shoreline polygons: broken waterline reflections, low rocks, marsh reeds, coastal scrub, and driftwood. The detail type and placement change between the developed districts and natural islets. Off-screen details are skipped during rendering.

Scenes: downtown, harbour, park, marsh islet, full map, and the transport gallery.

Verification: `node tests/huge-world-smoke.mjs`, `node tests/free-roam-render-smoke.mjs`, production Vite build, and `git diff --check` passed. The established topology remains at 16 developed districts, 7 natural islets, 24 bridges and 141 roads.

Known limits: the main district layout is still a regular grid. The coast is more articulated and its vegetation is denser, but the game remains a procedural low-poly rendering rather than matching the reference's pixel-art realism. BrowserAct continues to fail before opening a page with error 230305.
