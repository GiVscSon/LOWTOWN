export function createExplorationMemory({ cellSize = 160, capacity = 2048 } = {}) {
  const cells = new Map();
  const visits = [];
  const keyOf = (x, y) => `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;

  function touch(x, y, now = performance.now()) {
    const key = keyOf(x, y);
    const old = cells.get(key);
    const next = { key, x: Math.floor(x / cellSize), y: Math.floor(y / cellSize), visits: (old?.visits || 0) + 1, lastSeen: now };
    cells.set(key, next);
    visits.push(key);
    if (visits.length > capacity) {
      const removed = visits.shift();
      if (removed && !visits.includes(removed)) cells.delete(removed);
    }
    return next;
  }

  function score(x, y, now = performance.now()) {
    const cell = cells.get(keyOf(x, y));
    if (!cell) return 1;
    const age = Math.max(0, now - cell.lastSeen) / 1000;
    return Math.min(1, 0.15 + age / 90) / Math.max(1, Math.sqrt(cell.visits));
  }

  function leastVisited(nodes = []) {
    return [...nodes].sort((a, b) => score(b.x, b.y) - score(a.x, a.y));
  }

  function stats() {
    let totalVisits = 0;
    let maxVisits = 0;
    for (const cell of cells.values()) {
      totalVisits += cell.visits;
      maxVisits = Math.max(maxVisits, cell.visits);
    }
    return { cells: cells.size, totalVisits, maxVisits, cellSize };
  }

  function clear() {
    cells.clear();
    visits.length = 0;
  }

  return { touch, score, leastVisited, stats, clear, cells };
}
