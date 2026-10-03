export function createRouteDiversity({ cellSize = 160, recentLimit = 12 } = {}) {
  const recent = [];
  const key = (x, y) => `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

  function remember(route = []) {
    const signature = route.map(n => key(n.x, n.y)).join('|');
    if (!signature) return;
    const duplicate = recent.indexOf(signature);
    if (duplicate >= 0) recent.splice(duplicate, 1);
    recent.unshift(signature);
    while (recent.length > recentLimit) recent.pop();
  }

  function novelty(route = []) {
    if (!route.length) return 0;
    const signature = route.map(n => key(n.x, n.y)).join('|');
    let best = 1;
    for (const old of recent) {
      const a = signature.split('|');
      const b = old.split('|');
      const overlap = a.filter(v => b.includes(v)).length / Math.max(1, a.length);
      best = Math.min(best, 1 - overlap);
    }
    return best;
  }

  function shouldReject(route, threshold = 0.28) {
    return novelty(route) < threshold;
  }

  function stats() {
    return { recentRoutes: recent.length, recentLimit, cellSize };
  }

  function clear() { recent.length = 0; }

  return { remember, novelty, shouldReject, stats, clear };
}
