import { CITY_ROADS } from './city_semantics.js';
import { BRIDGES } from './islands.js';
import { WORLD } from './world.js';
import { CARRIAGEWAY_WIDTH, CURB_MARGIN } from './road_constants.js';

const EPSILON = 0.001;
const PROXIMITY_RADIUS = 90;

const point = ([x, y]) => ({ x, y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const samePoint = (a, b) => distance(a, b) <= EPSILON;

function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + dx * t, y: a.y + dy * t });
}

function roadNodes() {
  return CITY_ROADS.flatMap(road => road.points.map((raw, index) => ({
    id: `${road.id}:${index}`, roadId: road.id, index, ...point(raw)
  })));
}

function explicitIntersections(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const key = `${node.x}:${node.y}`;
    const group = groups.get(key) || [];
    group.push(node);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter(group => new Set(group.map(node => node.roadId)).size > 1)
    .map(group => ({ point: { x: group[0].x, y: group[0].y }, nodes: group.map(({ id, roadId, index }) => ({ id, roadId, index })) }));
}

function proximityCandidates(nodes) {
  const candidates = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i], b = nodes[j];
      if (a.roadId === b.roadId || samePoint(a, b)) continue;
      const d = distance(a, b);
      if (d < PROXIMITY_RADIUS) candidates.push({ a: a.id, b: b.id, aRoad: a.roadId, bRoad: b.roadId, distance: d });
    }
  }
  return candidates;
}

function bridgeEndpointBindings(nodes) {
  return BRIDGES.map(bridge => {
    const endpoints = [{ name: 'a', ...bridge.a }, { name: 'b', ...bridge.b }];
    return {
      bridgeId: bridge.id,
      width: bridge.width,
      endpoints: endpoints.map(endpoint => {
        const nearest = nodes.reduce((best, node) => !best || distance(endpoint, node) < best.distance
          ? { nodeId: node.id, roadId: node.roadId, index: node.index, distance: distance(endpoint, node) }
          : best, null);
        return { endpoint: endpoint.name, x: endpoint.x, y: endpoint.y, nearest };
      })
    };
  });
}

function rectangleIntersectsRoad(building, road, halfWidth) {
  const [x, y, width, height] = building;
  const corners = [{ x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }];
  for (let i = 0; i < road.points.length - 1; i += 1) {
    const a = point(road.points[i]);
    const b = point(road.points[i + 1]);
    if (corners.some(corner => pointToSegmentDistance(corner, a, b) <= halfWidth)) return true;
  }
  return false;
}

function buildingRoadConflicts() {
  const clearance = CARRIAGEWAY_WIDTH / 2 + CURB_MARGIN;
  const conflicts = [];
  WORLD.buildings.forEach((building, buildingIndex) => {
    CITY_ROADS.forEach(road => {
      if (rectangleIntersectsRoad(building, road, clearance)) conflicts.push({ buildingIndex, building, roadId: road.id, clearance });
    });
  });
  return conflicts;
}

export function buildWorldGeometryDiagnostic() {
  const nodes = roadNodes();
  return {
    metadata: { proximityRadius: PROXIMITY_RADIUS, epsilon: EPSILON, roadClearance: CARRIAGEWAY_WIDTH / 2 + CURB_MARGIN },
    counts: { roads: CITY_ROADS.length, roadNodes: nodes.length, bridges: BRIDGES.length, buildings: WORLD.buildings.length },
    explicitIntersections: explicitIntersections(nodes),
    proximityCandidates: proximityCandidates(nodes),
    bridgeEndpointBindings: bridgeEndpointBindings(nodes),
    buildingRoadConflicts: buildingRoadConflicts()
  };
}
