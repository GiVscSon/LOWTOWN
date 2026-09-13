import assert from 'node:assert/strict';
import { createTransportController } from '../src/game/transport_controller.js';
import { createAIDriver } from '../src/game/ai_driver.js';

function directTruck(){
  const t=createTransportController('truck',{x:0,y:0,a:0});
  const p=t.physics;
  const initial=t.state.x;
  let maxApplied=0;
  for(let i=0;i<120;i++){
    const telemetry=t.step(1/60,{throttle:1,brake:0,steer:0});
    maxApplied=Math.max(maxApplied,telemetry.actuator.applied.throttle);
  }
  assert.equal(t.state.mass,p.mass,'direct: mass mismatch');
  assert(maxApplied>.7,`direct: throttle contact lost, applied=${maxApplied}`);
  assert(t.state.x>initial+1,`direct: truck failed to accelerate, x=${t.state.x}`);
  assert(t.state.distance>1,`direct: distance=${t.state.distance}`);
  assert(t.state.telemetry.physics.engineForce>0);
  return {mode:'direct',mass:p.mass,engineForce:p.engineForce,maxApplied:+maxApplied.toFixed(3),speed:+t.state.telemetry.velocity.toFixed(3),distance:+t.state.distance.toFixed(3)};
}

function aiTruck(){
  const GRID=160,nodes=[];
  for(let x=0;x<=960;x+=GRID)for(let y=0;y<=960;y+=GRID)nodes.push({x,y,id:nodes.length,links:[]});
  for(const n of nodes)for(const m of nodes)if(Math.abs(n.x-m.x)+Math.abs(n.y-m.y)===GRID)n.links.push(m);
  const t=createTransportController('truck',{x:160,y:160});
  const ai=createAIDriver({nodes,blocked:()=>false,getTraffic:()=>[]});
  ai.start(t.state);
  let maxCommand=0,maxApplied=0,maxSpeed=0;
  for(let i=0;i<180;i++){
    const c=ai.update(t.state,1/60);
    assert(c,'AI returned no control');
    maxCommand=Math.max(maxCommand,c.throttle);
    const telemetry=t.step(1/60,c);
    maxApplied=Math.max(maxApplied,telemetry.actuator.applied.throttle);
    maxSpeed=Math.max(maxSpeed,telemetry.velocity);
    for(const k of ['throttle','brake','steer'])assert(Number.isFinite(c[k]),`AI control ${k} non-finite`);
  }
  assert(maxCommand>.05,`AI: no meaningful throttle command=${maxCommand}`);
  assert(maxApplied>.02,`AI/controller contact lost applied=${maxApplied}`);
  assert(maxSpeed>.5,`AI/physics contact failed speed=${maxSpeed}`);
  assert(t.state.distance>.5,`AI/physics contact failed distance=${t.state.distance}`);
  return {mode:'ai',maxCommand:+maxCommand.toFixed(3),maxApplied:+maxApplied.toFixed(3),maxSpeed:+maxSpeed.toFixed(3),distance:+t.state.distance.toFixed(3),decisions:ai.state.decisions};
}

const result=[directTruck(),aiTruck()];
console.log('TRANSPORT CONTACT TRACE: PASS DIRECT PHYSICS + AI -> CONTROLLER -> ACTUATOR -> PHYSICS');
console.log(JSON.stringify(result,null,2));
