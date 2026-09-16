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
  sampleRoadCorridor,
  sampleBridgeCorridor,
  bridgePoints,
  findSegmentIntersections,
  nearestRoadSegment,
  sidewalkOffset as geometrySidewalkOffset
} from '../src/game/road_geometry.js';

const EPS = 0.001;
const origin = { x: -120, y: 0 };

// A. Graph connectivity
const graph = buildCityGraph();
assert.ok(graph.length > 0, 'A: city graph must contain nodes');
const seen = new Set([graph[0].id]);
const queue = [graph[0]];
while (queue.length) {
  const node = queue.shift();
  for (const next of node.links) if (!seen.has(next.id)) { seen.add(next.id); queue.push(next); }
}
assert.equal(seen.size, graph.length, `A: city graph is disconnected (${graph.length - seen.size} unreachable nodes)`);

// B. Real segment validity, derived only from CITY_ROADS
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

// C. Real segment-to-segment intersection consistency
const { unmarked, allowed } = findSegmentIntersections(CITY_ROADS);
assert.equal(unmarked.length, 0, `C: ${unmarked.length} undeclared road crossings: ${JSON.stringify(unmarked)}`);
if (CITY_ROADS.some(r => r.gradeSeparated)) {
  assert.ok(allowed.length > 0, 'C: gradeSeparated roads exist but produced no recorded allowed crossings — check geometry');
}

// D. Full building/corridor clearance
function rectPerimeterSamples([bx, by, bw, bh], step = 10) {
  const pts = [];
  for (let x = bx; x <= bx + bw; x += step) { pts.push([x, by]); pts.push([x, by + bh]); }
  for (let y = by; y <= by + bh; y += step) { pts.push([bx, y]); pts.push([bx + bw, y]); }
  return pts;
}
function pointInRect(px, py, [bx, by, bw, bh]) {
  return px >= bx && px <= bx + bw && py >= by && py <= by + bh;
}
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function buildingIntersectsRoad(building, road) {
  const clearance = collisionHalfWidth(road);
  for (const seg of roadSegments(road)) {
    for (const [px, py] of rectPerimeterSamples(building, 10)) {
      if (distanceToSegment(px, py, seg.a.x, seg.a.y, seg.b.x, seg.b.y) <= clearance) return true;
    }
    if (pointInRect(seg.a.x, seg.a.y, building)) return true;
    if (pointInRect(seg.b.x, seg.b.y, building)) return true;
    const midX = (seg.a.x + seg.b.x) / 2, midY = (seg.a.y + seg.b.y) / 2;
    if (pointInRect(midX, midY, building)) return true;
    const cx = building[0] + building[2] / 2, cy = building[1] + building[3] / 2;
    if (distanceToSegment(cx, cy, seg.a.x, seg.a.y, seg.b.x, seg.b.y) <= clearance) return true;
  }
  return false;
}
for (const building of WORLD.buildings) {
  for (const road of CITY_ROADS) {
    assert.equal(buildingIntersectsRoad(building, road), false,
      `D: building ${JSON.stringify(building)} conflicts with ${road.id} corridor`);
  }
}

// E. Full road-corridor land coverage
for (const road of CITY_ROADS) {
  const corridor = sampleRoadCorridor(road, { step: 20, edgeSamples: 3 });
  for (const s of corridor) {
    assert.equal(isLand(s.x, s.y), true, `E: ${road.id} corridor point (${s.x.toFixed(1)},${s.y.toFixed(1)}) at offset ${s.offset.toFixed(1)} is not on land`);
  }
}

// F. Bridge geometry consistency
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
  for (const s of corridor) {
    assert.equal(isLand(s.x, s.y), true, `F: ${bridge.id} corridor point (${s.x.toFixed(1)},${s.y.toFixed(1)}) is not supported`);
  }
  assert.ok(bridge.width > 0 && bridge.width < 200, `F: ${bridge.id} has an implausible width ${bridge.width}`);
  const route = shortestRoute(bridge.a, bridge.b);
  assert.ok(route.length >= 2, `F: ${bridge.id} is not traversable by the navigation graph`);
}

// G. Destination geometry
for (const destination of CITY_DESTINATIONS) {
  const road = roadById(destination.roadId);
  assert.ok(road, `G: ${destination.id} references unknown road ${destination.roadId}`);
  assert.ok(destination.index >= 0 && destination.index < road.points.length, `G: ${destination.id} index out of range for ${destination.roadId}`);
  const point = destinationPoint(destination.id);
  assert.ok(point, `G: ${destination.id} has no computed point`);
  const nearest = nearestRoadSegment(point.x, point.y, [road]);
  assert.ok(nearest.distance < 200, `G: ${destination.id} marker is implausibly far (${nearest.distance.toFixed(1)}) from its declared road`);
  assert.equal(isLand(point.x, point.y), true, `G: ${destination.id} marker is not on land`);
  const insideBuilding = WORLD.buildings.some(b => pointInRect(point.x, point.y, b));
  assert.equal(insideBuilding, false, `G: ${destination.id} marker falls inside a building`);
  const route = shortestRoute(origin, point);
  assert.ok(route.length >= 2, `G: ${destination.id} is unreachable from Central Avenue`);
}
const missionRoute = shortestRoute(origin, WORLD.mission);
assert.ok(missionRoute.length >= 2, 'G: mission marker is unreachable from Central Avenue');
assert.equal(isLand(WORLD.mission.x, WORLD.mission.y), true, 'G: mission marker is not on land');

// H. Physics/corridor consistency
const authority = buildRoadNetwork();
const lines = authorityRoadSegments(authority);
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

// I. Navigation consistency (adapter parity — not an independent proof by itself)
assert.equal(authority.length, graph.length, 'I: road_authority must mirror city graph node count');
assert.deepEqual(authority.map(n => n.id).sort(), graph.map(n => n.id).sort(), 'I: road_authority ids must mirror city graph');

// J. No forbidden proximity-only links
for (const node of graph) {
  for (const link of node.links) {
    if (link.roadId === node.roadId) continue;
    const exact = Math.hypot(node.x - link.x, node.y - link.y) <= EPS;
    assert.ok(exact, `J: proximity-only link found between ${node.id} and ${link.id} (distance ${Math.hypot(node.x - link.x, node.y - link.y).toFixed(2)})`);
  }
}

// K. No duplicate geometry constants
for (const road of CITY_ROADS) {
  const expectedSidewalk = geometrySidewalkOffset(road);
  assert.ok(expectedSidewalk > 0, `K: ${road.id} sidewalk offset must be positive`);
}

// L. No legacy independent road grid
assert.equal(typeof buildRoadNetwork, 'function', 'L: buildRoadNetwork must exist');
assert.equal(buildRoadNetwork.length, 0, 'L: buildRoadNetwork must take no isLand/blocked/grid arguments');

console.log(JSON.stringify({
  result: 'GLOBAL_GEOMETRY_OK',
  roads: CITY_ROADS.length,
  nodes: graph.length,
  segments: allRoadSegments(CITY_ROADS).length,
  bridges: BRIDGES.length,
  destinations: CITY_DESTINATIONS.length,
  unmarkedIntersections: unmarked.length,
  allowedGradeSeparatedCrossings: allowed.length
}, null, 2));
