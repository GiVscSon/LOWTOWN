import assert from 'node:assert/strict';
import { buildWorldGeometryDiagnostic } from '../src/game/world_geometry_diagnostics.js';

const report = buildWorldGeometryDiagnostic();
assert.ok(report.counts.roads > 0, 'diagnostic must inspect city roads');
assert.ok(report.counts.bridges >= 2, 'diagnostic must inspect both declared bridges');
assert.ok(report.explicitIntersections.length > 0, 'city must retain exact-coordinate intersections');
assert.ok(report.proximityCandidates.length > 0, 'baseline must expose legacy proximity candidates');
const east = report.bridgeEndpointBindings.find(item => item.bridgeId === 'EAST_BRIDGE');
const north = report.bridgeEndpointBindings.find(item => item.bridgeId === 'NORTH_BRIDGE');
assert.ok(east && north, 'both bridge binding reports are required');
assert.ok(east.endpoints.every(item => item.nearest), 'east bridge endpoints must have nearest-node diagnostics');
assert.ok(north.endpoints.every(item => item.nearest), 'north bridge endpoints must have nearest-node diagnostics');
assert.ok(north.endpoints.some(item => item.nearest.distance > 90), 'baseline must expose NORTH_BRIDGE endpoint gap before migration');
console.log(JSON.stringify(report, null, 2));
