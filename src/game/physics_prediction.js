import { TRANSPORT_TYPES } from './transport_constants.js';
import { stepCarPhysics } from './car_physics.js';
import { stepBoatPhysics } from './boat_physics.js';
import { stepPlanePhysics } from './plane_physics.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function stepClone(state,dt,input,physics){
  const s={...state};
  if(state.telemetry)s.telemetry={...state.telemetry};
  if(state.type===TRANSPORT_TYPES.CAR)stepCarPhysics(s,dt,input,physics);
  else if(state.type===TRANSPORT_TYPES.BOAT)stepBoatPhysics(s,dt,input,physics);
  else if(state.type===TRANSPORT_TYPES.PLANE)stepPlanePhysics(s,dt,input,physics);
  else throw new Error(`Unsupported transport type: ${state.type}`);
  return s;
}

export function predictVehicle(state,seconds,input={},physics=state.physics){
  const safeSeconds=clamp(finite(seconds),0,10),safeDt=1/120;
  const steps=Math.max(1,Math.ceil(safeSeconds/safeDt)),dt=safeSeconds/steps;
  let current={...state};
  const points=[];
  for(let i=0;i<steps;i++){
    current=stepClone(current,dt,input,physics);
    if(i%Math.max(1,Math.floor(steps/24))===0)points.push({x:current.x,y:current.y,z:current.z,a:current.a,vx:current.vx,vy:current.vy,vz:current.vz});
  }
  return {x:current.x,y:current.y,z:current.z,a:current.a,vx:current.vx,vy:current.vy,vz:current.vz,speed:Math.hypot(current.vx,current.vy,current.vz),points};
}
