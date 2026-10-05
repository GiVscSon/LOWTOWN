import {chassis} from './solid_contacts.js';
import {applyBodyImpulse,bodyHeight,damagePanel,isMovableProp} from './body_physics.js';
import {meleeTarget} from './character_actions.js';

export const WEAPONS=Object.freeze({
  fists:{name:'Кулаки'},bat:{name:'Бита',range:42,damage:18,delay:.55},
  pistol:{name:'Пистолет',range:600,damage:24,delay:.3,capacity:12,reload:1.2},
  shotgun:{name:'Дробовик',range:350,damage:10,pellets:6,delay:.8,capacity:6,reload:1.8},
  flare:{name:'Сигнальный пистолет',range:260,damage:8,delay:1,capacity:4,reload:1.5,ignites:true}
});
export const WEAPON_IDS=Object.keys(WEAPONS);

function rayBox(origin,angle,range,body){
  const b=chassis(body),c=Math.cos(b.angle),s=Math.sin(b.angle),dx=origin.x-b.x,dy=origin.y-b.y;
  const x=dx*c+dy*s,y=-dx*s+dy*c,vx=Math.cos(angle-b.angle),vy=Math.sin(angle-b.angle);
  let enter=0,leave=range;
  for(const [p,v,half] of [[x,vx,b.length/2],[y,vy,b.breadth/2]]){
    if(Math.abs(v)<1e-8){if(Math.abs(p)>half)return null;continue;}
    const a=(-half-p)/v,z=(half-p)/v;enter=Math.max(enter,Math.min(a,z));leave=Math.min(leave,Math.max(a,z));
    if(leave<enter)return null;
  }
  return enter;
}
export function weaponRay(ctx,shooter,angle,range){
  const end={x:shooter.x+Math.cos(angle)*range,y:shooter.y+Math.sin(angle)*range};
  const people=new Set([...ctx.pedestrians,...(ctx.roam?.mode==='foot'?[ctx.player]:[])]);
  const scenery=ctx.getCityScenery().contacts.query(Math.min(shooter.x,end.x)-10,Math.min(shooter.y,end.y)-10,Math.max(shooter.x,end.x)+10,Math.max(shooter.y,end.y)+10);
  let nearest=null;
  for(const candidate of [...scenery,...ctx.cityCollisionBodies()]){
    const body=candidate.source||candidate;if(body===shooter||body.intact===false||body.inWater||(!people.has(body)&&bodyHeight(candidate)<12))continue;
    const distance=rayBox(shooter,angle,range,people.has(body)?{...body,width:9,height:9}:candidate);
    if(distance!==null&&(!nearest||distance<nearest.distance))nearest={body,candidate,distance,x:shooter.x+Math.cos(angle)*distance,y:shooter.y+Math.sin(angle)*distance,fixed:!!candidate.source,person:people.has(body)};
  }
  return nearest||{x:end.x,y:end.y,distance:range};
}
export function installWeapons(ctx){
  ctx.burningBodies=new Set();
  ctx.selectWeapon=id=>{if(!WEAPONS[id])return;ctx.player.weapon=id;ctx.player.weaponDrawRemaining=.28;ctx.player.shotRemaining=0;ctx.player.meleeRecoveryRemaining=0;ctx.player.reloadRemaining=0;ctx.player.attackTime=0;ctx.player.attackRequested=false;ctx.showToast(WEAPONS[id].name+' · F — применить · T — перезарядить');};
  ctx.cycleWeapon=()=>ctx.selectWeapon(WEAPON_IDS[(WEAPON_IDS.indexOf(ctx.player.weapon||'fists')+1)%WEAPON_IDS.length]);
  ctx.reloadWeapon=()=>{const p=ctx.player,w=WEAPONS[p.weapon];if(w?.capacity&&!p.reloadRemaining){p.reloadDuration=w.reload;p.reloadRemaining=w.reload;p.attackRequested=false;ctx.sound.playEffect('reload');}};
  const incident=(kind,hit)=>{
    const active=ctx.cityIncidentDirector.current();
    if(active?.kind===kind&&Math.hypot(active.x-hit.x,active.y-hit.y)<300){active.timer=Math.max(active.timer,18);if(hit.body?.dead){active.fatal=true;active.title='УБИЙСТВО';}return active;}
    const next=ctx.cityIncidentDirector.start(kind,{x:hit.x,y:hit.y},{actors:[],wrecks:[]});
    if(next){next.playerCaused=true;next.sourceBody=hit.body;next.fatal=!!hit.body?.dead;if(next.fatal)next.title='УБИЙСТВО';next.reported=ctx.pedestrians.some(p=>!p.dead&&Math.hypot(p.x-hit.x,p.y-hit.y)<550);}
    return next;
  };
  ctx.reportWeaponIncident=incident;
  function damage(shooter,hit,weapon,angle){
    if(!hit.body)return;
    const b=hit.body,person=hit.person,prop=isMovableProp(b)||b.type==='hydrant';
    ctx.effects.burst(hit.x,hit.y,14,person?'dust':'spark',5);
    if(person||prop||!hit.fixed){
      b.hp=Math.max(0,(b.hp??(prop?36:100))-weapon.damage);
      applyBodyImpulse(b,Math.cos(angle)*2400,Math.sin(angle)*2400,hit,person);
      if(person){b.hitFlash=.18;b.fleeTimer=6;b.reaction='fleeing';b.provokedTimer=6;if(b.hp<=30){b.stance='down';b.knockdownTimer=2;}if(b.hp===0&&b!==ctx.player){b.dead=true;b.attackTime=0;b.combatTimer=0;b.activity='dead';}}
      else if(prop&&b.hp===0)ctx.breakWorldProp(b);
      else if(!prop)damagePanel(b,-Math.cos(angle),-Math.sin(angle),.12);
    }
    if(shooter===ctx.player){
      ctx.raiseWantedFromCrime(person?3:1,1);
      if(weapon.ignites&&!b.inWater&&b.type!=='hydrant'){b.burning=18;ctx.burningBodies.add(b);if(ctx.burningBodies.size>8){const old=ctx.burningBodies.values().next().value;old.burning=0;ctx.burningBodies.delete(old);}incident('fire',hit);}
      else if(person)incident(b.dead||weapon.capacity?'killing':'fight',hit);
      else if(!hit.fixed&&!person&&!prop&&weapon.capacity&&(Math.abs(b.speed||0)>.8||b.hp<50)){b.collisionHold=1.2;b.damage.front=Math.max(.4,b.damage.front||0);incident('crash',hit);}
    }
  }
  function fire(shooter,id){
    const w=WEAPONS[id],angle=shooter.angle??shooter.heading??0;
    if(w.capacity)shooter.shotRemaining=.16;
    if(id==='bat'){
      shooter.meleeRecoveryRemaining=.28;
      const people=new Set([...ctx.pedestrians,...(ctx.roam?.mode==='foot'?[ctx.player]:[])]);
      const hit=meleeTarget(shooter,[...ctx.getCityScenery().contacts.query(shooter.x-60,shooter.y-60,shooter.x+60,shooter.y+60),...ctx.cityCollisionBodies()],people,w.range);
      if(hit){hit.person=people.has(hit.body);damage(shooter,hit,w,angle);ctx.sound.playImpact();}return;
    }
    ctx.sound.playWeapon(id,shooter);ctx.effects.burst(shooter.x+Math.cos(angle)*10,shooter.y+Math.sin(angle)*10,15,'spark',3);
    for(const witness of ctx.pedestrians)if(witness!==shooter&&!witness.dead&&Math.hypot(witness.x-shooter.x,witness.y-shooter.y)<420){
      const d=Math.hypot(witness.x-shooter.x,witness.y-shooter.y)||1;
      witness.eventFleeTimer=Math.max(witness.eventFleeTimer||0,3);witness.eventFleeX=(witness.x-shooter.x)/d;witness.eventFleeY=(witness.y-shooter.y)/d;witness.wasFleeing=true;
    }
    for(let n=0;n<(w.pellets||1);n++){
      const direction=angle+(w.pellets?(n-2.5)*.045:0),hit=weaponRay(ctx,shooter,direction,w.range);
      for(let d=16;d<hit.distance;d+=45)ctx.effects.burst(shooter.x+Math.cos(direction)*d,shooter.y+Math.sin(direction)*d,14,'spark',1);
      damage(shooter,hit,w,direction);
    }
    if(shooter===ctx.player)ctx.raiseWantedFromCrime(1,.6);
  }
  ctx.stepWeapons=(dt,keys)=>{
    const p=ctx.player;
    for(const body of ctx.burningBodies){
      body.burning=Math.max(0,body.burning-dt);
      if(!body.burning||ctx.cityIncidentDirector.current()?.sourceBody===body&&ctx.cityIncidentDirector.current().fireSuppressed){body.burning=0;ctx.burningBodies.delete(body);continue;}
      body.hp=Math.max(0,(body.hp??100)-dt*2);
      if(Math.floor(body.burning*6)!==Math.floor((body.burning+dt)*6)&&ctx.threeRenderer?.graphics.effects!=='off'){ctx.effects.burst(body.x,body.y,15,'spark',2);ctx.effects.burst(body.x,body.y,20,'steam',1);}
      if(isMovableProp(body)&&body.hp===0)ctx.breakWorldProp(body);
    }
    for(const npc of ctx.pedestrians){
      npc.provokedTimer=Math.max(0,(npc.provokedTimer||0)-dt);npc.weaponCooldown=Math.max(0,(npc.weaponCooldown||0)-dt);
      const equipment=WEAPONS[npc.weapon];
      if(npc.reloadRemaining>0){npc.reloadRemaining=Math.max(0,npc.reloadRemaining-dt);if(!npc.reloadRemaining)(npc.ammo||={})[npc.weapon]=equipment?.capacity;}
      if(!npc.dead&&npc.provokedTimer&&npc.weapon&&npc.weapon!=='fists'&&!npc.inWater&&!npc.knockdownTimer&&npc.hp>30&&ctx.roam?.mode==='foot'&&!p.inWater&&Math.hypot(npc.x-p.x,npc.y-p.y)<240){
        npc.heading=npc.angle=Math.atan2(p.y-npc.y,p.x-npc.x);npc.attackTime=(npc.attackTime||0)+dt;
        if(npc.attackTime>.65&&!npc.weaponCooldown&&!npc.reloadRemaining){
          npc.ammo||={};npc.ammo[npc.weapon]??=equipment.capacity;
          if(equipment.capacity&&npc.ammo[npc.weapon]===0){npc.reloadDuration=equipment.reload;npc.reloadRemaining=equipment.reload;}
          else{if(equipment.capacity)npc.ammo[npc.weapon]--;fire(npc,npc.weapon);npc.attackTime=0;npc.weaponCooldown=1.4;}
        }
      }
      else if(npc.weapon)npc.attackTime=0;
    }
    const w=WEAPONS[p.weapon||'fists'];
    p.weaponCooldown=Math.max(0,(p.weaponCooldown||0)-dt);
    if(p.reloadRemaining>0){p.reloadRemaining=Math.max(0,p.reloadRemaining-dt);if(!p.reloadRemaining)(p.ammo||={})[p.weapon]=w.capacity;}
    if(ctx.roam?.mode!=='foot'||p.weapon==='fists'||!p.weapon)return false;
    const pressed=!!keys.attack,requested=p.attackRequested;p.attackRequested=false;
    if(!p.inWater&&!p.knockdownTimer&&!p.weaponCooldown&&!p.reloadRemaining&&(requested||pressed&&!p.attackHeld)){
      if(w.capacity){p.ammo||={};p.ammo[p.weapon]??=w.capacity;if(!p.ammo[p.weapon])ctx.reloadWeapon();else {p.ammo[p.weapon]--;fire(p,p.weapon);p.attackTime=.001;p.weaponCooldown=w.delay;}}
      else {p.attackTime=.001;p.weaponCooldown=w.delay;p.weaponContact=false;}
    }
    p.attackHeld=pressed;
    if(p.attackTime){p.attackTime+=dt;if(p.weapon==='bat'&&p.attackTime>=.14&&!p.weaponContact){fire(p,'bat');p.weaponContact=true;}if(p.attackTime>=.42)p.attackTime=0;}
    return true;
  };
}
