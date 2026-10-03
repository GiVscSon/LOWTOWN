const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function estimateLoadTransfer({mass=1500,wheelbase=2.7,frontWeight=.52,longitudinalAccel=0,lateralAccel=0,cgHeight=.48,track=1.55}={}){
  const m=Math.max(1,finite(mass,1500)),wb=Math.max(.8,finite(wheelbase,2.7)),tw=Math.max(.5,finite(track,1.55)),h=Math.max(.05,finite(cgHeight,.48));
  const baseFront=m*9.81*clamp(finite(frontWeight,.52),.35,.65),baseRear=m*9.81-baseFront;
  const longitudinal=m*h*finite(longitudinalAccel)/wb;
  const lateral=m*h*finite(lateralAccel)/tw;
  return {front:Math.max(.05,baseFront-longitudinal),rear:Math.max(.05,baseRear+longitudinal),left:Math.max(.05,(m*9.81)/2-lateral),right:Math.max(.05,(m*9.81)/2+lateral),longitudinal,lateral};
}

export function estimateFriction({speed=0,slipAngle=0,mu=.95,roadGrip=1,weatherGrip=1}={}){
  const base=clamp(finite(mu,.95)*finite(roadGrip,1)*finite(weatherGrip,1),.15,1.6);
  const speedLoss=clamp(Math.max(0,finite(speed)-180)/900,0,.35);
  const slipLoss=clamp(Math.abs(finite(slipAngle))*0.55,0,.45);
  const effective=clamp(base*(1-speedLoss)*(1-slipLoss),.12,1.6);
  return {mu:base,effectiveMu:effective,uncertainty:clamp(.04+speedLoss*.5+slipLoss*.7,0,.6)};
}

export function applyTireFriction(force,normalLoad,friction={}){
  const limit=Math.max(1,finite(normalLoad))*clamp(finite(friction.effectiveMu,1),.12,1.6);
  return clamp(finite(force),-limit,limit);
}
