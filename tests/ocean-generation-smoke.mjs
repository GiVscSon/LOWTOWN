import assert from 'node:assert/strict';
import { OCEAN_CHUNK_SIZE, oceanChunkAt, visibleOceanChunks } from '../src/world/ocean_chunks.js';

assert.equal(OCEAN_CHUNK_SIZE, 1200);
const farChunks = [
  oceanChunkAt(0, 0), oceanChunkAt(-1, 1), oceanChunkAt(9500, -11200),
  oceanChunkAt(1_000_000, -2_000_000), oceanChunkAt(9_000_000, 7_000_000)
];
for (const chunk of farChunks) {
  assert.ok(chunk.waves.length >= 8 && chunk.waves.length <= 14);
  assert.ok(chunk.waves.every(wave => Number.isFinite(wave.x) && wave.x >= 0 && wave.x < OCEAN_CHUNK_SIZE));
  assert.deepEqual(chunk, oceanChunkAt(chunk.cx, chunk.cy), 'ocean chunks must regenerate identically from their world coordinates');
}
assert.notDeepEqual(oceanChunkAt(100, 20), oceanChunkAt(101, 20), 'adjacent ocean tiles should have their own seeded appearance');
assert.ok(visibleOceanChunks(13_000, -15_000, 1500).length > 4, 'view generation must continue beyond the authored city bounds');

const player = { x: 13_500, y: 0, angle: Math.PI / 2, speed: 8, width: 66, height: 26 };
for (let i = 0; i < 300; i++) {
  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;
  const tile = oceanChunkAt(Math.floor(player.x / OCEAN_CHUNK_SIZE), Math.floor(player.y / OCEAN_CHUNK_SIZE));
  assert.ok(tile.waves.length > 0);
}
assert.ok(player.y > 0 && player.y < 13_000, 'open-water movement should proceed through streamed ocean tiles');
console.log('OCEAN GENERATION: PASS deterministic streaming at negative and unbounded world coordinates');
