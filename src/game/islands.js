import { WORLD } from './world.js';
import { CITY_ROADS } from './city_semantics.js';
import { supportHalfWidth } from './road_geometry.js';

export const ISLANDS = [
  {
    id: 'LOWTOWN', name: 'LOWTOWN', biome: 'URBAN', center: { x: -560, y: -180 }, rx: 1320, ry: 1040,
    colors: { land: '#202326', shore: '#7b6650', accent: '#e09a3e' },
    districts: ['downtown', 'residential', 'old industrial'],
    ferry: { x: 640, y: 160 }, airfield: { x: 120, y: 640 }
  },
  {
    id: 'IRON_HARBOR', name: 'IRON HARBOR', biome: 'INDUSTRIAL_COAST', center: { x: 1700, y: -100 }, rx: 740, ry: 1000,
    colors: { land: '#25282a', shore: '#6b716f', accent: '#d4523a' },
    districts: ['docks', 'warehouses', 'shipyard'],
    ferry: { x: 1120, y: 160 }, airfield: { x: 1150, y: 260 }
  },
  {
    id: 'NORTH_RIDGE', name: 'NORTH RIDGE', biome: 'FOREST_HIGHLAND', center: { x: 0, y: 1800 }, rx: 1080, ry: 600,
    colors: { land: '#202820', shore: '#6e765d', accent: '#b7a66a' },
    districts: ['pine road', 'hill town', 'reservoir'],
    ferry: null, airfield: { x: 300, y: 1360 }
  }
];

// width is the total playable/rendered deck width. Geometry helpers use width / 2
// as the corridor radius, and main.js uses the same value as canvas lineWidth.
export const BRIDGES = [
  { id: 'EAST_BRIDGE', points: [[640, 80], [640, 160], [1120, 160]], a: { x: 640, y: 80 }, b: { x: 1120, y: 160 }, width: 70 },
  { id: 'NORTH_BRIDGE', points: [[-120, 600], [-320, 800], [-120, 1240]], a: { x: -120, y: 600 }, b: { x: -120, y: 1240 }, width: 90 }
];

const ellipse = (x, y, island) => {
  const dx = (x - island.center.x) / island.rx;
  const dy = (y - island.center.y) / island.ry;
  return dx * dx + dy * dy <= 1;
};

const segmentDistance = (x, y, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
};

const bridgePoints = bridge => {
  if (Array.isArray(bridge?.points) && bridge.points.length >= 2) return bridge.points;
  if (bridge?.a && bridge?.b) return [[bridge.a.x, bridge.a.y], [bridge.b.x, bridge.b.y]];
  return [];
};

const bridgeHit = (x, y, bridge) => {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const pts = bridgePoints(bridge);
  const halfWidth = (bridge.width || 0) / 2;
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (segmentDistance(x, y, pts[i], pts[i + 1]) <= halfWidth) return true;
  }
  return false;
};

const cityRoadHit = (x, y) => CITY_ROADS.some(road => {
  const half = supportHalfWidth(road);
  for (let i = 0; i < road.points.length - 1; i += 1) {
    if (segmentDistance(x, y, road.points[i], road.points[i + 1]) <= half) return true;
  }
  return false;
});

const buildingHit = (x, y) => WORLD.buildings.some(([bx, by, bw, bh]) =>
  x >= bx - 8 && x <= bx + bw + 8 && y >= by - 8 && y <= by + bh + 8
);

export function buildingIslandAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (y > 1200 && Math.abs(x) < 1100) return ISLANDS.find(i => i.id === 'NORTH_RIDGE') || null;
  if (x >= 900 && x < 2600) return ISLANDS.find(i => i.id === 'IRON_HARBOR') || null;
  if (x < 900) return ISLANDS.find(i => i.id === 'LOWTOWN') || null;
  return null;
}

export function islandAt(x, y) {
  const natural = ISLANDS.find(island => ellipse(x, y, island));
  if (natural) return natural;
  if (buildingHit(x, y)) return buildingIslandAt(x, y);
  return null;
}

export function isLand(x, y) {
  return !!islandAt(x, y) || BRIDGES.some(bridge => bridgeHit(x, y, bridge)) || cityRoadHit(x, y);
}

export function biomeAt(x, y) {
  return islandAt(x, y)?.biome ||
    (BRIDGES.some(bridge => bridgeHit(x, y, bridge)) ? 'BRIDGE' :
      (cityRoadHit(x, y) ? 'URBAN_RECLAIMED' : 'WATER'));
}
