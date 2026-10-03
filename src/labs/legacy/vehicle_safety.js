const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function stoppingDistance(speed,brakingAcceleration,reactionTime=0){
  const v=Math.max(0,finite(speed));
  const a=Math.max(0,finite(brakingAcceleration));
  const reaction=Math.max(0,finite(reactionTime));
  return v*reaction+(a>1e-6?v*v/(2*a):Infinity);
}

export function safeFollowingGap({speed=0,relativeSpeed=0,brakingAcceleration=0,reactionTime=.25,margin=12}={}){
  const v=Math.max(0,finite(speed));
  const closing=Math.max(0,finite(relativeSpeed));
  const ownStop=stoppingDistance(v,brakingAcceleration,reactionTime);
  const leadStop=stoppingDistance(closing,brakingAcceleration,0);
  return ownStop+leadStop+Math.max(0,finite(margin));
}

export function collisionSafety({gap=Infinity,speed=0,relativeSpeed=0,brakingAcceleration=0,reactionTime=.25,margin=12}={}){
  const g=Math.max(0,finite(gap,Infinity));
  const required=safeFollowingGap({speed,relativeSpeed,brakingAcceleration,reactionTime,margin});
  const closing=Math.max(0,finite(relativeSpeed));
  const ttc=closing>1e-6?g/closing:Infinity;
  return {gap:g,requiredGap:required,margin:g-required,safe:g>=required,ttc};
}

export function actuatorStep(current,target,responseRate,dt){
  const c=finite(current),t=finite(target),r=Math.max(0,finite(responseRate)),h=Math.max(0,finite(dt));
  const alpha=1-Math.exp(-r*h);
  return c+(t-c)*alpha;
}

export function applyActuatorDelay(input={},state={},dt=.016,response={steer:12,throttle:8,brake:16}){
  return {
    throttle:clamp(actuatorStep(state.throttle||0,input.throttle||0,response.throttle,dt),-1,1),
    brake:clamp(actuatorStep(state.brake||0,input.brake||0,response.brake,dt),0,1),
    steer:clamp(actuatorStep(state.steer||0,input.steer||0,response.steer,dt),-1,1),
    handbrake:!!input.handbrake,
    climb:clamp(actuatorStep(state.climb||0,input.climb||0,response.climb||8,dt),-1,1),
    descend:clamp(actuatorStep(state.descend||0,input.descend||0,response.descend||8,dt),0,1)
  };
}
