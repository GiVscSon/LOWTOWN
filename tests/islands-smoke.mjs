import assert from 'node:assert/strict';
import { ISLANDS, BRIDGES, islandAt, isLand, biomeAt } from '../src/game/islands.js';

assert.equal(ISLANDS.length, 3, 'world should contain exactly three islands');
assert.deepEqual(ISLANDS.map(i => i.biome), ['URBAN', 'INDUSTRIAL_COAST', 'FOREST_HIGHLAND']);
for (const island of ISLANDS) {
  assert.equal(islandAt(island.center.x, island.center.y)?.id, island.id);
  assert.equal(isLand(island.center.x, island.center.y), true);
  assert.notEqual(biomeAt(island.center.x, island.center.y), 'WATER');
}
assert.equal(BRIDGES.length, 2, 'three islands should have two inter-island bridges');
for (const bridge of BRIDGES) {
  assert.equal(isLand(bridge.a.x, bridge.a.y), true);
  assert.equal(isLand(bridge.b.x, bridge.b.y), true);
  assert.equal(biomeAt((bridge.a.x + bridge.b.x) / 2, (bridge.a.y + bridge.b.y) / 2), 'BRIDGE');
}
assert.equal(biomeAt(5000, 5000), 'WATER');
console.log('ISLANDS_OK', JSON.stringify({ islands: ISLANDS.map(i => i.id), biomes: ISLANDS.map(i => i.biome), bridges: BRIDGES.map(b => b.id) }));
