const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const VEHICLE_PHYSICS={
  mass:1200,
  engineForce:460,
  reverseForce:260,
  brakeForce:760,
  lateralGrip:10.5,
  handbrakeGrip:2.0,
  drag:0.993,
  handbrakeDrag:0.972,
  maxForwardSpeed:520,
  maxReverseSpeed:180,
  steeringRate:1.9,
  handbrakeSteeringRate:1.65,
  steeringAuthoritySpeed:55,
  rollingResistance:0.006,
  aeroDrag:0.000012,
  maxDt:1/30
};

export function createVehicleState({x=0,y=0,a=0,vx=0,vy=0}={}){return{x,y,a,vx,vy};}

export function vehicleSpeed(c){return Math.hypot(c.vx,c.vy);}

export function vehicleStep(car,dt,input={},cfg=VEHICLE_PHYSICS){
  const sub=Math.max(1,Math.ceil(Math.min(dt,cfg.maxDt)/(1/120)));
  const h=Math.min(dt,cfg.maxDt)/sub;
  const throttle=clamp(Number(input.throttle)||0,-1,1);
  const brake=clamp(Number(input.brake)||0,0,1);
  const steer=clamp(Number(input.steer)||0,-1,1);
  const handbrake=!!input.handbrake;
  let distance=0;
  for(let i=0;i<sub;i++){
    const fx=Math.cos(car.a),fy=Math.sin(car.a),rx=-fy,ry=fx;
    const forward=car.vx*fx+car.vy*fy;
    const lateral=car.vx*rx+car.vy*ry;
    const speed=Math.hypot(car.vx,car.vy);

    if(throttle>=0){car.vx+=fx*throttle*cfg.engineForce*h;car.vy+=fy*throttle*cfg.engineForce*h;}
    else{car.vx+=fx*throttle*cfg.reverseForce*h;car.vy+=fy*throttle*cfg.reverseForce*h;}

    if(brake>0){
      const amount=Math.min(Math.abs(forward),cfg.brakeForce*brake*h);
      if(Math.abs(forward)>1){car.vx-=fx*Math.sign(forward)*amount;car.vy-=fy*Math.sign(forward)*amount;}
    }

    const grip=handbrake?cfg.handbrakeGrip:cfg.lateralGrip;
    const lateralCorrection=Math.min(1,grip*h);
    car.vx-=rx*lateral*lateralCorrection;
    car.vy-=ry*lateral*lateralCorrection;

    const resistance=cfg.rollingResistance*speed*h;
    if(speed>1){car.vx-=car.vx/speed*resistance;car.vy-=car.vy/speed*resistance;}
    const drag=handbrake?cfg.handbrakeDrag:cfg.drag;
    const aero=1/(1+cfg.aeroDrag*speed*speed*h);
    car.vx*=Math.pow(drag,h*60)*aero;
    car.vy*=Math.pow(drag,h*60)*aero;

    const currentForward=car.vx*fx+car.vy*fy;
    const authority=clamp(Math.abs(currentForward)/cfg.steeringAuthoritySpeed,0,1);
    const steeringRate=handbrake?cfg.handbrakeSteeringRate:cfg.steeringRate;
    car.a+=steer*steeringRate*authority*h*(currentForward>=0?1:-1);

    const nfx=Math.cos(car.a),nfy=Math.sin(car.a);
    const limitedForward=car.vx*nfx+car.vy*nfy;
    if(limitedForward>cfg.maxForwardSpeed){const e=limitedForward-cfg.maxForwardSpeed;car.vx-=nfx*e;car.vy-=nfy*e;}
    if(limitedForward<-cfg.maxReverseSpeed){const e=limitedForward+cfg.maxReverseSpeed;car.vx-=nfx*e;car.vy-=nfy*e;}

    const nx=car.x+car.vx*h,ny=car.y+car.vy*h;
    car.x=nx;car.y=ny;distance+=vehicleSpeed(car)*h;
  }
  return{speed:vehicleSpeed(car),forward:car.vx*Math.cos(car.a)+car.vy*Math.sin(car.a),distance};
}
