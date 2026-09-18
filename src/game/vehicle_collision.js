import { WORLD } from './world.js';
import { isLand } from './islands.js';
import { roadById } from './city_semantics.js';
import { collisionHalfWidth } from './road_geometry.js';
import { ROAD_EDGE_TOLERANCE } from './road_authority.js';

export function pointInBuilding(x, y, margin = 0) {
  return WORLD.buildings.some(([bx, by, bw, bh]) =>
    x > bx - margin && x < bx + bw + margin && y > by - margin && y < by + bh + margin
  );
}

export function resolveVehicleOverlap(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = ((a.radius || (a.width ? a.width * 0.7 : 18)) + (b.radius || (b.width ? b.width * 0.7 : 18)));

  if (dist < minDist && dist > 0.001) {
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    // Push away equally
    a.x -= nx * overlap * 0.5;
    a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5;
    b.y += ny * overlap * 0.5;

    // Exchange / dampen velocities
    if (Number.isFinite(a.v) && Number.isFinite(b.v)) {
      const avgV = (a.v + b.v) * 0.45;
      a.v = avgV;
      b.v = avgV;
    }
    return true;
  }
  return false;
}

export function handlePoliceBuildingSlide(cop, dt = 1 / 60) {
  const margin = 8;
  if (pointInBuilding(cop.x, cop.y, margin)) {
    // Slide / push out of nearest building edge
    for (const [bx, by, bw, bh] of WORLD.buildings) {
      if (cop.x > bx - margin && cop.x < bx + bw + margin && cop.y > by - margin && cop.y < by + bh + margin) {
        const leftDist = Math.abs(cop.x - (bx - margin));
        const rightDist = Math.abs(cop.x - (bx + bw + margin));
        const topDist = Math.abs(cop.y - (by - margin));
        const bottomDist = Math.abs(cop.y - (by + bh + margin));

        const min = Math.min(leftDist, rightDist, topDist, bottomDist);
        if (min === leftDist) cop.x = bx - margin;
        else if (min === rightDist) cop.x = bx + bw + margin;
        else if (min === topDist) cop.y = by - margin;
        else if (min === bottomDist) cop.y = by + bh + margin;

        cop.v = Math.max(0, (cop.v || 0) * 0.4);
        break;
      }
    }
  }
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
    { x: x - fx * hl + rx * hw, y: y - fy * hl - ry * hw },
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
