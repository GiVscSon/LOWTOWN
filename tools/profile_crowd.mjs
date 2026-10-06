import {runtimeCity} from '../tests/helpers/runtime-city.mjs';
import {createFreeRoam} from '../src/simulation/free_roam.js';
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
const results=[];
for(const mode of ['idle','walk','crowd']){
 const {runtime}=runtimeCity(731),c=runtime.context;
 c.roam=createFreeRoam(c.player,c.parkedCars,c.buildings,c.trees,c.isPositionOnSolidGround,()=>{},c.solidProps,c.isPositionOnWaterObstacle,()=>[],{footSupport:(x,y)=>c.getWalkSurface()(x,y),footBlocked:c.isPedestrianSceneryBlocked});
 c.cityIncidentDirector.state.cooldown=999999;
 if(mode!=='idle'){
  const p=c.pedestrians.find(p=>p.route&&p.x>0&&!c.isPedestrianSceneryBlocked(p.x,p.y));c.roam.resetToFoot(p.x-20,p.y,p.heading||0);c.state.keys.up=true;
  if(mode==='crowd')for(let i=0;i<16;i++){const q=c.pedestrians[i],x=p.x+(i%4-2)*12,y=p.y+(Math.floor(i/4)-2)*12;if(!c.isPedestrianSceneryBlocked(x,y))Object.assign(q,{x,y,pause:0,activityRemaining:0});}
 }
 for(let i=0;i<15;i++)runtime.step(1/60);
 const timings={},names=['resolveCityMotion','updatePedestrians','isPedestrianBlocked','isPedestrianSceneryBlocked','getCityScenery','getWalkSurface','updateJunctionPriority','trafficMustStopAtSignal','updatePoliceAI','stepWaterInteraction','stepWorldEffects','surfaceAt','updateIncidentResponse','movePedestrian'];
 for(const name of names){const fn=c[name];if(typeof fn!=='function')continue;const result=timings[name]={calls:0,ms:0};c[name]=function(...a){const start=performance.now();try{return fn.apply(this,a);}finally{result.calls++;result.ms+=performance.now()-start;}};}
 const costs=[];for(let i=0;i<120;i++){const t=performance.now();runtime.step(1/60);costs.push(performance.now()-t);}
 costs.sort((a,b)=>a-b);const value={mode,bodies:c.physicsStats,people:c.pedestrians.length,median:costs[60],p95:costs[114],total:costs.reduce((a,b)=>a+b,0),timings};results.push(value);console.log(JSON.stringify(value));runtime.stop();
}
mkdirSync('artifacts/crowd-performance',{recursive:true});writeFileSync('artifacts/crowd-performance/'+(process.env.LOWTOWN_PROFILE_LABEL||'baseline')+'.json',JSON.stringify(results,null,2));
