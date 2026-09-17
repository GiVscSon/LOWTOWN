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
  const explicitIds = new Set();
  for (const node of explicitNodes) {
    for (const link of node.links) explicitIds.add(`${node.id}->${link.id}`);
  }
  const extra = [];
  for (const node of legacyNodes) {
    for (const link of node.links) {
      const id = `${node.id}->${link.id}`;
      if (!explicitIds.has(id) && distance(node, link) > EPSILON) {
        extra.push({ from: node.id, to: link.id, distance: distance(node, link) });
      }
    }
  }
  return extra;
}
