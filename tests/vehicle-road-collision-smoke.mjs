import assert from 'node:assert/strict';
import { buildRoadNetwork, roadSegments, snapToRoad, ROAD_WIDTH } from '../src/game/road_authority.js';
import { isLand } from '../src/game/islands.js';
import { vehicleWorldBlocked, nearestRoadDistanceForVehicle } from '../src/game/vehicle_collision.js';

const blocked=(x,y)=>false;
const nodes=buildRoadNetwork({isLand,blocked,limit:2720,grid:160});
const lines=roadSegments(nodes);
const start=snapToRoad({x:-320,y:0},nodes);
assert.ok(start,'a road spawn must exist');
assert.equal(vehicleWorldBlocked(start.x,start.y,start.heading,lines,{length:56,width:28}),false,'car must be valid on road');
const roadDistance=nearestRoadDistanceForVehicle(start.x,start.y,lines);
assert.ok(roadDistance<=1,'snapped vehicle must sit on road centreline');
const offRoadY=start.y+ROAD_WIDTH+30;
assert.equal(vehicleWorldBlocked(start.x,offRoadY,start.heading,lines,{length:56,width:28}),true,'car must not drive freely far outside road corridor');
console.log('VEHICLE ROAD COLLISION: PASS CENTRELINE + OFFROAD BLOCK');
