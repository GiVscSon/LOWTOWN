import assert from 'node:assert/strict';
import { CITY_ROADS, CITY_DESTINATIONS, destinationPoint, shortestRoute, buildCityGraph } from '../src/game/city_semantics.js';
import { WORLD } from '../src/game/world.js';
import { buildingIslandAt, isLand } from '../src/game/islands.js';
import { buildLayeredRoadTopology, ROAD_LEVELS } from '../src/game/road_topology.js';

const graph = buildCityGraph();
assert.ok(graph.length >= 50, `city graph unexpectedly small: ${graph.length}`);
assert.equal(new Set(graph.map(n => n.id)).size, graph.length, 'city graph contains duplicate node ids');

const seen = new Set();
const queue = [graph[0]];
seen.add(graph[0].id);
while (queue.length) {
  const node = queue.shift();
  for (const next of node.links) {
    if (!seen.has(next.id)) {
      seen.add(next.id);
      queue.push(next);
    }
  }
}
assert.equal(seen.size, graph.length, `city road graph is disconnected: ${graph.length - seen.size} unreachable nodes`);

for (const destination of CITY_DESTINATIONS) {
  const point = destinationPoint(destination.id);
  assert.ok(point, `missing destination point: ${destination.id}`);
  const route = shortestRoute({ x: -120, y: 0 }, point);
  assert.ok(route.length >= 2, `no road route to destination: ${destination.id}`);
}

for (const road of CITY_ROADS) {
  for (const point of road.points) assert.equal(isLand(point[0], point[1]), true, `road point is not physical ground: ${road.id} @ ${point.join(',')}`);
}

for (const [index, building] of WORLD.buildings.entries()) {
  const center = { x: building[0] + building[2] / 2, y: building[1] + building[3] / 2 };
  assert.ok(buildingIslandAt(center.x, center.y), `building ${index} has no district anchor`);
}

const topology = buildLayeredRoadTopology();
assert.equal(topology.length, graph.length, 'road authority is not using the city graph');
assert.ok(topology.every(node => node.level === ROAD_LEVELS.STREET), 'road authority contains unexpected road levels');
assert.equal(new Set(topology.map(node => node.id)).size, topology.length, 'road authority node ids are not unique');

console.log(`WORLD_AUTHORITY_OK roads=${CITY_ROADS.length} nodes=${graph.length} destinations=${CITY_DESTINATIONS.length} buildings=${WORLD.buildings.length}`);
