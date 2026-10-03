import { circleContact } from './collision_physics.js';
import { syncTrafficCarPose } from './runtime_traffic.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function radiusFor(entity){
  const width=Math.max(18,finite(entity?.width,48));
  const height=Math.max(14,finite(entity?.height,24));
  return clamp(Math.min(width,height)*0.75,12,22);
}

function trafficProxy(car){
  const speed=Math.max(0,finite(car.speed));
  return {
    x:finite(car.x),y:finite(car.y),
    vx:Math.cos(finite(car.angle))*speed,
    vy:Math.sin(finite(car.angle))*speed,
    mass:Math.max(900,finite(car.mass,1450)),
    radius:radiusFor(car)
  };
}

function playerProxy(player){
  return {
    x:finite(player.x),y:finite(player.y),
    vx:finite(player.vx),vy:finite(player.vy),
    mass:Math.max(900,finite(player.mass,1500)),
    radius:radiusFor(player)
  };
}

function applyTrafficProxy(car,proxy){
  const beforeX=finite(car.x),beforeY=finite(car.y);
  const fx=Math.cos(finite(car.angle)),fy=Math.sin(finite(car.angle));
  const projected=Math.max(0,proxy.vx*fx+proxy.vy*fy);
  car.speed=clamp(projected,0,Math.max(28,finite(car.cruiseSpeed,projected||70))*1.05);

  const length=Math.max(1,finite(car.segmentLength,1));
  const along=(proxy.x-beforeX)*fx+(proxy.y-beforeY)*fy;
  car.segmentProgress=clamp(finite(car.segmentProgress)+along/length,0,1);
  car.collisionHold=Math.max(finite(car.collisionHold),0.22);
  car.braking=true;
  syncTrafficCarPose(car);
}

function closeEnough(a,b,padding=4){
  const limit=radiusFor(a)+radiusFor(b)+padding;
  return Math.hypot(finite(b.x)-finite(a.x),finite(b.y)-finite(a.y))<limit;
}

export function resolveRuntimeVehicleCollisions(player,cars,dt=1/60,{onPlayerImpact=null}={}){
  const h=clamp(finite(dt,1/60),0.001,0.1);
  const result={playerHits:0,trafficContacts:0,damage:0,maxImpulse:0};

  if(player){
    player._trafficImpactCooldown=Math.max(0,finite(player._trafficImpactCooldown)-h);
  }

  // Traffic-to-traffic contact. Cars remain constrained to their route segments,
  // so collision response changes along-lane speed/progress instead of kicking
  // them sideways through curbs or buildings.
  for(let i=0;i<cars.length;i++){
    const a=cars[i];
    if(!a?.currentSegment)continue;
    for(let j=i+1;j<cars.length;j++){
      const b=cars[j];
      if(!b?.currentSegment||!closeEnough(a,b,2))continue;

      const pa=trafficProxy(a),pb=trafficProxy(b);
      const hit=circleContact(pa,pb,{
        restitution:.06,
        friction:.35,
        damageScale:0,
        maxImpulse:70000,
        separation:.9
      });
      if(!hit.hit)continue;

      result.trafficContacts++;
      result.maxImpulse=Math.max(result.maxImpulse,finite(hit.impulse));
      applyTrafficProxy(a,pa);
      applyTrafficProxy(b,pb);

      // Pure crossing/sideswipe overlaps can have near-zero normal closing
      // speed even though two chassis occupy the same space. Damp both cars
      // briefly so they do not ghost through each other at an intersection.
      if(finite(hit.impulse)<1&&finite(hit.penetration)>0.5){
        a.speed*=0.62;
        b.speed*=0.62;
      }
      a.collisionHold=Math.max(finite(a.collisionHold),0.28);
      b.collisionHold=Math.max(finite(b.collisionHold),0.28);
    }
  }

  if(!player)return result;

  // Player-to-traffic contact uses the shared impulse solver. Player receives
  // the full 2-D response while NPCs project the impulse back onto their lane.
  for(const car of cars){
    if(!car?.currentSegment||!closeEnough(player,car,5))continue;
    const pp=playerProxy(player),cp=trafficProxy(car);
    const hit=circleContact(pp,cp,{
      restitution:.10,
      friction:.42,
      damageScale:.00022,
      maxImpulse:90000,
      separation:.95
    });
    if(!hit.hit)continue;

    player.x=pp.x;player.y=pp.y;
    player.vx=pp.vx;player.vy=pp.vy;
    player.speed=Math.hypot(pp.vx,pp.vy);
    applyTrafficProxy(car,cp);
    car.collisionHold=Math.max(finite(car.collisionHold),0.38);

    result.maxImpulse=Math.max(result.maxImpulse,finite(hit.impulse));
    if(hit.impulse>1200&&player._trafficImpactCooldown<=0){
      const damage=clamp(finite(hit.damage),1,18);
      player._trafficImpactCooldown=.45;
      result.playerHits++;
      result.damage+=damage;
      if(typeof onPlayerImpact==='function')onPlayerImpact({car,contact:hit,damage});
    }
  }

  return result;
}
