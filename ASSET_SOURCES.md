# LOWTOWN visual asset sources

The live city draws oriented vehicle bodies procedurally on canvas. The original SVG generator in `src/render/shared/transport_svg.js` provides 19 transport types and 16 true isometric headings for each (304 views). The garage uses these local SVGs. The earlier six side-profile drawings remain exported as `LEGACY_VEHICLE_ASSETS` in `src/assets/vehicle_icons.js`. The game does not depend on remote image hotlinks.

For the next asset expansion, these public CC0 packs are suitable references/sources:

- Kenney City Kit (Roads): https://kenney.nl/assets/city-kit-roads
- Kenney City Kit (Industrial): https://kenney.nl/assets/city-kit-industrial
- Kenney Retro Urban Kit: https://kenney.nl/assets/retro-urban-kit
- Kenney Car Kit: https://kenney.nl/assets/car-kit
- Kenney Isometric Tiles Vehicles: https://kenney.nl/assets/isometric-tiles-vehicles
- Kenney Isometric Roads: https://kenney.nl/assets/isometric-roads
- Kenney Isometric Tiles Buildings: https://kenney.nl/assets/isometric-tiles-buildings
- Kenney Isometric Tiles Landscape: https://kenney.nl/assets/isometric-tiles-landscape

All listed Kenney packs are marked Creative Commons CC0 on their official asset pages.

LOWTOWN visual target remains: grimy 1990s night city, wet asphalt, sodium lamps, concrete, chrome, industrial waterfront, restrained amber/red accents, no cute/fantasy/cyberpunk look.

## Vehicle source inspection — 2026-10-01

Downloaded and inspected the official Kenney Isometric Vehicles preview and archive (540 assets). The archive `License.txt` confirms CC0 and permits personal/commercial use. It includes ambulances, civilian body/color variants, emergency vehicles and eight horizontal directions (plus slope variants). These images are suitable for transport cards or an eight-direction sprite renderer. They are not a drop-in replacement for the current continuously rotated chassis: the world-to-screen heading, contact footprint, front orientation, painter depth and headlight anchors must be calibrated together. No Kenney PNGs have been added to the production bundle in this change.

Existing local SVGs are single side profiles, useful in the garage, rather than a complete isometric rotation atlas.

The 2026-10-01 original SVG pack includes civilian cars, taxis, buses, vans, trucks, police/SWAT/National Guard, ambulance/fire engine, motorcycle, speedboat/tug, helicopter/plane. All artwork is authored in this repository; no downloaded images are used. Projection rotates model geometry before applying roof height, keeping sprites upright. `test:transport-svg` validates all 304 views.
