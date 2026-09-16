# LOWTOWN Geometry Diagnostics Baseline

## Purpose

`world_geometry_diagnostics.js` is read-only. It exposes the same geometry contract used by runtime road topology, collision and world-support checks.

The authoritative pipeline is:

`CITY_ROADS → real segments → geometric intersections → road corridors → world/collision/navigation adapters`

## Report fields

- `explicitIntersections`: road vertices that share exactly the same coordinate across different roads.
- `unmarkedIntersections`: real segment crossings that are not declared by shared road vertices and are not grade-separated.
- `allowedIntersections`: grade-separated segment crossings retained as diagnostic information but not connected as normal junctions.
- `proximityCandidates`: vertices from different roads at distance `< 90`, shown only as a legacy-risk diagnostic. Distance alone never creates a junction.
- `bridgeEndpointBindings`: nearest authoritative road node for each bridge endpoint.
- `buildingRoadConflicts`: full building footprint vs road-corridor conflicts using the per-road collision width.
- `roadCorridorGaps`: sampled points inside a road support corridor that are not recognized as land.
- `bridgeCorridorGaps`: sampled points inside a bridge deck corridor that are not recognized as supported land/bridge.

## Geometry contract

- Road width is derived per road from `road_constants.js` through `road_geometry.js`.
- Vehicle containment uses the same per-road collision corridor.
- Bridge `width` means total deck width. Corridor checks use `width / 2`.
- Bridge rendering follows the complete declared polyline, not a straight endpoint-to-endpoint shortcut.
- Buildings must not intersect a carriageway corridor.
- Non-grade-separated road segments may only cross at declared road vertices.
- Grade-separated crossings are detected but do not create normal road junctions.
- Runtime topology is adapted from the independent geometry authority rather than from a procedural grid.

## Baseline expectations

- `unmarkedIntersections.length === 0` for the authored city.
- `buildingRoadConflicts.length === 0` for the authored building layout.
- `roadCorridorGaps.length === 0` for the authored city.
- `bridgeCorridorGaps.length === 0` for the authored bridges.
- Both bridge endpoints bind exactly to CITY_ROADS nodes.
- Legacy proximity candidates may exist as diagnostic observations, but they must never become graph links.

## Negative coverage

`tests/global-geometry-contract.mjs` deliberately constructs broken in-memory geometry for:

1. road-through-building,
2. road-into-water,
3. undeclared segment crossing,
4. displaced bridge endpoint,
5. inconsistent lane width,
6. inconsistent sidewalk offset,
7. forbidden proximity-only link.

Each defect must fail its corresponding invariant. These cases never modify the real map.
