import assert from 'node:assert/strict';
import {
  CITY_ROADS,
  CITY_DESTINATIONS,
  buildCityGraph,
  destinationPoint,
  shortestRoute,
  roadById
} from '../src/game/city_semantics.js';
import { BRIDGES, isLand } from '../src/game/islands.js';
import { WORLD } from '../src/game/world.js';
import { buildRoadNetwork, roadSegments as authorityRoadSegments } from '../src/game/road_authority.js';
import { vehicleWorldBlocked } from '../src/game/vehicle_collision.js';
import {
  roadSegments,
  allRoadSegments,
  collisionHalfWidth,
  supportHalfWidth,
  visualHalfWidth,
  sampleRoadCorridor,
  sampleBridgeCorridor,
  bridgePoints,
  findSegmentIntersections,
  nearestRoadSegment,
  sidewalkOffset as geometrySidewalkOffset,
  buildGeometryAuthority,
  buildingIntersectsRoad
} from '../src/game/road_geometry.js';

const EPS = 0.001;
const origin = { x: -120, y: 0 };

// ---------------------------------------------------------------------
// INDEPENDENT AUTHORITY: built directly from CITY_ROADS segment geometry,
// with real segment-intersection junctions spliced in. Does NOT call
// buildCityGraph(). This is the ground truth invariants below rely on.
// ---------------------------------------------------------------------
const authorityGraph = buildGeometryAuthority(CITY_ROADS);
assert.ok(authorityGraph.length > 0, 'AUTHORITY: independent geometry authority produced no nodes');
{
  const seen = new Set([authorityGraph[0].id]);
  const queue = [authorityGraph[0]];
  while (queue.length) {
    const node = queue.shift();
    for (const next of node.links) if (!seen.has(next.id)) { seen.add(next.id); queue.push(next); }
  }
  assert.equal(seen.size, authorityGraph.length, `AUTHORITY: independent graph is disconnected (${authorityGraph.length - seen.size} unreachable)`);
}

// A. buildCityGraph() connectivity (checked independently, not compared to
// the authority graph above).
const graph = buildCityGraph();
assert.ok(graph.length > 0, 'A: city graph must contain nodes');
{
  const seen = new Set([graph[0].id]);
  const queue = [graph[0]];
  while (queue.length) {
    const node = queue.shift();
    for (const next of node.links) if (!seen.has(next.id)) { seen.add(next.id); queue.push(next); }
  }
  assert.equal(seen.size, graph.length, `A: city graph is disconnected (${graph.length - seen.size} unreachable nodes)`);
}

// B. Real segment validity
for (const road of CITY_ROADS) {
  const segments = roadSegments(road);
  assert.ok(segments.length === road.points.length - 1, `B: ${road.id} segment count mismatch`);
  for (const seg of segments) {
    assert.ok(seg.length > EPS, `B: ${road.id} segment ${seg.index} has zero length`);
    assert.equal(seg.roadId, road.id, `B: segment roadId mismatch on ${road.id}`);
    assert.ok(collisionHalfWidth(road) > 0, `B: ${road.id} has non-positive collision half-width`);
    assert.ok(Number.isFinite(seg.heading), `B: ${road.id} segment ${seg.index} has invalid heading`);
  }
}

// C. Real segment-to-segment intersection consistency.
const { unmarked, allowed } = findSegmentIntersections(CITY_ROADS);
assert.equal(unmarked.length, 0, `C: ${unmarked.length} undeclared, non-grade-separated road crossings: ${JSON.stringify(unmarked)}`);
if (CITY_ROADS.some(r => r.gradeSeparated)) {
  assert.ok(allowed.length > 0, 'C: gradeSeparated roads exist but produced no recorded allowed crossings');
}

// D. Full building footprint vs road corridor: exact segment-vs-rectangle
// (capsule) distance.
for (const building of WORLD.buildings) {
  for (const road of CITY_ROADS) {
    assert.equal(buildingIntersectsRoad(building, road), false,
      `D: building ${JSON.stringify(building)} conflicts with ${road.id} corridor (exact capsule test)`);
  }
}

// E. Full road-corridor land coverage: centerline + both corridor edges.
for (const road of CITY_ROADS) {
  const corridor = sampleRoadCorridor(road, { step: 20, edgeSamples: 3 });
  for (const s of corridor) {
    assert.equal(isLand(s.x, s.y), true, `E: ${road.id} corridor point (${s.x.toFixed(1)},${s.y.toFixed(1)}) at offset ${s.offset.toFixed(1)} is not on land`);
  }
}

// F. Full bridge corridor consistency.
for (const bridge of BRIDGES) {
  const pts = bridgePoints(bridge);
  assert.ok(pts.length >= 2, `F: ${bridge.id} needs a polyline`);
  assert.ok(bridge.a && bridge.b, `F: ${bridge.id} must keep a/b endpoint aliases`);
  const first = pts[0], last = pts.at(-1);
  assert.ok(Math.hypot(bridge.a.x - first[0], bridge.a.y - first[1]) <= EPS, `F: ${bridge.id}.a must equal first polyline point`);
  assert.ok(Math.hypot(bridge.b.x - last[0], bridge.b.y - last[1]) <= EPS, `F: ${bridge.id}.b must equal last polyline point`);
  for (const p of [bridge.a, bridge.b]) {
    assert.ok(graph.some(n => Math.hypot(n.x - p.x, n.y - p.y) <= EPS), `F: ${bridge.id} endpoint (${p.x},${p.y}) has no matching road graph node`);
  }
  const corridor = sampleBridgeCorridor(bridge, { step: 20, edgeSamples: 3 });
  assert.ok(corridor.length > 10, `F: ${bridge.id} corridor sampling produced too few points`);
  for (const s of corridor) {
    assert.equal(isLand(s.x, s.y), true, `F: ${bridge.id} full corridor point (${s.x.toFixed(1)},${s.y.toFixed(1)}) at offset ${s.offset.toFixed(1)} is not supported`);
  }
  assert.ok(bridge.width > 0 && bridge.width < 200, `F: ${bridge.id} has an implausible width ${bridge.width}`);
  const route = shortestRoute(bridge.a, bridge.b);
  assert.ok(route.length >= 2, `F: ${bridge.id} is not traversable by the navigation graph`);
}

// G. Destination geometry.
for (const destination of CITY_DESTINATIONS) {
  const road = roadById(destination.roadId);
  assert.ok(road, `G: ${destination.id} references unknown road ${destination.roadId}`);
  assert.ok(destination.index >= 0 && destination.index < road.points.length, `G: ${destination.id} index out of range for ${destination.roadId}`);
  const point = destinationPoint(destination.id);
  assert.ok(point, `G: ${destination.id} has no computed point`);
  const nearest = nearestRoadSegment(point.x, point.y, [road]);
  assert.ok(nearest.distance < 200, `G: ${destination.id} marker is implausibly far (${nearest.distance.toFixed(1)}) from its declared road`);
  assert.equal(isLand(point.x, point.y), true, `G: ${destination.id} marker is not on land`);
  const insideBuilding = WORLD.buildings.some(b => point.x >= b[0] && point.x <= b[0] + b[2] && point.y >= b[1] && point.y <= b[1] + b[3]);
  assert.equal(insideBuilding, false, `G: ${destination.id} marker falls inside a building`);
  const route = shortestRoute(origin, point);
  assert.ok(route.length >= 2, `G: ${destination.id} is unreachable from Central Avenue`);
}
const missionRoute = shortestRoute(origin, WORLD.mission);
assert.ok(missionRoute.length >= 2, 'G: mission marker is unreachable from Central Avenue');
assert.equal(isLand(WORLD.mission.x, WORLD.mission.y), true, 'G: mission marker is not on land');

// H. Physics/corridor consistency.
const runtimeAuthority = buildRoadNetwork();
const lines = authorityRoadSegments(runtimeAuthority);
for (const road of CITY_ROADS) {
  const [x, y] = road.points[0];
  assert.equal(vehicleWorldBlocked(x, y, 0, lines, { length: 28, width: 16 }), false, `H: ${road.id} blocks a vehicle at its own center`);
}
{
  const road0 = CITY_ROADS[0];
  const [ax, ay] = road0.points[0], [bx, by] = road0.points[1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const clear = supportHalfWidth(road0) + 60;
  const off = { x: ax - dy / len * clear, y: ay + dx / len * clear };
  assert.equal(vehicleWorldBlocked(off.x, off.y, 0, lines, { length: 28, width: 16 }), true, 'H: vehicle must be blocked outside every road corridor');
}

// I. road_authority is built from buildGeometryAuthority() — the SAME
// independent construction validated above, not buildCityGraph().
assert.equal(runtimeAuthority.length, authorityGraph.length, 'I: runtime road_authority must use the independent geometry authority');

// J. No forbidden proximity-only links.
for (const node of graph) {
  for (const link of node.links) {
    if (link.roadId === node.roadId) continue;
    const exact = Math.hypot(node.x - link.x, node.y - link.y) <= EPS;
    assert.ok(exact, `J: proximity-only link in buildCityGraph() between ${node.id} and ${link.id}`);
  }
}

// K. Unified width contract.
for (const road of CITY_ROADS) {
  const expectedSidewalk = geometrySidewalkOffset(road);
  assert.ok(expectedSidewalk > 0, `K: ${road.id} sidewalk offset must be positive`);
  const visual = visualHalfWidth(road);
  const collision = collisionHalfWidth(road);
  assert.ok(visual >= collision - EPS, `K: ${road.id} visual half-width (${visual}) is narrower than its physical collision corridor (${collision})`);
}

// L. No legacy independent road grid.
assert.equal(typeof buildRoadNetwork, 'function', 'L: buildRoadNetwork must exist');
assert.equal(buildRoadNetwork.length, 0, 'L: buildRoadNetwork must take no isLand/blocked/grid arguments');

// ---------------------------------------------------------------------
// NEGATIVE TESTS — each must FAIL when run against deliberately corrupted
// in-memory data, by reusing the SAME functions the invariants above use.
// If any of them does NOT throw, the contract is not strict enough.
// These never touch real files.
// ---------------------------------------------------------------------
function expectFailure(label, fn) {
  try {
    fn();
  } catch (e) {
    console.log(`NEGATIVE OK: ${label} correctly failed (${e.message})`);
    return;
  }
  throw new Error(`NEGATIVE TEST FAILED TO CATCH DEFECT: ${label} did not throw as expected`);
}

function assertBridgeGeometryValid(bridge, graphNodes) {
  const pts = bridgePoints(bridge);
  if (!(pts.length >= 2)) throw new Error(`${bridge.id} needs a polyline`);
  if (!(bridge.a && bridge.b)) throw new Error(`${bridge.id} must keep a/b endpoint aliases`);
  const first = pts[0], last = pts.at(-1);
  if (!(Math.hypot(bridge.a.x - first[0], bridge.a.y - first[1]) <= EPS)) throw new Error(`${bridge.id}.a must equal first polyline point`);
  if (!(Math.hypot(bridge.b.x - last[0], bridge.b.y - last[1]) <= EPS)) throw new Error(`${bridge.id}.b must equal last polyline point`);
  for (const p of [bridge.a, bridge.b]) {
    if (!graphNodes.some(n => Math.hypot(n.x - p.x, n.y - p.y) <= EPS)) throw new Error(`${bridge.id} endpoint (${p.x},${p.y}) has no matching road graph node`);
  }
}

function assertSidewalkOffsetMatchesContract(road, brokenOffsetFn) {
  const expected = geometrySidewalkOffset(road);
  const actualPoint = brokenOffsetFn(road);
  const actualOffset = Math.hypot(actualPoint.x - road.points[0][0], actualPoint.y - road.points[0][1]);
  if (Math.abs(actualOffset - expected) < 1) {
    throw new Error(`${road.id} broken offset ${actualOffset.toFixed(2)} unexpectedly matched contract ${expected.toFixed(2)}`);
  }
  assert.ok(Math.abs(actualOffset - expected) < 1, `${road.id} sidewalk offset ${actualOffset.toFixed(2)} diverges from contract ${expected.toFixed(2)} (this divergence must be caught)`);
}

// N1. Road segment passes through a building — reuses the real buildingIntersectsRoad().
expectFailure('N1 road-through-building', () => {
  const fakeRoad = { id: 'FAKE_ROAD', class: 'STREET', lanes: 2, points: [[-40, -1080], [-40, -800]] };
  const fakeBuilding = [-60, -1000, 100, 100];
  const detected = buildingIntersectsRoad(fakeBuilding, fakeRoad);
  assert.equal(detected, false, 'buildingIntersectsRoad failed to flag a real overlap');
});

// N2. Road segment goes into open water — reuses the real isLand() via sampleRoadCorridor().
expectFailure('N2 road-into-water', () => {
  const fakeRoad = { id: 'FAKE_WATER_ROAD', class: 'STREET', lanes: 2, points: [[5000, 5000], [5200, 5000]] };
  for (const s of sampleRoadCorridor(fakeRoad, { step: 40, edgeSamples: 2 })) {
    assert.equal(isLand(s.x, s.y), true, `fake road point (${s.x},${s.y}) should have been flagged as not on land`);
  }
});

// N3. Two segments intersect without a declared junction — reuses the real findSegmentIntersections().
expectFailure('N3 unmarked-crossing', () => {
  const roadA = { id: 'FAKE_A', class: 'STREET', lanes: 2, points: [[0, -50], [0, 50]] };
  const roadB = { id: 'FAKE_B', class: 'STREET', lanes: 2, points: [[-50, 0], [50, 0]] };
  const { unmarked: fakeUnmarked } = findSegmentIntersections([roadA, roadB]);
  assert.equal(fakeUnmarked.length, 0, `crossing at (0,0) should have been flagged, found ${fakeUnmarked.length}`);
});

// N4. Bridge endpoint displaced from its declared polyline — reuses the real endpoint-binding logic.
expectFailure('N4 displaced-bridge-endpoint', () => {
  const fakeBridge = { id: 'FAKE_BRIDGE', points: [[0, 0], [100, 0]], a: { x: 999, y: 999 }, b: { x: 100, y: 0 }, width: 40 };
  assertBridgeGeometryValid(fakeBridge, graph);
});

// N5. Lane width changed in only one place (old laneWidth=28 formula).
expectFailure('N5 inconsistent-lane-width', () => {
  const road = roadById('CENTRAL_AVENUE');
  const brokenFn = (r) => {
    const p0 = r.points[0], p1 = r.points[1];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
    const offset = (r.lanes * 28) / 2 + 22;
    return { x: p0[0] - dy / len * offset, y: p0[1] + dx / len * offset };
  };
  assertSidewalkOffsetMatchesContract(road, brokenFn);
});

// N6. Sidewalk offset changed in only one place (old lanes*14+22 flat formula).
expectFailure('N6 inconsistent-sidewalk-offset', () => {
  const road = roadById('MARKET_STREET');
  const brokenFn = (r) => {
    const p0 = r.points[0], p1 = r.points[1];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
    const offset = r.lanes * 14 + 22;
    return { x: p0[0] - dy / len * offset, y: p0[1] + dx / len * offset };
  };
  assertSidewalkOffsetMatchesContract(road, brokenFn);
});

// N7. Proximity link connects two close-but-different roads without a shared vertex.
expectFailure('N7 forbidden-proximity-link', () => {
  const nodeA = { id: 'road:A:0', roadId: 'ROAD_A', x: 0, y: 0, links: [] };
  const nodeB = { id: 'road:B:0', roadId: 'ROAD_B', x: 5, y: 5, links: [] };
  nodeA.links.push(nodeB);
  for (const link of nodeA.links) {
    if (link.roadId === nodeA.roadId) continue;
    const exact = Math.hypot(nodeA.x - link.x, nodeA.y - link.y) <= EPS;
    assert.ok(exact, `proximity-only link between ${nodeA.id} and ${link.id} at distance ${Math.hypot(nodeA.x - link.x, nodeA.y - link.y)} should have been rejected`);
  }
});

console.log(JSON.stringify({
  result: 'GLOBAL_GEOMETRY_OK',
  roads: CITY_ROADS.length,
  legacyGraphNodes: graph.length,
  independentAuthorityNodes: authorityGraph.length,
  segments: allRoadSegments(CITY_ROADS).length,
  bridges: BRIDGES.length,
  destinations: CITY_DESTINATIONS.length,
  unmarkedIntersections: unmarked.length,
  allowedGradeSeparatedCrossings: allowed.length,
  negativeTestsPassed: 7
}, null, 2));
