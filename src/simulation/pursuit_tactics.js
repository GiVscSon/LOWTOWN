import {applyBodyImpulse} from './body_physics.js';
import {chassis,contact} from './solid_contacts.js';
import {nearestStreet,streetPoints} from '../world/street_corridors.js';
export function pursuitTarget(ctx,cop,index){
  const p=ctx.player,level=ctx.state.wanted,land=ctx.roam?.mode!=='foot'&&(ctx.roam?.altitude||0)<12&&!p.inWater;
  cop.tactic=level>=3&&land&&index<2?'pit':level>=2&&index%2?'intercept':'follow';
  if(level>=4&&index===3){
    const bridges=ctx.bridges.filter(b=>!b.footway).map(b=>({b,point:streetPoints(b)[0]})).filter(v=>v.point&&Math.hypot(v.point[0]-p.x,v.point[1]-p.y)<1400).sort((a,b)=>Math.hypot(a.point[0]-p.x,a.point[1]-p.y)-Math.hypot(b.point[0]-p.x,b.point[1]-p.y));
    if(bridges[0]){cop.tactic='roadblock';const [x,y]=bridges[0].point;return {x,y};}
  }
  if(cop.tactic==='follow')return p;
  const heading=p.angle||0,speed=land?Math.max(0,p.speed||0):0;
  const ahead=cop.tactic==='pit'?-(p.width||48)*.8:cop.tactic==='intercept'?Math.min(260,speed*60*.8):0;
  const side=cop.tactic==='pit'?(index%2?1:-1)*((p.height||24)+(cop.height||24))*.48:0;
  const target={x:p.x+Math.cos(heading)*ahead-Math.sin(heading)*side,y:p.y+Math.sin(heading)*ahead+Math.cos(heading)*side};
  const hit=nearestStreet(target.x,target.y,[...ctx.roads,...ctx.bridges.filter(b=>!b.footway)]);
  if(!hit)return p;
  return ctx.policeFootprintOnRoad({...cop,x:target.x,y:target.y,angle:heading})?target:{x:hit.x,y:hit.y};
}
export function tryPit(ctx,cop,dt){
  cop.pitCooldown=Math.max(0,(cop.pitCooldown||0)-dt);
  const p=ctx.player;
  if(cop.tactic!=='pit'||cop.pitCooldown||ctx.roam?.mode==='foot'||p.inWater||Math.abs(p.speed||0)<2||Math.abs(p.speed||0)>7||(ctx.roam?.altitude||0)>12)return false;
  const cs=Math.cos(p.angle),sn=Math.sin(p.angle),dx=cop.x-p.x,dy=cop.y-p.y,along=dx*cs+dy*sn,side=-dx*sn+dy*cs;
  if(along>=-5||along<-(p.width||48)||Math.cos(cop.angle-p.angle)<.8||Math.abs((cop.speed||0)-(p.speed||0))>2.5||!contact(chassis({...cop,x:cop.x+Math.cos(cop.angle)*4,y:cop.y+Math.sin(cop.angle)*4}),chassis(p)))return false;
  if(ctx.surfaceAt(p.x,p.y)==='bridge')return false;
  const sign=Math.sign(side)||1,point={x:p.x-cs*(p.width||48)*.35,y:p.y-sn*(p.width||48)*.35};
  applyBodyImpulse(p,sn*sign*18000,-cs*sign*18000,point);
  p.yawRate=(p.yawRate||0)+sign*.4;p.hp=Math.max(0,p.hp-6);cop.pitCooldown=4;
  ctx.effects.burst(point.x,point.y,10,'spark',8);ctx.sound.playImpact();return true;
}
export function updatePursuitAir(ctx,dt){
  if(ctx.state.wanted<3){ctx.pursuitAirUnit=null;return;}
  if(!ctx.pursuitAirUnit){
    const base=ctx.roam?.fleet.find(v=>v.type==='helicopter')||{x:ctx.player.x-1100,y:ctx.player.y-800};
    ctx.state.pursuitLastKnown ||= {x:ctx.player.x,y:ctx.player.y};
    ctx.pursuitAirUnit={type:'helicopter',model:'helicopter',kind:'air',isPolice:true,color:'#303c48',x:base.x,y:base.y,angle:0,altitude:180,width:72,height:24,hp:100,orbit:0};
  }
  const air=ctx.pursuitAirUnit;air.orbit+=dt*.18;
  const known=ctx.state.pursuitLastKnown||ctx.player;
  const target={x:known.x+Math.cos(air.orbit)*160,y:known.y+Math.sin(air.orbit)*160},d=Math.hypot(target.x-air.x,target.y-air.y)||1;
  air.angle=Math.atan2(target.y-air.y,target.x-air.x);const move=Math.min(d,dt*120);air.x+=Math.cos(air.angle)*move;air.y+=Math.sin(air.angle)*move;air.searchTarget={x:known.x,y:known.y};
}

export function pursuitAirSees(ctx){
  const air=ctx.pursuitAirUnit,p=ctx.player;if(!air?.searchTarget)return false;
  const underRoof=ctx.buildings.some(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h);
  return !underRoof&&Math.hypot(air.x-p.x,air.y-p.y)<450&&Math.hypot(air.searchTarget.x-p.x,air.searchTarget.y-p.y)<90;
}
export function setRoadblock(ctx,cop,active){
  if(!active||ctx.state.wanted<4){
    for(const prop of cop.roadblockProps||[]){const i=ctx.breakableProps.indexOf(prop);if(i>=0)ctx.breakableProps.splice(i,1);}
    cop.roadblockProps=null;return;
  }
  if(cop.roadblockProps)return;
  const c=Math.cos(cop.angle),s=Math.sin(cop.angle);cop.roadblockProps=[];
  for(const side of [-1,1]){
    const prop={type:'cone',x:cop.x-s*side*28,y:cop.y+c*side*28,width:10,height:10,w:10,h:10,mass:9,movable:true,intact:true,hp:24};
    if(ctx.isPositionOnSolidGround(prop.x,prop.y)&&ctx.policeFootprintOnRoad({...prop,angle:cop.angle})){
      ctx.breakableProps.push(prop);cop.roadblockProps.push(prop);
    }
  }
}
