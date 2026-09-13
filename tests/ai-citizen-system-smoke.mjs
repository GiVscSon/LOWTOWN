import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { createAIDriver } from '../src/game/ai_driver.js';
import { createAICitizenSystem } from '../src/game/ai_citizen_system.js';

const nodes=[];for(let x=0;x<=960;x+=160)nodes.push({x,y:0,id:nodes.length,links:[]});
for(const n of nodes)for(const m of nodes)if(Math.abs(n.x-m.x)===160)n.links.push(m);
const system=createAICitizenSystem({
  count:1,nodes,blocked:()=>false,
  createTransport:(id,initial)=>createTransportController(id,initial),
  aiFactory:()=>createAIDriver({nodes,blocked:()=>false,getTraffic:()=>[]})
});
assert.equal(system.citizens.length,1);
const c=system.citizens[0];
assert.equal(c.actor.state.phase,'DRIVING');
for(let i=0;i<180;i++)system.update(1/60);
const s=system.snapshot()[0];
assert(Number.isFinite(s.vehicle.x)&&Number.isFinite(s.vehicle.vx));
assert(s.vehicle.x!==0||Math.abs(s.vehicle.vx)>0,'citizen vehicle must produce real motion');
assert(c.ai.state.decisions>0,'citizen AI must make decisions');
c.actor.forceExit('TEST');
for(let i=0;i<30;i++)system.update(1/60);
assert(c.actor.state.walkDistance>0,'citizen must continue on foot after exit');
console.log('AI CITIZEN SYSTEM: PASS SPAWN -> DRIVE -> REAL MOTION -> EXIT -> ON FOOT');
