import assert from 'node:assert/strict';
import { WORLD } from '../src/game/world.js';
import { ISLANDS, BRIDGES, isLand } from '../src/game/islands.js';
import { buildLayeredRoadTopology, layeredRoadSegments, nearestAnyRoadPoint, ROAD_LEVELS } from '../src/game/road_topology.js';
import { collisionHalfWidth } from '../src/game/road_geometry.js';
import { roadById, shortestRoute } from '../src/game/city_semantics.js';

const nodes = buildLayeredRoadTopology();
const segments = layeredRoadSegments(nodes);

assert(nodes.length > 0, 'runtime road topology must contain nodes');
assert(segments.length > 0, 'runtime road topology must expose real segments');
assert(nodes.every(n => n.level === ROAD_LEVELS.STREET), 'current road topology must use the STREET level consistently');

const adjacency = new Map(nodes.map(n => [n.id, n.links]));
const start = nodes[0];
const seen = new Set([start.id]);
const queue = [start];
while (queue.length) {
  const node = queue.shift();
  for (const next of adjacency.get(node.id) || []) {
    if (!seen.has(next.id)) {
      seen.add(next.id);
      queue.push(next);
    }
  }
}
assert.equal(seen.size, nodes.length, 'runtime road authority graph must be connected');

for (const island of ISLANDS) {
  const hit = nearestAnyRoadPoint(island.center.x, island.center.y, nodes);
  assert.ok(hit, `${island.id} must have a road sample in the runtime topology`);
}

function segmentDistance(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}

function corridorClear(bridge) {
  const pts = bridge.points || [[bridge.a.x, bridge.a.y], [bridge.b.x, bridge.b.y]];
  const halfWidth = bridge.width / 2;
  for (let i = 0; i < pts.length - 1; i += 1) {
    for (let s = 1; s <= 16; s += 1) {
      const t = s / 16;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
      const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
      if (!isLand(x, y)) return false;
      if (WORLD.buildings.some(([bx, by, bw, bh]) => x > bx - 8 && x < bx + bw + 8 && y > by - 8 && y < by + bh + 8)) return false;
    }
  }
  return halfWidth > 0;
}

for (const bridge of BRIDGES) {
  assert.equal(isLand(bridge.a.x, bridge.a.y), true, `${bridge.id} start must be drivable land`);
  assert.equal(isLand(bridge.b.x, bridge.b.y), true, `${bridge.id} end must be drivable land`);
  assert.equal(corridorClear(bridge), true, `${bridge.id} corridor must remain clear`);

  const startHit = nearestAnyRoadPoint(bridge.a.x, bridge.a.y, nodes);
  const endHit = nearestAnyRoadPoint(bridge.b.x, bridge.b.y, nodes);
  assert.ok(startHit && endHit, `${bridge.id} endpoints must have runtime road context`);
}

const routeChecks = [
  ['WEST_SIDE', {x:-2900,y:80}, 'LOWTOWN', {x:-560,y:-360}],
  ['LOWTOWN', {x:-560,y:-360}, 'IRON_HARBOR', {x:2400,y:-900}],
  ['LOWTOWN', {x:-120,y:600}, 'NORTH_RIDGE', {x:300,y:1900}],
  ['NORTH_RIDGE', {x:300,y:1900}, 'SOUTH_SIDE', {x:-900,y:1560}]
];
for (const [fromName, from, toName, to] of routeChecks) {
  const route = shortestRoute(from, to);
  assert(route.length >= 2, `expanded world route ${fromName} -> ${toName} must be connected`);
}

const requiredRoads = [
  'WESTERN_BOULEVARD','WEST_RESIDENTIAL','SOUTH_RING','SOUTH_MARKET',
  'HARBOR_EASTERN','HARBOR_SOUTH','NORTH_RIDGE_LOOP','NORTH_RESERVOIR'
];
for (const id of requiredRoads) {
  assert.ok(roadById(id), `expanded skeleton road ${id} must exist`);
}

const boulevard = roadById('LOWTOWN_BOULEVARD');
assert.ok(boulevard, 'LOWTOWN_BOULEVARD must remain part of semantic road data');
assert.ok(collisionHalfWidth(boulevard) > 0, 'semantic road must expose unified collision width');

console.log(`ROAD_TOPOLOGY_OK runtimeNodes=${nodes.length} runtimeSegments=${segments.length} islands=${ISLANDS.length} bridges=${BRIDGES.length}`);
