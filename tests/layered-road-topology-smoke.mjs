import assert from 'node:assert/strict';
import { buildLayeredRoadTopology, layeredRoadSegments, nearestLayeredRoadPoint, ROAD_LEVELS } from '../src/game/road_topology.js';
import { CITY_ROADS, buildCityGraph } from '../src/game/city_semantics.js';

const nodes=buildLayeredRoadTopology();
const lines=layeredRoadSegments(nodes);
const city=buildCityGraph();

assert.equal(nodes.length,city.length,'road authority must mirror the city semantic graph');
assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,'road authority node ids must be unique');
assert.ok(nodes.every(n=>n.level===ROAD_LEVELS.STREET),'world road authority should currently use the street deck only');
assert.ok(lines.length>=CITY_ROADS.length,'road authority must expose connected city segments');

const start=nearestLayeredRoadPoint(-120,0,nodes,ROAD_LEVELS.STREET);
assert.ok(start,'street graph must contain the central starting road');
assert.ok(start.distance<1,'starting road should be an exact city road point');

const upper=nearestLayeredRoadPoint(0,0,nodes,ROAD_LEVELS.UPPER);
assert.equal(upper,null,'unused upper deck must not create phantom roads');

console.log('layered road topology smoke: PASS', {nodes:nodes.length,segments:lines.length,levels:[ROAD_LEVELS.STREET]});
