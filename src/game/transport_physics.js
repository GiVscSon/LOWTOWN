const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export const TRANSPORT_TYPES=Object.freeze({CAR:'CAR',BOAT:'BOAT',PLANE:'PLANE'});

export const TRANSPORT_PROFILES=Object.freeze({
  CAR:Object.freeze({
    type:'CAR',mass:1200,engineForce:460,reverseForce:260,brakeForce:760,
    lateralGrip:10.5,handbrakeGrip:2,drag:.993,handbrakeDrag:.972,
    maxForwardSpeed:520,maxReverseSpeed:180,steeringRate:1.9,handbrakeSteeringRate:1.65,
    steeringAuthoritySpeed:55,rollingResistance:.006,aeroDrag:.000012,
    yawInertia:2.4,yawDamping:3.2,slipAngleGrip:7.5,handbrakeSlipGrip:1.15
  }),
  BOAT:Object.freeze({
    type:'BOAT',mass:2400,engineForce:250,reverseForce:150,brakeForce:170,
    lateralGrip:1.8,handbrakeGrip:1.8,drag:.985,handbrakeDrag:.985,
    maxForwardSpeed:180,maxReverseSpeed:65,steeringRate:0.72,handbrakeSteeringRate:0.72,
    steeringAuthoritySpeed:18,rollingResistance:.018,aeroDrag:.00002,
    yawInertia:1.35,yawDamping:1.8,slipAngleGrip:1.8,handbrakeSlipGrip:1.8
  }),
  PLANE:Object.freeze({
    type:'PLANE',mass:1800,engineForce:390,reverseForce:0,brakeForce:90,
    lateralGrip:.55,handbrakeGrip:.55,drag:.997,handbrakeDrag:.997,
    maxForwardSpeed:760,maxReverseSpeed:0,steeringRate:.48,handbrakeSteeringRate:.48,
    steeringAuthoritySpeed:35,rollingResistance:.002,aeroDrag:.000006,
    yawInertia:.85,yawDamping:1.1,slipAngleGrip:.55,handbrakeSlipGrip:.55,
    verticalForce:120,climbRate:95,maxAltitude:1800,minAltitude:40
  })
});

export function normalizeTransportInput(input={},type='CAR'){
  const p=TRANSPORT_PROFILES[type]||TRANSPORT_PROFILES.CAR;
  const throttle=clamp(finite(input.throttle),-1,1);
  return {
    throttle:type==='PLANE'?Math.max(0,throttle):throttle,
    brake:clamp(finite(input.brake),0,1),
    steer:clamp(finite(input.steer),-1,1),
    handbrake:type==='CAR'&&!!input.handbrake,
    climb:type==='PLANE'?clamp(finite(input.climb),-1,1):0,
    descend:type==='PLANE'?clamp(finite(input.descend),0,1):0,
    profile:p.type
  };
}

export function createTransportState({type='CAR',x=0,y=0,z=0,a=0,vx=0,vy=0,vz=0,yawRate=0}={}){
  const t=TRANSPORT_TYPES[type]?type:'CAR';
  const p=TRANSPORT_PROFILES[t];
  return {type:t,x:finite(x),y:finite(y),z:finite(z),a:finite(a),vx:finite(vx),vy:finite(vy),vz:finite(vz),yawRate:finite(yawRate),distance:0,age:0,telemetry:{surface:t==='CAR'?'road':t==='BOAT'?'water':'air'}};
}

export function transportSpeed(s){return Math.hypot(finite(s.vx),finite(s.vy),finite(s.vz));}

function stepCarBoat(s,dt,input,p){
  const fx=Math.cos(s.a),fy=Math.sin(s.a),rx=-fy,ry=fx;
  const forward=s.vx*fx+s.vy*fy,lateral=s.vx*rx+s.vy*ry,speed=Math.hypot(s.vx,s.vy);
  const force=input.throttle>=0?p.engineForce:p.reverseForce;
  s.vx+=fx*input.throttle*force*dt;s.vy+=fy*input.throttle*force*dt;
  if(input.brake>0){const amount=Math.min(Math.abs(forward),p.brakeForce*input.brake*dt);s.vx-=fx*Math.sign(forward||1)*amount;s.vy-=fy*Math.sign(forward||1)*amount;}
  const grip=input.handbrake?p.handbrakeGrip:p.lateralGrip;
  const targetLateral=Math.tan(input.steer*.42)*Math.max(0,Math.abs(forward));
  const lateralError=lateral-targetLateral;
  const lateralForce=clamp(lateralError*p.slipAngleGrip,-Math.max(10,speed*1.5),Math.max(10,speed*1.5));
  const correction=Math.min(1,grip*dt);
  s.vx-=rx*lateralForce*correction;s.vy-=ry*lateralForce*correction;
  const resistance=p.rollingResistance*speed*dt;
  if(speed>1){s.vx-=s.vx/speed*resistance;s.vy-=s.vy/speed*resistance;}
  const drag=input.handbrake?p.handbrakeDrag:p.drag;
  const aero=1/(1+p.aeroDrag*speed*speed*dt);
  s.vx*=Math.pow(drag,dt*60)*aero;s.vy*=Math.pow(drag,dt*60)*aero;
  const currentForward=s.vx*Math.cos(s.a)+s.vy*Math.sin(s.a);
  const authority=clamp(Math.abs(currentForward)/p.steeringAuthoritySpeed,0,1);
  const desiredYaw=input.steer*(input.handbrake?p.handbrakeSteeringRate:p.steeringRate)*authority*(currentForward>=0?1:-1);
  s.yawRate+=(desiredYaw-s.yawRate)*p.yawInertia*dt;s.yawRate-=s.yawRate*p.yawDamping*dt;s.a+=s.yawRate*dt;
  const nfx=Math.cos(s.a),nfy=Math.sin(s.a),limited=s.vx*nfx+s.vy*nfy;
  if(limited>p.maxForwardSpeed){const e=limited-p.maxForwardSpeed;s.vx-=nfx*e;s.vy-=nfy*e;}
  if(limited<-p.maxReverseSpeed){const e=limited+p.maxReverseSpeed;s.vx-=nfx*e;s.vy-=nfy*e;}
  s.x+=s.vx*dt;s.y+=s.vy*dt;
}

function stepPlane(s,dt,input,p){
  const fx=Math.cos(s.a),fy=Math.sin(s.a);
  const speed=Math.hypot(s.vx,s.vy,s.vz);
  s.vx+=fx*input.throttle*p.engineForce*dt;s.vy+=fy*input.throttle*p.engineForce*dt;
  s.vz+=(input.climb*p.verticalForce-input.descend*p.verticalForce)*dt;
  s.vz*=Math.pow(.985,dt*60);
  const yawAuthority=clamp(Math.abs(s.vx*fx+s.vy*fy)/p.steeringAuthoritySpeed,0,1);
  const desiredYaw=input.steer*p.steeringRate*yawAuthority;
  s.yawRate+=(desiredYaw-s.yawRate)*p.yawInertia*dt;s.yawRate-=s.yawRate*p.yawDamping*dt;s.a+=s.yawRate*dt;
  const drag=1/(1+p.aeroDrag*speed*speed*dt);s.vx*=drag;s.vy*=drag;
  const horizontal=Math.hypot(s.vx,s.vy);
  if(horizontal>p.maxForwardSpeed){const k=p.maxForwardSpeed/horizontal;s.vx*=k;s.vy*=k;}
  s.vz=clamp(s.vz,-p.maxAltitude*.5,p.maxAltitude*.5);
  s.x+=s.vx*dt;s.y+=s.vy*dt;s.z=clamp(s.z+s.vz*dt,p.minAltitude,p.maxAltitude);
}

export function transportStep(state,dt,input={}){
  const s=state;
  const p=TRANSPORT_PROFILES[s.type]||TRANSPORT_PROFILES.CAR;
  const safeDt=clamp(finite(dt),0,0.1);
  if(safeDt<=0)return transportTelemetry(s);
  const controls=normalizeTransportInput(input,s.type);
  const maxStep=1/120;
  const steps=Math.max(1,Math.ceil(safeDt/maxStep));
  const h=safeDt/steps;
  for(let i=0;i<steps;i++){
    if(s.type==='PLANE')stepPlane(s,h,controls,p);else stepCarBoat(s,h,controls,p);
    s.distance+=transportSpeed(s)*h;s.age+=h;
  }
  return transportTelemetry(s,controls);
}

export function transportTelemetry(s,input={}){
  const fx=Math.cos(s.a),fy=Math.sin(s.a);
  const forward=s.vx*fx+s.vy*fy;
  const lateral=-s.vx*Math.sin(s.a)+s.vy*Math.cos(s.a);
  const speed=transportSpeed(s);
  const slip=Math.atan2(lateral,Math.max(1,Math.abs(forward)));
  const acceleration=Math.hypot(finite(input.throttle)* (TRANSPORT_PROFILES[s.type]?.engineForce||0),finite(s.vz));
  return {
    vehicleType:s.type,x:s.x,y:s.y,z:s.z,heading:s.a,velocity:speed,forwardSpeed:forward,
    lateralSpeed:lateral,verticalSpeed:s.vz,acceleration,yawRate:s.yawRate,slipAngle:slip,
    traction:s.type==='CAR'?clamp(1-Math.abs(slip)/1.05,0,1):clamp(1-Math.abs(slip)/1.8,0,1),
    surface:s.telemetry.surface,distance:s.distance,drift:s.type==='CAR'&&Math.abs(slip)>.12,
    controls:{...input}
  };
}
