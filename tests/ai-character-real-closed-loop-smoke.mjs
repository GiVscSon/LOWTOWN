import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { createAIDriver } from '../src/game/ai_driver.js';
import { createAICharacterDriver, AI_CHARACTER_MODES } from '../src/game/ai_character_driver.js';

const nodes=[];
for(let x=0;x<=960;x+=160){
  for(let y=-160;y<=160;y+=160){
    nodes.push({x,y,id:nodes.length,links:[]});
  }
}
for(const n of nodes){
  for(const m of nodes){
    if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===160)n.links.push(m);
  }
}

const blocked=()=>false;
const transport=createTransportController('sedan',{x:0,y:0,a:0});
const ai=createAIDriver({nodes,blocked,getTraffic:()=>[]});
const actor=createAICharacterDriver({ai,transport,stallSeconds:1.2});

assert.equal(actor.state.mode,AI_CHARACTER_MODES.ON_FOOT);
assert.equal(actor.enter().mode,AI_CHARACTER_MODES.DRIVING);

for(let i=0;i<180;i++)actor.update(1/60);

assert.equal(actor.state.mode,AI_CHARACTER_MODES.DRIVING,'real AI must remain in vehicle while transport is healthy');
assert(transport.state.x>2||transport.state.y>2,'real AI -> controller -> actuator -> physics must move vehicle');
assert(ai.state.decisions>0,'real AI must make control decisions');
assert(Number.isFinite(ai.state.prediction.confidence),'AI prediction confidence must remain finite');
assert(Number.isFinite(transport.state.vx)&&Number.isFinite(transport.state.vy),'vehicle velocity must remain finite');

const before=actor.state.steps;
actor.exit('TEST_EXIT');
assert.equal(actor.state.mode,AI_CHARACTER_MODES.ON_FOOT);
actor.update(1);
assert(actor.state.steps>before,'AI character must continue independently on foot after vehicle exit');

console.log('AI CHARACTER REAL CLOSED LOOP: PASS AI -> TRANSPORT -> MOTION -> EXIT -> ON FOOT');
