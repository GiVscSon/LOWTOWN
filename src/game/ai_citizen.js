import { createAICharacterDriver, AI_CHARACTER_MODES } from './ai_character_driver.js';

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createAICitizen({ai,transportFactory,nodes=[],blocked=()=>{},x=0,y=0,a=0,walkSpeed=32,searchRadius=420,decisionInterval=3}={}){
  if(!ai||typeof transportFactory!=='function')throw new Error('AI citizen requires ai and transportFactory');
  const state={mode:'WANDER',target:null,vehicleId:null,decisionTime:0,vehicleSearches:0,walkTargets:0,entries:0,exits:0};
  const actor=createAICharacterDriver({ai,x,y,a,walkSpeed,blocked});
  let transport=null;
  let cursor=0;

  function nearestNode(px,py){let best=null,bd=Infinity;for(const n of nodes){const d=Math.hypot(n.x-px,n.y-py);if(d<bd&&d<=searchRadius&&!blocked(n.x,n.y)){best=n;bd=d;}}return best;}
  function randomWalkTarget(){if(!nodes.length)return null;for(let i=0;i<nodes.length;i++){cursor=(cursor+1)%nodes.length;const n=nodes[cursor];if(!blocked(n.x,n.y))return {x:n.x,y:n.y};}return null;}
  function chooseTransport(){
    const n=nearestNode(actor.state.x,actor.state.y);if(!n)return false;
    transport=transportFactory({x:n.x,y:n.y,a:0});
    if(!transport||typeof transport.step!=='function')return false;
    actor.setTransport(transport);state.vehicleId=transport.vehicleId;state.vehicleSearches++;
    return true;
  }
  function update(dt=1/60){
    const h=clamp(finite(dt,1/60),0,.1);state.decisionTime-=h;
    if(actor.onFoot){
      if(!state.target||dist(actor.state,state.target)<5){state.target=randomWalkTarget();if(state.target){actor.setWalkTarget(state.target);state.walkTargets++;}}
      if(state.decisionTime<=0){
        state.decisionTime=decisionInterval;
        if(chooseTransport()){actor.enter();state.entries++;state.mode='DRIVING';}
      }
    }
    const before=actor.state.mode;actor.update(h);const after=actor.state.mode;
    if(before===AI_CHARACTER_MODES.DRIVING&&after===AI_CHARACTER_MODES.ON_FOOT){state.exits++;state.mode='WANDER';state.target=randomWalkTarget();if(state.target){actor.setWalkTarget(state.target);state.walkTargets++;}}
    if(actor.driving)state.mode='DRIVING';
    return snapshot();
  }
  function enterVehicle(){if(actor.onFoot&&chooseTransport()){actor.enter();state.entries++;state.mode='DRIVING';}return snapshot();}
  function exitVehicle(reason='MANUAL'){if(actor.driving)actor.exit(reason);return snapshot();}
  function snapshot(){return {...state,actor:actor.snapshot(),transport:transport?{vehicleId:transport.vehicleId,state:{x:transport.state.x,y:transport.state.y,a:transport.state.a,vx:transport.state.vx,vy:transport.state.vy}}:null};}
  return {state,actor,update,enterVehicle,exitVehicle,snapshot,get transport(){return transport;}};
}
