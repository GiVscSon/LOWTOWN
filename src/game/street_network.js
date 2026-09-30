// Shared geometry for readable road endings and pedestrian routes.
const inside=(x,y,r,pad=0)=>x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
export function createRoadGraph(roads,bridges,accessPoints=[]){
  const nodes=[],lookup=new Map(),lines=[...roads,...bridges].map(r=>({...r,nodes:[]}));
  const add=(x,y,line)=>{const key=`${x.toFixed(1)}:${y.toFixed(1)}`;let id=lookup.get(key);if(id===undefined){id=nodes.length;nodes.push({x,y,edges:new Set()});lookup.set(key,id);}line.nodes.push(id);return id;};
  for(const r of lines){
    if(r.dir==='h'){add(r.x,r.y+r.h/2,r);add(r.x+r.w,r.y+r.h/2,r);}
    else{add(r.x+r.w/2,r.y,r);add(r.x+r.w/2,r.y+r.h,r);}
    for(const point of accessPoints){
      const cross=r.dir==='h'?point.y-(r.y+r.h/2):point.x-(r.x+r.w/2);
      if(Math.abs(cross)<.1&&inside(point.x,point.y,r))add(point.x,point.y,r);
    }
  }
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const a=lines[i],b=lines[j];
    if(a.dir!==b.dir){
      const h=a.dir==='h'?a:b,v=a.dir==='v'?a:b,x=v.x+v.w/2,y=h.y+h.h/2;
      if(inside(x,y,h)&&inside(x,y,v)){add(x,y,a);add(x,y,b);}
    }else{
      const horizontal=a.dir==='h',crossA=horizontal?a.y+a.h/2:a.x+a.w/2,crossB=horizontal?b.y+b.h/2:b.x+b.w/2;
      if(Math.abs(crossA-crossB)>.1)continue;
      for(const id of [...a.nodes,...b.nodes]){const n=nodes[id];if(inside(n.x,n.y,a)&&inside(n.x,n.y,b)){add(n.x,n.y,a);add(n.x,n.y,b);}}
    }
  }
  for(const r of lines){
    const sorted=[...new Set(r.nodes)].sort((a,b)=>r.dir==='h'?nodes[a].x-nodes[b].x:nodes[a].y-nodes[b].y);
    for(let i=1;i<sorted.length;i++){nodes[sorted[i-1]].edges.add(sorted[i]);nodes[sorted[i]].edges.add(sorted[i-1]);}
  }
  return nodes;
}

export function roadPath(graph,start,finish){
  if(!graph.length)return [];
  const nearest=p=>graph.reduce((best,n,i)=>Math.hypot(n.x-p.x,n.y-p.y)<Math.hypot(graph[best].x-p.x,graph[best].y-p.y)?i:best,0);
  const from=nearest(start),to=nearest(finish),queue=[from],parents=new Map([[from,null]]),costs=new Map([[from,0]]);
  // Street edges have unequal lengths. Minimise travel distance rather than
  // the number of intersections, which can choose a long detour to a base.
  while(queue.length){
    queue.sort((a,b)=>(costs.get(a)+Math.hypot(graph[a].x-graph[to].x,graph[a].y-graph[to].y))-
      (costs.get(b)+Math.hypot(graph[b].x-graph[to].x,graph[b].y-graph[to].y)));
    const current=queue.shift();if(current===to)break;
    for(const next of graph[current].edges){
      const cost=costs.get(current)+Math.hypot(graph[next].x-graph[current].x,graph[next].y-graph[current].y);
      if(cost>=(costs.get(next)??Infinity))continue;
      costs.set(next,cost);parents.set(next,current);if(!queue.includes(next))queue.push(next);
    }
  }
  if(!parents.has(to))return [];
  const path=[];for(let id=to;id!==null;id=parents.get(id))path.unshift({x:graph[id].x,y:graph[id].y});
  return path;
}

// Build continuous bus/emergency routes by joining shortest paths between
// named stops. Stop points are snapped to the same connected road graph used
// by police and other road vehicles.
export function planStopRoute(graph,stops,{loop=false,id='route'}={}){
  if(!Array.isArray(stops)||stops.length<2)return null;
  const legCount=loop?stops.length:stops.length-1,points=[],stopIndices=[];
  for(let leg=0;leg<legCount;leg++){
    const asPoint=value=>Array.isArray(value)?{x:value[0],y:value[1]}:value;
    const path=roadPath(graph,asPoint(stops[leg]),asPoint(stops[(leg+1)%stops.length]));
    if(path.length<1)return null;
    if(points.length&&Math.hypot(points.at(-1).x-path[0].x,points.at(-1).y-path[0].y)<1)path.shift();
    points.push(...path);
    stopIndices.push(points.length-1);
  }
  if(loop&&points.length>2&&Math.hypot(points.at(-1).x-points[0].x,points.at(-1).y-points[0].y)<1){
    points.pop();stopIndices[stopIndices.length-1]=0;
  }
  return {id,points,stopIndices,stopPoints:stopIndices.map(i=>points[i]),loop,stopCount:stops.length};
}

// Smoothly turns a route-following vehicle while keeping its centre on the
// graph path. Buses, service cars, and police can share this update primitive.
export function advanceRouteActor(actor,route,dt,{speed=1.4,dwell=1.6,stopRadius=24}={}){
  if(!route?.points?.length)return false;
  const frame=Math.min(Math.max(Number(dt)||0,0),.05)*60;
  if(!frame)return true;
  const points=route.points,index=((actor.routeIndex||0)%points.length+points.length)%points.length;
  actor.routeIndex=index;
  if((actor.routeWait||0)>0){actor.routeWait=Math.max(0,actor.routeWait-dt);actor.speed=0;return true;}
  const target=points[index],dx=target.x-actor.x,dy=target.y-actor.y,distance=Math.hypot(dx,dy);
  if(distance<stopRadius){
    if(route.stopIndices?.includes(index)&&actor.lastStopIndex!==index){actor.lastStopIndex=index;actor.routeWait=dwell;actor.speed=0;return true;}
    actor.routeIndex=route.loop?(index+1)%points.length:Math.min(index+1,points.length-1);
    actor.lastStopIndex=-1;
    return true;
  }
  const desired=Math.atan2(dy,dx),error=Math.atan2(Math.sin(desired-(actor.angle||0)),Math.cos(desired-(actor.angle||0)));
  const turn=Math.max(-.13*frame,Math.min(.13*frame,error));
  actor.angle=(actor.angle||0)+turn;
  const alignment=Math.max(.25,Math.cos(error));
  const targetSpeed=speed*(distance<90?.58:1)*alignment;
  actor.speed+=(targetSpeed-(actor.speed||0))*Math.min(1,.12*frame);
  actor.x+=Math.cos(actor.angle)*actor.speed*frame;
  actor.y+=Math.sin(actor.angle)*actor.speed*frame;
  actor.axis=Math.abs(Math.cos(actor.angle))>Math.abs(Math.sin(actor.angle))?'x':'y';
  return true;
}
export function roadTerminals(roads,bridges,solid){
  const ends=[];
  for(const road of roads){
    if(road.bridgeApproach||road.serviceAccess)continue;
    const horizontal=road.dir==='h',width=horizontal?road.h:road.w;
    for(const side of [-1,1]){
      const edge={x:horizontal?road.x+(side>0?road.w:0):road.x+road.w/2,y:horizontal?road.y+road.h/2:road.y+(side>0?road.h:0)};
      const forward={x:edge.x+(horizontal?side*8:0),y:edge.y+(horizontal?0:side*8)};
      if([...roads,...bridges].some(r=>r!==road&&(inside(forward.x,forward.y,r,3)||(r.dir!==road.dir&&inside(edge.x,edge.y,r,3)))))continue;
      const radius=width*.65+12;
      const cap={x:edge.x-(horizontal?side*radius*.4:0),y:edge.y-(horizontal?0:side*radius*.4),radius,width,dir:road.dir,side};
      if(ends.some(e=>Math.hypot(e.x-cap.x,e.y-cap.y)<radius))continue;
      const clear=()=>Array.from({length:16},(_,i)=>i*Math.PI/8).every(a=>solid(cap.x+Math.cos(a)*(radius+12),cap.y+Math.sin(a)*(radius+12)));
      let inset=0;
      while(!clear()&&inset<192){if(horizontal)cap.x-=side*16;else cap.y-=side*16;inset+=16;}
      if(clear()){
        if(inset){
          if(horizontal){if(side>0)road.w-=inset;else{road.x+=inset;road.w-=inset;}}
          else if(side>0)road.h-=inset;else{road.y+=inset;road.h-=inset;}
        }
        ends.push(cap);
      }
    }
  }
  return ends;
}

export function onRoadSurface(x,y,roads,bridges,curves=[],terminals=[]){
  if([...roads,...bridges].some(r=>inside(x,y,r)))return true;
  if(terminals.some(t=>Math.hypot(x-t.x,y-t.y)<=t.radius))return true;
  for(const road of curves)for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(length||1)));
    if(Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<road.width/2)return true;
  }
  return false;
}

export function createWalkingRoutes(roads,parks,clear){
  const routes=[];
  function sample(controls,kind,loop=false){
    let points=[];
    const flush=()=>{if(points.length>=5)routes.push({points,kind,loop:false});points=[];};
    let unbroken=true;
    for(let i=1;i<controls.length;i++){
      const a=controls[i-1],b=controls[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8);
      for(let n=0;n<steps;n++){
        const x=a.x+(b.x-a.x)*n/steps,y=a.y+(b.y-a.y)*n/steps;
        if(clear(x,y)){points.push({x,y});}else{flush();unbroken=false;}
      }
    }
    if(points.length>=5)routes.push({points,kind,loop:loop&&unbroken});
  }
  for(const r of roads){
    if(r.bridgeApproach||r.serviceAccess)continue;
    if(r.dir==='h')for(const y of [r.y-22,r.y+r.h+22])sample([{x:r.x+25,y},{x:r.x+r.w-25,y}],'sidewalk');
    else for(const x of [r.x-22,r.x+r.w+22])sample([{x,y:r.y+25},{x,y:r.y+r.h-25}],'sidewalk');
  }
  for(const p of parks){
    const corners=[{x:p.x+48,y:p.y+48},{x:p.x+p.w-48,y:p.y+48},{x:p.x+p.w-48,y:p.y+p.h-48},{x:p.x+48,y:p.y+p.h-48}];
    sample([...corners,corners[0]],'park',true);
  }
  return routes;
}

export function assignWalkingRoutes(people,routes){
  const placed=[];
  people.forEach((p,index)=>{
    let best,dist=Infinity;
    const local=p.districtId?routes.filter(r=>r.districtId===p.districtId):routes;
    const eligible=index%4===0&&local.some(r=>r.kind==='park')?local.filter(r=>r.kind==='park'):local;
    for(const route of eligible)for(let i=0;i<route.points.length;i++){
      const point=route.points[i],d=Math.hypot(p.x-point.x,p.y-point.y);
      if(d<dist&&!placed.some(q=>Math.hypot(q.x-point.x,q.y-point.y)<18)){best={route,i,point};dist=d;}
    }
    if(!best)return;
    Object.assign(p,best.point,{route:best.route,routeIndex:best.i,routeDirection:index%2?1:-1,pause:index%6*.2,goal:null});
    placed.push(best.point);
  });
}

export function nextWalkingGoal(p){
  const route=p.route;if(!route?.points.length)return null;
  let next=p.routeIndex+p.routeDirection*3;
  if(route.loop)next=(next+route.points.length)%route.points.length;
  else if(next<0||next>=route.points.length){p.routeDirection*=-1;next=Math.max(0,Math.min(route.points.length-1,p.routeIndex+p.routeDirection*3));p.pause=.8;}
  p.routeIndex=next;
  return route.points[next];
}

export function drawRoadTerminals(ctx,terminals){
  for(const t of terminals){
    ctx.beginPath();ctx.arc(t.x,t.y,t.radius+12,0,Math.PI*2);ctx.fillStyle='#55564d';ctx.fill();
    ctx.strokeStyle='#898172';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,Math.PI*2);ctx.fillStyle='#161b1f';ctx.fill();
    const throat=t.radius+16;
    if(t.dir==='h')ctx.fillRect(t.side>0?t.x-throat:t.x,t.y-t.width/2,throat,t.width);
    else ctx.fillRect(t.x-t.width/2,t.side>0?t.y-throat:t.y,t.width,throat);
    const angle=t.dir==='h'?(t.side>0?0:Math.PI):(t.side>0?Math.PI/2:-Math.PI/2);
    ctx.strokeStyle='rgba(224,154,62,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(t.x,t.y,t.radius-10,angle-1.15,angle+1.15);ctx.stroke();
  }
}
