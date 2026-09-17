import { WORLD } from './world.js';
import { isLand } from './islands.js';
import { roadById } from './city_semantics.js';
import { collisionHalfWidth } from './road_geometry.js';
import { ROAD_EDGE_TOLERANCE } from './road_authority.js';

function pointInBuilding(x, y, margin = 0) {
  return WORLD.buildings.some(([bx, by, bw, bh]) =>
    x > bx - margin && x < bx + bw + margin && y > by - margin && y < by + bh + margin
  );
}

function nearestRoadHit(x, y, roadLines = []) {
  let best = null;
  for (const [a, b] of roadLines) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    const px = a.x + dx * t, py = a.y + dy * t;
    const distance = Math.hypot(x - px, y - py);
    if (!best || distance < best.distance) best = { distance, roadId: a.roadId, a, b, t };
  }
  return best;
}

export function nearestRoadDistanceForVehicle(x, y, roadLines = []) {
  return nearestRoadHit(x, y, roadLines)?.distance ?? Infinity;
}

function footprintPoints(x, y, a, length = 56, width = 28) {
  const fx = Math.cos(a), fy = Math.sin(a), rx = -fy, ry = fx, hl = length / 2, hw = width / 2;
  return [
    { x, y },
    { x: x + fx * hl + rx * hw, y: y + fy * hl + ry * hw },
    { x: x + fx * hl - rx * hw, y: y + fy * hl - ry * hw },
    { x: x - fx * hl + rx * hw, y: y - fy * hl + ry * hw },
    { x: x - fx * hl - rx * hw, y: y - fy * hl - ry * hw }
  ];
}

export function vehicleWorldBlocked(x, y, a, roadLines = [], options = {}) {
  if (!roadLines.length) return false;

  const length = Math.max(30, Number(options.length) || 56);
  const width = Math.max(18, Number(options.width) || 28);
  const buildingMargin = Math.max(0, Number(options.buildingMargin) || 4);
  const rawTolerance = Number(options.roadTolerance);
  const roadTolerance = Number.isFinite(rawTolerance) ? Math.max(0, rawTolerance) : ROAD_EDGE_TOLERANCE;
  const points = footprintPoints(x, y, a, length, width);

  for (const p of points) {
    if (!isLand(p.x, p.y) || pointInBuilding(p.x, p.y, buildingMargin)) return true;
  }

  const hit = nearestRoadHit(x, y, roadLines);
  if (!hit) return true;
  const road = roadById(hit.roadId);
  const corridor = road ? collisionHalfWidth(road) + roadTolerance : 46 + roadTolerance;
  return hit.distance > corridor;
}
