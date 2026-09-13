const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export const SURFACE_TYPES=Object.freeze({DRY:'dry',WET:'wet',DIRT:'dirt',GRASS:'grass',OIL:'oil'});

export const SURFACE_PROFILES=Object.freeze({
  dry:Object.freeze({grip:1,brake:1,drag:1,power:1}),
  wet:Object.freeze({grip:.68,brake:.72,drag:1.04,power:.98}),
  dirt:Object.freeze({grip:.54,brake:.62,drag:1.12,power:.9}),
  grass:Object.freeze({grip:.42,brake:.5,drag:1.18,power:.82}),
  oil:Object.freeze({grip:.16,brake:.28,drag:.98,power:1})
});

export function resolveSurface(surface='dry'){
  const key=String(surface||'dry').toLowerCase();
  return SURFACE_PROFILES[key]||SURFACE_PROFILES.dry;
}

export function applySurfacePhysics(physics={},surface='dry'){
  const s=resolveSurface(surface);
  return {...physics,
    lateralGrip:Math.max(.01,finite(physics.lateralGrip,1)*s.grip),
    handbrakeGrip:Math.max(.01,finite(physics.handbrakeGrip,1)*s.grip),
    handbrakeSlipGrip:Math.max(.01,finite(physics.handbrakeSlipGrip,1)*s.grip),
    brakeForce:Math.max(0,finite(physics.brakeForce,0)*s.brake),
    friction:Math.max(.05,finite(physics.friction,1)*s.grip),
    drag:Math.max(.001,finite(physics.drag,1)*s.drag),
    handbrakeDrag:Math.max(.001,finite(physics.handbrakeDrag,1)*s.drag),
    engineForce:Math.max(0,finite(physics.engineForce,0)*s.power),
    surfaceGrip:s.grip,
    surfaceBrake:s.brake
  };
}

export function surfaceTelemetry(surface='dry',physics={}){
  const s=resolveSurface(surface);
  return {surface:String(surface||'dry').toLowerCase(),grip:clamp(s.grip,.01,1),brake:clamp(s.brake,.01,1),drag:s.drag,power:s.power,effectiveGrip:finite(physics.surfaceGrip,s.grip),effectiveBrake:finite(physics.surfaceBrake,s.brake)};
}
