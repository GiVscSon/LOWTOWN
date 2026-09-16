# LOWTOWN Geometry Diagnostics Baseline

## Purpose

`world_geometry_diagnostics.js` is read-only. It does not alter rendering, collision, `isLand`, `CITY_ROADS`, navigation, AI, or bridge behavior. Its only job is to expose disagreements that currently remain hidden by smoke tests.

## Report fields

- `explicitIntersections`: road vertices that share exactly the same coordinate across different roads.
- `proximityCandidates`: vertices from different roads at distance `< 90`, excluding exact matches. These are candidates for legacy `buildCityGraph()` proximity links, not legal junctions.
- `bridgeEndpointBindings`: for each endpoint of each bridge, the nearest CITY_ROADS node and distance.
- `buildingRoadConflicts`: building rectangles whose corner enters a road corridor of `CARRIAGEWAY_WIDTH / 2 + CURB_MARGIN`.

## Baseline expectations

- Downtown grid has explicit intersections at matching road coordinates.
- HARBOR_LINK `(640,160)` is close to the Eastern/Market grid at `(640,80)` but is not an exact junction.
- NORTH_BRIDGE is expected to reveal at least one endpoint farther than 90 units from a city-road node.
- Conflict rows are diagnostics, not immediate proof that every rectangle blocks a road: the first version deliberately errs toward reporting candidates for manual spatial review.

## Use before every geometry patch

1. Run the diagnostic contract.
2. Save the JSON report as CI artifact.
3. Review newly introduced proximity candidates, unbound bridge endpoints, and building-road conflicts.
4. Convert intended connections into explicit `junctionId` records; do not raise a distance threshold.
5. Delete legacy proximity linking only after all required intended joins have explicit replacements.
