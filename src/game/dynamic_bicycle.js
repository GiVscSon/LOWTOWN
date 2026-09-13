const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function stepDynamicBicycle(state,dt,physics={}){
  const h=clamp(finite(dt),0,.1),m=Math.max(1,finite(physics.mass,1500)),u=Math.max(5,Math.abs(finite(state.vx)*Math.cos(state.a)+finite(state.vy)*Math.sin(state.a))),v=-finite(state.vx)*Math.sin(state.a)+finite(state.vy)*Math.cos(state.a),r=finite(state.yawRate),steer=clamp(finite(physics.steerInput),-1,1)*(finite(physics.steeringRate,1.9));
  const wheelbase=Math.max(.5,finite(physics.wheelbase,2.7)),lf=wheelbase*.52,lr=wheelbase-lf,iz=Math.max(1,m*(lf*lf+lr*lr)*.82),stiff=Math.max(10,m*finite(physics.corneringStiffness,3.2)),cf=stiff,cr=stiff*.96;
  const alphaF=steer-Math.atan2(v+lf*r,u),alphaR=-Math.atan2(v-lr*r,u);
  const fyF=clamp(cf*alphaF,-m*finite(physics.maxLateralAccel,1.05),m*finite(physics.maxLateralAccel,1.05));
  const fyR=clamp(cr*alphaR,-m*finite(physics.maxLateralAccel,1.05),m*finite(physics.maxLateralAccel,1.05));
  const lateralAccel=(fyF+fyR)/m-u*r;
  const yawAccel=(lf*fyF-lr*fyR)/iz;
  const damping=clamp(finite(physics.dynamicDamping,.35),0,2);
  const nextV=v+(lateralAccel-damping*v)*h;
  state.yawRate=r+(yawAccel-damping*r)*h;
  state.a+=state.yawRate*h;
  const fx=Math.cos(state.a),fy=Math.sin(state.a),rx=-fy,ry=fx;
  const forward=Math.max(-Math.max(0,finite(physics.maxReverseSpeed)),Math.min(finite(physics.maxForwardSpeed,500),u));
  state.vx=fx*forward+rx*nextV;
  state.vy=fy*forward+ry*nextV;
  return {forwardSpeed:forward,lateralSpeed:nextV,yawRate:state.yawRate,slipAngle:Math.atan2(nextV,Math.max(1,Math.abs(forward))),frontForce:fyF,rearForce:fyR,model:'dynamic-bicycle'};
}
