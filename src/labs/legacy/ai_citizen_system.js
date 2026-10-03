import { createAICharacterVehicle, AI_CHARACTER_STATES } from './ai_character_vehicle.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function createAICitizenSystem({ createTransport, aiFactory, nodes=[], blocked=()=>false, count=1, walkSpeed=32 }={}) {
  if(typeof createTransport!=='function'||typeof aiFactory!=='function')throw new Error('AI citizen system requires createTransport and aiFactory');
  const citizens=[];
  let cursor=0;
  function point(){for(let i=0;i<nodes.length;i++){cursor=(cursor+1)%nodes.length;const n=nodes[cursor];if(n&&!blocked(n.x,n.y))return n;}return nodes[0]||{x:0,y:0};}
  function spawn(vehicleId='sedan'){
    const p=point(),transport=createTransport(vehicleId,{x:p.x,y:p.y,a:0}),ai=aiFactory(),actor=createAICharacterVehicle({ai,transport,walkSpeed});
    actor.enter();
    const citizen={id:citizens.length,vehicleId:transport.vehicleId,transport,ai,actor,age:0,cycles:0};
    citizens.push(citizen);return citizen;
  }
  while(citizens.length<Math.max(0,Math.floor(finite(count,1))))spawn();
  function update(dt=1/60){const h=clamp(finite(dt,1/60),0,.1);for(const c of citizens){c.age+=h;c.actor.update(h);if(c.actor.onFoot&&!c.actor.state.target){const p=point();c.actor.setWalkTarget(p);}if(c.actor.onFoot&&c.actor.state.target){const dx=c.actor.state.target.x-c.actor.state.x,dy=c.actor.state.target.y-c.actor.state.y;if(Math.hypot(dx,dy)<2){c.actor.enter();c.cycles++;}}}return snapshot();}
  function snapshot(){return citizens.map(c=>({id:c.id,vehicleId:c.vehicleId,age:c.age,cycles:c.cycles,mode:c.actor.state.phase,x:c.actor.state.x,y:c.actor.state.y,entries:c.actor.state.entries,exits:c.actor.state.exits,vehicle:{x:c.transport.state.x,y:c.transport.state.y,vx:c.transport.state.vx,vy:c.transport.state.vy}}));}
  return {citizens,spawn,update,snapshot};
}
