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
  // authority may split a legacy segment at a true intersection and mint
  // different node IDs. The contract is about real geometric edges.
  const explicitEdges = new Set();
  const edgeKey = (a, b) => {
    const ak = String(Math.round(a.x / EPSILON)) + ':' + String(Math.round(a.y / EPSILON));
    const bk = String(Math.round(b.x / EPSILON)) + ':' + String(Math.round(b.y / EPSILON));
    return ak < bk ? ak + '|' + bk : bk + '|' + ak;
  };
  for (const node of explicitNodes) {
    for (const link of node.links) explicitEdges.add(edgeKey(node, link));
  }

  const extra = [];
  for (const node of legacyNodes) {
    for (const link of node.links) {
      if (distance(node, link) <= EPSILON) continue;
      const key = edgeKey(node, link);
      if (!explicitEdges.has(key)) {
        extra.push({ from: node.id, to: link.id, distance: distance(node, link) });
      }
    }
  }
  return extra;
}
