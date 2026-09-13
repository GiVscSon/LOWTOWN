import assert from 'node:assert/strict';

const clamp=(v)=>Math.max(-1,Math.min(1,v));
const stick=(x,y)=>({
  steer:Math.abs(x)<.16?0:clamp(x),
  forward:y<-.28?Math.max(0,Math.min(1,-y)):0,
  reverse:y>.28?Math.max(0,Math.min(1,y)):0,
});

assert.deepEqual(stick(0,-1),{steer:0,forward:1,reverse:0});
assert.deepEqual(stick(0,1),{steer:0,forward:0,reverse:1});
assert.equal(stick(-1,0).steer,-1);
assert.equal(stick(1,0).steer,1);
assert.equal(stick(.05,0).steer,0);
console.log('MOBILE CONTROLS CONTRACT: PASS STICK FORWARD + REVERSE + STEERING + DEADZONE');
