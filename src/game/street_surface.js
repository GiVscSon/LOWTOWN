// A single asphalt footprint shared by streets and motor bridge decks. Edges
// are exposed union boundaries, never the seams between constituent rectangles.
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
export function streetSurfaceGeometry(roads,bridges=[]){
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
