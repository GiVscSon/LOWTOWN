import assert from 'node:assert/strict';
import { CITY_ROADS, CITY_DISTRICTS, CITY_DESTINATIONS, buildCityGraph, destinationPoint, pedestrianRoute, vehicleRoute } from '../src/game/city_semantics.js';

assert.ok(CITY_ROADS.length >= 8);
assert.ok(CITY_DISTRICTS.length >= 4);
assert.ok(CITY_DESTINATIONS.length >= 6);

const graph = buildCityGraph();
assert.ok(graph.length > 50, 'semantic city graph must contain many road nodes');
assert.ok(graph.some(n => n.roadId === 'LOWTOWN_BOULEVARD'));
assert.ok(graph.some(n => n.roadId === 'MARKET_STREET'));

const home = destinationPoint('LOWTOWN_APARTMENTS');
const market = destinationPoint('MARKET_HALL');
assert.ok(home && market);

const pedestrians = pedestrianRoute(home, market);
const vehicles = vehicleRoute(home, market);
assert.ok(pedestrians.length >= 2, 'pedestrian route must connect destinations');
assert.ok(vehicles.length >= 2, 'vehicle route must connect destinations');
assert.ok(pedestrians.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.roadId));
assert.ok(vehicles.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.roadId));
assert.ok(new Set(pedestrians.map(p => p.roadId)).size >= 2, 'pedestrian route should cross semantic road network');

console.log('SEMANTIC CITY ROUTING: PASS ROADS + DISTRICTS + DESTINATIONS + PEDESTRIAN/VEHICLE ROUTES');
