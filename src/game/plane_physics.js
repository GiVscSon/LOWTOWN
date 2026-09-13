import { normalizeTypeInput } from './transport_type_physics.js';
import { TRANSPORT_TYPES } from './transport_physics.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function stepPlanePhysics(state,dt,input,physics){
  const p=physics||{};
  const safeDt=clamp(finite(dt),0,0.1);
  const c=normalizeTypeInput(input,TRANSPORT_TYPES.PLANE);
  const fx=Math.cos(state.a),fy=Math.sin(state.a);
  const forward=state.vx*fx+state.vy*fy;
  const horizontal=Math.hypot(state.vx,state.vy);
  const speed=Math.hypot(state.vx,state.vy,state.vz);
  const thrust=finite(p.engineForce);
  state.vx+=fx*c.throttle*thrust*safeDt;
  state.vy+=fy*c.throttle*thrust*safeDt;
  state.vz+=(c.climb*finite(p.verticalForce)-c.descend*finite(p.verticalForce))*safeDt;
  const yawAuthority=clamp(Math.abs(forward)/(finite(p.steeringAuthoritySpeed,1)),0,1);
  const desiredYaw=c.steer*finite(p.steeringRate)*yawAuthority;
  state.yawRate+=(desiredYaw-state.yawRate)*finite(p.yawInertia,1)*safeDt;
  state.yawRate-=state.yawRate*finite(p.yawDamping)*safeDt;
  state.a+=state.yawRate*safeDt;
  const drag=1/(1+finite(p.aeroDrag)*speed*speed*safeDt);
  state.vx*=drag;state.vy*=drag;
  const nextHorizontal=Math.hypot(state.vx,state.vy);
  if(nextHorizontal>finite(p.maxForwardSpeed)){const k=finite(p.maxForwardSpeed)/Math.max(1,nextHorizontal);state.vx*=k;state.vy*=k;}
  state.vz=clamp(state.vz,-finite(p.maxAltitude,1800)*.5,finite(p.maxAltitude,1800)*.5);
  state.x+=state.vx*safeDt;state.y+=state.vy*safeDt;
  state.z=clamp(state.z+state.vz*safeDt,finite(p.minAltitude,40),finite(p.maxAltitude,1800));
  return planeTelemetry(state,c,p);
}

export function planeTelemetry(state,input={},physics={}){
  const fx=Math.cos(state.a),fy=Math.sin(state.a);const forward=state.vx*fx+state.vy*fy;const lateral=-state.vx*Math.sin(state.a)+state.vy*Math.cos(state.a);const speed=Math.hypot(state.vx,state.vy,state.vz);
  return {type:TRANSPORT_TYPES.PLANE,x:state.x,y:state.y,z:state.z,heading:state.a,velocity:speed,forwardSpeed:forward,lateralSpeed:lateral,verticalSpeed:state.vz,acceleration:Math.abs(finite(input.throttle))*finite(physics.engineForce),yawRate:state.yawRate,slipAngle:Math.atan2(lateral,Math.max(1,Math.abs(forward))),traction:clamp(1-Math.abs(lateral)/Math.max(1,speed),0,1),surface:'air',altitude:state.z,controls:{...input}};
}
