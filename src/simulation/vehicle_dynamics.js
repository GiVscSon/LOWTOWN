import {stepTyreForces} from './tyre_forces.js';
export const projectIso = (x, y) => ({ x: (x - y) * Math.sqrt(3) / 2, y: (x + y) / 2 });
export const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Preserve only intentional lateral inertia; longitudinal speed follows the engine.
export function velocityForHeading(car, retention = 0.18) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const lateral = (-car.vx * s + car.vy * c) * retention;
  return { vx: c * car.speed - s * lateral, vy: s * car.speed + c * lateral };
}

export function routeInput(car, target) {
  const distance = Math.hypot(target.x - car.x, target.y - car.y);
  const error = angleDifference(Math.atan2(target.y - car.y, target.x - car.x), car.angle);
  const desired = Math.abs(error) > 0.35 ? .8 : Math.max(.8,Math.min(4.8,distance/60));
  return { up: car.speed < desired, down: car.speed > desired + 0.3,
    left: error < -0.025, right: error > 0.025, handbrake: false, nitro: false };
}

// Live land-vehicle controller. Speeds retain the world's units per 60 Hz tick,
// while input, steering, braking and displacement are integrated in seconds.
export function stepLandVehicle(car, keys, dt, profile={}, surface={}) {
  const duration=Math.max(0,Math.min(dt,.1)),steps=Math.max(1,Math.ceil(duration*120)),step=duration/steps;
  const max=(profile.max??7.2)*(surface.maxSpeed??1);
  const engine=(profile.accel??.022)*(surface.acceleration??1);
  for(let i=0;i<steps;i++){
    const frame=step*60,abs=Math.abs(car.speed||0);
    const steerLimit=Math.max(.09,.8/(1+abs*abs*.45)),target=(Number(!!keys.right)-Number(!!keys.left))*steerLimit;
    const old=car.steeringAngle||0,rate=target?1.4:2.4;
    car.steeringAngle=old+Math.max(-rate*step,Math.min(rate*step,target-old));
    let speed=car.speed||0;
    if(keys.up){
      car.reverseDelay=0;
      speed=speed<0?Math.min(0,speed+.095*frame):Math.min(max,speed+engine*(1-.3*speed/max)*frame);
    }else if(keys.down){
      if(speed>0){speed=Math.max(0,speed-.095*(surface.braking??1)*frame);car.reverseDelay=0;}
      else{car.reverseDelay=(car.reverseDelay||0)+step;if(car.reverseDelay>=.35)speed=Math.max(-Math.min(1.8,max*.25),speed-engine*.65*frame);}
    }else car.reverseDelay=0;
    const drag=(.002+speed*speed*.000045)*(surface.coast ? (1-surface.coast)/.035:1)+(keys.handbrake?.07:0);
    speed=Math.sign(speed)*Math.max(0,Math.abs(speed)-drag*frame);
    stepTyreForces(car,speed,car.steeringAngle*(surface.steering??1),step,profile,surface,keys.handbrake);
    car.x+=car.vx*frame;car.y+=car.vy*frame;
  }
  return car;
}
