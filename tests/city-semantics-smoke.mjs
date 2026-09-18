import assert from 'node:assert/strict';
import { CITY_ROADS, CITY_DISTRICTS, buildCityGraph, shortestRoute, pedestrianRoute, vehicleRoute, vehicleLanePoint, sidewalkPoint, nearestRoad } from '../src/game/city_semantics.js';

assert.ok(CITY_ROADS.length >= 8, 'city needs named roads');
assert.ok(CITY_DISTRICTS.length >= 5, 'city needs meaningful districts');
{
  const hit=nearestRoad({x:-980,y:-330});
  assert.equal(hit.road.id,'LOWTOWN_BOULEVARD','nearest road must identify the containing segment');
  assert.ok(Math.abs(hit.point.x+980)<0.001 && Math.abs(hit.point.y+360)<0.001,'nearest road must project onto the segment, not snap to a vertex');
  assert.ok(Math.abs(hit.distance-30)<0.001,'nearest road segment distance must be exact');
  assert.ok(hit.t>0 && hit.t<1,'nearest road result must retain segment interpolation');
}
for (const road of CITY_ROADS) {
  assert.ok(road.name && road.id && road.points.length >= 2, `invalid road ${road.id}`);
  assert.ok(road.lanes >= 2 && road.speed > 0, `invalid traffic definition ${road.id}`);
  for (const p of road.points) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]), `invalid road point ${road.id}`);
  assert.ok(vehicleLanePoint(road.id, 0, 0), `no vehicle lane ${road.id}`);
  assert.ok(sidewalkPoint(road.id, 0, 1), `no sidewalk ${road.id}`);
}
const graph=buildCityGraph();
assert.ok(graph.length >= CITY_ROADS.length*2, 'semantic graph is too small');
const downtown=shortestRoute({x:-760,y:-360},{x:640,y:-360});
assert.ok(downtown.length >= 2, 'Downtown arterial route missing');
const harbor=shortestRoute({x:640,y:-360},{x:1700,y:-900});
assert.ok(harbor.length >= 2, 'Downtown to Iron Harbor route missing');
const pedestrians=pedestrianRoute({x:-760,y:-360},{x:-120,y:80});
const vehicles=vehicleRoute({x:-760,y:-360},{x:-120,y:80});
assert.ok(pedestrians.length >= 2 && vehicles.length >= 2, 'pedestrian/vehicle routes missing');
assert.ok(pedestrians.some(p => p.roadId) && vehicles.some(p => p.roadId), 'routes lost road identity');
assert.ok(pedestrians.some((p,i)=>vehicles[i]&&Math.hypot(p.x-vehicles[i].x,p.y-vehicles[i].y)>10), 'pedestrians are not separated from traffic lanes');
console.log(`CITY_SEMANTICS_OK roads=${CITY_ROADS.length} districts=${CITY_DISTRICTS.length} graphNodes=${graph.length}`);
