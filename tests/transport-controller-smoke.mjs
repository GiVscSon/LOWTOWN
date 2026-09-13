import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';

const ids=['taxi','sedan','coupe','police','van','truck','ferry','speedboat','light_plane','cargo_plane'];
for(const id of ids){
  const c=createTransportController(id,{z:id.includes('plane')?100:0});
  const start={x:c.state.x,y:c.state.y,z:c.state.z};
  const tele=c.step(1/60,{throttle:.75,steer:.2,brake:0,climb:id.includes('plane')?.25:0,descend:0});
  assert.equal(tele.vehicleType,c.profile.type);
  assert.equal(tele.physics.mass,c.profile.mass);
  assert.ok(Number.isFinite(tele.velocity));
  assert.ok(Number.isFinite(tele.physics.turnRadius));
  assert.ok(Number.isFinite(tele.frameDistance));
  assert.deepEqual(c.snapshot().input,{throttle:.75,brake:0,steer:.2,handbrake:false,climb:id.includes('plane')?.25:0,descend:0});
  assert.ok(Math.hypot(c.state.x-start.x,c.state.y-start.y)>0 || id.includes('plane'));
}

const coupe=createTransportController('coupe');
const truck=createTransportController('truck');
coupe.step(1/10,{throttle:1});
truck.step(1/10,{throttle:1});
assert.ok(coupe.physics.steeringRate>truck.physics.steeringRate);
assert.ok(coupe.physics.maxForwardSpeed>truck.physics.maxForwardSpeed);
assert.ok(coupe.physics.mass<truck.physics.mass);
console.log('TRANSPORT CONTROLLER SMOKE: PASS 10 PROFILES');
