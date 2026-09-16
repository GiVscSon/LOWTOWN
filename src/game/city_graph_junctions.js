import { CITY_ROADS } from './city_semantics.js';

const EPSILON = 0.001;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildJunctionGraph(roads = CITY_ROADS) {
  const nodes = [];
  for (const road of roads) {
    for (let i = 0; i < road.points.length; i += 1) {
      nodes.push({
        id: `${road.id}:${i}`,
        roadId: road.id,
        index: i,
        x: road.points[i][0],
        y: road.points[i][1],
        links: []
      });
    }
  }

  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const road of roads) {
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const a = byId.get(`${road.id}:${i}`);
      const b = byId.get(`${road.id}:${i + 1}`);
      a.links.push(b);
      if (!road.oneWay) b.links.push(a);
    }
  }

  const groups = new Map();
  for (const node of nodes) {
    const key = `${node.x}:${node.y}`;
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
      nodes: group.map(node => node.id)
    });
    for (const a of group) {
      for (const b of group) {
        if (a.id === b.id || a.links.includes(b)) continue;
        a.links.push(b);
      }
    }
  }

  return { nodes, junctions };
}

export function proximityOnlyEdges(legacyNodes, explicitNodes) {
  const explicitIds = new Set();
  for (const node of explicitNodes) {
    for (const link of node.links) explicitIds.add(`${node.id}->${link.id}`);
  }
  const extra = [];
  for (const node of legacyNodes) {
    for (const link of node.links) {
      const id = `${node.id}->${link.id}`;
      if (!explicitIds.has(id) && distance(node, link) > EPSILON) extra.push({ from: node.id, to: link.id, distance: distance(node, link) });
    }
  }
  return extra;
}
