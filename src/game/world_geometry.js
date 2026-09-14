import { WORLD } from './world.js';
import { isLand } from './islands.js';
import { ROAD_WIDTH } from './road_authority.js';

export const VEHICLE_RADIUS = 20;
export const CURB_MARGIN = 6;
export const ROAD_HALF_WIDTH = ROAD_WIDTH / 2;

export function pointInBuilding(x, y, margin = 0) {
  return WORLD.buildings.some(([bx, by, bw, bh]) =>
    x > bx - margin && x < bx + bw + margin && y > by - margin && y < by + bh + margin
  );
}

export function pointOnLand(x, y) {
  return isLand(x, y);
}

export function pointBlocked(x, y, margin = VEHICLE_RADIUS) {
  return !pointOnLand(x, y) || pointInBuilding(x, y, margin);
}

export function nearestRoadDistance(x, y, roadLines = []) {
  let best = Infinity;
  for (const [a, b] of roadLines) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    const px = a.x + dx * t, py = a.y + dy * t;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

export function vehicleOnRoad(x, y, roadLines = [], clearance = VEHICLE_RADIUS + CURB_MARGIN) {
  return nearestRoadDistance(x, y, roadLines) <= ROAD_HALF_WIDTH - clearance;
}
