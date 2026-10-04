export const WATER_LEVEL=-7;

// Water is a physical state reached after the contact sweep, not a shore wall.
export function installWaterInteraction(ctx){
  function clear(body){body.inWater=false;body.waterTime=0;body.swimPhase=0;}
  function safePoint(body){
    const point=body.waterSafe;
    if(point&&!ctx.isPedestrianSceneryBlocked(point.x,point.y))return point;
    return ctx.nearestSafeSpawn(body.x,body.y);
  }
  function splash(body,count=18){
    if(ctx.threeRenderer?.graphics.effects==='off')return;
    ctx.effects.burst(body.x,body.y,.5,'water',count,0,0,WATER_LEVEL);
    ctx.effects.burst(body.x,body.y,.08,'ripple',1,0,0,WATER_LEVEL);
  }
  function swimmer(body,dt,isPlayer){
    const dry=ctx.getWalkSurface()(body.x,body.y);
    if(dry){
      if(body.inWater&&isPlayer)ctx.showToast('На берегу');
      clear(body);
      if((!body.waterSafe||Math.hypot(body.x-body.waterSafe.x,body.y-body.waterSafe.y)>40)&&!ctx.isPedestrianSceneryBlocked(body.x,body.y))body.waterSafe={x:body.x,y:body.y};
      return;
    }
    if(body.jumpHeight>0)return;
    if(!body.inWater){
      body.inWater=true;body.waterTime=0;body.swimPhase=0;body.attackTime=0;body.stance=null;
      body.knockdownTimer=0;body.jumpRequested=body.attackRequested=false;
      splash(body,24);if(isPlayer){ctx.sound.playSplash();ctx.showToast('Плывите к берегу · WASD / стрелки');}
    }
    const before=body.waterTime;body.waterTime+=dt;body.swimPhase+=dt*6.5;
    body.contactVx=(body.contactVx||0)*Math.exp(-5*dt);body.contactVy=(body.contactVy||0)*Math.exp(-5*dt);
    if(Math.floor(before*3)!==Math.floor(body.waterTime*3))splash(body,3);
    if(body.waterTime>30)body.hp=Math.max(0,(body.hp??100)-dt*12);
    if(body.hp<=0){
      const safe=safePoint(body);
      if(isPlayer){ctx.roam.resetToFoot(safe.x,safe.y);body.hp=75;ctx.state.invulnTimer=120;ctx.showToast('Спасены на берегу · берегите силы');}
      else {Object.assign(body,safe,{hp:70});clear(body);}
    }
  }
  ctx.stepWaterInteraction=dt=>{
    const p=ctx.player,foot=ctx.roam?.mode==='foot';
    if(foot){swimmer(p,dt,true);ctx.state.isDrowning=false;ctx.state.drownProgress=0;}
    else if(ctx.roam?.profile?.kind==='water'||ctx.roam?.altitude>1){clear(p);ctx.state.isDrowning=false;ctx.state.drownProgress=0;}
    else if(!ctx.isPositionOnSolidGround(p.x,p.y)){
      if(!p.inWater){p.inWater=true;p.waterTime=0;splash(p,32);ctx.sound.playSplash();}
      p.waterTime+=dt;p.speed*=Math.exp(-4*dt);p.vx*=Math.exp(-4*dt);p.vy*=Math.exp(-4*dt);
      ctx.state.isDrowning=true;ctx.state.drownProgress=Math.min(1,p.waterTime/3);
      if(p.waterTime>=3){
        const safe=ctx.nearestSafeSpawn(p.x,p.y),hp=Math.max(1,p.hp-25);
        if(ctx.roam)ctx.roam.resetToSedan(safe.x,safe.y);else {Object.assign(p,safe,{speed:0,vx:0,vy:0});clear(p);}
        p.hp=hp;ctx.state.isDrowning=false;ctx.state.drownProgress=0;
        ctx.state.cash=Math.max(0,ctx.state.cash-50);ctx.state.invulnTimer=120;ctx.showToast('Машина утонула · эвакуация −$50');
      }
    }else {clear(p);ctx.state.isDrowning=false;ctx.state.drownProgress=0;}
    for(const person of ctx.pedestrians)swimmer(person,dt,false);
  };
}
