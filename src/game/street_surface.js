// A single asphalt footprint shared by streets and motor bridge decks. Edges
// are exposed union boundaries, never the seams between constituent rectangles.
import {streetWidth,streetPoints,offsetStreet,onStreetCollection} from './street_corridors.js';
import {buildCorridorGraph} from './street_graph.js';
const curvedCache=new WeakMap();
const EPS=.01;
function subtract(start,end,masks){
  const parts=[];let cursor=start;
  for(const [a,b] of masks.sort((a,b)=>a[0]-b[0])){
    if(b<=cursor||a>=end)continue;
    if(a-cursor>EPS)parts.push([cursor,Math.min(a,end)]);
    cursor=Math.max(cursor,b);if(cursor>=end)break;
  }
  if(end-cursor>EPS)parts.push([cursor,end]);return parts;
}
function merge(lines){
  const groups=new Map();
  for(const line of lines){
    const horizontal=line.y1===line.y2,fixed=horizontal?line.y1:line.x1;
    const bridge=line.bridge||'';
    const key=`${horizontal?'h':'v'}:${fixed.toFixed(5)}:${line.side||''}:${bridge}`;
    if(!groups.has(key))groups.set(key,{horizontal,fixed,side:line.side,bridge,spans:[]});
    groups.get(key).spans.push(horizontal?[line.x1,line.x2]:[line.y1,line.y2]);
  }
  const result=[];
  for(const {horizontal,fixed,side,bridge,spans} of groups.values()){
    const joined=[];
    for(const [a,b] of spans.sort((a,b)=>a[0]-b[0])){
      const last=joined.at(-1);
      if(last&&a<=last[1]+EPS)last[1]=Math.max(last[1],b);else joined.push([a,b]);
    }
    for(const [a,b] of joined)result.push(horizontal?{x1:a,y1:fixed,x2:b,y2:fixed,phase:a,side,bridge}:{x1:fixed,y1:a,x2:fixed,y2:b,phase:a,side,bridge});
  }
  return result;
}
export function streetSurfaceGeometry(roads,bridges=[],graph=null){
  if(roads.some(r=>r.points))return curvedStreetSurface(roads,bridges,graph);
  const surfaces=[...roads,...bridges.filter(b=>!b.footway)],edges=[],lanes=[];
  const bridgePaths=[];
  const pathById=new Map();
  for(const bridge of bridges.filter(b=>!b.footway&&Array.isArray(b.bridgePath))){
    const id=bridge.logicalId||bridge.id;
    if(pathById.has(id))continue;
    const path=bridge.bridgePath.map(point=>({x:point.x,y:point.y}));
    pathById.set(id,true);bridgePaths.push({id,width:bridge.dir==='h'?bridge.h:bridge.w,path});
  }
  for(const r of surfaces){
    const bridge=r.logicalId||null;
    for(const horizontal of [true,false])for(const side of [-1,1]){
      const fixed=horizontal?r.y+(side>0?r.h:0):r.x+(side>0?r.w:0);
      const start=horizontal?r.x:r.y,end=start+(horizontal?r.w:r.h),masks=[];
      for(const other of surfaces){
        if(other===r)continue;
        const lo=horizontal?other.y:other.x,hi=lo+(horizontal?other.h:other.w);
        const outside=fixed+side*EPS;
        if(outside>lo&&outside<hi)masks.push(horizontal?[other.x,other.x+other.w]:[other.y,other.y+other.h]);
      }
      for(const [a,b] of subtract(start,end,masks))edges.push(horizontal?{x1:a,y1:fixed,x2:b,y2:fixed,side,bridge}:{x1:fixed,y1:a,x2:fixed,y2:b,side,bridge});
    }
    // Bridge centerlines are painted along their rounded path by the scene
    // renderer; rectangular lane fragments would create stacked marks at
    // every elbow, so generate them only for ordinary roads.
    if(!bridge){
      const horizontal=r.dir==='h',fixed=horizontal?r.y+r.h/2:r.x+r.w/2;
      const start=horizontal?r.x:r.y,end=start+(horizontal?r.w:r.h),masks=[];
      for(const other of surfaces){
        if(other.dir===r.dir)continue;
        const lo=horizontal?other.y:other.x,hi=lo+(horizontal?other.h:other.w);
        if(fixed>=lo-EPS&&fixed<=hi+EPS)masks.push(horizontal?[other.x-40,other.x+other.w+40]:[other.y-40,other.y+other.h+40]);
      }
      for(const [a,b] of subtract(start,end,masks))lanes.push(horizontal?{x1:a,y1:fixed,x2:b,y2:fixed}:{x1:fixed,y1:a,x2:fixed,y2:b});
    }
  }
  return {surfaces,curbs:merge(edges),lanes:merge(lanes),bridgePaths};
}

function curvedStreetSurface(roads,bridges,graph){
  const cached=curvedCache.get(roads);
  if(cached&&cached.first===roads[0]&&cached.last===roads.at(-1)&&cached.count===roads.length&&cached.bridge===bridges[0])return cached.paint;
  const surfaces=[...roads,...bridges.filter(b=>!b.footway)],curbs=[],lanes=[],crosswalks=[];
  const nodes=graph?.organic?graph:buildCorridorGraph(surfaces),junctions=[];
  for(const node of nodes){
    if(node.roads.size<2||node.edges.size<3)continue;
    const owners=[...node.roads],directions=[];
    for(const id of node.edges){const next=nodes[id],angle=Math.atan2(next.y-node.y,next.x-node.x);
      if(!directions.some(a=>Math.abs(Math.atan2(Math.sin(a-angle),Math.cos(a-angle)))<.3))directions.push(angle);}
    if(directions.length<3)continue;
    const width=Math.max(...owners.map(streetWidth)),radius=width/2;
    const approaches={north:directions.some(a=>Math.sin(a)<-.5),south:directions.some(a=>Math.sin(a)>.5),west:directions.some(a=>Math.cos(a)<-.5),east:directions.some(a=>Math.cos(a)>.5)};
    const junction={x:node.x-radius,y:node.y-radius,w:width,h:width,center:{x:node.x,y:node.y},cx:node.x,cy:node.y,directions,
      horizontalRoads:owners.filter(r=>r.dir==='h'),verticalRoads:owners.filter(r=>r.dir==='v'),approaches};
    junctions.push(junction);
    if(owners.some(r=>r.serviceAccess||r.bridgeApproach))continue;
    for(const angle of directions)for(let offset=-radius+9;offset<radius-6;offset+=14){
      const x=node.x+Math.cos(angle)*(radius+24)-Math.sin(angle)*offset,y=node.y+Math.sin(angle)*(radius+24)+Math.cos(angle)*offset;
      crosswalks.push({x:x-5,y:y-4,w:10,h:8,angle:-angle});
    }
  }
  for(const road of roads){
    const points=streetPoints(road),width=streetWidth(road);let phase=0;
    for(const side of [-1,1]){
      const edge=offsetStreet(points,side*width/2);
      for(let i=1;i<edge.length;i++){
        const a=edge[i-1],b=edge[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.001)continue;
        const nx=-dy/length*side,ny=dx/length*side,steps=Math.ceil(length/4);let start=null;
        const boundary=t=>{
          const x=a[0]+dx*t,y=a[1]+dy*t;
          return !onStreetCollection(x+nx*1.2,y+ny*1.2,surfaces)&&onStreetCollection(x-nx*1.2,y-ny*1.2,surfaces);
        };
        for(let n=0;n<steps;n++){
          const exposed=[0,.25,.5,.75,1].every(t=>boundary((n+t)/steps));
          if(exposed&&start===null)start=n/steps;
          if(start!==null&&(!exposed||n===steps-1)){
            const end=(exposed?n+1:n)/steps;
            if(end>start)curbs.push({x1:a[0]+dx*start,y1:a[1]+dy*start,x2:a[0]+dx*end,y2:a[1]+dy*end,side});start=null;
          }
        }
      }
    }
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),mid={x:(a[0]+b[0])/2,y:(a[1]+b[1])/2};
      if(!junctions.some(j=>Math.min(Math.hypot(a[0]-j.cx,a[1]-j.cy),Math.hypot(b[0]-j.cx,b[1]-j.cy),Math.hypot(mid.x-j.cx,mid.y-j.cy))<j.w*.65))lanes.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1],phase});
      phase+=length;
    }
  }
  const bridgePaths=bridges.filter(b=>!b.footway).map(b=>({id:b.logicalId||b.id,width:streetWidth(b),path:streetPoints(b).map(([x,y])=>({x,y})),organic:true}));
  const crosswalkJunctions=junctions.filter(j=>[...j.horizontalRoads,...j.verticalRoads].every(r=>!r.serviceAccess&&!r.bridgeApproach));
  const signals=crosswalkJunctions.filter(j=>j.directions.length>=4);
  const paint={surfaces,curbs,lanes,bridgePaths,junctions,crosswalkJunctions,crosswalks,signals,organic:true};
  curvedCache.set(roads,{first:roads[0],last:roads.at(-1),count:roads.length,bridge:bridges[0],paint});return paint;
}
