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
  for (let i = 0; i < road.points.length - 1; i++) {
    const a = road.points[i], b = road.points[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) {
      throw new Error(`${road.id} has a zero-length segment at index ${i}`);
    }
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
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i], [bx, by] = points[i + 1];
    const dx = bx - ax, dy = by - ay;
    const length = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(length / step));
    for (let s = 0; s <= steps; s++) {
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
  for (let i = 0; i < centerline.length; i++) {
    const s = centerline[i];
    const points = road.points;
    const segIndex = Math.min(points.length - 2, s.segmentIndex);
    const [ax, ay] = points[segIndex], [bx, by] = points[segIndex + 1];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let e = -edgeSamples; e <= edgeSamples; e++) {
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
    for (let e = -edgeSamples; e <= edgeSamples; e++) {
      const offset = (e / edgeSamples) * hw;
      out.push({ x: s.x + nx * offset, y: s.y + ny * offset, bridge, offset });
    }
  }
  return out;
}

function segmentIntersection(a1, a2, b1, b2) {
  const [x1, y1] = a1, [x2, y2] = a2, [x3, y3] = b1, [x4, y4] = b2;
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return null;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1), t, u };
}

const sharesVertex = (p, points) => points.some(([x, y]) => Math.hypot(p.x - x, p.y - y) <= EPSILON);

export function findSegmentIntersections(roads = CITY_ROADS) {
  const segs = allRoadSegments(roads);
  const unmarked = [];
  const allowed = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i], s2 = segs[j];
      if (s1.roadId === s2.roadId) continue;
      const hit = segmentIntersection(
        [s1.a.x, s1.a.y], [s1.b.x, s1.b.y],
        [s2.a.x, s2.a.y], [s2.b.x, s2.b.y]
      );
      if (!hit) continue;
      const declared = sharesVertex(hit, s1.road.points) && sharesVertex(hit, s2.road.points);
      if (declared) continue;
      const entry = { x: hit.x, y: hit.y, roadA: s1.roadId, roadB: s2.roadId };
      if (s1.road.gradeSeparated || s2.road.gradeSeparated) allowed.push(entry);
      else unmarked.push(entry);
    }
  }
  return { unmarked, allowed };
}
