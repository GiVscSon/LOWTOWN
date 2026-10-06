const compiled=new WeakMap(),collections=new WeakMap();
const CELL=384;
export function streetPoints(road){
  if(road.points?.length)return road.points;
  return road.dir==='h'?[[road.x,road.y+road.h/2],[road.x+road.w,road.y+road.h/2]]:
    [[road.x+road.w/2,road.y],[road.x+road.w/2,road.y+road.h]];
}
export function streetWidth(road){return road.width||(road.dir==='h'?road.h:road.w);}
export function corridorRoad(points,width,properties={}){
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs)-width/2,y=Math.min(...ys)-width/2;
  return {...properties,points,width,x,y,w:Math.max(...xs)+width/2-x,h:Math.max(...ys)+width/2-y};
}
export function corridorSegments(road){
  if(compiled.has(road))return compiled.get(road);
  const points=streetPoints(road),segments=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
    if(length2>.000001)segments.push({a,b,dx,dy,length2,width:streetWidth(road),road});
  }
  compiled.set(road,segments);return segments;
}
export function projectStreet(x,y,segment){
  const {a,dx,dy,length2}=segment,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length2));
  const px=a[0]+dx*t,py=a[1]+dy*t;
  return {x:px,y:py,t,distance:Math.hypot(x-px,y-py),angle:Math.atan2(dy,dx),road:segment.road};
}
function segmentContains(x,y,segment,pad){
  const radius=segment.width/2+pad;if(radius<0)return false;
  const {a,dx,dy,length2}=segment,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length2));
  const px=x-a[0]-dx*t,py=y-a[1]-dy*t;
  return px*px+py*py<=radius*radius;
}
export function nearestStreet(x,y,roads){
  let best=null;
  for(const road of roads)for(const segment of corridorSegments(road)){
    const hit=projectStreet(x,y,segment);if(!best||hit.distance<best.distance)best=hit;
  }
  return best;
}
export function corridorContains(x,y,road,pad=0){
  if(x<road.x-pad||x>road.x+road.w+pad||y<road.y-pad||y>road.y+road.h+pad)return false;
  if(!road.points)return true;
  return corridorSegments(road).some(segment=>segmentContains(x,y,segment,pad));
}
export function corridorIndex(roads){
  const cached=collections.get(roads);if(cached?.length===roads.length&&cached.first===roads[0]&&cached.last===roads.at(-1))return cached;
  const cells=new Map();
  for(const road of roads)for(const segment of corridorSegments(road)){
    const radius=segment.width/2+48,{a,b}=segment;
    for(let x=Math.floor((Math.min(a[0],b[0])-radius)/CELL);x<=Math.floor((Math.max(a[0],b[0])+radius)/CELL);x++)
      for(let y=Math.floor((Math.min(a[1],b[1])-radius)/CELL);y<=Math.floor((Math.max(a[1],b[1])+radius)/CELL);y++){
        const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(segment);
      }
  }
  const index={length:roads.length,first:roads[0],last:roads.at(-1),at:(x,y)=>cells.get(`${Math.floor(x/CELL)},${Math.floor(y/CELL)}`)||[]};
  collections.set(roads,index);return index;
}
export function onStreetCollection(x,y,roads,pad=0,exclude=null){
  for(const segment of corridorIndex(roads).at(x,y)){
    if(segment.road===exclude)continue;
    if(!segment.road.points){if(corridorContains(x,y,segment.road,pad))return true;}
    else if(segmentContains(x,y,segment,pad))return true;
  }
  return false;
}
export function offsetStreet(points,offset){
  return points.map((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
    return [p[0]-dy/length*offset,p[1]+dx/length*offset];
  });
}
export function rectangleClearOfStreets(rect,roads,margin=0){
  for(const road of roads){
    if(rect.x+rect.w+margin<road.x||rect.x-margin>road.x+road.w||rect.y+rect.h+margin<road.y||rect.y-margin>road.y+road.h)continue;
    for(const segment of corridorSegments(road)){
      const radius=segment.width/2+margin;
      const lo=[rect.x-radius,rect.y-radius],hi=[rect.x+rect.w+radius,rect.y+rect.h+radius];
      let enter=0,leave=1;
      for(const axis of [0,1]){
        const delta=segment.b[axis]-segment.a[axis];
        if(Math.abs(delta)<1e-9){if(segment.a[axis]<lo[axis]||segment.a[axis]>hi[axis]){enter=2;break;}}
        else{const a=(lo[axis]-segment.a[axis])/delta,b=(hi[axis]-segment.a[axis])/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));}
      }
      if(enter>leave)continue;
      // The expanded box is only a broad phase. Rounded road corners can
      // pass its corners without touching the actual rectangular footprint.
      const corners=[[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x,rect.y+rect.h],[rect.x+rect.w,rect.y+rect.h]];
      const endpointDistance=point=>Math.hypot(Math.max(rect.x-point[0],0,point[0]-rect.x-rect.w),Math.max(rect.y-point[1],0,point[1]-rect.y-rect.h));
      const distances=[endpointDistance(segment.a),endpointDistance(segment.b),...corners.map(p=>projectStreet(...p,segment).distance)];
      let insideEnter=0,insideLeave=1;
      for(const axis of [0,1]){
        const low=axis===0?rect.x:rect.y,high=low+(axis===0?rect.w:rect.h),delta=segment.b[axis]-segment.a[axis];
        if(Math.abs(delta)<1e-9){if(segment.a[axis]<low||segment.a[axis]>high){insideEnter=2;break;}}
        else{const a=(low-segment.a[axis])/delta,b=(high-segment.a[axis])/delta;insideEnter=Math.max(insideEnter,Math.min(a,b));insideLeave=Math.min(insideLeave,Math.max(a,b));}
      }
      if(insideEnter<=insideLeave||Math.min(...distances)<radius)return false;
    }
  }
  return true;
}
