import { TRANSPORT_TYPES } from './transport_constants.js';
import { stepCarPhysics } from './car_physics.js';
import { stepBoatPhysics } from './boat_physics.js';
import { stepPlanePhysics } from './plane_physics.js';
import { stepHelicopterPhysics } from './helicopter_physics.js';
import { createVehicleState, vehicleSpeed } from './vehicle_state.js';
import { resolveTransportPhysics } from './transport_profiles.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)); const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
export { TRANSPORT_TYPES };
export function normalizeTransportInput(input={},type=TRANSPORT_TYPES.CAR){
  const t=TRANSPORT_TYPES[type]?type:TRANSPORT_TYPES.CAR;
  const throttle=clamp(finite(input.throttle),-1,1);
  const isPlane=t===TRANSPORT_TYPES.PLANE;
  const isHeli=t===TRANSPORT_TYPES.HELICOPTER;
  return {
    throttle: isPlane?Math.max(0,throttle):throttle,
    brake:    clamp(finite(input.brake),0,1),
    steer:    clamp(finite(input.steer),-1,1),
    handbrake:t===TRANSPORT_TYPES.CAR&&!!input.handbrake,
    strafe:   isHeli?clamp(finite(input.strafe),-1,1):0,
    climb:    (isPlane||isHeli)?clamp(finite(input.climb),-1,1):0,
    descend:  (isPlane||isHeli)?clamp(finite(input.descend),0,1):0,
    profile:  t,
  };
}
export function createTransportState(options={}){return createVehicleState(options);}
export function transportSpeed(s){return vehicleSpeed(s);}
function stepType(s,dt,input,p){
  if(s.type===TRANSPORT_TYPES.CAR)        return stepCarPhysics(s,dt,input,p);
  if(s.type===TRANSPORT_TYPES.BOAT)       return stepBoatPhysics(s,dt,input,p);
  if(s.type===TRANSPORT_TYPES.PLANE)      return stepPlanePhysics(s,dt,input,p);
  if(s.type===TRANSPORT_TYPES.HELICOPTER) return stepHelicopterPhysics(s,dt,input,p);
  throw new Error(`Unsupported transport type: ${s.type}`);
}
export function transportStep(state,dt,input={}){
  const s=state,safeDt=clamp(finite(dt),0,.1);
  if(safeDt<=0)return transportTelemetry(s,input);
  const p=s.physics&&s.physics.vehicleId===s.vehicleId?s.physics:resolveTransportPhysics(s.vehicleId||'sedan');
  const controls=normalizeTransportInput(input,s.type),maxStep=1/120,steps=Math.max(1,Math.ceil(safeDt/maxStep)),h=safeDt/steps;
  for(let i=0;i<steps;i++){stepType(s,h,controls,p);s.distance+=transportSpeed(s)*h;s.age+=h;}
  s.surface=s.type===TRANSPORT_TYPES.CAR?'road':s.type===TRANSPORT_TYPES.BOAT?'water':'air';
  return transportTelemetry(s,controls,p);
}
export function transportTelemetry(s,input={},physics=null){
  const fx=Math.cos(s.a),fy=Math.sin(s.a),forward=s.vx*fx+s.vy*fy,lateral=-s.vx*Math.sin(s.a)+s.vy*Math.cos(s.a),speed=vehicleSpeed(s),slip=Math.atan2(lateral,Math.max(1,Math.abs(forward))),p=physics||s.physics||resolveTransportPhysics(s.vehicleId||'sedan');
  return {vehicleType:s.type,vehicleId:s.vehicleId,x:s.x,y:s.y,z:s.z,heading:s.a,velocity:speed,forwardSpeed:forward,lateralSpeed:lateral,verticalSpeed:s.vz,acceleration:Math.hypot(finite(input.throttle)*p.acceleration,finite(s.vz)),yawRate:s.yawRate,slipAngle:slip,traction:s.type===TRANSPORT_TYPES.CAR?clamp(1-Math.abs(slip)/1.05,0,1):clamp(1-Math.abs(slip)/1.8,0,1),surface:s.surface,distance:s.distance,drift:s.type===TRANSPORT_TYPES.CAR&&Math.abs(slip)>.12,controls:{...input}};
}
