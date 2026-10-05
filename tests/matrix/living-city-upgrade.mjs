import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {axleLoads,frictionCapacity} from '../../src/simulation/tyre_forces.js';
import {stepLandVehicle} from '../../src/simulation/vehicle_dynamics.js';
import {createJunctionPriority,approachSignal} from '../../src/simulation/junction_priority.js';
import {roadPath} from '../../src/world/street_network.js';
import {PEOPLE_TYPES,assignPeopleTypes} from '../../src/simulation/people_profiles.js';
import {createCharacterBatch} from '../../src/render/three/characters.js';
import {createFreeRoam} from '../../src/simulation/free_roam.js';
import {runtimeCity} from '../helpers/runtime-city.mjs';
import {tryPit,updatePursuitAir,pursuitAirSees,setRoadblock} from '../../src/simulation/pursuit_tactics.js';
import {installAppAudio} from '../../src/app/audio.js';
const report={rates:[],types:[],priority:false,detour:false,audio:false,pit:false};
const config={mass:1500,wheelbase:3.2,track:1.6,cgHeight:.55,frontShare:.54};
const idle=axleLoads(config),accel=axleLoads(config,4,3),brake=axleLoads(config,-6,-3);
assert(accel.front<idle.front&&brake.front>idle.front);assert(accel.frontLeft<accel.frontRight);assert.equal(accel.front+accel.rear,idle.weight);
assert.equal(frictionCapacity(1000,1000,1),0);
for(const hz of [30,60,120]){
 const car={x:0,y:0,angle:0,speed:0,vx:0,vy:0,width:48,height:24,mass:1500};
 for(let i=0;i<hz*2;i++)stepLandVehicle(car,{up:true},1/hz,{max:7.2,accel:.022,width:48},{tyreGrip:1});
 const travelled=car.x;assert(travelled>60&&car.tyres.front<car.tyres.weight*.54);
 for(let i=0;i<hz;i++)stepLandVehicle(car,{up:true,right:true},1/hz,{max:7.2,accel:.022,width:48},{tyreGrip:1});
 assert(car.angle>.05&&car.y>0,'throttle must not remove all steering authority');
 assert(Object.values(car.tyres).every(Number.isFinite));assert(Math.abs(car.tyres.frontForce)<=car.tyres.frontCapacity+.001);
 const before=car.speed;for(let i=0;i<hz*3;i++)stepLandVehicle(car,{down:true},1/hz,{}, {tyreGrip:1});assert(car.speed<before);
 report.rates.push({hz,travelled,angle:car.angle,tyres:car.tyres});
}
for(const mu of [.2,.65,1]){const car={x:0,y:0,angle:0,speed:0,width:48,height:24};for(let i=0;i<120;i++)stepLandVehicle(car,{up:true},1/60,{}, {tyreGrip:mu});assert(car.x>5,'low grip must still allow a vehicle to start moving');assert(car.tyres.mu===mu);}
assert(Math.max(...report.rates.map(r=>r.travelled))-Math.min(...report.rates.map(r=>r.travelled))<1);
const j={cx:0,cy:0,w:100,h:100},paint={junctions:[j],signals:[]};
const controller=createJunctionPriority(paint),west={x:-105,y:0,angle:0,width:48,speed:1},south={x:0,y:105,angle:-Math.PI/2,width:48,speed:1};
controller.update([west,south],1/60);assert(west.priorityStop&&!south.priorityStop,'yield to vehicle on the right');
south.y=-180;controller.update([west,south],1/60);assert(!west.priorityStop);report.priority=true;
const band={cx:-100,cy:0,ux:-1,uy:0,width:100,length:32,approach:[{x:0,y:0}]};
const signalPaint={signals:[j],crossings:[band]};assert(Number.isFinite(approachSignal({x:-180,y:20,angle:0,width:48,speed:2},signalPaint,()=> 'red')));
assert.equal(approachSignal({x:-80,y:20,angle:0,width:48,speed:2},signalPaint,()=> 'red'),Infinity,'do not stop inside junction');
assert.equal(approachSignal({x:-180,y:20,angle:0,width:48,speed:2},signalPaint,()=> 'green'),Infinity);
const graph=[{x:0,y:0,edges:new Set([1,2])},{x:100,y:0,edges:new Set([0,3])},{x:0,y:100,edges:new Set([0,3])},{x:100,y:100,edges:new Set([1,2])}];
assert.deepEqual(roadPath(graph,graph[0],graph[1],{edgeClear:(a,b)=>!(a.y===0&&b.y===0)}),[graph[0],graph[2],graph[3],graph[1]].map(({x,y})=>({x,y})));report.detour=true;
const people=Array.from({length:64},(_,i)=>({x:i*40,y:0}));assignPeopleTypes(people);assert.equal(new Set(people.map(p=>p.personType)).size,8);assert(people.filter(p=>p.weapon).length<people.length/4);assert(PEOPLE_TYPES.elderly.pace<PEOPLE_TYPES.jogger.pace);
const scene=new THREE.Scene(),models=createCharacterBatch(scene,100);const objects=scene.children.length;
for(const p of people)models.update([p],()=>76);assert.equal(scene.children.length,objects);models.update(people,()=>0);
assert(models.accessories.hardhat.count>0&&models.accessories.glasses.count>0&&models.accessories.backpack.count>0&&models.accessories.scarf.count>0);report.types=Object.keys(PEOPLE_TYPES);
const {runtime}=runtimeCity(42),ctx=runtime.context;assert.equal(new Set(ctx.pedestrians.map(p=>p.personType)).size,8);
const originalGraph=ctx.roadGraph;ctx.roadGraph=graph;const detourCar={x:0,y:0,angle:0,width:24,height:12,routeManaged:true,routeIndex:0,route:{points:graph.slice(0,2).concat(graph[3]).map(({x,y})=>({x,y}))}};ctx.planTrafficDetour(detourCar,[{x:50,y:0,width:24,height:12,speed:0}],1/60);assert.deepEqual(detourCar.detourRoute.points,[{x:0,y:0},{x:0,y:100},{x:100,y:100}]);ctx.roadGraph=originalGraph;
ctx.roam=createFreeRoam(ctx.player,[],[],[],()=>true,()=>{},[],()=>false,()=>[],{footSupport:()=>true,footBlocked:()=>false});ctx.roam.fleet.length=0;ctx.roam.resetToFoot(0,0,0);for(const list of ['buildings','trees','solidProps','parkedCars','policeCars','trafficCars','pedestrians'])ctx[list].length=0;ctx.invalidateScenery();ctx.isPositionOnSolidGround=()=>true;ctx.getWalkSurface=()=>()=>true;
const victim={x:60,y:0,width:9,height:9,hp:20,personType:'resident'};ctx.pedestrians.push(victim);ctx.selectWeapon('pistol');ctx.player.attackRequested=true;ctx.stepCharacterActions(1/60,{});assert(victim.dead&&victim.hp===0);assert(ctx.cityIncidentDirector.current().fatal);for(let i=0;i<300;i++)ctx.updatePedestrians(1/60);assert(victim.dead&&victim.stance==='down','fatal victim must not stand up after knockdown');
const pitPlayer={x:0,y:0,angle:0,speed:4,vx:4,vy:0,width:48,height:24,hp:100,mass:1500};const cop={x:-25,y:22,angle:0,speed:4,width:48,height:24,tactic:'pit'};
const pitCtx={player:pitPlayer,roam:{mode:'sedan',altitude:0},surfaceAt:()=> 'road',effects:{burst(){}},sound:{playImpact(){}}};assert(tryPit(pitCtx,cop,1/60));assert(pitPlayer.hp<100&&Math.abs(pitPlayer.angularVelocity)>0);assert(!tryPit(pitCtx,cop,1/60));report.pit=true;
const blockCtx={state:{wanted:4},breakableProps:[{type:'bench'}],isPositionOnSolidGround:()=>true,policeFootprintOnRoad:()=>true},blockCop={x:0,y:0,angle:0};setRoadblock(blockCtx,blockCop,true);assert.equal(blockCtx.breakableProps.length,3);setRoadblock(blockCtx,blockCop,false);assert.equal(blockCtx.breakableProps.length,1);
ctx.state.wanted=3;updatePursuitAir(ctx,1/60);assert(ctx.pursuitAirUnit?.altitude===180);ctx.pursuitAirUnit.x=0;ctx.pursuitAirUnit.y=100;ctx.pursuitAirUnit.searchTarget={x:0,y:0};assert(pursuitAirSees(ctx));ctx.player.x=200;assert(!pursuitAirSees(ctx),'escaping the cone must break air observation');ctx.state.wanted=0;updatePursuitAir(ctx,1/60);assert.equal(ctx.pursuitAirUnit,null);
// Actual scheduled envelopes, station switching and resume, without bypassing gain.
const timers=new Map();let timer=0,notes=[];
const param=()=>({value:0,setValueAtTime(v,t){this.value=v;notes.push({v,t});},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(){}});
class Audio {constructor(){this.state='running';this.currentTime=0;this.destination={};}createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){},stop(){},type:'sine'};}createGain(){return {gain:param(),connect(){},disconnect(){}};}createBiquadFilter(){return {frequency:param(),connect(){}};}resume(){this.state='running';return Promise.resolve();}}
const audioCtx={env:{Math,window:{AudioContext:Audio},localStorage:{getItem(){return null;},setItem(){}},setInterval(fn){timers.set(++timer,fn);return timer;},clearInterval(id){timers.delete(id);}}};installAppAudio(audioCtx);const music=new audioCtx.SynthAudio();music.init();assert.equal(music.stationIdx,1);assert.equal(music.radioGain.gain.value,.65);assert(music.voices.size>=4&&music.voices.size<=48);music.setStation(2);assert.equal(timers.size,1);music.setPaused(true);assert.equal(music.masterGain.gain.value,0);music.setPaused(false);assert(music.masterGain.gain.value>0);music.setStation(0);assert.equal(timers.size,0);assert.equal(music.voices.size,0);report.audio=true;
mkdirSync('artifacts/living-city-1.1',{recursive:true});writeFileSync('artifacts/living-city-1.1/matrix.json',JSON.stringify(report,null,2));console.log('LIVING_CITY_UPGRADE_MATRIX_OK',JSON.stringify(report));
