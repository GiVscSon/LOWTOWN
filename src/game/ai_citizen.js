import { createAICharacterVehicle, AI_CHARACTER_STATES } from './ai_character_vehicle.js';

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createAICitizen({ ai, transportFactory, nodes=[], blocked=()=>false, walkSpeed=32, searchRadius=420, decisionInterval=.75 }={}) {
  if(!ai||typeof transportFactory!=='function')throw new Error('AI citizen requires ai and transportFactory');
  const state={mode:'WANDER',target:null,vehicleId:null,decisionTime:0,vehicleSearches:0,walkTargets:0,entries:0,exits:0};
  let transport=null;
  let actor=null;
  let cursor=0;

  function nearestNode(x,y){let best=null,bd=Infinity;for(const n of nodes){const d=Math.hypot(n.x-x,n.y-y);if(d<bd&&d<=searchRadius&&!blocked(n.x,n.y)){best=n;bd=d;}}return best;}
  function randomWalkTarget(){if(!nodes.length)return null;for(let i=0;i<nodes.length;i++){cursor=(cursor+1)%nodes.length;const n=nodes[cursor];if(!blocked(n.x,n.y))return {x:n.x,y:n.y};}return null;}
  function chooseTransport(){const n=nearestNode(actor.state.x,actor.state.y);if(!n)return false;transport=transportFactory({x:n.x,y:n.y,a:0});actor=createAICharacterVehicle({ai,transport,walkSpeed});actor.setWalkTarget({x:n.x,y:n.y});state.vehicleId=transport.vehicleId;state.vehicleSearches++;return true;}
  function update(dt=1/60){const h=clamp(finite(dt,1/60),0,.1);state.decisionTime-=h;
    if(!actor){if(state.decisionTime<=0){state.decisionTime=decisionInterval;const ok=chooseTransport();if(!ok)state.target=randomWalkTarget();}return snapshot();}
    const before=actor.state.phase;actor.update(h);const after=actor.state.phase;
    if(before!==after){if(after===AI_CHARACTER_STATES.DRIVING)state.entries++;if(after===AI_CHARACTER_STATES.ON_FOOT&&before===AI_CHARACTER_STATES.DRIVING){state.exits++;state.mode='WANDER';state.target=randomWalkTarget();if(state.target){actor.setWalkTarget(state.target);state.walkTargets++;}}}
    if(actor.onFoot&&state.target&&dist(actor.state,state.target)<2){state.target=randomWalkTarget();if(state.target){actor.setWalkTarget(state.target);state.walkTargets++;}}
    if(actor.driving)state.mode='DRIVING';
    return snapshot();
  }
  function enterVehicle(){if(!actor)chooseTransport();if(actor&&!actor.driving){actor.enter();state.mode='DRIVING';}return snapshot();}
  function snapshot(){return { ...state,actor:actor?.snapshot()||null,transport:transport?{vehicleId:transport.vehicleId,state:{x:transport.state.x,y:transport.state.y,a:transport.state.a,vx:transport.state.vx,vy:transport.state.vy}}:null};}
  return {state,update,enterVehicle,snapshot,get actor(){return actor;},get transport(){return transport;}};
}
