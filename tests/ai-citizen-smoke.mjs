import assert from 'node:assert/strict';
import { createAICitizen } from '../src/game/ai_citizen.js';
import { createTransportController } from '../src/game/transport_controller.js';

const nodes=[];for(let i=0;i<12;i++)nodes.push({x:i*160,y:0});
let made=0;
const citizen=createAICitizen({
  ai:{start(){},update(){return {throttle:1,brake:0,steer:0,handbrake:false};}},
  transportFactory:(initial)=>{made++;return createTransportController('sedan',initial);},
  nodes,
  searchRadius:5000
});
const s0=citizen.snapshot();assert.equal(s0.mode,'WANDER');
for(let i=0;i<10;i++)citizen.update(0.1);
assert(made>0,'citizen must acquire a transport');
assert(citizen.snapshot().actor,'citizen must own an actor');
assert(citizen.snapshot().vehicleId==='sedan');
assert(Number.isFinite(citizen.snapshot().actor.x)&&Number.isFinite(citizen.snapshot().actor.y));
console.log('AI CITIZEN: PASS TRANSPORT ACQUISITION + ACTOR LOOP');
