const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function createCharacterState(options={}){
  return {
    x:finite(options.x),
    y:finite(options.y),
    a:finite(options.a),
    vx:finite(options.vx),
    vy:finite(options.vy),
    speed:Math.max(1,finite(options.walkSpeed,34)),
    acceleration:Math.max(1,finite(options.acceleration,120)),
    turnRate:Math.max(.1,finite(options.turnRate,9)),
    radius:Math.max(4,finite(options.radius,10)),
    age:0,
    distance:0,
  };
}

export function stepCharacterPhysics(state,dt,input={},blocked=()=>false){
  const h=clamp(finite(dt,1/60),0,.1);
  if(h<=0)return characterTelemetry(state,input);
  const ix=clamp(finite(input.x),-1,1),iy=clamp(finite(input.y),-1,1);
  const length=Math.hypot(ix,iy);
  const nx=length>1e-6?ix/length:0,ny=length>1e-6?iy/length:0;
  const targetVx=nx*state.speed,targetVy=ny*state.speed;
  const blend=Math.min(1,state.acceleration*h/Math.max(state.speed,1));
  state.vx+=(targetVx-state.vx)*blend;
  state.vy+=(targetVy-state.vy)*blend;
  const moving=Math.hypot(state.vx,state.vy)>0.05;
  if(moving){
    const targetA=Math.atan2(state.vy,state.vx);
    let da=targetA-state.a;
    while(da>Math.PI)da-=Math.PI*2;
    while(da<-Math.PI)da+=Math.PI*2;
    state.a+=clamp(da,-state.turnRate*h,state.turnRate*h);
  }
  const dx=state.vx*h,dy=state.vy*h;
  const oldX=state.x,oldY=state.y;
  if(!blocked(state.x+dx,state.y))state.x+=dx;else state.vx=0;
  if(!blocked(state.x,state.y+dy))state.y+=dy;else state.vy=0;
  state.distance+=Math.hypot(state.x-oldX,state.y-oldY);
  state.age+=h;
  return characterTelemetry(state,input);
}

export function characterTelemetry(state,input={}){
  return {x:state.x,y:state.y,heading:state.a,velocity:Math.hypot(state.vx,state.vy),vx:state.vx,vy:state.vy,distance:state.distance,radius:state.radius,controls:{x:finite(input.x),y:finite(input.y)}};
}
