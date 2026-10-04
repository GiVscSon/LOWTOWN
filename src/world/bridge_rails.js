import {corridorContains} from './street_corridors.js';

// Open parapets only at a landward road entrance, including service driveways.
export function bridgeRailOpenAt(bridge,x,y){
  if(!bridge.railAccess?.length)return false;
  const start=bridge.path[0],end=bridge.path.at(-1);
  return Math.min(Math.hypot(x-start.x,y-start.y),Math.hypot(x-end.x,y-end.y))<240&&bridge.railAccess.some(road=>corridorContains(x,y,road,12));
}

// Motor bridges have visible raised parapets even after their old rectangular
// rails were discarded by organic remapping. Build solid edges on that path.
export function bridgeRailBodies(paths=[]){
  const rails=[];
  for(const bridge of paths){
    if(!bridge.organic)continue;
    const points=[bridge.path[0]];
    for(let i=1;i<bridge.path.length;i++){
      const a=bridge.path[i-1],b=bridge.path[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/36));
      for(let n=1;n<=steps;n++)points.push({x:a.x+(b.x-a.x)*n/steps,y:a.y+(b.y-a.y)*n/steps});
    }
    const normals=points.map((p,i)=>{
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],incoming=Math.hypot(p.x-a.x,p.y-a.y)||1,outgoing=Math.hypot(b.x-p.x,b.y-p.y)||1;
      const dx=(p.x-a.x)/incoming+(b.x-p.x)/outgoing,dy=(p.y-a.y)/incoming+(b.y-p.y)/outgoing,d=Math.hypot(dx,dy)||1;
      return {x:-dy/d,y:dx/d};
    });
    for(const side of [-1,1])for(let i=1;i<points.length;i++){
      const offset=(bridge.width/2-2)*side,a={x:points[i-1].x+normals[i-1].x*offset,y:points[i-1].y+normals[i-1].y*offset},b={x:points[i].x+normals[i].x*offset,y:points[i].y+normals[i].y*offset};
      if(bridgeRailOpenAt(bridge,(a.x+b.x)/2,(a.y+b.y)/2))continue;
      rails.push({sampleIndex:i-1,side,type:'bridgeRail',bridgeId:bridge.id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:Math.hypot(b.x-a.x,b.y-a.y)+.5,height:5,angle:Math.atan2(b.y-a.y,b.x-a.x),collisionHeight:28});
    }
  }
  return rails;
}
