import assert from 'node:assert/strict';
import { createAIDriver } from '../src/game/ai_driver.js';
import { createTransportController } from '../src/game/transport_controller.js';
import { TRANSPORT_TYPES } from '../src/game/transport_constants.js';
import { resolveTransportPhysics } from '../src/game/transport_profiles.js';

const nodes=[];
for(let x=0;x<=640;x+=160)for(let y=0;y<=640;y+=160)nodes.push({x,y,id:nodes.length,links:[]});
for(const n of nodes){for(const m of nodes){if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===160)n.links.push(m);}}
const blocked=()=>false;

function runProfile(vehicleId){
  const transport=createTransportController(vehicleId,{x:160,y:160});
  const ai=createAIDriver({nodes,blocked,getTraffic:()=>[]});
  ai.start(transport.state);
  assert.equal(transport.state.physics,transport.physics,'vehicle state must expose the live physics profile directly');
  const expected=resolveTransportPhysics(vehicleId);
  assert.equal(transport.state.physics.mass,expected.mass);
  assert.equal(transport.state.physics.engineForce,expected.engineForce);
  assert.equal(transport.state.physics.brakeForce,expected.brakeForce);
  assert.equal(transport.state.physics.steeringRate,expected.steeringRate);
  assert.equal(transport.state.physics.lateralGrip,expected.lateralGrip);
  assert.equal(transport.state.physics.maxForwardSpeed,expected.maxForwardSpeed);

  for(let i=0;i<30;i++){
    const control=ai.update(transport.state,1/60);
    assert.ok(control);
    transport.step(1/60,control);
    for(const k of ['x','y','vx','vy','a','distance'])assert.ok(Number.isFinite(transport.state[k]),`${vehicleId}:${k} is not finite`);
    for(const k of ['throttle','brake','steer'])assert.ok(Number.isFinite(control[k]),`${vehicleId}:${k} control is not finite`);
    assert.equal(transport.state.physics,transport.physics);
    assert.ok(ai.state.targetSpeed<=expected.maxForwardSpeed+1e-6,`${vehicleId}: AI target speed exceeded profile max`);
  }

  assert.ok(ai.state.decisions>0,`${vehicleId}: AI made no decisions`);
  assert.ok(ai.state.route.length>0,`${vehicleId}: AI route is empty`);
  return {transport,ai,expected};
}

const sedan=runProfile('sedan');
assert.equal(sedan.transport.state.type,TRANSPORT_TYPES.CAR);
assert.equal(sedan.transport.state.vehicleId,'sedan');
assert.equal(sedan.transport.physics.mass,1500);

const coupe=runProfile('coupe');
const truck=runProfile('truck');
assert.notEqual(coupe.expected.maxForwardSpeed,truck.expected.maxForwardSpeed);
assert.notEqual(coupe.expected.steeringRate,truck.expected.steeringRate);
assert.ok(truck.expected.mass>sedan.expected.mass);

const police=runProfile('police');
assert.equal(police.transport.state.type,TRANSPORT_TYPES.CAR);

console.log('AI TRANSPORT INTEGRATION SMOKE: PASS LIVE PROFILE -> AI -> CONTROLLER -> VEHICLE STATE -> CAR PHYSICS');
