import { createTransportState, transportStep, transportTelemetry, TRANSPORT_TYPES } from './transport_physics.js';
import { getTransportProfile, getTransportTypeProfile, resolveTransportPhysics } from './transport_profiles.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createTransportController(vehicleId='sedan',initial={}){
  let currentId=getTransportProfile(vehicleId).id;
  const profile=()=>getTransportProfile(currentId);
  const state=createTransportState({type:profile().type,vehicleId:currentId,mass:profile().mass,...initial});
  let physics=resolveTransportPhysics(currentId);
  state.mass=physics.mass;
  let lastInput={throttle:0,brake:0,steer:0,handbrake:false,climb:0,descend:0};

  function setVehicle(id){
    const next=getTransportProfile(id);
    currentId=next.id;
    physics=resolveTransportPhysics(currentId);
    state.vehicleId=currentId;
    state.type=next.type;
    state.mass=physics.mass;
    state.surface=next.type===TRANSPORT_TYPES.CAR?'road':next.type===TRANSPORT_TYPES.BOAT?'water':'air';
    return next;
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
    telemetry.physics={
      type:physics.type,mass:physics.mass,maxSpeed:physics.maxForwardSpeed,
      engineForce:physics.engineForce,brakeForce:physics.brakeForce,
      steeringRate:physics.steeringRate,grip:physics.lateralGrip,turnRadius:physics.turnRadius
    };
    return telemetry;
  }

  function snapshot(){
    const v=profile();
    const t=getTransportTypeProfile(v.type);
    return {vehicleId:v.id,profile:v,typeProfile:t,state:{...state},physics:{...physics},input:{...lastInput},telemetry:transportTelemetry(state,lastInput)};
  }

  return {get vehicleId(){return currentId;},get profile(){return profile();},get typeProfile(){return getTransportTypeProfile(state.type);},get state(){return state;},get physics(){return physics;},setVehicle,control,step,snapshot};
}
