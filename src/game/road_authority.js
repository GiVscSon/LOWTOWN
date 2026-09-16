import { buildCityGraph } from './city_semantics.js';
import { CARRIAGEWAY_WIDTH } from './road_constants.js';

export const ROAD_GRID = 160;
export const ROAD_LIMIT = 2720;
export const ROAD_WIDTH = CARRIAGEWAY_WIDTH;
export const ROAD_HALF_WIDTH = ROAD_WIDTH / 2;
export const ROAD_EDGE_TOLERANCE = 8;

const distanceToSegment = (x, y, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
  const px = a.x + dx * t, py = a.y + dy * t;
  return { x: px, y: py, t, distance: Math.hypot(x - px, y - py) };
};

export function buildRoadNetwork() {
  const source = buildCityGraph();
  const byId = new Map();
  const nodes = source.map(n => {
    const out = { x: n.x, y: n.y, id: n.id, roadId: n.roadId, index: n.index, links: [] };
    byId.set(out.id, out);
    return out;
  });
  for (const sourceNode of source) {
    const node = byId.get(sourceNode.id);
    node.links = (sourceNode.links || []).map(link => byId.get(link.id)).filter(Boolean);
  }
  globalThis.__LOWTOWN_CITY_GRAPH = nodes;
  return nodes;
}

export function roadSegments(nodes = []) {
  const seen = new Set(), segments = [];
  for (const a of nodes) for (const b of a.links) {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    segments.push([a, b]);
  }
  globalThis.__LOWTOWN_ROAD_LINES = segments;
  return segments;
}

export function nearestRoadPoint(x, y, nodes = []) {
  let best = null;
  for (const [a, b] of roadSegments(nodes)) {
    const hit = distanceToSegment(x, y, a, b);
    if (!best || hit.distance < best.distance) best = { x: hit.x, y: hit.y, distance: hit.distance, heading: Math.atan2(b.y - a.y, b.x - a.x), a, b, t: hit.t };
  }
  return best;
}

export function snapToRoad(point, nodes = []) {
  const hit = nearestRoadPoint(Number(point?.x) || 0, Number(point?.y) || 0, nodes);
  if (!hit) return null;
  return { x: hit.x, y: hit.y, heading: hit.heading, distance: hit.distance, node: hit.a, segment: [hit.a, hit.b], t: hit.t };
}

export function isNearRoad(x, y, nodes = [], radius = ROAD_HALF_WIDTH) {
  const hit = nearestRoadPoint(x, y, nodes);
  return !!hit && hit.distance <= radius;
}

export function roadDistance(x, y, nodes = []) {
  const hit = nearestRoadPoint(x, y, nodes);
  return hit ? hit.distance : Infinity;
}
