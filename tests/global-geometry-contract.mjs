import assert from 'node:assert/strict';
import { CITY_ROADS,CITY_DESTINATIONS,buildCityGraph,destinationPoint,shortestRoute } from '../src/game/city_semantics.js';
import { BRIDGES,isLand } from '../src/game/islands.js';
import { WORLD } from '../src/game/world.js';
import { buildRoadNetwork,roadSegments,ROAD_HALF_WIDTH,ROAD_EDGE_TOLERANCE } from '../src/game/road_authority.js';
import { vehicleWorldBlocked } from '../src/game/vehicle_collision.js';
import { buildWorldGeometryDiagnostic } from '../src/game/world_geometry_diagnostics.js';
const eps=.001,graph=buildCityGraph(),authority=buildRoadNetwork(),lines=roadSegments(authority),origin={x:-120,y:0};
assert.ok(CITY_ROADS.length&&graph.length,'city needs roads and nodes');
assert.equal(authority.length,graph.length,'authority must mirror city graph');
assert.deepEqual(authority.map(n=>n.id).sort(),graph.map(n=>n.id).sort(),'authority ids must mirror city graph');
const seen=new Set([graph[0].id]),q=[graph[0]];while(q.length)for(const n of q.shift().links)if(!seen.has(n.id)){seen.add(n.id);q.push(n)}assert.equal(seen.size,graph.length,'city graph is disconnected');
for(const r of CITY_ROADS)for(const [x,y]of r.points)assert.equal(isLand(x,y),true,`${r.id} node is not physical land`);
assert.equal(buildWorldGeometryDiagnostic().buildingRoadConflicts.length,0,'building intersects a road');
for(const b of BRIDGES){assert.ok(b.a&&b.b&&b.points?.length>=2,`${b.id} bridge format`);const f=b.points[0],l=b.points.at(-1);assert.ok(Math.hypot(b.a.x-f[0],b.a.y-f[1])<=eps&&Math.hypot(b.b.x-l[0],b.b.y-l[1])<=eps,`${b.id} alias mismatch`);for(const p of[b.a,b.b])assert.ok(graph.some(n=>Math.hypot(n.x-p.x,n.y-p.y)<=eps),`${b.id} endpoint has no road node`)}
for(const d of CITY_DESTINATIONS)assert.ok(shortestRoute(origin,destinationPoint(d.id)).length>=2,`${d.id} is unreachable`);assert.ok(shortestRoute(origin,WORLD.mission).length>=2,'mission is unreachable');
for(const r of CITY_ROADS){const[x,y]=r.points[0];assert.equal(vehicleWorldBlocked(x,y,0,lines,{length:28,width:16}),false,`${r.id} blocks center`)}
const[a,b]=CITY_ROADS[0].points,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,off={x:a[0]-dy/len*(ROAD_HALF_WIDTH+ROAD_EDGE_TOLERANCE+60),y:a[1]+dx/len*(ROAD_HALF_WIDTH+ROAD_EDGE_TOLERANCE+60)};assert.equal(vehicleWorldBlocked(off.x,off.y,0,lines,{length:28,width:16}),true,'off-road is not blocked');
console.log(JSON.stringify({result:'GLOBAL_GEOMETRY_OK',roads:CITY_ROADS.length,nodes:graph.length,segments:lines.length,bridges:BRIDGES.length,destinations:CITY_DESTINATIONS.length},null,2));
