import { TRANSPORT_TYPES } from './transport_constants.js';
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
export function createVehicleState({type=TRANSPORT_TYPES.CAR,vehicleId='sedan',x=0,y=0,z=0,a=0,vx=0,vy=0,vz=0,yawRate=0}={}){
  const safeType=TRANSPORT_TYPES[type]?type:TRANSPORT_TYPES.CAR;
  return {type:safeType,vehicleId,x:finite(x),y:finite(y),z:finite(z),a:finite(a),vx:finite(vx),vy:finite(vy),vz:finite(vz),yawRate:finite(yawRate),distance:0,age:0,surface:safeType===TRANSPORT_TYPES.CAR?'road':safeType===TRANSPORT_TYPES.BOAT?'water':'air',telemetry:{}};
}
export function normalizeVehicleState(state){
  const s=state||createVehicleState();
  for(const k of ['x','y','z','a','vx','vy','vz','yawRate','distance','age'])s[k]=finite(s[k]);
  return s;
}
export function vehicleSpeed(state){return Math.hypot(finite(state.vx),finite(state.vy),finite(state.vz));}
export function vehicleSnapshot(state){const s=normalizeVehicleState({...state,telemetry:{...state.telemetry}});return Object.freeze({...s,telemetry:Object.freeze({...s.telemetry})});}
