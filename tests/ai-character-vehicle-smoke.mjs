import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { createAICharacterVehicle, AI_CHARACTER_STATES } from '../src/game/ai_character_vehicle.js';
import { DRIVER_EXIT_STATES } from '../src/game/driver_exit_diagnostic.js';

function makeAI(){
  const nodes=[];for(let x=0;x<=640;x+=160)for(let y=0;y<=640;y+=160)nodes.push({x,y,id:nodes.length,links:[]});
  for(const n of nodes)for(const m of nodes)if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===160)n.links.push(m);
  return {nodes};
}

const {nodes}=makeAI();
const transport=createTransportController('sedan',{x:160,y:160});
const ai={start(){},update(){return {throttle:1,brake:0,steer:0,handbrake:false};}};
const actor=createAICharacterVehicle({ai,transport,stallSeconds:0.5});
assert.equal(actor.state.phase,AI_CHARACTER_STATES.ON_FOOT);
actor.enter();
assert.equal(actor.state.phase,AI_CHARACTER_STATES.DRIVING);
for(let i=0;i<30;i++)actor.update(1/60);
assert.equal(actor.state.phase,AI_CHARACTER_STATES.DRIVING,'healthy vehicle must keep AI driving');
assert(transport.state.x>160,'AI character vehicle must produce real vehicle motion');
assert(actor.state.entries===1&&actor.state.exits===0);

const stalledTransport=createTransportController('sedan',{x:160,y:160});
const stalledAI={start(){},update(){return {throttle:1,brake:0,steer:0,handbrake:false};}};
const stalled=createAICharacterVehicle({ai:stalledAI,transport:stalledTransport,stallSeconds:0.2});
const originalStep=stalledTransport.step;
stalledTransport.step=(dt,input)=>{const t=originalStep(dt,{...input,throttle:0,brake:1});t.x=stalledTransport.state.x;t.y=stalledTransport.state.y;t.velocity=0;t.frameDistance=0;t.acceleration=0;t.actuator={target:{throttle:1},applied:{throttle:1}};return t;};
stalled.enter();
for(let i=0;i<20;i++)stalled.update(1/60);
assert.equal(stalled.state.phase,AI_CHARACTER_STATES.ON_FOOT,'stalled vehicle must release the character');
assert.equal(stalled.state.exits,1);
assert(stalled.state.exitReason==='NO_ENGINE_RESPONSE'||stalled.state.exitReason==='NO_VEHICLE_MOTION');
stalled.setWalkTarget({x:260,y:160});
for(let i=0;i<30;i++)stalled.update(1/60);
assert(stalled.state.walkDistance>0,'released AI character must walk independently');
assert.equal(stalled.diagnostic.state.phase,DRIVER_EXIT_STATES.ON_FOOT);
console.log('AI CHARACTER VEHICLE: PASS ENTER -> DRIVE -> STALL -> EXIT -> ON FOOT');
