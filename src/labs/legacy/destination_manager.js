export function createDestinationManager({ nodes = [], blocked = () => false } = {}) {
  const destinations = [];
  let current = null;
  let serial = 0;

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const safe = n => n && !blocked(n.x, n.y) && Array.isArray(n.links) && n.links.length > 0;

  function rebuild() {
    destinations.length = 0;
    for (const node of nodes) {
      if (!safe(node)) continue;
      const degree = node.links.length;
      destinations.push({
        id: `dest-${++serial}`,
        node,
        x: node.x,
        y: node.y,
        weight: 1 + degree * 0.4,
        tags: degree >= 3 ? ['junction', 'busy'] : ['street']
      });
    }
    return destinations;
  }

  function choose(origin, { minDistance = 320, maxDistance = Infinity, novelty = () => 1, avoid = new Set() } = {}) {
    if (!destinations.length) rebuild();
    let best = null;
    let bestScore = -Infinity;
    for (const d of destinations) {
      if (avoid.has(d.node.id)) continue;
      const dist = distance(origin, d);
      if (dist < minDistance || dist > maxDistance) continue;
      const score = dist * 0.7 + d.weight * 80 + novelty(d.x, d.y) * 500 + Math.random() * 80;
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    current = best;
    return best;
  }

  function complete() {
    if (!current) return null;
    const done = current;
    current = null;
    return done;
  }

  function state() {
    return current ? { id: current.id, nodeId: current.node.id, x: current.x, y: current.y, tags: [...current.tags] } : null;
  }

  rebuild();
  return { rebuild, choose, complete, state, destinations };
}
