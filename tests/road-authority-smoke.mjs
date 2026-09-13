import assert from 'node:assert/strict';
import { buildRoadNetwork, roadSegments, snapToRoad, ROAD_GRID, ROAD_WIDTH } from '../src/game/road_authority.js';

const blocked=(x,y)=>x>100&&x<260&&y>-120&&y<120;
const isLand=()=>true;
const nodes=buildRoadNetwork({isLand,blocked,limit:320,grid:ROAD_GRID});
assert.ok(nodes.length>0,'road authority must create nodes');
assert.ok(roadSegments(nodes).length>0,'road authority must create connected segments');
const spawn=snapToRoad({x:-320,y:0},nodes);
assert.ok(spawn,'road authority must find a spawn road');
assert.ok(Number.isFinite(spawn.heading),'spawn heading must be finite');
assert.ok(spawn.distance>=0,'spawn distance must be non-negative');
assert.equal(ROAD_WIDTH,92,'road width must remain shared with renderer');
console.log('ROAD AUTHORITY: PASS SINGLE GRAPH + SEGMENTS + SPAWN');
