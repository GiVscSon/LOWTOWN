import assert from 'node:assert/strict';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {createWeather,weatherMovement,surfaceMovement,WEATHER_PRESETS} from '../src/game/surface_physics.js';
import {roofEquipment} from '../src/game/architecture.js';
const weather=createWeather();
for(const kind of Object.keys(WEATHER_PRESETS)){
 weather.set(kind);for(let i=0;i<1200;i++)weather.step(1/60);
 assert(Math.abs(weather.rain-WEATHER_PRESETS[kind].rain)<.001);assert(Number.isFinite(weather.gust));
}
weather.set('storm');for(let i=0;i<1200;i++)weather.step(1/60);
const wet=weatherMovement(surfaceMovement('road'),weather);assert(wet.braking<.85&&wet.slipRetention>.25);
for(const [w,h] of [[68,36],[120,55],[180,70],[700,300]])for(const unit of roofEquipment({x:0,y:0,w,h})){assert(unit.x-unit.lift>=0&&unit.y-unit.lift>=0&&unit.x+unit.w<=w&&unit.y+unit.h<=h,'rooftop equipment escapes its supporting roof');}
const {run}=runtimeCity(73);
// Drive the actual live controller in BOTH directions on every motor bridge and
// every non-service street, without using the in-game AutoTest button or route.
// Each street is isolated from transient traffic, so a stopped NPC is not
// mistaken for a permanent defect in road geometry. Services have populated tests.
const report=JSON.parse(run(`JSON.stringify((()=>{
 trafficCars.length=0;parkedCars.length=0;pedestrians.length=0;policeCars.length=0;incidentPoliceCars.length=0;incidentResponseVehicles.length=0;
 cityIncidentDirector.state.cooldown=99999;weather.set('clear');weather.remaining=1e9;
 roam=createFreeRoam(player,parkedCars,buildings,trees,isPositionOnSolidGround,()=>{},solidProps,isPositionOnWaterObstacle);roam.fleet.length=0;
 const segments=[...roads.filter(r=>!r.serviceAccess),...bridges.filter(b=>!b.footway)],districts=new Set(),failures=[];let distance=0,runs=0;
 for(const r of segments)for(const sign of [1,-1]){
  let points=streetPoints(r).map(([x,y])=>({x,y}));if(sign<0)points.reverse();
  const first=points[0],second=points[1],last=points.at(-1),penultimate=points.at(-2);
  const heading=Math.atan2(second.y-first.y,second.x-first.x),endHeading=Math.atan2(last.y-penultimate.y,last.x-penultimate.x);
  const from={x:first.x+Math.cos(heading)*30,y:first.y+Math.sin(heading)*30};
  const to={x:last.x-Math.cos(endHeading)*30,y:last.y-Math.sin(endHeading)*30};
  points[0]=from;points[points.length-1]=to;
  roam.resetToSedan(from.x,from.y,heading);player.hp=100;
  state.wanted=0;state.invulnTimer=999999;Object.keys(state.keys).forEach(k=>state.keys[k]=false);
  let stuck=0,ticks=0,index=1;
  while(Math.hypot(to.x-player.x,to.y-player.y)>12&&ticks<5000){
   while(index<points.length-1&&Math.hypot(points[index].x-player.x,points[index].y-player.y)<40)index++;
   const target=points[index],desired=Math.atan2(target.y-player.y,target.x-player.x);
   const error=Math.atan2(Math.sin(desired-player.angle),Math.cos(desired-player.angle));
   state.keys.right=error>.012;state.keys.left=error<-.012;
   // Follow curves at a modest speed through the real steering/brake inputs.
   state.keys.up=Math.abs(player.speed)<2.4;state.keys.down=Math.abs(player.speed)>2.7;
   const old={x:player.x,y:player.y};updatePhysics(1/30);ticks++;
   const moved=Math.hypot(player.x-old.x,player.y-old.y);distance+=moved;stuck=moved<.05?stuck+1:0;
   for(const island of islands)if(player.x>=island.x&&player.x<=island.x+island.w&&player.y>=island.y&&player.y<=island.y+island.h)districts.add(island.id);
   if(stuck>60||state.isDrowning||player.hp<100){failures.push({name:r.name||r.id,x:player.x,y:player.y,from,to,stuck,drowning:state.isDrowning,hp:player.hp});break;}
  }
  if(ticks>=5000)failures.push({name:r.name||r.id,timeout:true});runs++;
 }
 state.keys.up=false;
 const release=policeStationRelease(1200,1200),path=release?.exitPath;
 return {segments:segments.length,runs,districts:[...districts],distance,failures,releasePath:path?.length,releaseReachesStreet:path?.length&&onRoadSurface(path.at(-1).x,path.at(-1).y,roads,bridges,scenicRoads,roadEnds)};
})())`));
assert.equal(report.failures.length,0,JSON.stringify(report.failures.slice(0,8)));assert.equal(report.districts.length,16);assert(report.runs>=200);assert(report.releaseReachesStreet);
console.log('PASS: live driving across every motor bridge/street in both directions, all 16 islands, reachable precinct exit and bounded roof equipment',JSON.stringify(report));
