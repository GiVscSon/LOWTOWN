import assert from 'node:assert/strict';
import { createAIDriver } from '../src/game/ai_driver.js';
import { createTransportController } from '../src/game/transport_controller.js';
import { TRANSPORT_TYPES } from '../src/game/transport_constants.js';

const nodes=[];
for(let x=0;x<=640;x+=160)for(let y=0;y<=640;y+=160)nodes.push({x,y,id:nodes.length,links:[]});
for(const n of nodes){for(const m of nodes){if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===160)n.links.push(m);}}
const blocked=()=>false;
const transport=createTransportController('sedan',{x:160,y:160});
const ai=createAIDriver({nodes,blocked,getTraffic:()=>[]});
ai.start(transport.state);
for(let i=0;i<30;i++){
  const control=ai.update(transport.state,1/60);
  assert.ok(control);
  transport.step(1/60,control);
  for(const k of ['x','y','vx','vy','a','distance'])assert.ok(Number.isFinite(transport.state[k]),`${k} is not finite`);
  for(const k of ['throttle','brake','steer'])assert.ok(Number.isFinite(control[k]),`${k} control is not finite`);
}
assert.equal(transport.state.type,TRANSPORT_TYPES.CAR);
assert.equal(transport.state.vehicleId,'sedan');
assert.equal(transport.physics.mass,1500);
assert.ok(ai.state.decisions>0);
assert.ok(ai.state.route.length>0);
console.log('AI TRANSPORT INTEGRATION SMOKE: PASS DIRECT AI -> CONTROLLER -> VEHICLE STATE -> CAR PHYSICS');
