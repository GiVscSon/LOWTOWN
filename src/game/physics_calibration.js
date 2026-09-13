const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function buildPhysicsErrorProfile(report={}){
  const vehicles={};
  for(const [id,v] of Object.entries(report.vehicles||{})){
    const accel=v.meanAccelerationError||0;
    const steer=v.meanSteeringError||0;
    vehicles[id]={
      vehicleId:id,
      accelerationBias:+clamp(accel,-50,50).toFixed(5),
      steeringBias:+clamp(steer,-10,10).toFixed(5),
      speedLimitViolations:Number(v.speedLimitViolations)||0,
      confidence:Math.min(1,(Number(v.samples)||0)/120)
    };
  }
  return {version:1,vehicles};
}

export function applyPhysicsCalibration(input={},profile={}){
  const id=input.vehicleId||input.id||'sedan',p=profile.vehicles?.[id];
  if(!p)return {...input,calibrationApplied:false};
  const confidence=clamp(finite(p.confidence),0,1);
  return {...input,
    throttle:clamp(finite(input.throttle)*(1-clamp(p.accelerationBias/Math.max(1,Math.abs(finite(input.throttle)*100)), -.25,.25)*confidence),-1,1),
    steer:clamp(finite(input.steer)*(1-clamp(p.steeringBias/10,-.25,.25)*confidence),-1,1),
    calibrationApplied:true,
    calibrationConfidence:confidence
  };
}

export function mergeCalibrationProfiles(base={},next={}){
  return {version:1,vehicles:{...(base.vehicles||{}),...(next.vehicles||{})}};
}
