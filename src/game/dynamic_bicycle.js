const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function dynamicBicycleForces(state,physics={}){
  const m=Math.max(1,finite(physics.mass,1500));
  const wheelbase=Math.max(.8,finite(physics.wheelbase,2.7));
  const lf=wheelbase*clamp(finite(physics.frontWeight,.52),.35,.65);
  const lr=wheelbase-lf;
  const iz=Math.max(1,m*(lf*lf+lr*lr)*clamp(finite(physics.yawInertiaScale,.82),.55,1.2));
  const speed=Math.max(1,Math.hypot(finite(state.vx),finite(state.vy)));
  const fx=Math.cos(state.a),fy=Math.sin(state.a),u=state.vx*fx+state.vy*fy,v=-state.vx*fy+state.vy*fx,r=finite(state.yawRate);
  const steer=clamp(finite(physics.steerInput),-1,1)*finite(physics.steeringRate,1.9);
  const baseC=Math.max(50,m*finite(physics.corneringStiffness,3.2));
  const cf=baseC*finite(physics.frontCorneringScale,1);
  const cr=baseC*finite(physics.rearCorneringScale,.96);
  const alphaF=steer-Math.atan2(v+lf*r,Math.max(5,u));
  const alphaR=-Math.atan2(v-lr*r,Math.max(5,u));
  const limit=m*Math.max(.2,finite(physics.maxLateralAccel,1.05));
  const fyF=clamp(cf*alphaF,-limit,limit);
  const fyR=clamp(cr*alphaR,-limit,limit);
  const ay=(fyF+fyR)/m-u*r;
  const yaw=(lf*fyF-lr*fyR)/iz;
  const damping=clamp(finite(physics.dynamicDamping,.35),0,2);
  const nextV=v+(ay-damping*v)*.0;
  return {m,wheelbase,lf,lr,iz,u,v,r,steer,fyF,fyR,lateralAccel:ay,yawAccel:yaw,damping,nextV,speed,slipAngle:Math.atan2(v,Math.max(1,Math.abs(u)))};
}

export function stepDynamicBicycle(state,dt,physics={}){
  const h=clamp(finite(dt),0,.1),q=dynamicBicycleForces(state,physics);
  const lateral=vStep(q.v,q.lateralAccel,q.damping,h);
  state.yawRate=q.r+(q.yawAccel-q.damping*q.r)*h;
  state.a+=state.yawRate*h;
  const maxForward=Math.max(0,finite(physics.maxForwardSpeed,500));
  const maxReverse=Math.max(0,finite(physics.maxReverseSpeed));
  const forward=clamp(q.u,-maxReverse,maxForward);
  const fx=Math.cos(state.a),fy=Math.sin(state.a),rx=-fy,ry=fx;
  state.vx=fx*forward+rx*lateral;
  state.vy=fy*forward+ry*lateral;
  return {forwardSpeed:forward,lateralSpeed:lateral,yawRate:state.yawRate,slipAngle:Math.atan2(lateral,Math.max(1,Math.abs(forward))),frontForce:q.fyF,rearForce:q.fyR,lateralAccel:q.lateralAccel,yawAccel:q.yawAccel,model:'dynamic-bicycle'};
}

function vStep(v,a,d,h){return v+(a-d*v)*h;}
