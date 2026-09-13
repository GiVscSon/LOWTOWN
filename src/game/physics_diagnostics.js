const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function diagnosePhysicsSample(previous,current,dt=0){
  const a=previous||{},b=current||{},p=b.physics||a.physics||{},input=b.input||b.control||{},telemetry=b.telemetry||{};
  const h=Math.max(.001,finite(dt,.001));
  const mass=Math.max(1,finite(p.mass,1));
  const engineForce=finite(p.engineForce);
  const brakeForce=finite(p.brakeForce);
  const throttle=clamp(finite(input.throttle),-1,1);
  const brake=clamp(finite(input.brake),0,1);
  const expectedDrive=throttle*engineForce/mass;
  const expectedBrake=brake*brakeForce/mass;
  const prevSpeed=finite(a.forwardSpeed,finite(a.speed));
  const currSpeed=finite(b.forwardSpeed,finite(b.speed));
  const actualAcceleration=(currSpeed-prevSpeed)/h;
  const longitudinalExpected=expectedDrive-(currSpeed>=0?1:-1)*expectedBrake;
  const accelerationError=actualAcceleration-longitudinalExpected;
  const steeringRate=finite(p.steeringRate);
  const prevHeading=finite(a.heading,finite(a.a));
  const currHeading=finite(b.heading,finite(b.a));
  let dHeading=currHeading-prevHeading;
  while(dHeading>Math.PI)dHeading-=Math.PI*2;
  while(dHeading<-Math.PI)dHeading+=Math.PI*2;
  const actualYawRate=dHeading/h;
  const expectedYawRate=finite(input.steer)*steeringRate*clamp(Math.abs(currSpeed)/55,0,1)*(currSpeed>=0?1:-1);
  const steeringError=actualYawRate-expectedYawRate;
  const targetSpeed=finite(b.targetSpeed,finite(b.ai?.targetSpeed,NaN));
  const maxSpeed=finite(p.maxSpeed,finite(p.maxForwardSpeed,NaN));
  const speedLimitViolation=Number.isFinite(targetSpeed)&&Number.isFinite(maxSpeed)?targetSpeed>maxSpeed+.001:false;
  return {vehicleId:b.vehicleId||a.vehicleId||null,vehicleType:b.vehicleType||a.vehicleType||null,mass,expectedDrive,expectedBrake,longitudinalExpected,actualAcceleration,accelerationError,steeringRate,expectedYawRate,actualYawRate,steeringError,targetSpeed,maxSpeed,speedLimitViolation};
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
