import assert from 'node:assert/strict';
import { WORLD } from '../src/game/world.js';
import { ISLANDS, BRIDGES, isLand, islandAt, buildingIslandAt } from '../src/game/islands.js';

const GRID = 160;
const LIMIT = 2720;
const CAR_CLEARANCE = 18;
const LANE_OFFSET = 16;

const pointInRect = (x, y, [bx, by, bw, bh], pad = 0) =>
  x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;

const rectsOverlap = (a, b, pad = 0) =>
  a[0] < b[0] + b[2] + pad && a[0] + a[2] + pad > b[0] &&
  a[1] < b[1] + b[3] + pad && a[1] + a[3] + pad > b[1];

const blocked = (x, y) => !isLand(x, y) || WORLD.buildings.some(b => pointInRect(x, y, b, CAR_CLEARANCE));
const corridor = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = a.x + dx * t, y = a.y + dy * t;
    if (blocked(x, y) || blocked(x + nx * LANE_OFFSET, y + ny * LANE_OFFSET) || blocked(x - nx * LANE_OFFSET, y - ny * LANE_OFFSET)) return false;
  }
  return true;
};

// Buildings may use developed/reclaimed city ground outside the procedural shore mask.
// The anchor is still required to belong to an explicit island district.
for (let i = 0; i < WORLD.buildings.length; i++) {
  const b = WORLD.buildings[i];
  const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  assert.ok(b[2] > 0 && b[3] > 0, `building ${i} has invalid dimensions`);
  assert.ok(buildingIslandAt(cx, cy), `building ${i} has no island district anchor`);
  for (let j = i + 1; j < WORLD.buildings.length; j++) assert.equal(rectsOverlap(b, WORLD.buildings[j]), false, `buildings ${i} and ${j} overlap`);
}

// Reconstruct the same grid used by the game and verify every usable road edge
// has room for the car body on both sides, not just an unobstructed center point.
const nodes = [], map = new Map();
for (let x = -LIMIT; x <= LIMIT; x += GRID) for (let y = -LIMIT; y <= LIMIT; y += GRID) {
  if (!blocked(x, y)) { const n = { x, y, links: [] }; nodes.push(n); map.set(`${x},${y}`, n); }
}
let edges = 0;
for (const n of nodes) for (const [dx, dy] of [[GRID, 0], [0, GRID]]) {
  const m = map.get(`${n.x + dx},${n.y + dy}`);
  if (m && corridor(n, m)) { n.links.push(m); edges++; }
}
assert.ok(nodes.length > 0, 'no drivable road nodes');
assert.ok(edges > 0, 'no drivable road edges');

// Bridge endpoints also need a clean approach for the car.
for (const bridge of BRIDGES) for (const p of [bridge.a, bridge.b]) {
  assert.equal(blocked(p.x, p.y), false, `${bridge.id} endpoint is blocked`);
  assert.ok(ISLANDS.some(i => islandAt(p.x, p.y)?.id === i.id), `${bridge.id} endpoint is not on an island`);
}

console.log(`WORLD_LAYOUT_OK buildings=${WORLD.buildings.length} roadNodes=${nodes.length} roadEdges=${edges} islands=${ISLANDS.length}`);
