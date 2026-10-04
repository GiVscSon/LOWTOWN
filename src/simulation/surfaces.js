import {onStreetCollection} from '../world/street_corridors.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const inside=(x,y,rect,pad=0)=>x>=rect.x-pad&&x<=rect.x+rect.w+pad&&y>=rect.y-pad&&y<=rect.y+rect.h+pad;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export const SURFACE_TYPES=Object.freeze({
  ROAD:'road', BRIDGE:'bridge', GRAVEL:'gravel', SAND:'sand', GRASS:'grass',
  CURB:'curb', TIMBER:'timber', OFFROAD:'offroad', WATER:'water', DRY:'dry', WET:'wet', OIL:'oil'
});

export const SURFACE_PROFILES=Object.freeze({
  dry:Object.freeze({grip:1,brake:1,drag:1,power:1}),
  wet:Object.freeze({grip:.68,brake:.72,drag:1.04,power:.98}),
  dirt:Object.freeze({grip:.54,brake:.62,drag:1.12,power:.9}),
  sand:Object.freeze({grip:.43,brake:.48,drag:1.22,power:.72}),
  grass:Object.freeze({grip:.42,brake:.5,drag:1.18,power:.82}),
  curb:Object.freeze({grip:.62,brake:.7,drag:1.09,power:.9}),
  timber:Object.freeze({grip:.7,brake:.74,drag:1.08,power:.92}),
  offroad:Object.freeze({grip:.48,brake:.57,drag:1.16,power:.78}),
  oil:Object.freeze({grip:.16,brake:.28,drag:.98,power:1}),
  water:Object.freeze({grip:.01,brake:.08,drag:1.25,power:.15})
});

const SURFACE_ALIASES=Object.freeze({road:'dry',bridge:'dry',asphalt:'dry',tarmac:'dry',gravel:'dirt'});
export function resolveSurface(surface='dry'){
  const raw=String(surface||'dry').toLowerCase(),key=SURFACE_ALIASES[raw]||raw;
  return SURFACE_PROFILES[key]||SURFACE_PROFILES.dry;
}

export function applySurfacePhysics(physics={},surface='dry'){
  const material=resolveSurface(surface);
  return {...physics,
    lateralGrip:Math.max(.01,finite(physics.lateralGrip,1)*material.grip),
    handbrakeGrip:Math.max(.01,finite(physics.handbrakeGrip,1)*material.grip),
    handbrakeSlipGrip:Math.max(.01,finite(physics.handbrakeSlipGrip,1)*material.grip),
    brakeForce:Math.max(0,finite(physics.brakeForce,0)*material.brake),
    friction:Math.max(.05,finite(physics.friction,1)*material.grip),
    drag:Math.max(.001,finite(physics.drag,1)*material.drag),
    handbrakeDrag:Math.max(.001,finite(physics.handbrakeDrag,1)*material.drag),
    engineForce:Math.max(0,finite(physics.engineForce,0)*material.power),
    surfaceGrip:material.grip,
    surfaceBrake:material.brake
  };
}

export function surfaceTelemetry(surface='dry',physics={}){
  const raw=String(surface||'dry').toLowerCase(),material=resolveSurface(raw);
  return {surface:raw,grip:material.grip,brake:material.brake,drag:material.drag,power:material.power,
    effectiveGrip:finite(physics.surfaceGrip,material.grip),
    effectiveBrake:finite(physics.surfaceBrake,material.brake)};
}

const MOVEMENT=Object.freeze({
  road:    {speed:1,    acceleration:1,    steering:1,    slip:.18, coast:.965, demand:0},
  bridge:  {speed:.98,  acceleration:.98,  steering:.96,  slip:.21, coast:.964, demand:0},
  gravel:  {speed:.82,  acceleration:.78,  steering:.92,  slip:.29, coast:.95,  demand:1},
  sand:    {speed:.61,  acceleration:.54,  steering:.76,  slip:.48, coast:.915,demand:1.4},
  grass:   {speed:.68,  acceleration:.62,  steering:.82,  slip:.39, coast:.93, demand:.7},
  curb:    {speed:.75,  acceleration:.68,  steering:.74,  slip:.38, coast:.94, demand:.25},
  timber:  {speed:.70,  acceleration:.60,  steering:.84,  slip:.34, coast:.94, demand:.4},
  offroad: {speed:.72,  acceleration:.64,  steering:.82,  slip:.41, coast:.93, demand:.9},
  water:   {speed:0,    acceleration:0,    steering:0,    slip:1,   coast:.99, demand:0}
});

function nearPath(x,y,road){
  const points=road.points||[];
  for(let i=1;i<points.length;i++){
    const [ax,ay]=points[i-1],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
    const t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
    if(Math.hypot(x-ax-dx*t,y-ay-dy*t)<(road.width||0)/2)return true;
  }
  return false;
}

export function classifySurface(x,y,world={}){
  if(!Number.isFinite(x)||!Number.isFinite(y))return SURFACE_TYPES.WATER;
  const bridges=world.bridges||[],roads=world.roads||[],scenic=world.scenicRoads||[];
  if(onStreetCollection(x,y,bridges))return SURFACE_TYPES.BRIDGE;
  if(onStreetCollection(x,y,roads))return SURFACE_TYPES.ROAD;
  if(scenic.some(r=>!r.footway&&nearPath(x,y,r)))return SURFACE_TYPES.GRAVEL;
  if(onStreetCollection(x,y,roads,12))return SURFACE_TYPES.CURB;
  if((world.piers||[]).some(r=>inside(x,y,r)))return SURFACE_TYPES.TIMBER;
  if(world.beachAt?.(x,y))return SURFACE_TYPES.SAND;
  if((world.parks||[]).some(r=>inside(x,y,r))&&world.landAt?.(x,y))return SURFACE_TYPES.GRASS;
  if(world.landAt?.(x,y))return SURFACE_TYPES.OFFROAD;
  return SURFACE_TYPES.WATER;
}

export function surfaceMovement(surface,vehicle={}){
  const base=MOVEMENT[surface]||MOVEMENT.offroad;
  const capability=clamp(Number(vehicle.offroad)||1,.55,1.5),demand=base.demand;
  const adjustment=(capability-1)*demand;
  return {
    maxSpeed:clamp(base.speed+adjustment*.22,.35,1.12),
    acceleration:clamp(base.acceleration+adjustment*.25,.3,1.15),
    steering:clamp(base.steering+adjustment*.16,.45,1.12),
    slipRetention:clamp(base.slip+(1-capability)*demand*.16,.12,.72),
    tyreGrip:resolveSurface(surface).grip,
    coast:base.coast
  };
}

export function sampleVehicleSurface(x,y,angle,width,height,world={}){
  const c=Math.cos(angle||0),s=Math.sin(angle||0),hx=(width||48)*.34,hy=(height||24)*.42;
  const samples=[[0,0],[hx,hy],[hx,-hy],[-hx,hy],[-hx,-hy]];
  const counts=new Map();
  for(const [lx,ly] of samples){
    const surface=classifySurface(x+lx*c-ly*s,y+lx*s+ly*c,world);
    counts.set(surface,(counts.get(surface)||0)+1);
  }
  return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||SURFACE_TYPES.WATER;
}

export const WEATHER_PRESETS=Object.freeze({
  clear:{label:'Ясно',rain:0,fog:0,wind:.16},
  haze:{label:'Дымка',rain:0,fog:.25,wind:.28},
  rain:{label:'Дождь',rain:.65,fog:.18,wind:.5},
  storm:{label:'Гроза',rain:1,fog:.3,wind:1},
  fog:{label:'Туман',rain:.08,fog:.7,wind:.12}
});
export function createWeather(){
  const weather={kind:'clear',time:0,remaining:150,rain:0,fog:0,wind:.16,wetness:0,gust:0,flash:0};
  weather.set=kind=>{if(!WEATHER_PRESETS[kind])throw new Error('Unknown weather');weather.kind=kind;weather.remaining=150;};
  weather.next=()=>{const kinds=Object.keys(WEATHER_PRESETS);weather.set(kinds[(kinds.indexOf(weather.kind)+1)%kinds.length]);};
  weather.step=dt=>{
    dt=clamp(finite(dt),0,.1);weather.time+=dt;weather.remaining-=dt;if(weather.remaining<=0)weather.next();
    const target=WEATHER_PRESETS[weather.kind],mix=1-Math.exp(-dt*.45);
    for(const key of ['rain','fog','wind'])weather[key]+=(target[key]-weather[key])*mix;
    weather.wetness+=(weather.rain-weather.wetness)*(1-Math.exp(-dt*(weather.rain>weather.wetness?.16:.025)));
    weather.gust=weather.wind*(.65+.25*Math.sin(weather.time*.73)+.1*Math.sin(weather.time*2.1));
    const lightning=weather.kind==='storm'&&Math.sin(weather.time*.23)> .9997;
    weather.flash=lightning?Math.max(weather.flash,.28):Math.max(0,weather.flash-dt*1.4);
    return weather;
  };
  return weather;
}
export function weatherMovement(response,weather){
  const wet=clamp(weather.wetness||0,0,1);
  return {...response,tyreGrip:(response.tyreGrip??1)*(1-wet*.32),slipRetention:Math.min(.72,response.slipRetention+wet*.13),braking:1-wet*.23,
    acceleration:response.acceleration*(1-wet*.04)};
}
