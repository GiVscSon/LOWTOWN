import assert from 'node:assert/strict';
import { buildCityGraph } from '../src/game/city_semantics.js';
import { buildJunctionGraph, proximityOnlyEdges } from '../src/game/city_graph_junctions.js';

const explicit = buildJunctionGraph();
const legacy = buildCityGraph();
assert.ok(explicit.nodes.length > 0, 'explicit graph must contain road nodes');
assert.ok(explicit.junctions.length > 0, 'downtown grid must keep exact-coordinate junctions');
assert.ok(explicit.junctions.every(j => j.nodes.length >= 2), 'every junction must join at least two nodes');
const extra = proximityOnlyEdges(legacy, explicit.nodes);
assert.equal(extra.length, 0, 'all road joins must be exact-coordinate junctions');
console.log(JSON.stringify({ junctions: explicit.junctions.length, proximityOnlyEdges: extra.length }, null, 2));
