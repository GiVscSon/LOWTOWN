// A single asphalt footprint shared by streets and motor bridge decks. Edges
// are exposed union boundaries, never the seams between constituent rectangles.
import {streetWidth,streetPoints,offsetStreet,onStreetCollection,corridorContains,corridorIndex,projectStreet} from './street_corridors.js';
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
  }
  const crossings=approachCrosswalks(nodes,surfaces);
  crosswalks.push(...crossings.flatMap(band=>band.stripes));
  const laneClearances=crossings.flatMap(band=>{
    const clearances=[{...band,gap:14}];
    for(let k=1;k<band.approach.length;k++){
      const a=band.approach[k-1],b=band.approach[k],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      if(length>.001)clearances.push({cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,ux:dx/length,uy:dy/length,width:band.width,length,gap:30});
    }
    return clearances;
  });
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
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),masks=[];
      if(length<.001)continue;
      for(const j of junctions){
        const px=a[0]-j.cx,py=a[1]-j.cy,t=-(px*dx+py*dy)/(length*length);
        const distance2=(px+dx*t)**2+(py+dy*t)**2,radius=j.w*.7;
        if(distance2<radius*radius){const half=Math.sqrt(radius*radius-distance2)/length;masks.push([t-half,t+half]);}
      }
      for(const clearance of laneClearances){
        const interval=bandInterval(a,b,clearance,clearance.gap);if(interval)masks.push(interval);
      }
      for(const [start,end] of subtract(0,1,masks))lanes.push({x1:a[0]+dx*start,y1:a[1]+dy*start,x2:a[0]+dx*end,y2:a[1]+dy*end,phase:phase+length*start});
      phase+=length;
    }
  }
  const bridgePaths=bridges.filter(b=>!b.footway).map(b=>({id:b.logicalId||b.id,width:streetWidth(b),path:streetPoints(b).map(([x,y])=>({x,y})),organic:true}));
  const crosswalkJunctions=junctions.filter(j=>[...j.horizontalRoads,...j.verticalRoads].every(r=>!r.serviceAccess&&!r.bridgeApproach));
  const signals=crosswalkJunctions.filter(j=>j.directions.length>=4);
  const paint={surfaces,curbs,lanes,bridgePaths,junctions,crosswalkJunctions,crosswalks,crossings,signals,organic:true};
  curvedCache.set(roads,{first:roads[0],last:roads.at(-1),count:roads.length,bridge:bridges[0],paint});return paint;
}

// Crossings belong to the outgoing carriageway, not to an angular ring around
// a graph node. Follow the real street until the whole zebra clears the corner.
function approachCrosswalks(nodes,surfaces){
  const result=[],index=corridorIndex(surfaces);
  const isJunction=node=>node.roads.size>=2&&node.edges.size>=3;
  for(let origin=0;origin<nodes.length;origin++){
    const node=nodes[origin];
    if(!isJunction(node)||[...node.roads].some(r=>r.serviceAccess||r.bridgeApproach))continue;
    for(const first of node.edges){
      let previous=origin,current=first,travelled=0,done=false;
      const visited=new Set([origin]),approach=[{x:node.x,y:node.y}];
      while(!done&&!visited.has(current)){
        visited.add(current);
        const a=nodes[previous],b=nodes[current],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
        if(length<.001)break;
        const owners=[...a.roads].filter(r=>b.roads.has(r)),width=Math.max(0,...owners.map(streetWidth));
        if(!width||owners.some(r=>r.serviceAccess||r.bridgeApproach)||travelled>width*4)break;
        const ux=dx/length,uy=dy/length;
        for(let distance=Math.max(0,width/2+44-travelled);distance<=length;distance+=6){
          if(travelled+distance>width*4)break;
          const band={cx:a.x+ux*distance,cy:a.y+uy*distance,ux,uy,width,length:32,origin,approach:[...approach,{x:a.x+ux*distance,y:a.y+uy*distance}]};
          // A straight, symmetric set of long zebra bars, inset from both kerbs.
          const count=Math.floor((width-24)/16),span=(count-1)*16;
          if(count<3)break;
          const samples=[];
          for(const along of [-16,0,16])for(const across of [-span/2-4,0,span/2+4])
            samples.push([band.cx+ux*along-uy*across,band.cy+uy*along+ux*across]);
          if(samples.some(([x,y])=>!owners.some(r=>corridorContains(x,y,r,-2))))continue;
          const corner=samples.some(([x,y])=>index.at(x,y).some(segment=>{
            if(owners.includes(segment.road))return false;
            const hit=projectStreet(x,y,segment);
            const alignment=Math.abs((segment.dx*ux+segment.dy*uy)/Math.sqrt(segment.length2));
            return alignment<.96&&hit.distance<segment.width/2+18;
          }));
          if(corner||result.some(other=>bandsOverlap(band,other,12)))continue;
          band.stripes=Array.from({length:count},(_,i)=>{
            const offset=i*16-span/2,x=band.cx-uy*offset,y=band.cy+ux*offset;
            return {x:x-16,y:y-4,w:32,h:8,angle:-Math.atan2(uy,ux)};
          });
          result.push(band);done=true;break;
        }
        if(done||isJunction(b))break; // Internal links receive no stacked zebras.
        const next=[...b.edges].filter(id=>id!==previous);
        if(next.length!==1)break;
        approach.push({x:b.x,y:b.y});travelled+=length;previous=current;current=next[0];
      }
    }
  }
  return result;
}
function bandsOverlap(a,b,gap=0){
  const dx=b.cx-a.cx,dy=b.cy-a.cy;
  for(const [x,y] of [[a.ux,a.uy],[-a.uy,a.ux],[b.ux,b.uy],[-b.uy,b.ux]]){
    const radius=band=>(Math.abs(x*band.ux+y*band.uy)*band.length+Math.abs(-x*band.uy+y*band.ux)*band.width)/2;
    if(Math.abs(dx*x+dy*y)>radius(a)+radius(b)+gap)return false;
  }
  return true;
}
function bandInterval(a,b,band,gap){
  const axes=[[band.ux,band.uy,band.length/2+gap],[-band.uy,band.ux,band.width/2+4]];
  let start=0,end=1;
  for(const [ux,uy,radius] of axes){
    const position=(a[0]-band.cx)*ux+(a[1]-band.cy)*uy,delta=(b[0]-a[0])*ux+(b[1]-a[1])*uy;
    if(Math.abs(delta)<1e-9){if(Math.abs(position)>radius)return null;}
    else{const lo=(-radius-position)/delta,hi=(radius-position)/delta;start=Math.max(start,Math.min(lo,hi));end=Math.min(end,Math.max(lo,hi));}
    if(start>=end)return null;
  }
  return [start,end];
}
