import { createDriverExitDiagnostic, DRIVER_EXIT_STATES } from './driver_exit_diagnostic.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export const AI_CHARACTER_STATES=Object.freeze({ON_FOOT:'ON_FOOT',ENTERING:'ENTERING',DRIVING:'DRIVING',EXITING:'EXITING'});

export function createAICharacterVehicle({ ai, transport, walkSpeed=32, stallSeconds=2.5, sideOffset=28 }={}) {
  if(!ai||!transport)throw new Error('AI character vehicle requires ai and transport');
  const diagnostic=createDriverExitDiagnostic({stallSeconds});
  const state={phase:AI_CHARACTER_STATES.ON_FOOT,x:transport.state.x,y:transport.state.y,a:transport.state.a,walkSpeed:Math.max(1,finite(walkSpeed,32)),sideOffset:Math.max(8,finite(sideOffset,28)),target:null,exitReason:null,entries:0,exits:0,walkDistance:0};

  function snapshot(){return {...state,diagnostic:diagnostic.snapshot()};}
  function enter(){
    if(state.phase!==AI_CHARACTER_STATES.ON_FOOT)return snapshot();
    state.phase=AI_CHARACTER_STATES.ENTERING;state.x=transport.state.x;state.y=transport.state.y;state.a=transport.state.a;state.entries++;
    diagnostic.reset({x:transport.state.x,y:transport.state.y,heading:transport.state.a,speed:0});
    state.phase=AI_CHARACTER_STATES.DRIVING;
    ai.start(transport.state);
    return snapshot();
  }
  function setWalkTarget(target){state.target=target?{x:finite(target.x),y:finite(target.y)}:null;return snapshot();}
  function update(dt=1/60){
    const h=clamp(finite(dt,1/60),0,.1);
    if(state.phase===AI_CHARACTER_STATES.DRIVING){
      const control=ai.update(transport.state,h);
      const telemetry=control?transport.step(h,control):transport.step(h,{throttle:0,brake:1,steer:0});
      const d=diagnostic.update(h,telemetry);
      state.x=transport.state.x;state.y=transport.state.y;state.a=transport.state.a;
      if(d.phase===DRIVER_EXIT_STATES.EXITING){
        state.phase=AI_CHARACTER_STATES.EXITING;state.exitReason=d.exitReason;
        diagnostic.exit({x:transport.state.x+Math.cos(transport.state.a+Math.PI/2)*state.sideOffset,y:transport.state.y+Math.sin(transport.state.a+Math.PI/2)*state.sideOffset,heading:transport.state.a});
        state.x=diagnostic.state.driverX;state.y=diagnostic.state.driverY;state.a=diagnostic.state.driverA;state.exits++;state.phase=AI_CHARACTER_STATES.ON_FOOT;
      }
    } else if(state.phase===AI_CHARACTER_STATES.ON_FOOT&&state.target){
      const dx=state.target.x-state.x,dy=state.target.y-state.y,d=Math.hypot(dx,dy);
      if(d>1){const step=Math.min(d,state.walkSpeed*h),nx=state.x+dx/d*step,ny=state.y+dy/d*step;state.a=Math.atan2(dy,dx);state.x=nx;state.y=ny;state.walkDistance+=step;}
      if(d<=1)state.target=null;
    }
    return snapshot();
  }
  function forceExit(reason='MANUAL'){if(state.phase!==AI_CHARACTER_STATES.DRIVING)return snapshot();state.exitReason=reason;state.phase=AI_CHARACTER_STATES.EXITING;diagnostic.exit({x:transport.state.x+Math.cos(transport.state.a+Math.PI/2)*state.sideOffset,y:transport.state.y+Math.sin(transport.state.a+Math.PI/2)*state.sideOffset,heading:transport.state.a});state.x=diagnostic.state.driverX;state.y=diagnostic.state.driverY;state.a=diagnostic.state.driverA;state.exits++;state.phase=AI_CHARACTER_STATES.ON_FOOT;return snapshot();}
  function reset(){state.phase=AI_CHARACTER_STATES.ON_FOOT;state.x=transport.state.x;state.y=transport.state.y;state.a=transport.state.a;state.target=null;state.exitReason=null;diagnostic.reset({x:state.x,y:state.y,heading:state.a,speed:0});return snapshot();}
  return {state,diagnostic,enter,update,setWalkTarget,forceExit,reset,snapshot,get onFoot(){return state.phase===AI_CHARACTER_STATES.ON_FOOT;},get driving(){return state.phase===AI_CHARACTER_STATES.DRIVING;}};
}
