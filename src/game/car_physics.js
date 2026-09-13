import { getTypePhysics, normalizeTypeInput } from './transport_type_physics.js';
import { TRANSPORT_TYPES } from './transport_physics.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function stepCarPhysics(state,dt,input,physics){
  const p=physics||{};
  const safeDt=clamp(finite(dt),0,0.1);
  const c=normalizeTypeInput(input,TRANSPORT_TYPES.CAR);
  const fx=Math.cos(state.a),fy=Math.sin(state.a),rx=-fy,ry=fx;
  const forward=state.vx*fx+state.vy*fy;
  const lateral=state.vx*rx+state.vy*ry;
  const speed=Math.hypot(state.vx,state.vy);
  const drive=c.throttle>=0?p.engineForce:Math.abs(p.reverseForce||0);
  state.vx+=fx*c.throttle*drive*safeDt;
  state.vy+=fy*c.throttle*drive*safeDt;
  if(c.brake){
    const amount=Math.min(Math.abs(forward),Math.abs(p.brakeForce||0)*c.brake*safeDt);
    state.vx-=fx*Math.sign(forward||1)*amount;
    state.vy-=fy*Math.sign(forward||1)*amount;
  }
  const grip=c.handbrake?p.handbrakeGrip:p.lateralGrip;
  const desiredLateral=Math.tan(c.steer*0.42)*Math.abs(forward);
  const lateralError=lateral-desiredLateral;
  const lateralForce=clamp(lateralError*(p.slipAngleGrip||1),-Math.max(10,speed*1.5),Math.max(10,speed*1.5));
  const correction=Math.min(1,grip*safeDt);
  state.vx-=rx*lateralForce*correction;
  state.vy-=ry*lateralForce*correction;
  const resistance=(p.rollingResistance||0)*speed*safeDt;
  if(speed>1){state.vx-=state.vx/speed*resistance;state.vy-=state.vy/speed*resistance;}
  const drag=c.handbrake?p.handbrakeDrag:p.drag;
  const aero=1/(1+(p.aeroDrag||0)*speed*speed*safeDt);
  state.vx*=Math.pow(drag,safeDt*60)*aero;
  state.vy*=Math.pow(drag,safeDt*60)*aero;
  const currentForward=state.vx*Math.cos(state.a)+state.vy*Math.sin(state.a);
  const authority=clamp(Math.abs(currentForward)/(p.steeringAuthoritySpeed||1),0,1);
  const desiredYaw=c.steer*(c.handbrake?p.handbrakeSteeringRate:p.steeringRate)*authority*(currentForward>=0?1:-1);
  state.yawRate+=(desiredYaw-state.yawRate)*(p.yawInertia||1)*safeDt;
  state.yawRate-=state.yawRate*(p.yawDamping||0)*safeDt;
  state.a+=state.yawRate*safeDt;
  const nfx=Math.cos(state.a),nfy=Math.sin(state.a),limited=state.vx*nfx+state.vy*nfy;
  if(limited>p.maxForwardSpeed){const e=limited-p.maxForwardSpeed;state.vx-=nfx*e;state.vy-=nfy*e;}
  if(limited<-(p.maxReverseSpeed||0)){const e=limited+p.maxReverseSpeed;state.vx-=nfx*e;state.vy-=nfy*e;}
  state.x+=state.vx*safeDt;state.y+=state.vy*safeDt;
  return carTelemetry(state,c,p);
}

export function carTelemetry(state,input={},physics={}){
  const fx=Math.cos(state.a),fy=Math.sin(state.a);
  const forward=state.vx*fx+state.vy*fy;
  const lateral=-state.vx*Math.sin(state.a)+state.vy*Math.cos(state.a);
  const speed=Math.hypot(state.vx,state.vy);
  const slip=Math.atan2(lateral,Math.max(1,Math.abs(forward)));
  return {type:TRANSPORT_TYPES.CAR,x:state.x,y:state.y,heading:state.a,velocity:speed,forwardSpeed:forward,lateralSpeed:lateral,verticalSpeed:0,acceleration:Math.abs(finite(input.throttle))*finite(physics.engineForce),yawRate:state.yawRate,slipAngle:slip,traction:clamp(1-Math.abs(slip)/1.05,0,1),surface:'road',drift:Math.abs(slip)>.12,controls:{...input}};
}
