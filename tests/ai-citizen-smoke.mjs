import assert from 'node:assert/strict';
import { createAICitizen } from '../src/game/ai_citizen.js';
import { createTransportController } from '../src/game/transport_controller.js';

const nodes=[];for(let i=0;i<12;i++)nodes.push({x:i*160,y:0});
let made=0;
const citizen=createAICitizen({
  ai:{start(){},reset(){},update(){return {throttle:1,brake:0,steer:0,handbrake:false};}},
  transportFactory:(initial)=>{made++;return createTransportController('sedan',initial);},
  nodes,
  x:0,y:0,
  searchRadius:5000,
  decisionInterval:99
});

for(let i=0;i<60;i++)citizen.update(1/60);
assert(citizen.actor.state.steps>0,'citizen must walk using character physics before using transport');
const walkingX=citizen.actor.state.x;
assert(citizen.snapshot().transport===null,'walking citizen must not require a transport');

citizen.enterVehicle();
assert(made===1,'citizen must acquire a transport only when choosing transport');
assert(citizen.snapshot().actor.mode==='DRIVING','citizen must enter transport explicitly');
for(let i=0;i<60;i++)citizen.update(1/60);
assert(citizen.snapshot().transport.state.x>walkingX,'transport must move independently of character physics');

citizen.exitVehicle('TEST_EXIT');
assert(citizen.snapshot().actor.mode==='ON_FOOT','citizen must return to independent on-foot mode');
const before=citizen.actor.state.steps;
citizen.actor.setWalkTarget({x:citizen.actor.state.x+100,y:citizen.actor.state.y});
for(let i=0;i<30;i++)citizen.update(1/60);
assert(citizen.actor.state.steps>before,'citizen must continue walking after leaving transport');
console.log('AI CITIZEN: PASS INDEPENDENT WALK -> ENTER TRANSPORT -> DRIVE -> EXIT -> WALK');
