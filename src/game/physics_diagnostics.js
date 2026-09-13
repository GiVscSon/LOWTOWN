const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function predictLongitudinal(previous,current,p,input,dt){
  const mass=Math.max(1,finite(p.mass,1));
  const speed=Math.max(0,Math.abs(finite(previous.forwardSpeed,finite(previous.speed))));
  const throttle=clamp(finite(input.throttle),-1,1);
  const brake=clamp(finite(input.brake),0,1);
  const drive=throttle*(throttle>=0?finite(p.engineForce):Math.abs(finite(p.reverseForce)))/mass;
  const brakeDecel=brake*finite(p.brakeForce)/mass;
  const rolling=finite(p.rollingResistance)*speed;
  const dragBase=clamp(finite(p.drag,1),0,1);
  const handbrake=!!input.handbrake;
  const drag=handbrake?clamp(finite(p.handbrakeDrag,dragBase),0,1):dragBase;
  const aero=1/(1+finite(p.aeroDrag)*speed*speed*Math.max(.001,dt));
  const dragDecel=speed>0?speed*(1-Math.pow(drag,Math.max(.001,dt)*60)*aero)/Math.max(.001,dt):0;
  return {drive,brakeDecel,rollingDecel:rolling,dragDecel,longitudinalExpected:drive-Math.sign(finite(previous.forwardSpeed,1))*(brakeDecel+rolling+dragDecel)};
}

export function diagnosePhysicsSample(previous,current,dt=0){
  const a=previous||{},b=current||{},p=b.physics||a.physics||{},input=b.input||b.control||b.controls||{},telemetry=b.telemetry||{};
  const h=Math.max(.001,finite(dt,.001));
  const mass=Math.max(1,finite(p.mass,1));
  const longitudinal=p.type==='CAR'||b.vehicleType==='CAR'||!p.type?predictLongitudinal(a,b,p,input,h):{drive:finite(input.throttle)*finite(p.engineForce)/mass,brakeDecel:finite(input.brake)*finite(p.brakeForce)/mass,rollingDecel:0,dragDecel:0,longitudinalExpected:finite(input.throttle)*finite(p.engineForce)/mass-finite(input.brake)*finite(p.brakeForce)/mass};
  const prevSpeed=finite(a.forwardSpeed,finite(a.speed));
  const currSpeed=finite(b.forwardSpeed,finite(b.speed));
  const actualAcceleration=(currSpeed-prevSpeed)/h;
  const accelerationError=actualAcceleration-longitudinal.longitudinalExpected;
  const steeringRate=finite(p.steeringRate);
  const prevHeading=finite(a.heading,finite(a.a));
  const currHeading=finite(b.heading,finite(b.a));
  let dHeading=currHeading-prevHeading;
  while(dHeading>Math.PI)dHeading-=Math.PI*2;
  while(dHeading<-Math.PI)dHeading+=Math.PI*2;
  const actualYawRate=dHeading/h;
  const speedAuthority=clamp(Math.abs(currSpeed)/Math.max(1,finite(p.steeringAuthoritySpeed,55)),0,1);
  const expectedYawRate=finite(input.steer)*steeringRate*speedAuthority*(currSpeed>=0?1:-1);
  const steeringError=actualYawRate-expectedYawRate;
  const targetSpeed=finite(b.targetSpeed,finite(b.ai?.targetSpeed,NaN));
  const maxSpeed=finite(p.maxSpeed,finite(p.maxForwardSpeed,NaN));
  const speedLimitViolation=Number.isFinite(targetSpeed)&&Number.isFinite(maxSpeed)?targetSpeed>maxSpeed+.001:false;
  return {vehicleId:b.vehicleId||a.vehicleId||null,vehicleType:b.vehicleType||a.vehicleType||null,mass,expectedDrive:longitudinal.drive,expectedBrake:longitudinal.brakeDecel,expectedRollingResistance:longitudinal.rollingDecel,expectedDrag:longitudinal.dragDecel,longitudinalExpected:longitudinal.longitudinalExpected,actualAcceleration,accelerationError,steeringRate,expectedYawRate,actualYawRate,steeringError,targetSpeed,maxSpeed,speedLimitViolation,telemetryAvailable:Object.keys(telemetry).length>0};
}

export function createPhysicsDiagnostics({capacity=600}={}){
  const samples=[];
  const summary={samples:0,accelerationErrorAbs:0,steeringErrorAbs:0,maxAccelerationError:0,maxSteeringError:0,speedLimitViolations:0,vehicles:{}};
  function sample(previous,current,dt){
    const d=diagnosePhysicsSample(previous,current,dt);samples.push(d);if(samples.length>capacity)samples.splice(0,samples.length-capacity);
    summary.samples++;summary.accelerationErrorAbs+=Math.abs(d.accelerationError);summary.steeringErrorAbs+=Math.abs(d.steeringError);summary.maxAccelerationError=Math.max(summary.maxAccelerationError,Math.abs(d.accelerationError));summary.maxSteeringError=Math.max(summary.maxSteeringError,Math.abs(d.steeringError));if(d.speedLimitViolation)summary.speedLimitViolations++;
    const id=d.vehicleId||'unknown';const v=summary.vehicles[id]||(summary.vehicles[id]={samples:0,accelerationErrorAbs:0,steeringErrorAbs:0,maxAccelerationError:0,maxSteeringError:0,speedLimitViolations:0});v.samples++;v.accelerationErrorAbs+=Math.abs(d.accelerationError);v.steeringErrorAbs+=Math.abs(d.steeringError);v.maxAccelerationError=Math.max(v.maxAccelerationError,Math.abs(d.accelerationError));v.maxSteeringError=Math.max(v.maxSteeringError,Math.abs(d.steeringError));if(d.speedLimitViolation)v.speedLimitViolations++;
    return d;
  }
  function report(){const s=summary,vehicles={};for(const [id,v] of Object.entries(s.vehicles))vehicles[id]={...v,meanAccelerationError:v.samples?+(v.accelerationErrorAbs/v.samples).toFixed(5):0,meanSteeringError:v.samples?+(v.steeringErrorAbs/v.samples).toFixed(5):0};return {version:1,samples:s.samples,meanAccelerationError:s.samples?+(s.accelerationErrorAbs/s.samples).toFixed(5):0,meanSteeringError:s.samples?+(s.steeringErrorAbs/s.samples).toFixed(5):0,maxAccelerationError:+s.maxAccelerationError.toFixed(5),maxSteeringError:+s.maxSteeringError.toFixed(5),speedLimitViolations:s.speedLimitViolations,vehicles,recent:samples.slice(-120)};}
  function reset(){samples.length=0;Object.assign(summary,{samples:0,accelerationErrorAbs:0,steeringErrorAbs:0,maxAccelerationError:0,maxSteeringError:0,speedLimitViolations:0,vehicles:{}});}
  return {sample,report,reset,state:summary};
}
