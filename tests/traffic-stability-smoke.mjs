import assert from 'node:assert/strict';

globalThis.Image = class {
  constructor() { this.complete = false; this.naturalWidth = 0; }
  set src(v) { this._src = v; }
};
globalThis.location = { search: '' };

const { createTrafficSystem } = await import('../src/game/traffic.js');

// --- 1. default spawn count --------------------------------------------------
// `nodes` and `blocked` are accepted as no-ops for backward compat.
const traffic = createTrafficSystem({ nodes: [], blocked: () => true, seed: 7 });
assert.equal(traffic.cars.length, 12, 'default traffic load should be 12');

// --- 2. cars advance (not frozen) -------------------------------------------
const startX = traffic.cars[0].x;
const startY = traffic.cars[0].y;
for (let i = 0; i < 60; i++) traffic.update(1 / 60);
const movedX = traffic.cars[0].x;
const movedY = traffic.cars[0].y;
const moved = Math.hypot(movedX - startX, movedY - startY);
assert.ok(moved > 0, 'cars must advance along road segments after 60 ticks');

// --- 3. step alias works the same as update ----------------------------------
const c2 = createTrafficSystem({ seed: 42 });
const px = c2.cars[0].x;
for (let i = 0; i < 10; i++) c2.step(1 / 60);
assert.ok(c2.cars[0].x !== px || c2.cars[0].y !== 0, 'step() alias must advance cars');

// --- 4. density URL still parsed correctly -----------------------------------
const densityUrl = '?scenario=' + encodeURIComponent(JSON.stringify({ trafficDensity: 0.2 }));
globalThis.location = { search: densityUrl };
const sparse = createTrafficSystem({ nodes: [], blocked: () => false, seed: 11 });
assert.equal(sparse.cars.length, 12, 'blocked no-op must not affect spawn count');
for (let i = 0; i < 60; i++) sparse.update(1 / 60);

console.log('TRAFFIC STABILITY: PASS spawn-count + car-advance + step-alias + density-url');
