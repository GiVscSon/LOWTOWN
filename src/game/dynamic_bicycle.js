const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smoothstep=(x)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};

export function dynamicBlendWeight(speed,physics={}){
  const center=Math.max(0,finite(physics.dynamicModelSpeed,180));
  const width=Math.max(1,finite(physics.dynamicBlendSpeed,35));
  return smoothstep((Math.abs(speed)-(center-width))/width);
}

export function dynamicBicycleForces(state,physics={}){
  const m=Math.max(1,finite(physics.mass,1500));
  const wheelbase=Math.max(.8,finite(physics.wheelbase,2.7));
  const frontWeight=clamp(finite(physics.frontWeight,.52),.35,.65);
  const lf=wheelbase*frontWeight;
  const lr=wheelbase-lf;
  const iz=Math.max(1,m*(lf*lf+lr*lr)*clamp(finite(physics.yawInertiaScale,.82),.55,1.2));
  const fx=Math.cos(state.a),fy=Math.sin(state.a);
  const u=finite(state.vx)*fx+finite(state.vy)*fy;
  const v=-finite(state.vx)*fy+finite(state.vy)*fx;
  const r=finite(state.yawRate);
  const steer=clamp(finite(physics.steerInput),-1,1)*finite(physics.steeringRate,1.9);
  const baseC=Math.max(50,m*finite(physics.corneringStiffness,3.2));
  const cf=baseC*finite(physics.frontCorneringScale,1);
  const cr=baseC*finite(physics.rearCorneringScale,.96);
  const uSafe=Math.max(5,Math.abs(u));
  const direction=u<0?-1:1;
  const alphaF=steer-Math.atan2(v+lf*r,uSafe)*direction;
  const alphaR=-Math.atan2(v-lr*r,uSafe)*direction;
  const gravity=Math.max(.1,finite(physics.gravity,9.81));
  const mu=Math.max(.2,finite(physics.friction,1));
  const cgHeight=Math.max(.05,finite(physics.cgHeight,.55));
  const longitudinalAcceleration=finite(physics.longitudinalAcceleration,0);
  const transfer=m*longitudinalAcceleration*cgHeight/wheelbase;
  const staticFront=m*gravity*frontWeight;
  const staticRear=m*gravity*(1-frontWeight);
  const frontLoad=clamp(staticFront-transfer,0,m*gravity);
  const rearLoad=clamp(staticRear+transfer,0,m*gravity);
  const lateralScale=Math.max(.2,finite(physics.maxLateralAccel,1.05)/gravity);
  const frontLimit=frontLoad*mu*lateralScale;
  const rearLimit=rearLoad*mu*lateralScale;
  const fyF=clamp(cf*alphaF,-frontLimit,frontLimit);
  const fyR=clamp(cr*alphaR,-rearLimit,rearLimit);
  const lateralAccel=(fyF+fyR)/m-u*r;
  const yawAccel=(lf*fyF-lr*fyR)/iz;
  const damping=clamp(finite(physics.dynamicDamping,.35),0,2);
  return {m,wheelbase,lf,lr,iz,u,v,r,steer,fyF,fyR,frontLoad,rearLoad,lateralAccel,yawAccel,damping,speed:Math.hypot(finite(state.vx),finite(state.vy)),slipAngle:Math.atan2(v,Math.max(1,Math.abs(u)))};
}

export function stepDynamicBicycle(state,dt,physics={}){
  const h=clamp(finite(dt),0,.1);
  const q=dynamicBicycleForces(state,physics);
  const lateral=q.v+(q.lateralAccel-q.damping*q.v)*h;
  const yawRate=q.r+(q.yawAccel-q.damping*q.r)*h;
  state.yawRate=yawRate;
  state.a+=yawRate*h;
  const maxForward=Math.max(0,finite(physics.maxForwardSpeed,500));
  const maxReverse=Math.max(0,finite(physics.maxReverseSpeed));
  const forward=clamp(q.u,-maxReverse,maxForward);
  const fx=Math.cos(state.a),fy=Math.sin(state.a),rx=-fy,ry=fx;
  state.vx=fx*forward+rx*lateral;
  state.vy=fy*forward+ry*lateral;
  return {forwardSpeed:forward,lateralSpeed:lateral,yawRate:state.yawRate,slipAngle:Math.atan2(lateral,Math.max(1,Math.abs(forward))),frontForce:q.fyF,rearForce:q.fyR,frontLoad:q.frontLoad,rearLoad:q.rearLoad,lateralAccel:q.lateralAccel,yawAccel:q.yawAccel,model:'dynamic-bicycle'};
}

export function dynamicHandlingActive(speed,physics={},wasActive=false){
  const center=Math.max(0,finite(physics.dynamicModelSpeed,180));
  const width=Math.max(1,finite(physics.dynamicBlendSpeed,35));
  const absSpeed=Math.abs(finite(speed));
  if(wasActive)return absSpeed>Math.max(0,center-width);
  return absSpeed>=center;
}
