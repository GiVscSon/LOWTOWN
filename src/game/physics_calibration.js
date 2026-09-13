const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const robustMean=(values)=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 1;const trim=a.length>=8?Math.floor(a.length*.1):0;const b=a.slice(trim,a.length-trim||a.length);return b.reduce((s,v)=>s+v,0)/Math.max(1,b.length);};

function scaleFromRatios(values,fallback=1){const usable=values.filter(v=>Number.isFinite(v)&&v>.05&&v<4);return clamp(robustMean(usable.length?usable:[fallback]),.75,1.25);}

export function buildPhysicsErrorProfile(report={}){
  const vehicles={};
  for(const [id,v] of Object.entries(report.vehicles||{})){
    const samples=Math.max(0,finite(v.samples));
    vehicles[id]={vehicleId:id,accelerationBias:+clamp(finite(v.meanAccelerationError),-50,50).toFixed(5),steeringBias:+clamp(finite(v.meanSteeringError),-10,10).toFixed(5),accelerationScale:scaleFromRatios([v.driveScale],1),brakingScale:scaleFromRatios([v.brakeScale],1),steeringScale:scaleFromRatios([v.steeringScale],1),dragScale:1,turnRadiusScale:1,speedLimitViolations:Number(v.speedLimitViolations)||0,confidence:Math.min(1,samples/120),samples,ready:samples>=30};
  }
  return {version:2,vehicles};
}

export function calibrateSamples(samples=[],{minSamples=30,maxBiasAccel=50,maxBiasSteer=10}={}){
  const groups={};
  for(const s of samples){const id=s.vehicleId||'unknown';(groups[id]||(groups[id]=[])).push(s);}
  const vehicles={};
  for(const [id,list] of Object.entries(groups)){
    const accel=robustMean(list.map(s=>finite(s.accelerationError,NaN)));
    const steer=robustMean(list.map(s=>finite(s.steeringError,NaN)));
    const n=list.length;
    const accelerationBias=+clamp(accel,-maxBiasAccel,maxBiasAccel).toFixed(5);
    const steeringBias=+clamp(steer,-maxBiasSteer,maxBiasSteer).toFixed(5);
    vehicles[id]={vehicleId:id,accelerationBias,steeringBias,accelerationScale:scaleFromRatios(list.map(s=>s.driveScale),1),brakingScale:scaleFromRatios(list.map(s=>s.brakeScale),1),steeringScale:scaleFromRatios(list.map(s=>s.steeringScale),1),dragScale:scaleFromRatios(list.map(s=>s.dragScale),1),turnRadiusScale:scaleFromRatios(list.map(s=>s.turnRadiusScale),1),confidence:Math.min(1,n/minSamples),samples:n,ready:n>=minSamples};
  }
  return {version:2,vehicles};
}

export function applyPhysicsCalibration(input={},profile={}){
  const id=input.vehicleId||input.id||'sedan',p=profile.vehicles?.[id];
  if(!p||p.ready===false)return {...input,calibrationApplied:false};
  const confidence=clamp(finite(p.confidence),0,1),accelScale=clamp(finite(p.accelerationScale,1),.75,1.25),steerScale=clamp(finite(p.steeringScale,1),.75,1.25);
  return {...input,throttle:clamp(finite(input.throttle)*(1-(accelScale-1)*confidence),-1,1),steer:clamp(finite(input.steer)*(1-(steerScale-1)*confidence),-1,1),calibrationApplied:true,calibrationConfidence:confidence};
}

export function calibrationScalesFromError({accelerationBias=0,steeringBias=0,brakingBias=0,dragBias=0,turnRadiusBias=0,confidence=0}={}){
  const c=clamp(confidence,0,1);
  return {accelerationScale:clamp(1-accelerationBias/20,.75,1.25),brakingScale:clamp(1-brakingBias/20,.75,1.25),steeringScale:clamp(1-steeringBias/4,.75,1.25),dragScale:clamp(1+dragBias/20,.75,1.25),turnRadiusScale:clamp(1+turnRadiusBias/20,.75,1.25),confidence:c};
}

export function mergeCalibrationProfiles(base={},next={}){return {version:2,vehicles:{...(base.vehicles||{}),...(next.vehicles||{})}};}
