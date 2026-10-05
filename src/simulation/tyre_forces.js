const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// City speeds are units/60 Hz tick; 10 world units represent one metre.
export function axleLoads({mass=1500,wheelbase=3.2,track=1.6,cgHeight=.55,frontShare=.54},ax=0,ay=0){
  const weight=mass*9.81,longitudinal=mass*ax*cgHeight/wheelbase;
  const front=clamp(weight*frontShare-longitudinal,weight*.12,weight*.88),rear=weight-front;
  const transfer=clamp(mass*ay*cgHeight/track,-weight*.4,weight*.4);
  return {front,rear,frontLeft:front/2-transfer*front/weight,frontRight:front/2+transfer*front/weight,
    rearLeft:rear/2-transfer*rear/weight,rearRight:rear/2+transfer*rear/weight,weight};
}
export function frictionCapacity(load,longitudinal,mu){
  const maximum=Math.max(0,load*mu);return Math.sqrt(Math.max(0,maximum*maximum-longitudinal*longitudinal));
}
export function stepTyreForces(car,requestedSpeed,steering,dt,profile={},surface={},handbrake=false){
  const mass=profile.mass||car.mass||1500,wheelbase=Math.max(2.1,(profile.width||car.width||48)*.07),track=Math.max(1.1,(car.height||24)*.065);
  const config={mass,wheelbase,track,cgHeight:profile.cgHeight||(/truck|bus|van/.test(car.type||'')?.9:.55),frontShare:profile.frontShare||.54};
  const mu=clamp(surface.tyreGrip??(1-(surface.slipRetention??.18)+.18),.15,1.15),u=(car.speed||0)*6;
  const requestedAx=(requestedSpeed-(car.speed||0))*6/Math.max(dt,.001);
  let ax=clamp(requestedAx,-mu*9.81,mu*9.81);
  const braking= Math.sign(ax)!==Math.sign(u)&&Math.abs(u)>.1;
  const frontDrive=(profile.drive||'front')==='front';
  for(let i=0;i<3;i++){
    const loaded=axleLoads(config,ax,car.lateralAcceleration||0);
    const requestedCorner=mass*u*u/wheelbase*Math.tan(steering);
    const frontCorner=clamp(requestedCorner*config.frontShare,-loaded.front*mu*.75,loaded.front*mu*.75);
    const rearCorner=clamp(requestedCorner*(1-config.frontShare),-loaded.rear*mu*.75,loaded.rear*mu*.75);
    const frontLong=frictionCapacity(loaded.front,frontCorner,mu),rearLong=frictionCapacity(loaded.rear,rearCorner,mu);
    const available=braking?Math.min(frontLong/.68,rearLong/.32):frontDrive?frontLong:rearLong;
    ax=clamp(requestedAx,-available/mass,available/mass);
  }
  let speed=(car.speed||0)+ax*dt/6;
  const loads=axleLoads(config,ax,car.lateralAcceleration||0);
  const fx=mass*ax,frontFx=fx*(braking?.68:frontDrive?1:0),rearFx=fx-frontFx;
  // Each outside tyre carries more weight but gains less grip than it loses inside.
  const axleCapacity=(left,right,force,lock=1)=>frictionCapacity(left,force/2,mu)*lock+frictionCapacity(right,force/2,mu)*lock;
  const frontCapacity=axleCapacity(loads.frontLeft,loads.frontRight,frontFx);
  const rearCapacity=axleCapacity(loads.rearLeft,loads.rearRight,rearFx,handbrake?.22:1);
  const cs=Math.cos(car.angle||0),sn=Math.sin(car.angle||0);
  let lateral=(-(car.vx||0)*sn+(car.vy||0)*cs)*6,yaw=car.yawRate||0;
  const frontLength=wheelbase*(1-config.frontShare),rearLength=wheelbase*config.frontShare;
  const safeSpeed=Math.max(3,Math.abs(u));
  const frontSlip=steering*Math.sign(u||1)-Math.atan2(lateral+yaw*frontLength,safeSpeed);
  const rearSlip=-Math.atan2(lateral-yaw*rearLength,safeSpeed);
  const frontForce=clamp(frontSlip*loads.front*8,-frontCapacity,frontCapacity),rearForce=clamp(rearSlip*loads.rear*8,-rearCapacity,rearCapacity);
  const lateralForce=frontForce+rearForce;
  if(Math.abs(u)<3){yaw=u/wheelbase*Math.tan(steering);lateral*=Math.exp(-dt*12);}
  else{yaw+=(frontForce*frontLength-rearForce*rearLength)/(mass*(wheelbase*wheelbase+track*track)/12)*dt;lateral+=(lateralForce/mass-u*yaw)*dt;}
  yaw=clamp(yaw,-2.5,2.5);lateral=clamp(lateral,-Math.abs(u)*.65-1,Math.abs(u)*.65+1);
  if(Math.abs(speed)<.003&&Math.abs(requestedSpeed)<.003){speed=0;lateral=0;yaw=0;}
  car.speed=speed;car.yawRate=yaw;car.lateralAcceleration=lateralForce/mass;car.angle+=yaw*dt;
  car.vx=Math.cos(car.angle)*speed-Math.sin(car.angle)*lateral/6;
  car.vy=Math.sin(car.angle)*speed+Math.cos(car.angle)*lateral/6;
  car.tyres={...loads,mu,ax,ay:car.lateralAcceleration,frontForce,rearForce,frontCapacity,rearCapacity,frontSlip,rearSlip,slipAngle:Math.atan2(lateral,Math.max(.1,Math.abs(u)))};
}
