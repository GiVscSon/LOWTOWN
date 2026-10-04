import {createSpatialIndex} from '../simulation/spatial_index.js';
import {streetPoints,streetWidth,onStreetCollection} from './street_corridors.js';

// Deterministic roadside placement; reserve entrances, walking routes and coast.
export function populateWorldDetails(ctx){
  ctx.ambientVents=ctx.buildings.filter((b,i)=>i%9===0).map(b=>({x:b.x+b.w*.6,y:b.y+b.h*.6,z:(b.floors||5)*24+16}));
  const scenery=ctx.getCityScenery().pedestrians;
  const walking=createSpatialIndex(ctx.walkingRoutes.flatMap(r=>r.points),p=>({left:p.x-8,right:p.x+8,top:p.y-8,bottom:p.y+8}));
  const types=['crate','barrel','trashcan','cone','planter','bikeRack','mailbox'];let serial=0;
  const actors=[...ctx.parkedCars,...ctx.trafficCars,...ctx.pedestrians,ctx.player,...ctx.solidProps,...ctx.breakableProps,...ctx.streetLights];
  const motorways=[...ctx.roads,...ctx.bridges];
  const roads=ctx.roads.filter(r=>!r.serviceAccess&&!r.bridgeApproach);
  let roadIndex=0;
  for(const road of roads){const points=streetPoints(road),budget=1+(roadIndex++%3===0?1:0);let added=0;
    for(let i=3;i<points.length-3;i+=5){
      if(serial>=140||added>=budget)break;
      const a=points[i-1],b=points[i+1],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),side=(i+serial)%2?1:-1;
      const setback=streetWidth(road)/2+86,x=points[i][0]-Math.sin(angle)*side*setback,y=points[i][1]+Math.cos(angle)*side*setback;
      const type=types[serial%types.length],width=type==='bikeRack'?25:16,height=type==='bikeRack'?9:16,radius=Math.hypot(width,height)/2+10;
      if(![[0,0],[-radius,-radius],[-radius,radius],[radius,-radius],[radius,radius]].every(([dx,dy])=>ctx.getWalkSurface()(x+dx,y+dy)&&!scenery.query(x+dx,y+dy,x+dx,y+dy).length&&!onStreetCollection(x+dx,y+dy,motorways,4)))continue;
      if(actors.some(p=>Math.hypot(p.x-x,p.y-y)<radius+35)||walking.query(x-radius,y-radius,x+radius,y+radius).length)continue;
      const movable=['crate','barrel','trashcan','cone'].includes(type),prop={type,x,y,angle,width,height,w:width,h:height,collisionHeight:type==='cone'?10:18,mass:type==='crate'?22:type==='barrel'?45:type==='trashcan'?18:5,movable,intact:true,hp:36,authoredDetail:true};
      (movable?ctx.breakableProps:ctx.solidProps).push(prop);actors.push(prop);serial++;added++;
    }
  }
  ctx.worldDetailCount=serial;ctx.invalidateScenery();
}

export function mobilizeSmallProps(ctx){
  const types=new Set(['bench','bin','phone','bollard','planter','bikeRack','mailbox','parasol','stall','kiosk','workzone']);
  const heights={bench:17,bin:15,phone:28,bollard:12,planter:18,bikeRack:12,mailbox:23,parasol:34,stall:24,kiosk:24,workzone:18};
  for(let i=ctx.solidProps.length-1;i>=0;i--){
    const p=ctx.solidProps[i],w=p.width||p.w||16,h=p.height||p.h||16;
    if(!types.has(p.type)||Math.max(w,h)>80)continue;
    Object.assign(p,{w,h,width:w,height:h,movable:true,intact:true,hp:90,collisionHeight:heights[p.type],mass:p.type==='bollard'?45:p.type==='bench'?65:p.type==='phone'?140:p.type==='planter'?100:p.type==='parasol'?18:50});
    ctx.breakableProps.push(p);ctx.solidProps.splice(i,1);
  }
  for(const p of ctx.breakableProps)if(p.type==='hydrant'){p.movable=true;p.mass=85;p.collisionHeight=14;}
  ctx.invalidateScenery();
}
