import {coastPoints} from './coastline.js';
import {rectangleClearOfStreets} from './street_corridors.js';

export function populateBeaches(ctx){
  ctx.beachZones=[];
  const preferred=['core','velvet','marina',...ctx.islands.map(i=>i.id)];
  for(const id of new Set(preferred)){
    if(ctx.beachZones.length===3)break;
    const island=ctx.islands.find(i=>i.id===id);if(!island)continue;
    for(const fraction of [.5,.32,.68]){
      const x=island.x+island.w*fraction-420;
      const points=coastPoints(island).filter(p=>p[0]>x&&p[0]<x+840&&p[1]<island.y+island.h*.2);
      if(!points.length)continue;
      const y=Math.min(...points.map(p=>p[1]))-180,rect={x,y,w:840,h:330};
      if(!rectangleClearOfStreets(rect,[...ctx.roads,...ctx.bridges],30)||ctx.buildings.some(b=>b.x<rect.x+rect.w+20&&b.x+b.w>rect.x-20&&b.y<rect.y+rect.h+20&&b.y+b.h>rect.y-20))continue;
      // The beach connects to the existing sand band; the same outline is used
      // by painting and walk support, with no hidden rectangle over the sea.
      if(!ctx.getWalkSurface()(x+420,y+320,0))continue;
      const beach={...rect,id:`beach-${id}`,name:['Северный пляж','Пляж Закат','Пляж у гавани'][ctx.beachZones.length],districtId:id,natural:true,
        coast:[[.03,.2],[.18,.04],[.48,.02],[.8,.06],[.97,.22],[1,.63],[.91,.96],[.65,1],[.3,.98],[.05,.87],[0,.52]]};
      ctx.beachZones.push(beach);ctx.invalidateTerrain();
      for(let n=0;n<10;n++){
        const px=x+150+(n%5)*130,py=y+170+Math.floor(n/5)*60;
        if(ctx.isPedestrianSceneryBlocked(px,py))continue;
        const sea={x:px,y:y-80},sand={x:px,y:py};
        const swimmer=n<2;
        ctx.pedestrians.push({x:px,y:py,hp:100,width:9,height:9,beachId:beach.id,districtId:id,
          beachRoute:swimmer?[sand,sea,sand]:[sand,{x:px+60,y:py+25},{x:px-50,y:py+35}],beachRouteIndex:1,route:{districtId:id,points:[sand,swimmer?sea:{x:px+60,y:py+25},sand]},
          shirt:['#ba7959','#608aa0','#aeae81','#8a6690'][n%4],pants:'#394a59',skin:n%2?'#ad7b58':'#d4b291',hair:n%3?'#342c26':'#786b4d',
          walkPhase:n,gait:1,waterSafe:sand,activity:swimmer?'beachSwimming':'beachWalking',waterIntent:swimmer,
          dailyStops:[{kind:'beachWalk',x:px,y:py},{kind:swimmer?'swimming':'sunbathing',x:px,y:swimmer?sea.y:py+30}]});
      }
      for(let n=0;n<5;n++)ctx.solidProps.push({type:'parasol',x:x+180+n*120,y:y+245,width:12,height:12,w:12,h:12,color:n%2?'#bc7357':'#6692a0'});
      break;
    }
  }
  ctx.invalidateScenery();ctx.invalidateTerrain();
}
