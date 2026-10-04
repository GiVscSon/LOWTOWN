// Velocities in the city are world units per 60 Hz tick; impulses use seconds.
export const MOVABLE_TYPES = new Set(['dumpster','crate','barrel','trashcan','cone']);
export const isMovableProp = body => body.movable === true || MOVABLE_TYPES.has(body.type);
export const bodyHeight = body => body.collisionHeight ?? (body.entityType === 'pedestrian' ? 23 : /truck|van|bus|ambulance|fire/i.test(body.type||body.model||'') ? 29 : 12);
export function applyBodyImpulse(body, x, y, point = body, person = false) {
  const mass = Math.max(1, body.mass || (person ? 70 : 1500));
  const vx = x / mass / 60, vy = y / mass / 60;
  if (person) { body.contactVx = (body.contactVx||0)+vx; body.contactVy = (body.contactVy||0)+vy; }
  else { body.vx = (body.vx||0)+vx; body.vy = (body.vy||0)+vy;
    body.speed = body.vx*Math.cos(body.angle||0)+body.vy*Math.sin(body.angle||0); }
  if (!person) {
    const inertia = mass*((body.width||body.w||48)**2+(body.height||body.h||24)**2)/12;
    const torque = (point.x-body.x)*y-(point.y-body.y)*x;
    body.angularVelocity = Math.max(-3,Math.min(3,(body.angularVelocity||0)+torque/inertia));
  }
}
export function damagePanel(body, nx, ny, amount) {
  const angle=body.angle||0, forward=nx*Math.cos(angle)+ny*Math.sin(angle),side=-nx*Math.sin(angle)+ny*Math.cos(angle);
  const panel=Math.abs(forward)>Math.abs(side)?forward>0?'front':'rear':side>0?'right':'left';
  body.damage ||= {}; body.damage[panel]=Math.min(1,(body.damage[panel]||0)+amount);
}
// Damped springs react to measured acceleration, including collision impulses.
export function stepBodyResponse(body, dt, movable=false) {
  const angle=body.angle||0,vx=body.vx||0,vy=body.vy||0;
  const ax=(vx-(body.responseVx??vx))/Math.max(dt,.001),ay=(vy-(body.responseVy??vy))/Math.max(dt,.001);
  body.responseVx=vx;body.responseVy=vy;
  if(Math.abs(ax)+Math.abs(ay)+Math.abs(body.pitch||0)+Math.abs(body.roll||0)+Math.abs(body.pitchVelocity||0)+Math.abs(body.rollVelocity||0)<.00001){
    body.pitch=body.roll=body.pitchVelocity=body.rollVelocity=0;body.angularVelocity=(body.angularVelocity||0)*Math.exp(-(movable?2.5:6)*dt);return;
  }
  const targetPitch=Math.max(-.08,Math.min(.08,-(ax*Math.cos(angle)+ay*Math.sin(angle))*.012));
  const targetRoll=Math.max(-.07,Math.min(.07,(-ax*Math.sin(angle)+ay*Math.cos(angle))*.01));
  const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps;
  for(let i=0;i<steps;i++)for(const [key,target] of [['pitch',targetPitch],['roll',targetRoll]]){
    const speedKey=key+'Velocity';body[speedKey]=(body[speedKey]||0)+(target-(body[key]||0))*100*h-(body[speedKey]||0)*18*h;
    body[key]=(body[key]||0)+body[speedKey]*h;
  }
  body.angularVelocity=(body.angularVelocity||0)*Math.exp(-(movable?2.5:6)*dt);
}
