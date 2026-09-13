import { TRANSPORT_TYPES } from './transport_physics.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export const TYPE_PHYSICS=Object.freeze({
  CAR:Object.freeze({
    type:TRANSPORT_TYPES.CAR,
    dimensions:Object.freeze({grounded:true,altitude:false}),
    forces:Object.freeze({drive:true,brake:true,lateral:true,yaw:true}),
    controls:Object.freeze({throttle:true,brake:true,steer:true,handbrake:true,climb:false,descend:false}),
    environment:Object.freeze({surface:'road',gravity:1,waterResistance:0,aeroLift:0}),
    limits:Object.freeze({maxAltitude:0,minAltitude:0})
  }),
  BOAT:Object.freeze({
    type:TRANSPORT_TYPES.BOAT,
    dimensions:Object.freeze({grounded:false,altitude:false}),
    forces:Object.freeze({drive:true,brake:true,lateral:true,yaw:true}),
    controls:Object.freeze({throttle:true,brake:true,steer:true,handbrake:false,climb:false,descend:false}),
    environment:Object.freeze({surface:'water',gravity:1,waterResistance:1,aeroLift:0}),
    limits:Object.freeze({maxAltitude:0,minAltitude:0})
  }),
  PLANE:Object.freeze({
    type:TRANSPORT_TYPES.PLANE,
    dimensions:Object.freeze({grounded:false,altitude:true}),
    forces:Object.freeze({drive:true,brake:true,lateral:false,yaw:true}),
    controls:Object.freeze({throttle:true,brake:true,steer:true,handbrake:false,climb:true,descend:true}),
    environment:Object.freeze({surface:'air',gravity:1,waterResistance:0,aeroLift:1}),
    limits:Object.freeze({maxAltitude:1800,minAltitude:40})
  })
});

export function getTypePhysics(type=TRANSPORT_TYPES.CAR){
  return TYPE_PHYSICS[type]||TYPE_PHYSICS.CAR;
}

export function normalizeTypeInput(input={},type=TRANSPORT_TYPES.CAR){
  const p=getTypePhysics(type);
  return {
    throttle:p.controls.throttle?clamp(finite(input.throttle),-1,1):0,
    brake:p.controls.brake?clamp(finite(input.brake),0,1):0,
    steer:p.controls.steer?clamp(finite(input.steer),-1,1):0,
    handbrake:p.controls.handbrake&&!!input.handbrake,
    climb:p.controls.climb?clamp(finite(input.climb),-1,1):0,
    descend:p.controls.descend?clamp(finite(input.descend),0,1):0
  };
}

export function typeTelemetry(type,state){
  const p=getTypePhysics(type);
  return {
    type:p.type,
    surface:p.environment.surface,
    grounded:p.dimensions.grounded,
    altitudeEnabled:p.dimensions.altitude,
    controls:{...p.controls},
    position:{x:finite(state?.x),y:finite(state?.y),z:finite(state?.z)},
    environment:{...p.environment}
  };
}
