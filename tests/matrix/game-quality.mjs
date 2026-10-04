import './simulation-clock.mjs';
import './night-detail.mjs';
import './frame-watchdog.mjs';
import './visual-polish.mjs';
import './interaction-world.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {runtimeCity} from '../helpers/runtime-city.mjs';
import {createWalkSurface} from '../../src/world/walk_surface.js';
import {createFreeRoam} from '../../src/simulation/free_roam.js';
import {captureMotion,contact,chassis} from '../../src/simulation/solid_contacts.js';
import {createTransportVisual,updateTransportVisual,disposeTransportVisual} from '../../src/render/three/vehicles.js';
import {createViewportSizer,changeGraphics,loadGraphics,DEFAULT_GRAPHICS} from '../../src/render/three/graphics_settings.js';
import {createLifetime} from '../../src/runtime/lifetime.js';
const report={contacts:[],terrain:[],animations:0,resolutions:0,lifetime:false};
const {runtime}=runtimeCity(731),c=runtime.context;
for(const hz of [30,60,120])for(const kind of ['wall','tree','bench','hydrant','dumpster','person','parkedCar','movingCar']){
  for(const name of ['buildings','trees','solidProps','breakableProps','parkedCars','trafficCars','pedestrians','policeCars','incidentPoliceCars','incidentResponseVehicles'])c[name].length=0;
  c.cityIncidentDirector.state.cooldown=999999;
  const notices=[];c.showToast=message=>notices.push(message);c.sound.playImpact=()=>{};
  c.roam=createFreeRoam(c.player,c.parkedCars,c.buildings,c.trees,c.isPositionOnSolidGround,()=>{},c.solidProps,c.isPositionOnWaterObstacle,()=>[],{footSupport:(x,y)=>c.getWalkSurface()(x,y),footBlocked:c.isPedestrianSceneryBlocked});c.roam.fleet.length=0;
  c.roam.resetToFoot(1600,1200);Object.assign(c.player,{hp:100,hitCooldown:0,stance:null,knockdownTimer:0});
  const target={x:1630,y:1200,angle:0,width:14,height:14,hp:100,speed:0,mass:1500};
  if(kind==='wall')c.buildings.push({x:1623,y:1193,w:14,h:14});
  if(kind==='tree')c.trees.push(target);
  if(kind==='bench')c.solidProps.push({...target,type:'bench'});
  if(kind==='hydrant')c.breakableProps.push({...target,type:'hydrant',intact:true});
  if(kind==='dumpster')c.breakableProps.push({...target,type:'dumpster',intact:true,mass:130});
  if(kind==='person')c.pedestrians.push({...target,heading:0});
  if(kind==='parkedCar')c.parkedCars.push({...target,type:'sedan',width:48,height:24});
  if(kind==='movingCar')c.trafficCars.push({...target,x:1560,type:'sedan',width:48,height:24,speed:8,vx:8,vy:0});
  c.invalidateScenery();
  for(let i=0;i<hz/2;i++){
    const starts=captureMotion(c.cityCollisionBodies());
    if(kind==='movingCar')c.trafficCars[0].x+=8*60/hz;
    else c.player.x+=2.4*60/hz;
    c.resolveCityMotion(starts,1/hz);
  }
  if(kind==='movingCar'){assert(c.player.hp<100,`${hz}: actual moving vehicle failed to injure`);assert(c.player.knockdownTimer>0);assert(notices.some(s=>s.includes('Вас сбила машина')));}
  else {assert.equal(c.player.hp,100,`${hz}/${kind}: false injury`);assert(!c.player.knockdownTimer,`${hz}/${kind}: false knockdown`);assert(!notices.some(s=>s.includes('Вас сбила машина')));}
  if(kind==='parkedCar')assert(!contact(chassis(c.player),chassis(c.parkedCars[0])));
  report.contacts.push({hz,kind,hp:c.player.hp,knockdown:!!c.player.knockdownTimer});
}
// A narrow deck has no inherited car margin; foot movement is swept even at 30 Hz.
for(const hz of [30,60,120])for(const terrain of ['pier','bridge']){
  const deck={x:0,y:0,w:90,h:90},surface=createWalkSurface(terrain==='pier'?{piers:[deck]}:{bridges:[deck]});
  assert(surface(45,45));assert(!surface(88,45));assert(!surface(94,45));
  const person={x:45,y:45,hp:100},roam=createFreeRoam(person,[],[],[],(x,y)=>surface(x,y,0),()=>{},[],()=>false,()=>[],{footSupport:surface});roam.fleet.length=0;roam.resetToFoot();
  for(let i=0;i<hz;i++){roam.step({down:true},1/hz);assert(surface(person.x,person.y),`${terrain}/${hz}: walked off support`);}
  roam.resetToFoot(99999,99999);assert(surface(person.x,person.y),'invalid saved position must recover to known ground');
  report.terrain.push({hz,terrain,position:[person.x,person.y]});
}
const models=['sedan','coupe','sports','wagon','taxi','van','bus','truck','bike','police','armoredPolice','nationalGuard','fireEngine','ambulance'];
for(const type of models)for(const rain of [0,.8])for(const hp of [100,80,50,30])for(const side of [-1,1])for(const hz of [30,60,120]){
  const vehicle={type,width:type==='bus'?96:48,height:24,color:'#863a45',x:0,y:0,angle:0,speed:4,steeringAngle:.2,hp,damage:{front:1,left:.6,right:.6},doorActionAt:0,doorSide:side};
  const group=createTransportVisual(vehicle),neighbor=createTransportVisual({...vehicle,hp:100}),state=group.userData.animation;
  const base=neighbor.userData.animation.body.geometry,original=base.attributes.position.array.slice();
  updateTransportVisual(group,vehicle,.75,0,{rain});vehicle.x+=4*60/hz;updateTransportVisual(group,vehicle,.8,0,{rain});
  assert.equal(state.stage,hp>=85?0:hp>=65?1:hp>=40?2:3);assert.deepEqual(base.attributes.position.array,original,'damage changed another vehicle');
  if(hp<85)assert.notEqual(state.body.geometry,base);else assert.equal(state.body.geometry,base);
  const doors=state.components.filter(p=>p.part.type==='door');if(doors.length){assert(doors.find(d=>d.part.side===side).pivotGroup.rotation.y*side>.9);assert(doors.find(d=>d.part.side===-side).pivotGroup.rotation.y===0);}
  assert(state.components.filter(p=>p.part.type==='wheel').every(p=>Math.abs(p.pivotGroup.rotation.z)>0));
  if(state.wipers){const wet=state.wipers.geometry.attributes.position.array.slice();updateTransportVisual(group,vehicle,.95,0,{rain});assert.equal(wet.some((v,i)=>v!==state.wipers.geometry.attributes.position.array[i]),rain>0);}
  group.traverse(object=>{if(object.geometry)for(const v of object.geometry.attributes.position.array)assert(Number.isFinite(v));});
  updateTransportVisual(group,{...vehicle,hp:100,damage:undefined,doorActionAt:undefined},3,0,{rain:0});assert.equal(state.body.geometry,base);assert(state.components.filter(p=>p.part.type==='door').every(p=>p.pivotGroup.rotation.y===0));assert.equal(state.smoke.visible,false);
  disposeTransportVisual(group);disposeTransportVisual(neighbor);report.animations++;
}
for(const hardwareDpr of [1,1.25,2,3])for(const width of [390,390.5,1280])for(const resolution of [.75,1,1.25,1.5,2]){
  let calls=0;const fake={setDrawingBufferSize(w,h,ratio){calls++;assert.equal(ratio,resolution);}},camera={updateProjectionMatrix(){}};
  const sizer=createViewportSizer(fake,camera);for(let frame=0;frame<120;frame++)sizer.update(width,844.5,resolution);
  assert.equal(calls,1,`${hardwareDpr}/${width}/${resolution}: framebuffer reallocates every frame`);assert.equal(sizer.resizes,1);report.resolutions++;
}
const storage={value:null,getItem(){return this.value;},setItem(_,v){this.value=v;}};
const selected=changeGraphics(DEFAULT_GRAPHICS,{resolution:2,lighting:'simple',fps:30},storage);assert.deepEqual(loadGraphics(storage),selected);assert.equal(changeGraphics(selected,{preset:'high'},storage).resolution,2);
const listeners=new Map(),cancelled=[],target={addEventListener(t,f){listeners.set(t,f);},removeEventListener(t){listeners.delete(t);}},env={requestAnimationFrame:()=>17,setTimeout:()=>23,setInterval:()=>29,cancelAnimationFrame:id=>cancelled.push(id),clearTimeout:id=>cancelled.push(id),clearInterval:id=>cancelled.push(id)};
const lifetime=createLifetime(env);lifetime.listen(target,'keydown',()=>{});env.requestAnimationFrame(()=>{});env.setTimeout(()=>{},1);env.setInterval(()=>{},1);lifetime.dispose();lifetime.dispose();assert.equal(listeners.size,0);assert.deepEqual(cancelled,[17,23,29]);assert.equal(env.requestAnimationFrame(()=>{}),0);report.lifetime=true;
mkdirSync('artifacts/quality-matrix',{recursive:true});writeFileSync('artifacts/quality-matrix/unit.json',JSON.stringify(report,null,2));
console.log('GAME_QUALITY_MATRIX_OK',JSON.stringify({contacts:report.contacts.length,terrain:report.terrain.length,animations:report.animations,resolutions:report.resolutions,lifetime:report.lifetime}));
