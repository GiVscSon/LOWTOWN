import { TRANSPORT_TYPES } from './transport_constants.js';
import { stepCarPhysics } from './car_physics.js';
import { stepBoatPhysics } from './boat_physics.js';
import { stepPlanePhysics } from './plane_physics.js';
import { stepArcadeCar } from './arcade_car_physics.js';
import { applyActuatorDelay } from './vehicle_safety.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const DEFAULT_RESPONSE=Object.freeze({steer:12,throttle:8,brake:16,climb:8,descend:8});

function physicsStep(state,dt,input,physics){
  if(state.type===TRANSPORT_TYPES.CAR){
    if(physics?.model==='arcade-bicycle-swept')return stepArcadeCar(state,dt,input,physics);
    return stepCarPhysics(state,dt,input,physics);
  }
  if(state.type===TRANSPORT_TYPES.BOAT)return stepBoatPhysics(state,dt,input,physics);
  if(state.type===TRANSPORT_TYPES.PLANE)return stepPlanePhysics(state,dt,input,physics);
  throw new Error(`Unsupported transport type: ${state.type}`);
}

export function predictVehicle(state,seconds,input={},physics=state.physics,options={}){
  const safeSeconds=clamp(finite(seconds),0,10);
  const arcadeCar=state.type===TRANSPORT_TYPES.CAR&&physics?.model==='arcade-bicycle-swept';
  const physicsDt=arcadeCar?.05:1/120;
  const useActuator=options.useActuatorDelay!==false&&!!state.actuatorState;
  const response=useActuator?{...DEFAULT_RESPONSE,...(state.actuatorResponse||{}),...(options.actuatorResponse||{})}:null;
  // Match the live controller cadence. The prediction may use smaller physics
  // substeps, but actuator delay must be sampled at the same 60 Hz cadence as
  // transport_controller.step(), otherwise the predicted input is applied
  // more often than the real vehicle receives it.
  const controlDt=useActuator?Math.max(1/60,finite(options.controlDt,1/60)):physicsDt;
  let current={...state,telemetry:state.telemetry?{...state.telemetry}:state.telemetry};
  let actuator=useActuator?{...state.actuatorState}:null;
  const points=[];const blocked=typeof options.blocked==='function'?options.blocked:null;
  let collision=false,collisionT=safeSeconds,stepIndex=0,minWall=Infinity;
  const sampleEvery=Math.max(1,Math.floor(Math.max(physicsDt,safeSeconds/24)/physicsDt));
  let elapsed=0;
  while(elapsed<safeSeconds-1e-9){
    const frame=Math.min(controlDt,safeSeconds-elapsed);
    if(useActuator){actuator=applyActuatorDelay(input,actuator,frame,response);current.actuatorState={...actuator};}
    let frameElapsed=0;
    while(frameElapsed<frame-1e-9){
      const h=Math.min(physicsDt,frame-frameElapsed);
      physicsStep(current,h,useActuator?actuator:input,physics);
      elapsed+=h;frameElapsed+=h;stepIndex++;
      if(blocked&&blocked(current.x,current.y)){collision=true;collisionT=elapsed;break;}
      if(stepIndex%sampleEvery===0)points.push({x:current.x,y:current.y,z:current.z,a:current.a,vx:current.vx,vy:current.vy,vz:current.vz});
    }
    if(collision)break;
  }
  const speed=Math.hypot(current.vx,current.vy,current.vz),forward=current.vx*Math.cos(current.a)+current.vy*Math.sin(current.a),lateral=-current.vx*Math.sin(current.a)+current.vy*Math.cos(current.a),slip=Math.atan2(lateral,Math.max(1,Math.abs(forward)));
  const horizonUncertainty=clamp(safeSeconds*.035,0,.35),slipUncertainty=clamp(Math.abs(slip)/1.05*.22,0,.22),actuatorUncertainty=useActuator?clamp(Math.abs((actuator?.throttle||0)-(input.throttle||0))*.08+Math.abs((actuator?.steer||0)-(input.steer||0))*.12,0,.2):0;
  const uncertainty=clamp(horizonUncertainty+slipUncertainty+actuatorUncertainty+(collision?.08:0),0,.7);
  return {safe:!collision,collisionT,x:current.x,y:current.y,z:current.z,a:current.a,vx:current.vx,vy:current.vy,vz:current.vz,speed,points,minWall,slipAngle:slip,uncertainty,confidence:1-uncertainty,actuator:actuator?{...actuator}:null};
}
