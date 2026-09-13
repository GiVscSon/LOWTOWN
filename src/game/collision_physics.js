const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function circleContact(a,b,{restitution=.12,friction=.45,damageScale=.002}={}){
  const ax=finite(a.x),ay=finite(a.y),bx=finite(b.x),by=finite(b.y);
  const dx=bx-ax,dy=by-ay;
  const distance=Math.hypot(dx,dy);
  const radius=Math.max(0,finite(a.radius,10))+Math.max(0,finite(b.radius,10));
  if(distance>=radius)return {hit:false,penetration:0,normalX:0,normalY:0,impulse:0,damage:0};
  const nx=distance>1e-6?dx/distance:1,ny=distance>1e-6?dy/distance:0;
  const avx=finite(a.vx),avy=finite(a.vy),bvx=finite(b.vx),bvy=finite(b.vy);
  const rvx=bvx-avx,rvy=bvy-avy;
  const closing=rvx*nx+rvy*ny;
  if(closing>=0)return {hit:true,penetration:radius-distance,normalX:nx,normalY:ny,impulse:0,damage:0,separating:true};
  const invA=1/Math.max(1,finite(a.mass,1000)),invB=1/Math.max(1,finite(b.mass,1000));
  const impulse=-(1+clamp(finite(restitution,.12),0,1))*closing/(invA+invB);
  const tangentX=-ny,tangentY=nx;
  const tangentSpeed=rvx*tangentX+rvy*tangentY;
  const maxFriction=impulse*clamp(finite(friction,.45),0,1);
  const frictionImpulse=clamp(-tangentSpeed/(invA+invB),-maxFriction,maxFriction);
  const jx=nx*impulse+tangentX*frictionImpulse,jy=ny*impulse+tangentY*frictionImpulse;
  a.vx-=jx*invA;a.vy-=jy*invA;b.vx+=jx*invB;b.vy+=jy*invB;
  const damage=Math.abs(impulse)*Math.max(0,finite(damageScale,.002));
  return {hit:true,penetration:radius-distance,normalX:nx,normalY:ny,impulse,frictionImpulse,damage,separating:false};
}

export function resolveWallContact(state,normalX,normalY,{restitution=.08,friction=.35,damageScale=.0015}={}){
  const nx=finite(normalX),ny=finite(normalY);const nLen=Math.hypot(nx,ny)||1;const nxx=nx/nLen,nyy=ny/nLen;
  const vn=finite(state.vx)*nxx+finite(state.vy)*nyy;
  if(vn>=0)return {hit:false,impulse:0,damage:0};
  const invMass=1/Math.max(1,finite(state.mass,1000));
  const impulse=-(1+clamp(finite(restitution,.08),0,1))*vn/invMass;
  state.vx+=nxx*impulse*invMass;state.vy+=nyy*impulse*invMass;
  const tx=-nyy,ty=nxx,vt=state.vx*tx+state.vy*ty;
  const tangentScale=clamp(1-finite(friction,.35),0,1);
  state.vx+=tx*(vt*tangentScale-vt);state.vy+=ty*(vt*tangentScale-vt);
  return {hit:true,impulse,damage:Math.abs(impulse)*Math.max(0,finite(damageScale,.0015))};
}

export function collisionTelemetry(contact={}){
  return {hit:!!contact.hit,penetration:Math.max(0,finite(contact.penetration)),impulse:Math.max(0,finite(contact.impulse)),damage:Math.max(0,finite(contact.damage))};
}
