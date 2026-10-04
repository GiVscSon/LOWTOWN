import {chassis} from './solid_contacts.js';
import {applyBodyImpulse,bodyHeight,damagePanel,isMovableProp,stepBodyResponse} from './body_physics.js';
import {createEffectPool} from './effects.js';
import {advanceCharacterAnimation} from './character_animation.js';

function contains(body,x,y,person=false){
  const c=person?{x:body.x,y:body.y,angle:0,length:9,breadth:9}:chassis(body),dx=x-c.x,dy=y-c.y,cs=Math.cos(c.angle),sn=Math.sin(c.angle);
  return Math.abs(dx*cs+dy*sn)<=c.length/2&&Math.abs(-dx*sn+dy*cs)<=c.breadth/2;
}
// Sweep a short fist corridor. The first solid surface occludes every target behind it.
export function meleeTarget(player,candidates,people=new Set(),range=27){
  const cs=Math.cos(player.angle||0),sn=Math.sin(player.angle||0),height=(player.jumpHeight||0)+14;
  for(let distance=5;distance<=range;distance++)for(const side of [0,-4,4]){
    const x=player.x+cs*distance-sn*side,y=player.y+sn*distance+cs*side;
    for(const candidate of candidates){const body=candidate.source||candidate;
      if(body===player||body.intact===false||height>(people.has(body)?23:bodyHeight(body))+5||!candidate.source&&Math.hypot(body.x-player.x,body.y-player.y)>150)continue;
      if(contains(candidate,x,y,people.has(body)))return {body,x,y,distance,fixed:!!candidate.source};
    }
  }return null;
}
export function installCharacterActions(ctx){
  let effectSeed=731;
  ctx.effects=createEffectPool(256,()=>((effectSeed=Math.imul(effectSeed,1664525)+1013904223>>>0)/4294967296));
  ctx.breakWorldProp=prop=>{
    if(prop.intact===false)return;
    prop.intact=false;ctx.sound.playPropBreak();
    ctx.effects.burst(prop.x,prop.y,8,prop.type==='hydrant'?'water':'chip',18);
    if(prop.type==='hydrant'){prop.sprayRemaining=12;ctx.showToast('💦 Гидрант разбит');}
  };
  ctx.stepCharacterActions=(dt,keys)=>{
    const p=ctx.player;
    for(const person of ctx.pedestrians)if(person.combatTimer>0){
      person.combatTimer=Math.max(0,person.combatTimer-dt);
      person.heading=person.angle=Math.atan2(p.y-person.y,p.x-person.x);
      person.attackTime=.7-person.combatTimer;
      if(person.combatTimer<=.35&&!person.counterHit){
        person.counterHit=true;
        const obstruction=ctx.getCityScenery().contacts.query(person.x-40,person.y-40,person.x+40,person.y+40);
        const target=meleeTarget(person,[...obstruction,p],new Set([p]));
        if(target?.body===p&&ctx.roam?.mode==='foot'&&!p.hitCooldown&&!person.knockdownTimer){
          p.hp=Math.max(0,p.hp-8);p.hitCooldown=.6;p.hitFlash=.18;
          applyBodyImpulse(p,Math.cos(person.angle)*2000,Math.sin(person.angle)*2000,target,true);
          ctx.effects.burst(target.x,target.y,14,'dust',5);ctx.sound.playImpact();
        }
      }
      if(!person.combatTimer){person.attackTime=0;person.fleeTimer=4;person.reaction='fleeing';}
    }
    if(ctx.stepWeapons(dt,keys))return;
    p.attackCooldown=Math.max(0,(p.attackCooldown||0)-dt);
    const requested=p.attackRequested;p.attackRequested=false;
    const foot=ctx.roam?.mode==='foot',pressed=!!keys.attack;
    if(foot&&!p.inWater&&(requested||pressed&&!p.attackHeld)&&!p.attackCooldown&&!p.knockdownTimer){p.attackTime=.001;p.attackHit=false;p.attackSide=-(p.attackSide||-1);p.attackCooldown=.48;}
    p.attackHeld=pressed;
    if(!foot||p.inWater){p.attackTime=0;return;}
    if(!p.attackTime)return;
    p.attackTime+=dt;
    if(p.attackTime>=.14&&!p.attackHit){
      p.attackHit=true;
      const people=new Set([...ctx.pedestrians,...(ctx.cityIncidentDirector?.current()?.actors||[])]);
      const nearby=ctx.getCityScenery().contacts.query(p.x-65,p.y-65,p.x+65,p.y+65);
      const hit=meleeTarget(p,[...nearby,...ctx.cityCollisionBodies()],people);
      if(hit){
        const b=hit.body,person=people.has(b),prop=b.type==='hydrant'||isMovableProp(b),dx=Math.cos(p.angle||0),dy=Math.sin(p.angle||0);
        b.hitFlash=.18;ctx.effects.burst(hit.x,hit.y,14+(p.jumpHeight||0),person?'dust':prop?'chip':'spark',person?5:10,dx*12,dy*12);ctx.sound.playImpact();
        if(!hit.fixed)applyBodyImpulse(b,dx*4200,dy*4200,hit,person);
        if(person){b.hp=Math.max(0,(b.hp??100)-14);b.provokedTimer=6;b.fleeTimer=4;b.reaction='fleeing';b.activity='recovering';b.activityRemaining=0;b.conversationPartner=null;
          if(ctx.pedestrians.indexOf(b)%5===0&&b.hp>30){b.combatTimer=.7;b.counterHit=false;b.fleeTimer=0;b.reaction='angry';}
          if(b.hp<=30){b.stance='down';b.knockdownTimer=1.2;}ctx.raiseWantedFromCrime(1,.7);
        }else if(prop){b.hp=Math.max(0,(b.hp??(b.type==='dumpster'?100:36))-12);if(b.hp<=0)ctx.breakWorldProp(b);
        }else if(!hit.fixed){b.hp=Math.max(0,(b.hp??100)-3);damagePanel(b,-dx,-dy,.1);}
      }
    }
    if(p.attackTime>=.42)p.attackTime=0;
  };
  ctx.stepWorldEffects=dt=>{
    advanceCharacterAnimation(ctx.player,dt,ctx.state.keys);
    for(const person of new Set([...ctx.pedestrians,...(ctx.cityIncidentDirector?.current()?.actors||[])]))advanceCharacterAnimation(person,dt);
    for(const vehicle of new Set([ctx.player,...ctx.cityCollisionBodies(),...(ctx.roam?.fleet||[])]))if(Number.isFinite(vehicle.doorElapsed)&&vehicle.doorElapsed<1.6)vehicle.doorElapsed=Math.min(1.6,vehicle.doorElapsed+dt);
    ctx.effects.step(dt);ctx.effectClock=(ctx.effectClock||0)+dt;
    const quality=ctx.threeRenderer?.graphics.effects||'high';
    const pulse=Math.floor(ctx.effectClock*8)!==Math.floor((ctx.effectClock-dt)*8);
    for(const prop of ctx.breakableProps){
      if(prop.sprayRemaining>0){prop.sprayRemaining=Math.max(0,prop.sprayRemaining-dt);if(pulse&&quality!=='off')ctx.effects.burst(prop.x,prop.y,3,'water',3);}
      if(isMovableProp(prop)&&prop.intact!==false)stepBodyResponse(prop,dt,true);
    }
    const people=new Set([...ctx.pedestrians,...(ctx.cityIncidentDirector?.current()?.actors||[]),...(ctx.roam?.mode==='foot'?[ctx.player]:[])]);
    for(const car of ctx.cityCollisionBodies())if(!people.has(car)&&!isMovableProp(car))stepBodyResponse(car,dt);
    const p=ctx.player;
    if(p.landed){if(quality!=='off'&&!p.inWater)ctx.effects.burst(p.x,p.y,.5,ctx.weather.wetness>.2?'water':'dust',8);p.landed=false;}
    if(pulse&&quality!=='off'&&!p.inWater&&ctx.roam?.profile?.kind==='land'){
      const speed=Math.abs(p.speed||0),back=(p.width||48)*.45;
      if(speed<1.5)ctx.effects.burst(p.x-Math.cos(p.angle)*back,p.y-Math.sin(p.angle)*back,5,'steam',1);
      if(speed>2&&ctx.state.keys.handbrake)ctx.effects.burst(p.x,p.y,1,ctx.weather.wetness>.2?'water':'dust',2);
    }
    if(pulse&&quality==='high')for(const vent of (ctx.ambientVents||[]))if(Math.hypot(vent.x-p.x,vent.y-p.y)<550)ctx.effects.burst(vent.x,vent.y,vent.z,'steam',1);
  };
}
