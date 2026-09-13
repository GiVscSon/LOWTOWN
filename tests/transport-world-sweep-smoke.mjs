import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';

const car=createTransportController('sedan',{x:-120,y:-360,a:0});
const start={x:car.state.x,y:car.state.y};
for(let i=0;i<120;i++)car.step(1/60,{throttle:1,steer:0,brake:0});
assert.ok(car.state.x>start.x+40,'car must travel forward on a clear road');
assert.ok(car.state.v>20,'car must build real forward speed');
const safe={x:car.state.x,y:car.state.y};
car.state.x=900;car.state.y=-900;car.state.v=300;car.state.vx=300;car.state.vy=0;
car.step(1/60,{throttle:1});
assert.equal(car.state.x,safe.x,'out-of-world car must be restored');
assert.equal(car.state.y,safe.y,'out-of-world car must be restored');
assert.equal(car.state.v,0,'world collision must hard-stop the car');
console.log('TRANSPORT WORLD SWEEP: PASS ROAD MOTION + HARD WORLD GUARD');
