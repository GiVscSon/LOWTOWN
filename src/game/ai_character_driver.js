import { createCharacterState, stepCharacterPhysics, characterTelemetry } from './character_physics.js';

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const AI_CHARACTER_MODES=Object.freeze({ON_FOOT:'ON_FOOT',ENTERING:'ENTERING',DRIVING:'DRIVING',EXITING:'EXITING'});

export function createAICharacterDriver({ai,transport,walkSpeed=34,acceleration=120,turnRate=9,radius=10,blocked=()=>{},exitDistance=30}={}){
  if(!ai)throw new Error('AI character requires ai');
  const character=createCharacterState({x:transport?.state?.x,y:transport?.state?.y,a:transport?.state?.a,walkSpeed,acceleration,turnRate,radius});
  const state={mode:AI_CHARACTER_MODES.ON_FOOT,x:character.x,y:character.y,a:character.a,walkSpeed:character.speed,exitDistance:Math.max(8,finite(exitDistance,30)),exitReason:null,vehicleOccupied:false,steps:0};
  let walkTarget=null;

  function sync(){state.x=character.x;state.y=character.y;state.a=character.a;state.walkSpeed=character.speed;}
  function setPosition(x,y,a=character.a){character.x=finite(x,character.x);character.y=finite(y,character.y);character.a=finite(a,character.a);character.vx=0;character.vy=0;sync();}
  function enter(){
    if(!transport)throw new Error('Character cannot enter without a transport instance');
    setPosition(transport.state.x,transport.state.y,transport.state.a);
    state.mode=AI_CHARACTER_MODES.ENTERING;state.vehicleOccupied=true;state.exitReason=null;walkTarget=null;
    if(typeof ai.start==='function')ai.start(transport.state);
    state.mode=AI_CHARACTER_MODES.DRIVING;
    return snapshot();
  }
  function setWalkTarget(target){walkTarget=target?{x:finite(target.x),y:finite(target.y)}:null;return snapshot();}
  function exit(reason='MANUAL'){
    if(state.mode!==AI_CHARACTER_MODES.DRIVING)return snapshot();
    const a=finite(transport?.state?.a,character.a),x=finite(transport?.state?.x,character.x),y=finite(transport?.state?.y,character.y);
    setPosition(x-Math.cos(a)*state.exitDistance,y-Math.sin(a)*state.exitDistance,a);
    state.mode=AI_CHARACTER_MODES.EXITING;state.exitReason=reason||'MANUAL';state.vehicleOccupied=false;
    if(typeof ai.reset==='function')ai.reset();
    state.mode=AI_CHARACTER_MODES.ON_FOOT;
    return snapshot();
  }
  function update(dt=1/60){
    const h=clamp(finite(dt,1/60),0,.1);
    if(state.mode===AI_CHARACTER_MODES.DRIVING){
      const control=typeof ai.update==='function'?ai.update(transport.state,h):{};
      transport.step(h,control||{});
      syncFromVehicle();
      return snapshot();
    }
    if(state.mode===AI_CHARACTER_MODES.ON_FOOT){
      const input=walkTarget?{x:walkTarget.x-character.x,y:walkTarget.y-character.y}:{x:0,y:0};
      const before=character.distance;
      stepCharacterPhysics(character,h,input,blocked);
      if(walkTarget&&Math.hypot(walkTarget.x-character.x,walkTarget.y-character.y)<5)walkTarget=null;
      state.steps+=character.distance-before;
      sync();
    }
    return snapshot();
  }
  function syncFromVehicle(){
    if(!transport)return;
    character.x=finite(transport.state.x,character.x);character.y=finite(transport.state.y,character.y);character.a=finite(transport.state.a,character.a);character.vx=finite(transport.state.vx);character.vy=finite(transport.state.vy);sync();
  }
  function snapshot(){return {...state,character:{...character},walkTarget:walkTarget?{...walkTarget}:null,transport:transport?{vehicleId:transport.vehicleId,state:{x:transport.state.x,y:transport.state.y,a:transport.state.a,vx:transport.state.vx,vy:transport.state.vy}}:null};}
  return {state,character,enter,exit,update,setWalkTarget,snapshot,get onFoot(){return state.mode===AI_CHARACTER_MODES.ON_FOOT;},get driving(){return state.mode===AI_CHARACTER_MODES.DRIVING;}};
}
