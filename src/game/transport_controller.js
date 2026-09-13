import { createTransportState, transportStep, transportTelemetry, TRANSPORT_TYPES } from './transport_physics.js';
import { getTransportProfile, resolveTransportPhysics } from './transport_profiles.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function createTransportController(vehicleId='sedan',initial={}){
  const profile=getTransportProfile(vehicleId);
  const state=createTransportState({type:profile.type,...initial});
  let physics=resolveTransportPhysics(vehicleId);
  let lastInput={throttle:0,brake:0,steer:0,handbrake:false,climb:0,descend:0};

  function setVehicle(id){
    const next=getTransportProfile(id);
    physics=resolveTransportPhysics(next.id);
    state.type=next.type;
    state.telemetry.surface=next.type===TRANSPORT_TYPES.CAR?'road':next.type===TRANSPORT_TYPES.BOAT?'water':'air';
    return next;
  }

  function control(input={}){
    lastInput={
      throttle:clamp(Number(input.throttle)||0,-1,1),
      brake:clamp(Number(input.brake)||0,0,1),
      steer:clamp(Number(input.steer)||0,-1,1),
      handbrake:state.type===TRANSPORT_TYPES.CAR&&!!input.handbrake,
      climb:state.type===TRANSPORT_TYPES.PLANE?clamp(Number(input.climb)||0,-1,1):0,
      descend:state.type===TRANSPORT_TYPES.PLANE?clamp(Number(input.descend)||0,0,1):0
    };
    return lastInput;
  }

  function step(dt,input=lastInput){
    control(input);
    const old={x:state.x,y:state.y,z:state.z};
    const telemetry=transportStep(state,dt,lastInput);
    const dx=state.x-old.x,dy=state.y-old.y,dz=state.z-old.z;
    telemetry.frameDistance=Math.hypot(dx,dy,dz);
    telemetry.physics={
      mass:physics.mass,maxSpeed:physics.maxForwardSpeed,engineForce:physics.engineForce,
      brakeForce:physics.brakeForce,steeringRate:physics.steeringRate,
      grip:physics.lateralGrip,turnRadius:physics.turnRadius
    };
    return telemetry;
  }

  function snapshot(){
    const p=getTransportProfile(vehicleId);
    return {
      vehicleId:p.id,profile:p,state:{...state},physics:{...physics},input:{...lastInput},telemetry:transportTelemetry(state,lastInput)
    };
  }

  return {get vehicleId(){return vehicleId;},get profile(){return getTransportProfile(vehicleId);},get state(){return state;},get physics(){return physics;},setVehicle,control,step,snapshot};
}
