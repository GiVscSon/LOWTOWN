import assert from 'node:assert/strict';
import { buildRoadNetwork, roadSegments, snapToRoad, ROAD_WIDTH } from '../src/game/road_authority.js';
import { isLand } from '../src/game/islands.js';
import { vehicleWorldBlocked, nearestRoadDistanceForVehicle } from '../src/game/vehicle_collision.js';

const nodes=buildRoadNetwork();
const lines=roadSegments(nodes);
assert.ok(nodes.length>0,'road authority must produce nodes');
assert.ok(lines.length>0,'road authority must produce segments');

const center={x:nodes[0].x,y:nodes[0].y};
assert.equal(vehicleWorldBlocked(center.x,center.y,0,lines),false,'vehicle on road centerline must not be blocked');

const deepWater={x:4200,y:4200};
assert.equal(vehicleWorldBlocked(deepWater.x,deepWater.y,0,lines),true,'vehicle outside land/roads must be blocked');
console.log('vehicle-road-collision-smoke OK');
