const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const meanAbs=(list,key)=>{const a=(list||[]).map(v=>Math.abs(finite(v?.[key],NaN))).filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:Infinity;};
const sum=(list,key)=> (list||[]).reduce((s,v)=>s+Math.max(0,finite(v?.[key])),0);

export function calibrationMetrics(samples=[]){
  return {
    samples:samples.length,
    acceleration:meanAbs(samples,'accelerationError'),
    steering:meanAbs(samples,'steeringError'),
    braking:meanAbs(samples,'brakingError'),
    turnRadius:meanAbs(samples,'turnRadiusError'),
    speedViolations:sum(samples,'speedLimitViolation')+sum(samples,'speedLimitViolations')
  };
}

export function acceptCalibration(beforeSamples=[],afterSamples=[],options={}){
  const before=calibrationMetrics(beforeSamples),after=calibrationMetrics(afterSamples);
  const tolerance=Math.max(0,finite(options.tolerance,.03));
  const notWorse=(a,b)=>{
    if(Number.isFinite(a)&&Number.isFinite(b)) return b<=a*(1+tolerance);
    if(!Number.isFinite(a)&&Number.isFinite(b)) return true;
    return !Number.isFinite(a)&&!Number.isFinite(b);
  };
  const accelerationImproved=Number.isFinite(before.acceleration)&&Number.isFinite(after.acceleration)&&after.acceleration<before.acceleration;
  const accepted=accelerationImproved&&
    notWorse(before.steering,after.steering)&&
    notWorse(before.braking,after.braking)&&
    notWorse(before.turnRadius,after.turnRadius)&&
    after.speedViolations<=before.speedViolations;
  return {accepted,before,after,reasons:{accelerationImproved,steeringNotWorse:notWorse(before.steering,after.steering),brakingNotWorse:notWorse(before.braking,after.braking),turnRadiusNotWorse:notWorse(before.turnRadius,after.turnRadius),speedViolationsNotWorse:after.speedViolations<=before.speedViolations}};
}
