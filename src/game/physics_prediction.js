import { TRANSPORT_TYPES } from './transport_constants.js';
import { stepCarPhysics } from './car_physics.js';
import { stepBoatPhysics } from './boat_physics.js';
import { stepPlanePhysics } from './plane_physics.js';
import { applyActuatorDelay } from './vehicle_safety.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function stepClone(state,dt,input,physics,actuatorState=null,actuatorResponse=null){
  const s={...state};
  if(state.telemetry)s.telemetry={...state.telemetry};
  let applied=input||{};
  if(actuatorState&&actuatorResponse){
    const next=applyActuatorDelay(input,actuatorState,dt,actuatorResponse);
    s.actuatorState={...next};
    applied=next;
  }
  if(s.type===TRANSPORT_TYPES.CAR)stepCarPhysics(s,dt,applied,physics);
  else if(s.type===TRANSPORT_TYPES.BOAT)stepBoatPhysics(s,dt,applied,physics);
  else if(s.type===TRANSPORT_TYPES.PLANE)stepPlanePhysics(s,dt,applied,physics);
  else throw new Error(`Unsupported transport type: ${s.type}`);
  return s;
}

export function predictVehicle(state,seconds,input={},physics=state.physics,options={}){
  const safeSeconds=clamp(finite(seconds),0,10),safeDt=1/120;
  const steps=Math.max(1,Math.ceil(safeSeconds/safeDt)),dt=safeSeconds/steps;
  let current={...state};
  const points=[];
  const useActuator=options.useActuatorDelay!==false&&!!state.actuatorState;
  let actuatorState=useActuator?{...state.actuatorState}:null;
  const actuatorResponse=useActuator?{steer:12,throttle:8,brake:16,climb:8,descend:8,...(options.actuatorResponse||{})}:null;
  let collision=false,collisionT=safeSeconds;
  const blocked=typeof options.blocked==='function'?options.blocked:null;
  for(let i=0;i<steps;i++){
    current=stepClone(current,dt,input,physics,actuatorState,actuatorResponse);
    if(current.actuatorState)actuatorState={...current.actuatorState};
    if(blocked&&blocked(current.x,current.y)){collision=true;collisionT=(i+1)*dt;break;}
    if(i%Math.max(1,Math.floor(steps/24))===0)points.push({x:current.x,y:current.y,z:current.z,a:current.a,vx:current.vx,vy:current.vy,vz:current.vz});
  }
  return {safe:!collision,collisionT,x:current.x,y:current.y,z:current.z,a:current.a,vx:current.vx,vy:current.vy,vz:current.vz,speed:Math.hypot(current.vx,current.vy,current.vz),points};
}
