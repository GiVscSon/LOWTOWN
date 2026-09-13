import { ISLANDS, isLand } from './islands.js';

const FERRY_ROUTES = [
  // Docks are on the two shores; the sampled middle of the route remains water.
  { id:'LOWTOWN_IRON_FERRY', from:'LOWTOWN', to:'IRON_HARBOR', a:{x:680,y:160}, b:{x:980,y:160}, speed:105 }
];
const AIR_ROUTES = [
  { id:'LOWTOWN_NORTH_AIR', from:'LOWTOWN', to:'NORTH_RIDGE', a:{x:120,y:640}, b:{x:300,y:1360}, speed:420 },
  { id:'LOWTOWN_IRON_AIR', from:'LOWTOWN', to:'IRON_HARBOR', a:{x:120,y:640}, b:{x:1150,y:260}, speed:420 },
  { id:'IRON_NORTH_AIR', from:'IRON_HARBOR', to:'NORTH_RIDGE', a:{x:1850,y:420}, b:{x:300,y:1360}, speed:420 }
];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const islandById=id=>ISLANDS.find(i=>i.id===id)||null;
export function createTransportSystem(){
  const boats=FERRY_ROUTES.map(r=>({route:r,t:0,dir:1,x:r.a.x,y:r.a.y,active:true,trips:0}));
  const planes=AIR_ROUTES.map(r=>({route:r,t:0,dir:1,x:r.a.x,y:r.a.y,active:true,trips:0}));
  const state={boats,planes,boatTrips:0,flightTrips:0};
  function stepVehicle(v,dt){const r=v.route,len=distance(r.a,r.b)||1;v.t+=Math.max(.01,r.speed*dt/len)*v.dir;if(v.t>=1){v.t=1;v.dir=-1;v.trips++;}if(v.t<=0){v.t=0;v.dir=1;}v.x=r.a.x+(r.b.x-r.a.x)*v.t;v.y=r.a.y+(r.b.y-r.a.y)*v.t;}
  function update(dt){for(const b of boats){const old=b.t;stepVehicle(b,dt);if(old>0.98&&b.t<old)state.boatTrips++;}for(const p of planes){const old=p.t;stepVehicle(p,dt);if(old>0.98&&p.t<old)state.flightTrips++;}}
  function draw(ctx,iso,now=0){for(const b of boats){const p=iso(b.x,b.y),r=b.route,a=iso(r.a.x,r.a.y),z=iso(r.b.x,r.b.y);ctx.save();ctx.strokeStyle='rgba(224,154,62,.28)';ctx.lineWidth=2;ctx.setLineDash([8,12]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(z.x,z.y);ctx.stroke();ctx.setLineDash([]);ctx.translate(p.x,p.y);ctx.rotate(-Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)-.15);ctx.fillStyle='#d8d1bd';ctx.fillRect(-12,-5,24,10);ctx.fillStyle='#25282a';ctx.fillRect(-5,-9,10,5);ctx.fillStyle='#d4523a';ctx.fillRect(7,-4,5,3);ctx.restore();}for(const a of planes){const p=iso(a.x,a.y),r=a.route;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)-.15);ctx.fillStyle='#c5c8c8';ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-8,-4);ctx.lineTo(-2,0);ctx.lineTo(-8,4);ctx.closePath();ctx.fill();ctx.fillStyle='#d4523a';ctx.fillRect(-4,-1,6,2);ctx.restore();ctx.strokeStyle='rgba(197,200,200,.14)';ctx.beginPath();ctx.arc(p.x,p.y,13+Math.sin(now*.006)*2,0,Math.PI*2);ctx.stroke();}}
  function connectivity(){return FERRY_ROUTES.map(r=>({id:r.id,from:r.from,to:r.to,endpointsOnLand:isLand(r.a.x,r.a.y)&&isLand(r.b.x,r.b.y),waterSegments:[...Array(9)].every((_,i)=>{const t=(i+1)/10;return !isLand(r.a.x+(r.b.x-r.a.x)*t,r.a.y+(r.b.y-r.a.y)*t);})}));}
  function flightConnectivity(){return AIR_ROUTES.map(r=>({id:r.id,from:r.from,to:r.to,fromValid:!!islandById(r.from),toValid:!!islandById(r.to),airspace:true}));}
  return {state,boats,planes,update,draw,connectivity,flightConnectivity};
}
export { FERRY_ROUTES, AIR_ROUTES };
