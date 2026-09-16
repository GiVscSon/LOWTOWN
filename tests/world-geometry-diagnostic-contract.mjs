import assert from 'node:assert/strict';
import { buildWorldGeometryDiagnostic } from '../src/game/world_geometry_diagnostics.js';

const report = buildWorldGeometryDiagnostic();
assert.ok(report.counts.roads > 0, 'diagnostic must inspect city roads');
assert.ok(report.counts.bridges >= 2, 'diagnostic must inspect both declared bridges');
assert.ok(report.explicitIntersections.length > 0, 'city must retain exact-coordinate intersections');
const east = report.bridgeEndpointBindings.find(item => item.bridgeId === 'EAST_BRIDGE');
const north = report.bridgeEndpointBindings.find(item => item.bridgeId === 'NORTH_BRIDGE');
assert.ok(east && north, 'both bridge binding reports are required');
assert.ok(east.endpoints.every(item => item.nearest && item.nearest.distance <= 0.001), 'EAST_BRIDGE must sit on exact city-road nodes');
assert.ok(north.endpoints.every(item => item.nearest && item.nearest.distance <= 0.001), 'NORTH_BRIDGE must sit on exact city-road nodes');
console.log(JSON.stringify({ roads: report.counts.roads, junctions: report.explicitIntersections.length, bridges: report.bridgeEndpointBindings }, null, 2));
