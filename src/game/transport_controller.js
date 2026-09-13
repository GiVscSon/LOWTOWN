import { createTransportState, transportStep, transportTelemetry } from './transport_physics.js';
import { TRANSPORT_TYPES } from './transport_constants.js';
import { getTransportProfile, getTransportTypeProfile, resolveTransportPhysics } from './transport_profiles.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function calibratedPhysics(base,calibration=null){
  if(!calibration||calibration.ready===false)return base;
  const confidence=clamp(finite(calibration.confidence,0),0,1);
  const scale=(value,fallback=1)=>clamp(finite(value,fallback),.75,1.25);
  const accelerationScale=scale(calibration.accelerationScale);
  const brakingScale=scale(calibration.brakingScale);
  const steeringScale=scale(calibration.steeringScale);
  const dragScale=scale(calibration.dragScale);
  const turnRadiusScale=scale(calibration.turnRadiusScale);
  return {...base,
    engineForce:base.engineForce*(1+(accelerationScale-1)*confidence),
    brakeForce:base.brakeForce*(1+(brakingScale-1)*confidence),
    steeringRate:base.steeringRate*(1+(steeringScale-1)*confidence),
    drag:base.drag*(1+(dragScale-1)*confidence),
    turnRadius:base.turnRadius*(1+(turnRadiusScale-1)*confidence),
    calibration:{accelerationScale,brakingScale,steeringScale,dragScale,turnRadiusScale,confidence}
  };
}

export function createTransportController(vehicleId='sedan',initial={}){
  let currentId=getTransportProfile(vehicleId).id;
  const profile=()=>getTransportProfile(currentId);
  const state=createTransportState({type:profile().type,vehicleId:currentId,mass:profile().mass,...initial});
  let calibration=null;
  let physics=resolveTransportPhysics(currentId);
  state.mass=physics.mass;
  state.physics=physics;
  let lastInput={throttle:0,brake:0,steer:0,handbrake:false,climb:0,descend:0};

  function rebuildPhysics(){
    physics=calibratedPhysics(resolveTransportPhysics(currentId),calibration);
    state.mass=physics.mass;
    state.physics=physics;
    return physics;
  }

  function setVehicle(id){
    const next=getTransportProfile(id);
    currentId=next.id;
    rebuildPhysics();
    state.vehicleId=currentId;
    state.type=next.type;
    state.surface=next.type===TRANSPORT_TYPES.CAR?'road':next.type===TRANSPORT_TYPES.BOAT?'water':'air';
    return next;
  }

  function setCalibration(next=null){
    calibration=next&&typeof next==='object'?{...next}:null;
    rebuildPhysics();
    return calibration;
  }

  function clearCalibration(){
    calibration=null;
    rebuildPhysics();
    return physics;
  }

  function control(input={}){
    const type=state.type;
    lastInput={
      throttle:clamp(Number(input.throttle)||0,-1,1),
      brake:clamp(Number(input.brake)||0,0,1),
      steer:clamp(Number(input.steer)||0,-1,1),
      handbrake:type===TRANSPORT_TYPES.CAR&&!!input.handbrake,
      climb:type===TRANSPORT_TYPES.PLANE?clamp(Number(input.climb)||0,-1,1):0,
      descend:type===TRANSPORT_TYPES.PLANE?clamp(Number(input.descend)||0,0,1):0
    };
    if(type===TRANSPORT_TYPES.PLANE)lastInput.throttle=Math.max(0,lastInput.throttle);
    return lastInput;
  }

  function step(dt,input=lastInput){
    control(input);
    const old={x:state.x,y:state.y,z:state.z};
    const telemetry=transportStep(state,dt,lastInput);
    const dx=state.x-old.x,dy=state.y-old.y,dz=state.z-old.z;
    telemetry.frameDistance=Math.hypot(dx,dy,dz);
    telemetry.vehicleId=currentId;
    telemetry.physics={type:physics.type,mass:physics.mass,maxSpeed:physics.maxForwardSpeed,engineForce:physics.engineForce,brakeForce:physics.brakeForce,steeringRate:physics.steeringRate,grip:physics.lateralGrip,turnRadius:physics.turnRadius,calibration:physics.calibration||null};
    telemetry.calibration=calibration?{...calibration}:null;
    state.telemetry=telemetry;
    return telemetry;
  }

  function snapshot(){
    const v=profile();
    const t=getTransportTypeProfile(v.type);
    return {vehicleId:v.id,profile:v,typeProfile:t,state:{...state},physics:{...physics},calibration:calibration?{...calibration}:null,input:{...lastInput},telemetry:transportTelemetry(state,lastInput)};
  }

  return {get vehicleId(){return currentId;},get profile(){return profile();},get typeProfile(){return getTransportTypeProfile(state.type);},get state(){return state;},get physics(){return physics;},get calibration(){return calibration;},setVehicle,setCalibration,clearCalibration,control,step,snapshot};
}
