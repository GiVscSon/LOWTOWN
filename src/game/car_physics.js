import { normalizeTypeInput } from './transport_type_physics.js';
import { TRANSPORT_TYPES } from './transport_constants.js';
import { dynamicBlendWeight, dynamicHandlingActive, stepDynamicBicycle } from './dynamic_bicycle.js';
import { applySurfacePhysics, surfaceTelemetry } from './surface_physics.js';
import { axleLoads, drivetrainDistribution } from './axle_physics.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function stepKinematicGrip(state,dt,input,physics){
  const fx=Math.cos(state.a),fy=Math.sin(state.a),rx=-fy,ry=fx;
  const forward=state.vx*fx+state.vy*fy;
  const lateral=state.vx*rx+state.vy*ry;
  const speed=Math.hypot(state.vx,state.vy);
  const grip=input.handbrake?physics.handbrakeGrip:physics.lateralGrip;
  const desiredLateral=Math.tan(input.steer*.42)*Math.abs(forward);
  const lateralForce=clamp((lateral-desiredLateral)*(physics.slipAngleGrip||1),-Math.max(10,speed*1.5),Math.max(10,speed*1.5));
  const correction=Math.min(1,grip*dt);
  state.vx-=rx*lateralForce*correction;
  state.vy-=ry*lateralForce*correction;
  const currentForward=state.vx*Math.cos(state.a)+state.vy*Math.sin(state.a);
  const authority=clamp(Math.abs(currentForward)/(physics.steeringAuthoritySpeed||1),0,1);
  const desiredYaw=input.steer*(input.handbrake?physics.handbrakeSteeringRate:physics.steeringRate)*authority*(currentForward>=0?1:-1);
  state.yawRate+=(desiredYaw-state.yawRate)*(physics.yawInertia||1)*dt;
  state.yawRate-=state.yawRate*(physics.yawDamping||0)*dt;
  state.a+=state.yawRate*dt;
  return state;
}

function blendState(a,b,t){
  const k=clamp(t,0,1);
  a.vx+=(b.vx-a.vx)*k;
  a.vy+=(b.vy-a.vy)*k;
  a.yawRate+=(b.yawRate-a.yawRate)*k;
  const angleDelta=Math.atan2(Math.sin(b.a-a.a),Math.cos(b.a-a.a));
  a.a+=angleDelta*k;
  return a;
}

export function stepCarPhysics(state,dt,input,physics){
  const p0=physics||{};
  const safeDt=clamp(finite(dt),0,.1);
  const c=normalizeTypeInput(input,TRANSPORT_TYPES.CAR);
  const surface=input?.surface??state.surface??'dry';
  const p=applySurfacePhysics(p0,surface);
  const fx=Math.cos(state.a),fy=Math.sin(state.a);
  const forward=state.vx*fx+state.vy*fy;
  const speed=Math.hypot(state.vx,state.vy);
  const mass=Math.max(1,p.mass||state.mass||1);
  // Engine acceleration is a calibrated gameplay quantity, but tyres remain
  // the authority on how much of it can reach the road. This prevents the
  // previous "arcade acceleration bypass" from ignoring drivetrain traction.
  const engineAcceleration=c.throttle>=0
    ? finite(p.engineAcceleration,p.engineForce/mass)
    : finite(p.reverseAcceleration,p.reverseForce/mass);
  const requestedAcceleration=c.throttle*engineAcceleration;

  // Estimate axle loads with the requested longitudinal acceleration, then
  // cap driven-axle force. The result is the actual longitudinal tyre demand.
  const loads=axleLoads({
    mass, gravity:p.gravity||9.81, wheelbase:p.wheelbase||2.7,
    frontWeight:p.frontWeight||.52,
    longitudinalAcceleration:requestedAcceleration,
    cgHeight:p.cgHeight||.55
  });
  const distribution=drivetrainDistribution(p.drivetrain,loads);
  const longitudinalCapacity=Math.max(0,finite(p.friction,1)*distribution.drivenLoad/mass);
  const driveAcceleration=clamp(requestedAcceleration,-longitudinalCapacity,longitudinalCapacity);
  state.driveLimit={
    requestedForce:requestedAcceleration*mass,
    force:driveAcceleration*mass,
    capacity:longitudinalCapacity*mass,
    drivetrain:distribution.type,
    frontLoad:loads.front,
    rearLoad:loads.rear,
    limited:Math.abs(driveAcceleration-requestedAcceleration)>1e-9
  };

  state.vx+=fx*driveAcceleration*safeDt;
  state.vy+=fy*driveAcceleration*safeDt;
  if(c.brake){
    const amount=Math.min(Math.abs(forward),Math.abs(p.brakeForce||0)*c.brake*safeDt/mass);
    state.vx-=fx*Math.sign(forward||1)*amount;
    state.vy-=fy*Math.sign(forward||1)*amount;
  }

  const postDriveSpeed=Math.hypot(state.vx,state.vy);
  const explicitDynamic=p.handlingModel==='dynamic';
  const wasDynamic=state.dynamicHandlingActive===true;
  const autoDynamic=dynamicHandlingActive(postDriveSpeed,p,wasDynamic);
  const dynamicBlend=explicitDynamic?1:(autoDynamic?Math.max(.5,dynamicBlendWeight(postDriveSpeed,p)):0);
  const useDynamic=!c.handbrake&&(explicitDynamic||autoDynamic);
  let handlingModel='kinematic-grip';
  let dynamicTelemetry=null;

  if(useDynamic){
    const dynamicState={...state};
    dynamicTelemetry=stepDynamicBicycle(dynamicState,safeDt,{...p,steerInput:c.steer,longitudinalAcceleration:driveAcceleration});
    if(dynamicBlend>=.999||autoDynamic){
      state.vx=dynamicState.vx;
      state.vy=dynamicState.vy;
      state.yawRate=dynamicState.yawRate;
      state.a=dynamicState.a;
      handlingModel='dynamic-bicycle';
    }else{
      const kinematicState={...state};
      stepKinematicGrip(kinematicState,safeDt,c,p);
      blendState(state,dynamicState,dynamicBlend);
      state.a=kinematicState.a+(Math.atan2(Math.sin(dynamicState.a-kinematicState.a),Math.cos(dynamicState.a-kinematicState.a)))*dynamicBlend;
      state.yawRate=kinematicState.yawRate+(dynamicState.yawRate-kinematicState.yawRate)*dynamicBlend;
      handlingModel='dynamic-bicycle-blend';
    }
  }else{
    stepKinematicGrip(state,safeDt,c,p);
  }

  state.dynamicHandlingActive=autoDynamic||explicitDynamic;
  const resistance=(p.rollingResistance||0)*speed*safeDt;
  if(speed>1){state.vx-=state.vx/speed*resistance;state.vy-=state.vy/speed*resistance;}
  const drag=c.handbrake?p.handbrakeDrag:p.drag;
  const aero=1/(1+(p.aeroDrag||0)*speed*speed*safeDt);
  state.vx*=Math.pow(drag,safeDt*60)*aero;
  state.vy*=Math.pow(drag,safeDt*60)*aero;
  const nfx=Math.cos(state.a),nfy=Math.sin(state.a);
  const limited=state.vx*nfx+state.vy*nfy;
  if(limited>p.maxForwardSpeed){const e=limited-p.maxForwardSpeed;state.vx-=nfx*e;state.vy-=nfy*e;}
  if(limited<-(p.maxReverseSpeed||0)){const e=limited+p.maxReverseSpeed;state.vx-=nfx*e;state.vy-=nfy*e;}
  state.x+=state.vx*safeDt;
  state.y+=state.vy*safeDt;
  state.surface=surface;
  state.handlingModel=handlingModel;
  state.modelBlend=dynamicBlend;
  state.driveLimit=drive;
  return carTelemetry(state,c,p,dynamicTelemetry);
}

export function carTelemetry(state,input={},physics={},dynamic=null){
  const fx=Math.cos(state.a),fy=Math.sin(state.a);
  const forward=state.vx*fx+state.vy*fy;
  const lateral=-state.vx*Math.sin(state.a)+state.vy*Math.cos(state.a);
  const speed=Math.hypot(state.vx,state.vy);
  const slip=Math.atan2(lateral,Math.max(1,Math.abs(forward)));
  return {type:TRANSPORT_TYPES.CAR,x:state.x,y:state.y,heading:state.a,velocity:speed,forwardSpeed:forward,lateralSpeed:lateral,verticalSpeed:0,acceleration:Math.abs(finite(input.throttle))*finite(physics.acceleration),yawRate:state.yawRate,slipAngle:slip,traction:clamp(1-Math.abs(slip)/1.05,0,1),surface:state.surface||input.surface||'dry',surfacePhysics:surfaceTelemetry(state.surface||input.surface||'dry',physics),drivetrain:physics.drivetrain||'RWD',driveLimit:state.driveLimit||null,drift:Math.abs(slip)>.12,handlingModel:state.handlingModel||'kinematic-grip',modelBlend:clamp(finite(state.modelBlend),0,1),dynamic:dynamic?{frontForce:dynamic.frontForce,rearForce:dynamic.rearForce,frontLoad:dynamic.frontLoad,rearLoad:dynamic.rearLoad}:null,controls:{...input}};
}
