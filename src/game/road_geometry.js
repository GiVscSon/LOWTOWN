import { CITY_ROADS } from './city_semantics.js';
import {
  LANE_WIDTH,
  SIDEWALK_WIDTH,
  CURB_MARGIN,
  CLASS_MIN_CARRIAGEWAY,
  VISUAL_CLASS_SCALE
} from './road_constants.js';

const EPSILON = 0.001;

export function carriagewayWidth(road) {
  const laneTotal = (road.lanes || 2) * LANE_WIDTH;
  const minWidth = CLASS_MIN_CARRIAGEWAY[road.class] || CLASS_MIN_CARRIAGEWAY.STREET;
  return Math.max(laneTotal, minWidth);
}

export function carriagewayHalfWidth(road) {
  return carriagewayWidth(road) / 2;
}

export function collisionHalfWidth(road) {
  return carriagewayHalfWidth(road) + CURB_MARGIN;
}

export function supportHalfWidth(road) {
  return collisionHalfWidth(road) + SIDEWALK_WIDTH;
}

export function visualHalfWidth(road) {
  const scale = VISUAL_CLASS_SCALE[road.class] ?? 1;
  return Math.max(collisionHalfWidth(road), collisionHalfWidth(road) * scale);
}

export function sidewalkOffset(road) {
  return collisionHalfWidth(road) + SIDEWALK_WIDTH;
}

export function laneCenterOffset(road, lane) {
  const lanes = road.lanes || 2;
  const total = (lanes - 1) * LANE_WIDTH;
  return lane * LANE_WIDTH - total / 2;
}

export function roadSegments(road) {
  const segments = [];
  for (let i = 0; i < road.points.length - 1; i += 1) {
    const a = road.points[i], b = road.points[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) throw new Error(`${road.id} has a zero-length segment at index ${i}`);
    segments.push({
      roadId: road.id,
      index: i,
      a: { x: a[0], y: a[1] },
      b: { x: b[0], y: b[1] },
      length,
      heading: Math.atan2(dy, dx)
    });
  }
  return segments;
}

export function allRoadSegments(roads = CITY_ROADS) {
  const out = [];
  for (const road of roads) for (const segment of roadSegments(road)) out.push({ ...segment, road });
  return out;
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + dx * t, cy = ay + dy * t;
  return { distance: Math.hypot(px - cx, py - cy), x: cx, y: cy, t };
}

export function nearestRoadSegment(x, y, roads = CITY_ROADS) {
  let best = null;
  for (const entry of allRoadSegments(roads)) {
    const hit = pointToSegmentDistance(x, y, entry.a.x, entry.a.y, entry.b.x, entry.b.y);
    if (!best || hit.distance < best.distance) best = { ...hit, segment: entry, road: entry.road };
  }
  return best;
}

export function samplePolyline(points, step = 12) {
  const samples = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const dx = bx - ax, dy = by - ay;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / step));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      samples.push({ x: ax + dx * t, y: ay + dy * t, segmentIndex: i, t });
    }
  }
  return samples;
}

export function sampleRoadCorridor(road, { step = 12, halfWidth = null, edgeSamples = 3 } = {}) {
  const hw = halfWidth ?? collisionHalfWidth(road);
  const centerline = samplePolyline(road.points, step);
  const out = [];
  for (const s of centerline) {
    const segIndex = Math.min(road.points.length - 2, s.segmentIndex);
    const [ax, ay] = road.points[segIndex], [bx, by] = road.points[segIndex + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let e = -edgeSamples; e <= edgeSamples; e += 1) {
      const offset = (e / edgeSamples) * hw;
      out.push({ x: s.x + nx * offset, y: s.y + ny * offset, road, offset, centerlineT: s.t });
    }
  }
  return out;
}

export function bridgePoints(bridge) {
  if (Array.isArray(bridge?.points) && bridge.points.length >= 2) return bridge.points;
  if (bridge?.a && bridge?.b) return [[bridge.a.x, bridge.a.y], [bridge.b.x, bridge.b.y]];
  return [];
}

export function sampleBridgeCorridor(bridge, { step = 12, edgeSamples = 3 } = {}) {
  const points = bridgePoints(bridge);
  const hw = (bridge.width || 40) / 2;
  const centerline = samplePolyline(points, step);
  const out = [];
  for (const s of centerline) {
    const segIndex = Math.min(points.length - 2, s.segmentIndex);
    const [ax, ay] = points[segIndex], [bx, by] = points[segIndex + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let e = -edgeSamples; e <= edgeSamples; e += 1) {
      const offset = (e / edgeSamples) * hw;
      out.push({ x: s.x + nx * offset, y: s.y + ny * offset, bridge, offset });
    }
  }
  return out;
}

function segmentIntersection(a1, a2, b1, b2) {
  const [x1, y1] = a1, [x2, y2] = a2, [x3, y3] = b1, [x4, y4] = b2;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) <= EPSILON) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t, u };
}

const pointOnRoadVertex = (p, road) => road.points.some(([x, y]) => Math.hypot(p.x - x, p.y - y) <= EPSILON);
const isEndpoint = t => t <= EPSILON || t >= 1 - EPSILON;

function collectSegmentIntersections(roads = CITY_ROADS) {
  const segs = allRoadSegments(roads);
  const hits = [];
  for (let i = 0; i < segs.length; i += 1) {
    for (let j = i + 1; j < segs.length; j += 1) {
      const a = segs[i], b = segs[j];
      if (a.roadId === b.roadId) continue;
      const hit = segmentIntersection(
        [a.a.x, a.a.y], [a.b.x, a.b.y],
        [b.a.x, b.a.y], [b.b.x, b.b.y]
      );
      if (!hit) continue;
      const endpointContact = isEndpoint(hit.t) || isEndpoint(hit.u);
      if ((a.road.gradeSeparated || b.road.gradeSeparated) && !endpointContact) continue;
      hits.push({ a, b, ...hit });
    }
  }
  return hits;
}

export function findSegmentIntersections(roads = CITY_ROADS) {
  const unmarked = [];
  const allowed = [];
  for (const hit of collectSegmentIntersections(roads)) {
    const declared = pointOnRoadVertex({ x: hit.x, y: hit.y }, hit.a.road) && pointOnRoadVertex({ x: hit.x, y: hit.y }, hit.b.road);
    if (declared) continue;
    const entry = { x: hit.x, y: hit.y, roadA: hit.a.roadId, roadB: hit.b.roadId };
    if (hit.a.road.gradeSeparated || hit.b.road.gradeSeparated) allowed.push(entry);
    else unmarked.push(entry);
  }
  return { unmarked, allowed };
}

function pointToRectDistance(px, py, x, y, width, height) {
  const dx = Math.max(x - px, 0, px - (x + width));
  const dy = Math.max(y - py, 0, py - (y + height));
  return Math.hypot(dx, dy);
}

function segmentIntersectsRect(a, b, x, y, width, height) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const checks = [
    [-dx, a.x - x],
    [ dx, x + width - a.x],
    [-dy, a.y - y],
    [ dy, y + height - a.y]
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) <= EPSILON) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 <= t1 + EPSILON;
}

export function buildingIntersectsRoad(building, road, halfWidth = collisionHalfWidth(road)) {
  const [x, y, width, height] = building;
  for (const segment of roadSegments(road)) {
    if (segmentIntersectsRect(segment.a, segment.b, x, y, width, height)) return true;
    const corners = [
      { x, y }, { x: x + width, y },
      { x, y: y + height }, { x: x + width, y: y + height }
    ];
    if (corners.some(c => pointToSegmentDistance(c.x, c.y, segment.a.x, segment.a.y, segment.b.x, segment.b.y).distance <= halfWidth)) return true;
    const edges = [
      [{ x, y }, { x: x + width, y }],
      [{ x: x + width, y }, { x: x + width, y: y + height }],
      [{ x: x + width, y: y + height }, { x, y: y + height }],
      [{ x, y: y + height }, { x, y }]
    ];
    if (edges.some(([ea, eb]) => pointToSegmentDistance(ea.x, ea.y, segment.a.x, segment.a.y, segment.b.x, segment.b.y).distance <= halfWidth || pointToSegmentDistance(eb.x, eb.y, segment.a.x, segment.a.y, segment.b.x, segment.b.y).distance <= halfWidth)) return true;
    if (pointToRectDistance(segment.a.x, segment.a.y, x, y, width, height) <= halfWidth || pointToRectDistance(segment.b.x, segment.b.y, x, y, width, height) <= halfWidth) return true;
  }
  return false;
}

function addUniqueLink(a, b) {
  if (a !== b && !a.links.includes(b)) a.links.push(b);
}

function coordinateKey(x, y) {
  return `${Math.round(x / EPSILON) * EPSILON}:${Math.round(y / EPSILON) * EPSILON}`;
}

export function buildGeometryAuthority(roads = CITY_ROADS) {
  const intersections = collectSegmentIntersections(roads);
  const inserts = new Map();
  const addInsert = (roadId, segmentIndex, t, x, y) => {
    const key = `${roadId}:${segmentIndex}`;
    const list = inserts.get(key) || [];
    if (!list.some(v => Math.abs(v.t - t) <= EPSILON)) list.push({ t, x, y });
    inserts.set(key, list);
  };

  for (const hit of intersections) {
    addInsert(hit.a.roadId, hit.a.index, hit.t, hit.x, hit.y);
    addInsert(hit.b.roadId, hit.b.index, hit.u, hit.x, hit.y);
  }

  const nodes = [];
  const roadChains = new Map();
  for (const road of roads) {
    const chain = [];
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const [ax, ay] = road.points[i], [bx, by] = road.points[i + 1];
      const points = [{ t: 0, x: ax, y: ay }, ...(inserts.get(`${road.id}:${i}`) || []), { t: 1, x: bx, y: by }];
      points.sort((a, b) => a.t - b.t);
      for (const p of points) {
        const endpoint = p.t <= EPSILON || p.t >= 1 - EPSILON;
        const index = endpoint ? (p.t <= EPSILON ? i : i + 1) : `${i}x${p.t.toFixed(6)}`;
        const id = endpoint ? `${road.id}:${index}` : `${road.id}:${index}`;
        const existing = chain.find(n => Math.abs(n.x - p.x) <= EPSILON && Math.abs(n.y - p.y) <= EPSILON);
        if (!existing) chain.push({ id, roadId: road.id, index, x: p.x, y: p.y, links: [] });
      }
    }
    roadChains.set(road.id, chain);
    nodes.push(...chain);
  }

  const byCoord = new Map();
  for (const node of nodes) {
    const key = coordinateKey(node.x, node.y);
    const group = byCoord.get(key) || [];
    group.push(node);
    byCoord.set(key, group);
  }

  for (const road of roads) {
    const chain = roadChains.get(road.id) || [];
    for (let i = 0; i < chain.length - 1; i += 1) {
      const a = chain[i], b = chain[i + 1];
      addUniqueLink(a, b);
      if (!road.oneWay) addUniqueLink(b, a);
    }
  }

  for (const group of byCoord.values()) {
    const roadIds = new Set(group.map(n => n.roadId));
    if (roadIds.size < 2) continue;
    for (const a of group) {
      const road = roads.find(r => r.id === a.roadId);
      for (const b of group) {
        if (a === b || a.roadId === b.roadId) continue;
        addUniqueLink(a, b);
        if (road?.oneWay) continue;
      }
    }
  }

  for (const node of nodes) {
    node.level = 1;
    node.z = 34;
  }
  return nodes;
}
