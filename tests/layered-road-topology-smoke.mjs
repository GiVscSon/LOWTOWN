import assert from 'node:assert/strict';
import { buildLayeredRoadTopology, layeredRoadSegments, nearestLayeredRoadPoint, ROAD_LEVELS } from '../src/game/road_topology.js';

const buildings=[[ -100, -100, 200, 200 ]];
const isLand=()=>true;
const blocked=(x,y,level=ROAD_LEVELS.STREET)=>level===ROAD_LEVELS.STREET && buildings.some(([bx,by,bw,bh])=>x>bx&&x<bx+bw&&y>by&&y<by+bh);
const nodes=buildLayeredRoadTopology({isLand,blocked,limit:320,grid:160});
const lines=layeredRoadSegments(nodes);
const levels=new Set(nodes.map(n=>n.level));
assert.deepEqual([...levels].sort(),[0,1,2],'all three road levels must exist');
assert.ok(lines.some(([a,b])=>a.level!==b.level),'level connectors must exist');
const upper=nearestLayeredRoadPoint(0,0,nodes,ROAD_LEVELS.UPPER);
assert.ok(upper,'upper deck must be routable above a building');
assert.equal(upper.level,ROAD_LEVELS.UPPER);
const street=nearestLayeredRoadPoint(0,0,nodes,ROAD_LEVELS.STREET);
assert.equal(street,null,'street deck must respect the building footprint');
const lower=nearestLayeredRoadPoint(0,0,nodes,ROAD_LEVELS.LOWER);
assert.ok(lower,'lower deck must remain independent from street objects');
console.log('layered road topology smoke: PASS', {nodes:nodes.length,segments:lines.length,levels:[...levels].sort()});
