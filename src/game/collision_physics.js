const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function circleContact(a,b,{restitution=.12,friction=.45,damageScale=.002,maxImpulse=90,separation=.95}={}){
  const ax=finite(a.x),ay=finite(a.y),bx=finite(b.x),by=finite(b.y);
  const dx=bx-ax,dy=by-ay,distance=Math.hypot(dx,dy);
  const radius=Math.max(0,finite(a.radius,10))+Math.max(0,finite(b.radius,10));
  if(distance>=radius)return {hit:false,penetration:0,normalX:0,normalY:0,impulse:0,damage:0};
  const nx=distance>1e-6?dx/distance:1,ny=distance>1e-6?dy/distance:0,penetration=radius-distance;
  const invA=1/Math.max(1,finite(a.mass,1000)),invB=1/Math.max(1,finite(b.mass,1000)),sumInv=invA+invB;
  const move=Math.min(Math.max(penetration*.5*clamp(separation,0,1),1.2),22);
  if(move>0){a.x-=nx*move*(invA/sumInv);a.y-=ny*move*(invA/sumInv);b.x+=nx*move*(invB/sumInv);b.y+=ny*move*(invB/sumInv);}
  const avx=finite(a.vx),avy=finite(a.vy),bvx=finite(b.vx),bvy=finite(b.vy),rvx=bvx-avx,rvy=bvy-avy,closing=rvx*nx+rvy*ny;
  if(closing>=0)return {hit:true,penetration,normalX:nx,normalY:ny,impulse:0,damage:0,separating:true};
  const rawImpulse=-(1+clamp(finite(restitution,.12),0,1))*closing/sumInv,impulse=Math.min(Math.max(0,finite(maxImpulse,90)),rawImpulse);
  const tangentX=-ny,tangentY=nx,tangentSpeed=rvx*tangentX+rvy*tangentY,maxFriction=impulse*clamp(finite(friction,.45),0,1),frictionImpulse=clamp(-tangentSpeed/sumInv,-maxFriction,maxFriction);
  const jx=nx*impulse+tangentX*frictionImpulse,jy=ny*impulse+tangentY*frictionImpulse;
  a.vx-=jx*invA;a.vy-=jy*invA;b.vx+=jx*invB;b.vy+=jy*invB;
  const damage=Math.abs(impulse)*Math.max(0,finite(damageScale,.002));
  return {hit:true,penetration,normalX:nx,normalY:ny,impulse,frictionImpulse,damage,separating:false};
}

export function resolveWallContact(state,normalX,normalY,{restitution=.08,friction=.35,damageScale=.0015,maxImpulse=50000}={}){
  const nx=finite(normalX),ny=finite(normalY);const nLen=Math.hypot(nx,ny)||1;const nxx=nx/nLen,nyy=ny/nLen;
  const vn=finite(state.vx)*nxx+finite(state.vy)*nyy;
  if(vn>=0)return {hit:false,impulse:0,damage:0};
  const invMass=1/Math.max(1,finite(state.mass,1000));
  const rawImpulse=-(1+clamp(finite(restitution,.08),0,1))*vn/invMass,impulse=Math.min(Math.max(0,finite(maxImpulse,120)),rawImpulse);
  state.vx+=nxx*impulse*invMass;state.vy+=nyy*impulse*invMass;
  const tx=-nyy,ty=nxx,vt=state.vx*tx+state.vy*ty;
  const tangentScale=clamp(1-finite(friction,.35),0,1);
  state.vx+=tx*(vt*tangentScale-vt);state.vy+=ty*(vt*tangentScale-vt);
  return {hit:true,impulse,damage:Math.abs(impulse)*Math.max(0,finite(damageScale,.0015))};
}

export function collisionTelemetry(contact={}){
  return {hit:!!contact.hit,penetration:Math.max(0,finite(contact.penetration)),impulse:Math.max(0,finite(contact.impulse)),damage:Math.max(0,finite(contact.damage))};
}
