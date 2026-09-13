const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const DRIVETRAINS=Object.freeze({FWD:'FWD',RWD:'RWD',AWD:'AWD'});

export function resolveDrivetrain(value='RWD'){
  const key=String(value||'RWD').toUpperCase();
  return DRIVETRAINS[key]||DRIVETRAINS.RWD;
}

export function axleLoads({mass=1500,gravity=9.81,wheelbase=2.7,frontWeight=.52,longitudinalAcceleration=0,cgHeight=.55}={}){
  const m=Math.max(1,finite(mass,1500));
  const wb=Math.max(.8,finite(wheelbase,2.7));
  const fw=clamp(finite(frontWeight,.52),.35,.65);
  const g=Math.max(.1,finite(gravity,9.81));
  const transfer=m*finite(longitudinalAcceleration)*Math.max(.05,finite(cgHeight,.55))/wb;
  return {front:clamp(m*g*fw-transfer,0,m*g),rear:clamp(m*g*(1-fw)+transfer,0,m*g)};
}

export function drivetrainDistribution(drivetrain='RWD',loads={front:0,rear:0}){
  const type=resolveDrivetrain(drivetrain);
  if(type===DRIVETRAINS.FWD)return {type,front:.5,rear:0,drivenLoad:Math.max(0,finite(loads.front))};
  if(type===DRIVETRAINS.AWD)return {type,front:.5,rear:.5,drivenLoad:Math.max(0,finite(loads.front))+Math.max(0,finite(loads.rear))};
  return {type,front:0,rear:.5,drivenLoad:Math.max(0,finite(loads.rear))};
}

export function limitDriveForce(requestedForce,{drivetrain='RWD',mass=1500,friction=1,gravity=9.81,loads}={}){
  const m=Math.max(1,finite(mass,1500));
  const axle=loads||axleLoads({mass:m,gravity,longitudinalAcceleration:0});
  const d=drivetrainDistribution(drivetrain,axle);
  const capacity=Math.max(0,finite(friction,1))*Math.max(0.1,finite(gravity,9.81))*d.drivenLoad;
  const force=clamp(finite(requestedForce),-capacity,capacity);
  return {force,capacity,drivetrain:d.type,frontLoad:axle.front,rearLoad:axle.rear,frontShare:d.front,rearShare:d.rear,limited:Math.abs(force)<Math.abs(finite(requestedForce))};
}
