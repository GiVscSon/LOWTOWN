// The sea is streamed from world-space chunks. Chunk appearance is keyed only
// by coordinates, so sailing back through an area produces the same current
// pattern without keeping an ever-growing world array in memory.
export const OCEAN_CHUNK_SIZE = 1200;

function hash32(x, y, salt = 0) {
  let value = Math.imul((x | 0) ^ 0x9e3779b9, 0x85ebca6b);
  value ^= Math.imul((y | 0) ^ 0xc2b2ae35, 0x27d4eb2f);
  value ^= Math.imul(salt + 1, 0x165667b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return value >>> 0;
}

const unit = (x, y, salt) => hash32(x, y, salt) / 0xffffffff;

export function oceanChunkAt(chunkX, chunkY) {
  if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) throw new TypeError('Ocean chunk coordinates must be finite');
  const cx = Math.floor(chunkX), cy = Math.floor(chunkY);
  const count = 8 + Math.floor(unit(cx, cy, 0) * 7);
  const waves = Array.from({ length: count }, (_, i) => ({
    x: unit(cx, cy, i * 3 + 1) * OCEAN_CHUNK_SIZE,
    y: unit(cx, cy, i * 3 + 2) * OCEAN_CHUNK_SIZE,
    length: 12 + unit(cx, cy, i * 3 + 3) * 28,
    phase: unit(cx, cy, i * 3 + 4) * Math.PI * 2,
    bright: unit(cx, cy, i * 3 + 5) > 0.78
  }));
  const seed = hash32(cx, cy, 71);
  return {
    cx, cy,
    x: cx * OCEAN_CHUNK_SIZE,
    y: cy * OCEAN_CHUNK_SIZE,
    seed,
    waves,
    // Rare, non-solid flecks keep long open-water crossings from looking like
    // a single flat texture. They never enter collision or navigation geometry.
    glint: unit(cx, cy, 73) > 0.84
  };
}

export function visibleOceanChunks(x, y, radius = 2400) {
  if (![x, y, radius].every(Number.isFinite) || radius < 0) throw new TypeError('Ocean view must use finite coordinates and a non-negative radius');
  const minX = Math.floor((x - radius) / OCEAN_CHUNK_SIZE);
  const maxX = Math.floor((x + radius) / OCEAN_CHUNK_SIZE);
  const minY = Math.floor((y - radius) / OCEAN_CHUNK_SIZE);
  const maxY = Math.floor((y + radius) / OCEAN_CHUNK_SIZE);
  const chunks = [];
  for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) chunks.push(oceanChunkAt(cx, cy));
  return chunks;
}
