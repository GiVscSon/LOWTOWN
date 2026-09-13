import assert from 'node:assert/strict';
import { WORLD } from '../src/game/world.js';
import { ISLANDS, BRIDGES, isLand, islandAt } from '../src/game/islands.js';

const GRID = 160;
const ROAD_HALF_WIDTH = 46;
const CAR_CLEARANCE = 18;
const BUILDING_CLEARANCE = ROAD_HALF_WIDTH + CAR_CLEARANCE;
const EPS = 0.001;

const pointInRect = (x, y, [bx, by, bw, bh], pad = 0) =>
  x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;

const rectsOverlap = (a, b, pad = 0) =>
  a[0] < b[0] + b[2] + pad && a[0] + a[2] + pad > b[0] &&
  a[1] < b[1] + b[3] + pad && a[1] + a[3] + pad > b[1];

function segmentDistanceToRect(x1, y1, x2, y2, rect) {
  const [bx, by, bw, bh] = rect;
  const steps = Math.max(8, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 20));
  let min = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const dx = Math.max(bx - x, 0, x - (bx + bw));
    const dy = Math.max(by - y, 0, y - (by + bh));
    min = Math.min(min, Math.hypot(dx, dy));
  }
  return min;
}

// 1) Buildings must stay on a single island and never overlap each other.
for (let i = 0; i < WORLD.buildings.length; i++) {
  const b = WORLD.buildings[i];
  assert.ok(b[2] > 0 && b[3] > 0, `building ${i} has invalid dimensions`);
  const centerIsland = islandAt(b[0] + b[2] / 2, b[1] + b[3] / 2);
  assert.ok(centerIsland, `building ${i} is not placed on an island`);
  for (let j = i + 1; j < WORLD.buildings.length; j++) {
    assert.equal(rectsOverlap(b, WORLD.buildings[j], 0), false, `buildings ${i} and ${j} overlap`);
  }
}

// 2) Every grid road centerline must keep a full car-safe clearance from buildings.
// Only test centerlines that actually cross the island footprint.
let roadSamples = 0;
for (let x = -2720; x <= 2720; x += GRID) {
  for (const b of WORLD.buildings) {
    const y1 = b[1] - 80, y2 = b[1] + b[3] + 80;
    if (segmentDistanceToRect(x, y1, x, y2, b) < BUILDING_CLEARANCE - EPS) {
      throw new Error(`vertical road x=${x} crowds building ${JSON.stringify(b)}`);
    }
    roadSamples++;
  }
}
for (let y = -2720; y <= 2720; y += GRID) {
  for (const b of WORLD.buildings) {
    const x1 = b[0] - 80, x2 = b[0] + b[2] + 80;
    if (segmentDistanceToRect(x1, y, x2, y, b) < BUILDING_CLEARANCE - EPS) {
      throw new Error(`horizontal road y=${y} crowds building ${JSON.stringify(b)}`);
    }
    roadSamples++;
  }
}

// 3) Bridge endpoints must have enough open area for a road connection.
for (const bridge of BRIDGES) {
  for (const p of [bridge.a, bridge.b]) {
    assert.equal(isLand(p.x, p.y), true, `${bridge.id} endpoint is not land`);
    for (const b of WORLD.buildings) {
      assert.equal(pointInRect(p.x, p.y, b, CAR_CLEARANCE), false, `${bridge.id} endpoint crowds a building`);
    }
  }
}

console.log(`WORLD_LAYOUT_OK buildings=${WORLD.buildings.length} islands=${ISLANDS.length} roadChecks=${roadSamples}`);
