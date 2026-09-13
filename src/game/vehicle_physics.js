const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const VEHICLE_PHYSICS={
  mass:1200,engineForce:460,reverseForce:260,brakeForce:760,
  lateralGrip:10.5,handbrakeGrip:2,drag:.993,handbrakeDrag:.972,
  maxForwardSpeed:520,maxReverseSpeed:180,steeringRate:1.9,handbrakeSteeringRate:1.65,
  steeringAuthoritySpeed:55,rollingResistance:.006,aeroDrag:.000012,
  yawInertia:2.4,yawDamping:3.2,slipAngleGrip:7.5,handbrakeSlipGrip:1.15,maxSlipAngle:1.05,maxDt:1/30
};

export function createVehicleState({x=0,y=0,a=0,vx=0,vy=0,yawRate=0}={}){return{x,y,a,vx,vy,yawRate};}
export function vehicleSpeed(c){return Math.hypot(c.vx,c.vy);}

export function vehicleStep(car,dt,input={},cfg=VEHICLE_PHYSICS){
  const sub=Math.max(1,Math.ceil(Math.min(dt,cfg.maxDt)/(1/120))),h=Math.min(dt,cfg.maxDt)/sub;
  const throttle=clamp(Number(input.throttle)||0,-1,1),brake=clamp(Number(input.brake)||0,0,1),steer=clamp(Number(input.steer)||0,-1,1),handbrake=!!input.handbrake;
  let distance=0,slipAngle=0,lateralSpeed=0;
  for(let i=0;i<sub;i++){
    const fx=Math.cos(car.a),fy=Math.sin(car.a),rx=-fy,ry=fx;
    const forward=car.vx*fx+car.vy*fy,lateral=car.vx*rx+car.vy*ry,speed=Math.hypot(car.vx,car.vy);
    const driveForce=throttle>=0?cfg.engineForce:cfg.reverseForce;
    car.vx+=fx*throttle*driveForce*h;car.vy+=fy*throttle*driveForce*h;
    if(brake>0){const amount=Math.min(Math.abs(forward),cfg.brakeForce*brake*h);if(Math.abs(forward)>1){car.vx-=fx*Math.sign(forward)*amount;car.vy-=fy*Math.sign(forward)*amount;}}
    const grip=handbrake?cfg.handbrakeSlipGrip:cfg.slipAngleGrip;
    const targetLateral=Math.tan(steer*.42)*Math.max(0,Math.abs(forward)),lateralError=lateral-targetLateral;
    const lateralForce=clamp(lateralError*grip,-Math.max(20,speed*3),Math.max(20,speed*3));
    const correction=Math.min(1,grip*h);car.vx-=rx*lateralForce*correction;car.vy-=ry*lateralForce*correction;
    const resistance=cfg.rollingResistance*speed*h;if(speed>1){car.vx-=car.vx/speed*resistance;car.vy-=car.vy/speed*resistance;}
    const drag=handbrake?cfg.handbrakeDrag:cfg.drag,aero=1/(1+cfg.aeroDrag*speed*speed*h);car.vx*=Math.pow(drag,h*60)*aero;car.vy*=Math.pow(drag,h*60)*aero;
    const currentForward=car.vx*fx+car.vy*fy,authority=clamp(Math.abs(currentForward)/cfg.steeringAuthoritySpeed,0,1);
    const desiredYaw=steer*(handbrake?cfg.handbrakeSteeringRate:cfg.steeringRate)*authority*(currentForward>=0?1:-1);
    car.yawRate+=(desiredYaw-car.yawRate)*cfg.yawInertia*h;car.yawRate-=car.yawRate*cfg.yawDamping*h;car.a+=car.yawRate*h;
    const nfx=Math.cos(car.a),nfy=Math.sin(car.a),limitedForward=car.vx*nfx+car.vy*nfy;
    if(limitedForward>cfg.maxForwardSpeed){const e=limitedForward-cfg.maxForwardSpeed;car.vx-=nfx*e;car.vy-=nfy*e;}
    if(limitedForward<-cfg.maxReverseSpeed){const e=limitedForward+cfg.maxReverseSpeed;car.vx-=nfx*e;car.vy-=nfy*e;}
    car.x+=car.vx*h;car.y+=car.vy*h;distance+=vehicleSpeed(car)*h;
    lateralSpeed=car.vx*(-Math.sin(car.a))+car.vy*Math.cos(car.a);slipAngle=Math.atan2(lateralSpeed,Math.max(1,Math.abs(car.vx*nfx+car.vy*nfy)));
  }
  return{speed:vehicleSpeed(car),forward:car.vx*Math.cos(car.a)+car.vy*Math.sin(car.a),lateralSpeed,slipAngle,drift:Math.abs(slipAngle)>.12,distance};
}
