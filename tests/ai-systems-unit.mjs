import assert from 'node:assert/strict';
import { createExplorationMemory } from '../src/game/exploration_memory.js';
import { createDestinationManager } from '../src/game/destination_manager.js';
import { createRouteDiversity } from '../src/game/route_diversity.js';
import { createExperimentHistory } from '../src/game/experiment_history.js';

const nodes = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  x: (i % 4) * 160,
  y: Math.floor(i / 4) * 160,
  links: []
}));
for (let i = 0; i < nodes.length; i++) {
  if (i % 4) nodes[i].links.push(nodes[i - 1]);
  if (i % 4 < 3) nodes[i].links.push(nodes[i + 1]);
  if (i >= 4) nodes[i].links.push(nodes[i - 4]);
  if (i < 4) nodes[i].links.push(nodes[i + 4]);
}

const memory = createExplorationMemory({ cellSize: 160 });
memory.touch(0, 0, 0);
assert.equal(memory.stats().cells, 1);
assert(memory.score(480, 480) > memory.score(0, 0));

const destinations = createDestinationManager({ nodes });
const chosen = destinations.choose({ x: 0, y: 0 }, { minDistance: 150 });
assert(chosen);
assert.equal(destinations.state().nodeId, chosen.node.id);
destinations.complete();
assert.equal(destinations.state(), null);

const diversity = createRouteDiversity();
const routeA = [nodes[0], nodes[1], nodes[2], nodes[3]];
const routeB = [nodes[4], nodes[5], nodes[6], nodes[7]];
diversity.remember(routeA);
assert(diversity.novelty(routeB) > diversity.novelty(routeA));

const history = createExperimentHistory();
history.record({ id: 1, metrics: { distance: 100, collisions: 2 } });
const current = history.record({ id: 2, metrics: { distance: 180, collisions: 1 } });
const delta = history.compare(current);
assert.equal(delta.delta.distance, 80);
assert.equal(delta.delta.collisions, -1);

console.log('isolated AI systems: PASS');
