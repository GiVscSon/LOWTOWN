// Oriented bodies and inelastic momentum exchange used by the live city.
import { createSpatialIndex } from './spatial_index.js';
export { createSpatialIndex } from './spatial_index.js';
export function chassis(body) {
  return { x: body.x, y: body.y, angle: body.angle || 0,
    length: body.width || body.w || 48, breadth: body.height || body.h || 24 };
}
export function contact(a, b) {
  const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2];
  let depth = Infinity, normal;
  for (const angle of axes) {
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const radius = o => Math.abs(Math.cos(o.angle - angle)) * o.length / 2 + Math.abs(Math.sin(o.angle - angle)) * o.breadth / 2;
    const distance = (a.x - b.x) * nx + (a.y - b.y) * ny;
    const overlap = radius(a) + radius(b) - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < depth) { depth = overlap; normal = { x: nx * (distance < 0 ? -1 : 1), y: ny * (distance < 0 ? -1 : 1) }; }
  }
  return { ...normal, depth };
}
const mass = body => Math.max(50, Number(body.mass) || 1500);
const velocity = body => ({x:Number.isFinite(body.vx)?body.vx:Math.cos(body.angle||0)*(body.speed||0),
  y:Number.isFinite(body.vy)?body.vy:Math.sin(body.angle||0)*(body.speed||0)});
function setVelocity(body,x,y) {
  body.vx=x;body.vy=y;
  if(Number.isFinite(body.speed)){
    const forward=x*Math.cos(body.angle||0)+y*Math.sin(body.angle||0);
    body.speed=body.isTraffic?Math.sign(body.cruiseSpeed||1)*Math.max(0,forward):forward;
  }
}
export function resolveContact(a, b, fixed = false) {
  const hit = contact(chassis(a), chassis(b));
  if (!hit) return false;
  const invA=1/mass(a),invB=fixed?0:1/mass(b),total=invA+invB;
  a.x += hit.x * (hit.depth + .02) * invA/total;
  a.y += hit.y * (hit.depth + .02) * invA/total;
  if (!fixed) { b.x -= hit.x * (hit.depth + .02) * invB/total; b.y -= hit.y * (hit.depth + .02) * invB/total; }
  const av=velocity(a),bv=fixed?{x:0,y:0}:velocity(b);
  const closing=(av.x-bv.x)*hit.x+(av.y-bv.y)*hit.y;
  // Preserve tangent motion: glancing contact slides instead of killing the engine.
  if(closing<0){
    const impulse=-closing*1.08/total;
    setVelocity(a,av.x+hit.x*impulse*invA,av.y+hit.y*impulse*invA);
    if(!fixed)setVelocity(b,bv.x-hit.x*impulse*invB,bv.y-hit.y*impulse*invB);
  }
  return true;
}
function sceneryBodies(buildings,trees,props){
  return [...buildings.map(b=>({x:b.x+b.w/2,y:b.y+b.h/2,width:b.w,height:b.h})),
    ...trees.map(t=>({x:t.x,y:t.y,width:12,height:12})),...props];
}
export function resolveScenery(car, buildings, trees = [], props = []) {
  let hit=false;
  const radius=Math.hypot(chassis(car).length,chassis(car).breadth)/2;
  for(const prop of sceneryBodies(buildings,trees,props)){
    const body={...prop,width:prop.width||prop.w||12,height:prop.height||prop.h||12};
    const reach=radius+Math.hypot(body.width,body.height)/2;
    if(Math.abs(car.x-body.x)>reach||Math.abs(car.y-body.y)>reach)continue;
    hit=resolveContact(car,body,true)||hit;
  }
  return hit;
}
export function captureMotion(bodies){
  return new Map(bodies.map(body=>[body,{x:body.x,y:body.y,angle:body.angle||0}]));
}

// Sweep the complete rotating chassis along every frame's intended trajectory.
// AI supplies a trajectory; impacts change its remaining movement and leave an
// external velocity that persists while its driver brakes. Parked bodies coast.
export function solveVehicleMotion(bodies,starts,dt,{buildings=[],trees=[],props=[],people=new Set(),passive=new Set(),
  player=null,canOccupy=()=>true,onImpact=()=>{},isEnabled=()=>true}={}){
  const frame=Math.max(.0001,Math.min(dt,.1)*60),states=[];
  let steps=1;
  const shape=s=>s.person?{x:s.body.x,y:s.body.y,angle:0,length:9,breadth:9}:chassis(s.body);
  for(const body of bodies){
    const end={x:body.x,y:body.y,angle:body.angle||0};let start=starts.get(body)||end;
    if(Math.hypot(end.x-start.x,end.y-start.y)>512)start=end; // custody/respawn is a relocation, never a swept crash
    const person=people.has(body),parked=passive.has(body),angle=person?0:Math.atan2(Math.sin(end.angle-start.angle),Math.cos(end.angle-start.angle));
    let vx=(end.x-start.x)/frame,vy=(end.y-start.y)/frame;
    if(parked){const v=velocity(body);vx=v.x;vy=v.y;}
    else if(body!==player){vx+=body.contactVx||0;vy+=body.contactVy||0;}
    const radius=person?6:Math.hypot(chassis(body).length,chassis(body).breadth)/2;
    steps=Math.max(steps,Math.ceil((Math.hypot(vx,vy)*frame+Math.abs(angle)*radius)/2));
    states.push({body,start,end,endVelocity:velocity(body),person,parked,vx,vy,engineX:parked?0:(end.x-start.x)/frame,engineY:parked?0:(end.y-start.y)/frame,angle,radius});
  }
  steps=Math.min(256,steps);const slice=frame/steps,maxRadius=Math.max(0,...states.map(s=>s.radius));
  const scenery=sceneryBodies(buildings,trees,props).map(p=>{
    const width=p.width||p.w||12,height=p.height||p.h||12;
    return {...p,width,height,radius:Math.hypot(width,height)/2,source:p};
  });
  const sceneryIndex=createSpatialIndex(scenery,p=>{
    // Long bridge barriers occupy thin rectangles, not kilometre-wide circles.
    // Include rotation so the broad phase remains conservative for every prop.
    const c=Math.abs(Math.cos(p.angle||0)),s=Math.abs(Math.sin(p.angle||0));
    const rx=(c*p.width+s*p.height)/2,ry=(s*p.width+c*p.height)/2;
    return {left:p.x-rx,right:p.x+rx,top:p.y-ry,bottom:p.y+ry};
  });
  for(const s of states){
    Object.assign(s.body,s.start);
    const travel=Math.hypot(s.vx,s.vy)*frame+s.radius+4;
    s.scenery=sceneryIndex.query(s.start.x-travel,s.start.y-travel,s.start.x+travel,s.start.y+travel);
  }
  const reported=new Map();
  function collide(a,b,fixed=false){
    if(!isEnabled(a.body)||!isEnabled(b.body.source||b.body))return false;
    if(!fixed&&a.person&&b.person)return false;
    if(Math.abs(a.body.x-b.body.x)>a.radius+b.radius||Math.abs(a.body.y-b.body.y)>a.radius+b.radius)return false;
    const hit=contact(shape(a),shape(b));if(!hit)return false;
    const closing=Math.max(0,-((a.vx-b.vx)*hit.x+(a.vy-b.vy)*hit.y));
    const target=b.body.source||b.body;
    let touched=reported.get(a.body);if(!touched)reported.set(a.body,touched=new Set());
    if(closing>.15&&!touched.has(target)){
      touched.add(target);onImpact(a.body,target,closing,{x:hit.x,y:hit.y});
      if(!isEnabled(target))return false;
    }
    const invA=1/(a.person?70:mass(a.body)),invB=fixed?0:1/(b.person?70:mass(b.body)),total=invA+invB;
    let shareA=invA/total,shareB=invB/total;
    const depth=hit.depth+.025;
    const permitted=(s,x,y)=>canOccupy(s.body,{...s.body,x,y},s.person);
    if(!permitted(a,a.body.x+hit.x*depth*shareA,a.body.y+hit.y*depth*shareA)){shareA=0;shareB=fixed?0:1;}
    if(!fixed&&!permitted(b,b.body.x-hit.x*depth*shareB,b.body.y-hit.y*depth*shareB)){shareB=0;shareA=1;}
    if(shareA&&permitted(a,a.body.x+hit.x*depth*shareA,a.body.y+hit.y*depth*shareA)){
      a.body.x+=hit.x*depth*shareA;a.body.y+=hit.y*depth*shareA;
    }
    if(shareB){b.body.x-=hit.x*depth*shareB;b.body.y-=hit.y*depth*shareB;}
    if(closing>0){
      const impulse=closing*1.04/total;
      a.vx+=hit.x*impulse*invA;a.vy+=hit.y*impulse*invA;
      if(!fixed){b.vx-=hit.x*impulse*invB;b.vy-=hit.y*impulse*invB;}
      for(const s of fixed?[a]:[a,b])if(s.person){const speed=Math.hypot(s.vx,s.vy);if(speed>3){s.vx*=3/speed;s.vy*=3/speed;}}
    }
    return true;
  }
  for(let step=0;step<steps;step++){
    for(const s of states){
      const pose={x:s.body.x,y:s.body.y,angle:s.body.angle};
      s.body.x+=s.vx*slice;s.body.y+=s.vy*slice;s.body.angle=s.start.angle+s.angle*(step+1)/steps;
      if((s.parked&&Math.hypot(s.vx,s.vy)>.001||Math.abs(s.vx-s.engineX)+Math.abs(s.vy-s.engineY)>.01)&&!canOccupy(s.body,s.body,s.person)){Object.assign(s.body,pose);s.vx=s.vy=0;}
    }
    for(let pass=0;pass<32;pass++){
      let touched=false;
      // Nearby-cell pairs keep a large populated city affordable on phones.
      const cellSize=128,cells=new Map();
      states.forEach((s,index)=>{const key=`${Math.floor(s.body.x/cellSize)},${Math.floor(s.body.y/cellSize)}`;
        let cell=cells.get(key);if(!cell)cells.set(key,cell=[]);cell.push(index);});
      for(let i=0;i<states.length;i++){
        const a=states[i],cx=Math.floor(a.body.x/cellSize),cy=Math.floor(a.body.y/cellSize);
        const reach=Math.max(1,Math.ceil((a.radius+maxRadius)/cellSize));
        for(let x=cx-reach;x<=cx+reach;x++)for(let y=cy-reach;y<=cy+reach;y++)
          for(const j of cells.get(`${x},${y}`)||[])if(j>i)touched=collide(a,states[j])||touched;
        for(const p of a.scenery){const b={body:p,person:false,vx:0,vy:0,radius:p.radius};touched=collide(a,b,true)||touched;}
      }
      if(!touched)break;
    }
  }
  for(const s of states){
    if(s.person){s.body.angle=s.end.angle;s.body.contactVx=s.vx-s.engineX;s.body.contactVy=s.vy-s.engineY;}
    else{
      setVelocity(s.body,s.body===player?s.endVelocity.x+s.vx-s.engineX:s.vx,s.body===player?s.endVelocity.y+s.vy-s.engineY:s.vy);
      if(s.body!==player&&!s.parked){s.body.contactVx=s.vx-s.engineX;s.body.contactVy=s.vy-s.engineY;}
    }
    const decay=Math.exp(-(s.person?8:s.parked?3:5)*dt);
    if(s.parked)setVelocity(s.body,s.vx*decay,s.vy*decay);
    else if(s.body!==player){s.body.contactVx*=decay;s.body.contactVy*=decay;if(Math.hypot(s.body.contactVx,s.body.contactVy)<.01)s.body.contactVx=s.body.contactVy=0;}
  }
}
