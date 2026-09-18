import { buildGeometryAuthority } from './road_geometry.js';

const EPSILON = 0.001;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildJunctionGraph(roads) {
  const nodes = buildGeometryAuthority(roads);
  const groups = new Map();
  for (const node of nodes) {
    const key = `${Math.round(node.x / EPSILON)}:${Math.round(node.y / EPSILON)}`;
    const group = groups.get(key) || [];
    group.push(node);
    groups.set(key, group);
  }

  const junctions = [];
  for (const group of groups.values()) {
    const roadIds = [...new Set(group.map(node => node.roadId))];
    if (roadIds.length < 2) continue;
    junctions.push({
      x: group[0].x,
      y: group[0].y,
      nodes: group.map(node => node.id),
      roadIds
    });
  }
  return { nodes, junctions };
}

// Kept as a diagnostic helper for old graph comparisons. It deliberately
// reports links that cannot be explained by exact shared geometry.
export function proximityOnlyEdges(legacyNodes, explicitNodes) {
  // Compare links by geometry, not generated node IDs. The independent
  // authority may split one legacy segment at a true intersection, so a
  // legacy edge can be represented by several smaller explicit edges.
  const pointKey = (p) => String(Math.round(p.x / EPSILON)) + ':' + String(Math.round(p.y / EPSILON));
  const explicitEdges = [];
  const seen = new Set();
  for (const node of explicitNodes) {
    for (const link of node.links) {
      const aKey = pointKey(node), bKey = pointKey(link);
      const key = aKey < bKey ? aKey + '|' + bKey : bKey + '|' + aKey;
      if (seen.has(key)) continue;
      seen.add(key);
      explicitEdges.push([node, link]);
    }
  }

  const pointOnLegacySegment = (p, a, b) => {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    if (len2 <= EPSILON * EPSILON) return distance(p, a) <= EPSILON;
    const cross = (p.x - a.x) * aby - (p.y - a.y) * abx;
    if (Math.abs(cross) > EPSILON * Math.sqrt(len2)) return false;
    const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
    return t >= -EPSILON && t <= 1 + EPSILON;
  };

  const legacyEdgeCovered = (a, b) => {
    if (distance(a, b) <= EPSILON) return true;
    const abx = b.x - a.x, aby = b.y - a.y, len2 = abx * abx + aby * aby;
    const intervals = [];
    for (const [u, v] of explicitEdges) {
      if (!pointOnLegacySegment(u, a, b) || !pointOnLegacySegment(v, a, b)) continue;
      const tu = ((u.x - a.x) * abx + (u.y - a.y) * aby) / len2;
      const tv = ((v.x - a.x) * abx + (v.y - a.y) * aby) / len2;
      intervals.push([Math.max(0, Math.min(tu, tv)), Math.min(1, Math.max(tu, tv))]);
    }
    intervals.sort((u, v) => u[0] - v[0]);
    let covered = 0;
    for (const [lo, hi] of intervals) {
      if (lo > covered + EPSILON) return false;
      covered = Math.max(covered, hi);
      if (covered >= 1 - EPSILON) return true;
    }
    return covered >= 1 - EPSILON;
  };

  const extra = [];
  for (const node of legacyNodes) {
    for (const link of node.links) {
      if (distance(node, link) <= EPSILON) continue;
      if (!legacyEdgeCovered(node, link)) {
        extra.push({ from: node.id, to: link.id, distance: distance(node, link) });
      }
    }
  }
  return extra;
}
