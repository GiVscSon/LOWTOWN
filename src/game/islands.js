export const ISLANDS = [
  {
    id: 'LOWTOWN', name: 'LOWTOWN', biome: 'URBAN', center: { x: -560, y: -180 }, rx: 1600, ry: 1700,
    colors: { land: '#202326', shore: '#7b6650', accent: '#e09a3e' },
    districts: ['downtown', 'residential', 'old industrial'],
    ferry: { x: 640, y: 160 }, airfield: { x: 120, y: 640 }
  },
  {
    id: 'IRON_HARBOR', name: 'IRON HARBOR', biome: 'INDUSTRIAL_COAST', center: { x: 1700, y: -100 }, rx: 820, ry: 1800,
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

export const BRIDGES = [
  { id: 'EAST_BRIDGE', a: { x: 640, y: 160 }, b: { x: 1120, y: 160 }, width: 70 },
  { id: 'NORTH_BRIDGE', a: { x: -320, y: 800 }, b: { x: 0, y: 1520 }, width: 90 }
];

const ellipse = (x, y, island) => {
  if (!island || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const dx = (x - island.center.x) / island.rx;
  const dy = (y - island.center.y) / island.ry;
  return dx * dx + dy * dy <= 1;
};
const bridgeHit = (x, y, bridge) => {
  if (!bridge?.a || !bridge?.b || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const vx = bridge.b.x - bridge.a.x, vy = bridge.b.y - bridge.a.y;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - bridge.a.x) * vx + (y - bridge.a.y) * vy) / len2));
  const px = bridge.a.x + vx * t, py = bridge.a.y + vy * t;
  return Math.hypot(x - px, y - py) <= (bridge.width || 0);
};
export function islandAt(x, y) { return ISLANDS.find(island => ellipse(x, y, island)) || null; }
export function isLand(x, y) { return !!islandAt(x, y) || BRIDGES.some(bridge => bridgeHit(x, y, bridge)); }
export function biomeAt(x, y) { return islandAt(x, y)?.biome || (BRIDGES.some(bridge => bridgeHit(x, y, bridge)) ? 'BRIDGE' : 'WATER'); }
