const ROAD = Object.freeze({ ARTERIAL: 'ARTERIAL', AVENUE: 'AVENUE', STREET: 'STREET', SERVICE: 'SERVICE' });
const USE = Object.freeze({ VEHICLE: 'VEHICLE', PEDESTRIAN: 'PEDESTRIAN', BOTH: 'BOTH' });

export const CITY_ROADS = Object.freeze([
  { id: 'LOWTOWN_BOULEVARD', name: 'Lowtown Boulevard', class: ROAD.ARTERIAL, zone: 'DOWNTOWN', speed: 95, lanes: 4, oneWay: false, points: [[-1960, -360], [-1200, -360], [-760, -360], [-520, -360], [-120, -360], [200, -360], [640, -360], [880, -360], [1500, -360]] },
  { id: 'RIVER_AVENUE', name: 'River Avenue', class: ROAD.AVENUE, zone: 'DOWNTOWN', speed: 70, lanes: 2, oneWay: false, points: [[-760, -1160], [-760, -600], [-760, -360], [-760, 0], [-760, 80], [-760, 600], [-760, 1240]] },
  { id: 'CENTRAL_AVENUE', name: 'Central Avenue', class: ROAD.AVENUE, zone: 'DOWNTOWN', speed: 70, lanes: 2, oneWay: false, points: [[-120, -1160], [-120, -600], [-120, -360], [-120, 0], [-120, 80], [-120, 600], [-120, 1240]] },
  { id: 'EASTERN_AVENUE', name: 'Eastern Avenue', class: ROAD.AVENUE, zone: 'DOWNTOWN', speed: 75, lanes: 2, oneWay: false, points: [[640, -1160], [640, -900], [640, -600], [640, -360], [640, 0], [640, 80], [640, 600], [640, 1240]] },
  { id: 'MARKET_STREET', name: 'Market Street', class: ROAD.STREET, zone: 'DOWNTOWN', speed: 45, lanes: 2, oneWay: false, points: [[-1960, 80], [-1200, 80], [-760, 80], [-520, 80], [-120, 80], [200, 80], [640, 80], [900, 80], [1500, 80]] },
  { id: 'CANAL_STREET', name: 'Canal Street', class: ROAD.STREET, zone: 'DOWNTOWN', speed: 45, lanes: 2, oneWay: false, points: [[-760, -600], [-120, -600], [640, -600]] },
  { id: 'RIDGE_STREET', name: 'Ridge Street', class: ROAD.STREET, zone: 'RESIDENTIAL', speed: 45, lanes: 2, oneWay: false, points: [[-760, 600], [-120, 600], [640, 600]] },
  { id: 'HARBOR_LINK', name: 'Harbor Link', class: ROAD.ARTERIAL, zone: 'DOWNTOWN', speed: 80, lanes: 2, oneWay: false, gradeSeparated: true, points: [[640, 80], [640, 160], [1120, 160], [1300, -900]] },
  { id: 'DOCKSIDE_DRIVE', name: 'Dockside Drive', class: ROAD.ARTERIAL, zone: 'IRON_HARBOR', speed: 85, lanes: 4, oneWay: false, points: [[1300, -900], [1500, -900], [2100, -900]] },
  { id: 'FREIGHTER_ROW', name: 'Freighter Row', class: ROAD.AVENUE, zone: 'IRON_HARBOR', speed: 55, lanes: 2, oneWay: false, points: [[1020, -500], [1500, -500], [2050, -500]] },
  { id: 'SHIPYARD_ROAD', name: 'Shipyard Road', class: ROAD.STREET, zone: 'IRON_HARBOR', speed: 40, lanes: 2, oneWay: false, points: [[1020, -100], [1500, -100], [2050, -100]] },
  { id: 'HARBOR_SPINE', name: 'Harbor Spine', class: ROAD.AVENUE, zone: 'IRON_HARBOR', speed: 60, lanes: 2, oneWay: false, points: [[1500, -900], [1500, -500], [1500, -360], [1500, -100], [1500, 80]] },
  { id: 'PINE_ROUTE', name: 'Pine Route', class: ROAD.ARTERIAL, zone: 'NORTH_RIDGE', speed: 80, lanes: 2, oneWay: false, points: [[-120, 1240], [-520, 1400], [-120, 1700], [300, 1900], [800, 2050]] },
  { id: 'NORTH_BRIDGE_ROAD', name: 'North Bridge', class: ROAD.AVENUE, zone: 'DOWNTOWN', speed: 60, lanes: 2, oneWay: false, points: [[-120, 600], [-120, 800], [-120, 1240]] }
]);

export const CITY_DISTRICTS = Object.freeze([
  { id: 'DOWNTOWN', name: 'Downtown', center: { x: -560, y: -180 }, roadIds: ['LOWTOWN_BOULEVARD', 'RIVER_AVENUE', 'CENTRAL_AVENUE', 'EASTERN_AVENUE', 'MARKET_STREET', 'CANAL_STREET', 'HARBOR_LINK', 'NORTH_BRIDGE_ROAD'], pedestrianDensity: 1.35, vehicleDensity: 1.2 },
  { id: 'RESIDENTIAL', name: 'Residential', center: { x: -520, y: 620 }, roadIds: ['CENTRAL_AVENUE', 'RIVER_AVENUE', 'RIDGE_STREET'], pedestrianDensity: 1.1, vehicleDensity: .75 },
  { id: 'OLD_INDUSTRIAL', name: 'Old Industrial', center: { x: 430, y: 650 }, roadIds: ['EASTERN_AVENUE', 'RIDGE_STREET'], pedestrianDensity: .55, vehicleDensity: .9 },
  { id: 'IRON_HARBOR', name: 'Iron Harbor', center: { x: 1700, y: -100 }, roadIds: ['DOCKSIDE_DRIVE', 'FREIGHTER_ROW', 'SHIPYARD_ROAD', 'HARBOR_SPINE'], pedestrianDensity: .7, vehicleDensity: 1.45 },
  { id: 'NORTH_RIDGE', name: 'North Ridge', center: { x: 0, y: 1800 }, roadIds: ['PINE_ROUTE'], pedestrianDensity: .35, vehicleDensity: .45 }
]);

export const CITY_DESTINATIONS = Object.freeze([
  { id: 'LOWTOWN_APARTMENTS', name: 'Lowtown Apartments', kind: 'HOME', district: 'RESIDENTIAL', roadId: 'CENTRAL_AVENUE', index: 5 },
  { id: 'MARKET_HALL', name: 'Market Hall', kind: 'SHOP', district: 'DOWNTOWN', roadId: 'MARKET_STREET', index: 4 },
  { id: 'CENTRAL_GARAGE', name: 'Central Garage', kind: 'GARAGE', district: 'DOWNTOWN', roadId: 'CENTRAL_AVENUE', index: 3 },
  { id: 'CITY_HALL', name: 'City Hall', kind: 'CIVIC', district: 'DOWNTOWN', roadId: 'LOWTOWN_BOULEVARD', index: 4 },
  { id: 'FREIGHT_DEPOT', name: 'Freight Depot', kind: 'JOB', district: 'IRON_HARBOR', roadId: 'FREIGHTER_ROW', index: 1 },
  { id: 'NORTH_MOTEL', name: 'North Ridge Motel', kind: 'LODGING', district: 'NORTH_RIDGE', roadId: 'PINE_ROUTE', index: 2 }
]);

// ─── Air & Water spawn points ─────────────────────────────────────────────────
// Helipads: world-space positions on rooftops / open ground, altitude = spawn z
// Boat docks: world-space positions along the waterfront, heading in radians
export const CITY_HELIPADS = Object.freeze([
  {
    id: 'HELIPAD_CITY_HALL',
    name: 'City Hall Rooftop',
    district: 'DOWNTOWN',
    // Centred over City Hall block — approx LOWTOWN_BOULEVARD index 4
    x: 200, y: -360,
    altitude: 92,          // roof height (world units)
    heading: 0,            // nose pointing East on spawn
    radius: 28,            // landing circle radius
  },
  {
    id: 'HELIPAD_IRON_HARBOR',
    name: 'Iron Harbor Logistics Pad',
    district: 'IRON_HARBOR',
    // Between DOCKSIDE_DRIVE and FREIGHTER_ROW, near HARBOR_SPINE midpoint
    x: 1700, y: -700,
    altitude: 18,          // ground-level pad on the quay
    heading: Math.PI,      // nose West on spawn
    radius: 32,
  },
  {
    id: 'HELIPAD_NORTH_RIDGE',
    name: 'North Ridge Clearing',
    district: 'NORTH_RIDGE',
    x: 300, y: 1900,
    altitude: 12,
    heading: -Math.PI / 2, // nose North on spawn
    radius: 24,
  },
]);

export const CITY_BOAT_DOCKS = Object.freeze([
  {
    id: 'DOCK_IRON_HARBOR_MAIN',
    name: 'Iron Harbor Main Dock',
    district: 'IRON_HARBOR',
    // South side of FREIGHTER_ROW, open water entry heading East
    x: 1500, y: -300,
    heading: 0,
    surface: 'water',
    slipLength: 120,       // usable slip length before open water
  },
  {
    id: 'DOCK_DOWNTOWN_RIVERSIDE',
    name: 'Downtown Riverside Dock',
    district: 'DOWNTOWN',
    // West of RIVER_AVENUE near canal junction
    x: -820, y: -600,
    heading: Math.PI / 2,  // heading South into canal
    surface: 'water',
    slipLength: 80,
  },
]);

// ─── Lookup helpers ───────────────────────────────────────────────────────────
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function roadById(id) { return CITY_ROADS.find(r => r.id === id) || null; }
export function districtById(id) { return CITY_DISTRICTS.find(d => d.id === id) || null; }
export function destinationById(id) { return CITY_DESTINATIONS.find(d => d.id === id) || null; }
export function helipadById(id) { return CITY_HELIPADS.find(h => h.id === id) || null; }
export function boatDockById(id) { return CITY_BOAT_DOCKS.find(d => d.id === id) || null; }

/** Returns the nearest helipad to world-space point {x, y}. */
export function nearestHelipad(point) {
  return CITY_HELIPADS.reduce((best, h) => distance(point, h) < distance(point, best) ? h : best);
}

/** Returns the nearest boat dock to world-space point {x, y}. */
export function nearestBoatDock(point) {
  return CITY_BOAT_DOCKS.reduce((best, d) => distance(point, d) < distance(point, best) ? d : best);
}

const sidewalkOffsetFallback = r => (r ? Math.max(r.lanes * 23, r.class === 'ARTERIAL' ? 70 : r.class === 'AVENUE' ? 52 : 40) / 2 + 20 : 36);
export function destinationPoint(id, side = 1) {
  const d = destinationById(id), r = d && roadById(d.roadId);
  if (!d || !r) return null;
  return { ...roadPoint(d.roadId, d.index, side * sidewalkOffsetFallback(r)), destinationId: d.id, district: d.district, kind: d.kind };
}

export function buildCityGraph() {
  const nodes = [];
  for (const road of CITY_ROADS) {
    for (let i = 0; i < road.points.length; i++) {
      const [x, y] = road.points[i];
      nodes.push({ id: `node:${road.id}:${i}`, roadId: road.id, index: i, x, y, speed: road.speed, lanes: road.lanes, oneWay: road.oneWay, class: road.class, zone: road.zone, links: [] });
    }
  }
  for (const road of CITY_ROADS) {
    const roadNodes = nodes.filter(n => n.roadId === road.id).sort((a, b) => a.index - b.index);
    for (let i = 0; i < roadNodes.length - 1; i++) {
      const a = roadNodes[i], b = roadNodes[i + 1];
      a.links.push(b);
      if (!road.oneWay) b.links.push(a);
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (a.roadId === b.roadId) continue;
      const roadA = roadById(a.roadId), roadB = roadById(b.roadId);
      if (roadA?.gradeSeparated || roadB?.gradeSeparated) continue;
      if (distance(a, b) <= 0.001) {
        if (!a.links.includes(b)) a.links.push(b);
        if (!b.links.includes(a)) b.links.push(a);
      }
    }
  }
  return nodes;
}

export function roadPoint(roadId, index, lateralOffset = 0) {
  const road = roadById(roadId);
  if (!road || index < 0 || index >= road.points.length) return null;
  const pts = road.points, cur = pts[index], next = pts[Math.min(pts.length - 1, index + 1)], prev = pts[Math.max(0, index - 1)];
  const forward = next !== cur ? next : cur !== prev ? cur : [cur[0] + 1, cur[1]];
  const base = next !== cur ? cur : prev;
  const dx = forward[0] - base[0], dy = forward[1] - base[1], len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return { x: cur[0] + nx * lateralOffset, y: cur[1] + ny * lateralOffset, heading: Math.atan2(dy, dx) };
}

export function nearestRoadNode(point, graph = buildCityGraph()) {
  let best = null, bestDist = Infinity;
  for (const node of graph) {
    const d = distance(point, node);
    if (d < bestDist) { bestDist = d; best = node; }
  }
  return best;
}

export function shortestRoute(startPoint, endPoint, graph = buildCityGraph()) {
  const start = nearestRoadNode(startPoint, graph), goal = nearestRoadNode(endPoint, graph);
  if (!start || !goal) return [];
  if (start.id === goal.id) return [start];
  const queue = [[start]], visited = new Set([start.id]);
  while (queue.length > 0) {
    const path = queue.shift(), cur = path[path.length - 1];
    if (cur.id === goal.id) return path;
    for (const next of cur.links) {
      if (!visited.has(next.id)) { visited.add(next.id); queue.push([...path, next]); }
    }
  }
  return [];
}
