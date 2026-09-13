import { createDriverExitDiagnostic, DRIVER_EXIT_STATES } from './driver_exit_diagnostic.js';

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const AI_CHARACTER_MODES=Object.freeze({ON_FOOT:'ON_FOOT',ENTERING:'ENTERING',DRIVING:'DRIVING',EXITING:'EXITING'});

export function createAICharacterDriver({ai,transport,walkSpeed=34,exitDistance=30,stallSeconds=2.5}={}){
  if(!ai||!transport)throw new Error('AI character requires ai and transport');
  const diagnostic=createDriverExitDiagnostic({stallSeconds});
  const state={mode:AI_CHARACTER_MODES.ON_FOOT,x:finite(transport.state?.x),y:finite(transport.state?.y),a:finite(transport.state?.a),walkSpeed:Math.max(1,finite(walkSpeed,34)),exitDistance:Math.max(8,finite(exitDistance,30)),exitReason:null,vehicleOccupied:false,steps:0};
  let walkTarget=null;
  function sync(){state.x=finite(transport.state?.x,state.x);state.y=finite(transport.state?.y,state.y);state.a=finite(transport.state?.a,state.a);}
  function enter(){sync();state.mode=AI_CHARACTER_MODES.ENTERING;state.vehicleOccupied=true;state.exitReason=null;diagnostic.reset({x:state.x,y:state.y,heading:state.a,speed:0});ai.start(transport.state);state.mode=AI_CHARACTER_MODES.DRIVING;return snapshot();}
  function setWalkTarget(){const a=finite(transport.state?.a,state.a);state.x=finite(transport.state?.x,state.x)-Math.cos(a)*state.exitDistance;state.y=finite(transport.state?.y,state.y)-Math.sin(a)*state.exitDistance;state.a=a;walkTarget={x:state.x+Math.cos(a)*120,y:state.y+Math.sin(a)*120};}
  function exit(reason='MANUAL'){sync();state.mode=AI_CHARACTER_MODES.EXITING;state.exitReason=reason||diagnostic.state.exitReason||'MANUAL';state.vehicleOccupied=false;ai.reset();setWalkTarget();diagnostic.exit({x:state.x,y:state.y,heading:state.a});state.mode=AI_CHARACTER_MODES.ON_FOOT;return snapshot();}
  function walk(dt){if(!walkTarget)return;const dx=walkTarget.x-state.x,dy=walkTarget.y-state.y,d=Math.hypot(dx,dy);if(d<5){walkTarget=null;return;}const h=clamp(finite(dt),0,.1),step=Math.min(d,state.walkSpeed*h);state.a=Math.atan2(dy,dx);state.x+=Math.cos(state.a)*step;state.y+=Math.sin(state.a)*step;state.steps+=step;}
  function update(dt=1/60){const h=clamp(finite(dt),0,.1);if(state.mode===AI_CHARACTER_MODES.DRIVING){const control=ai.update(transport.state,h);const telemetry=transport.step(h,control||{});const diag=diagnostic.update(h,telemetry);if(diag.phase===DRIVER_EXIT_STATES.EXITING)return exit(diag.exitReason);sync();return snapshot();}if(state.mode===AI_CHARACTER_MODES.ON_FOOT)walk(h);return snapshot();}
  function snapshot(){return {...state,diagnostic:diagnostic.snapshot(),walkTarget:walkTarget?{...walkTarget}:null};}
  return {state,diagnostic,enter,exit,update,snapshot,get onFoot(){return state.mode===AI_CHARACTER_MODES.ON_FOOT;},get driving(){return state.mode===AI_CHARACTER_MODES.DRIVING;}};
}
