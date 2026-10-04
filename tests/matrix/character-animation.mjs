import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {characterPose,presentedCharacters} from '../../src/render/shared/character_pose.js';
import {advanceCharacterAnimation} from '../../src/simulation/character_animation.js';
import {createCharacterBatch} from '../../src/render/three/characters.js';
import {createFreeRoam} from '../../src/simulation/free_roam.js';
import {runtimeCity} from '../helpers/runtime-city.mjs';

const fixtures={idle:{},walk:{gait:1,walkPhase:1},run:{gait:1,walkPhase:1,runIntent:true},
  'jump-rise':{jumpHeight:12,jumpVelocity:60},'jump-fall':{jumpHeight:12,jumpVelocity:-60},land:{landingRemaining:.11},
  punch:{attackTime:.14,attackSide:1},'bat-swing':{weapon:'bat',attackTime:.14},fire:{weapon:'pistol',shotRemaining:.12,attackTime:.04},
  reload:{weapon:'shotgun',reloadDuration:1.8,reloadRemaining:.9},'weapon-change':{weapon:'pistol',weaponDrawRemaining:.14},
  stagger:{hitFlash:.14},fall:{knockdownTimer:1,fallElapsed:.1},'get-up':{getUpRemaining:.3},
  swim:{inWater:true,gait:1,swimPhase:1},'tread-water':{inWater:true,swimPhase:1},'hands-up':{stance:'handsUp'},treated:{medicalTreated:true},
  coffee:{activity:'coffee'},reading:{activity:'reading'},talking:{activity:'talking'},checkingPhone:{activity:'checkingPhone'},shopping:{activity:'shopping'},
  'enter-vehicle':{transitionAction:'enter-vehicle',gait:1},'exit-vehicle':{transitionAction:'exit-vehicle',gait:1}};
const scene=new THREE.Group(),batch=createCharacterBatch(scene,4),objectCount=scene.children.length,m=new THREE.Matrix4(),report={poses:[],rates:[]};
for(const surface of [0,76,124]){
  batch.update([{x:0,y:0,gait:0}],()=>surface);batch.batches.shoe.getMatrixAt(0,m);
  const vertices=batch.batches.shoe.geometry.attributes.position,point=new THREE.Vector3();let lowest=Infinity;
  for(let i=0;i<vertices.count;i++)lowest=Math.min(lowest,point.fromBufferAttribute(vertices,i).applyMatrix4(m).y);
  assert(lowest>=surface-.05&&lowest<surface+.05,'shoe sole floats above or penetrates the street/bridge deck');
}
for(const [action,fields] of Object.entries(fixtures))for(const time of [0,.2,.7,1.1]){
  const person={x:0,y:0,animationTime:time,...fields},pose=characterPose(person);assert.equal(pose.action,action);
  batch.update([person],()=>0);assert.equal(batch.actions[action],1);assert.equal(scene.children.length,objectCount,'animation allocated another scene object');
  for(const mesh of [...Object.values(batch.batches),...Object.values(batch.held),...Object.values(batch.personal)])for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);assert(m.elements.every(Number.isFinite));assert(Math.abs(m.determinant()-1)<1e-5);}
  if(person.inWater){batch.batches.head.getMatrixAt(0,m);const face=new THREE.Vector3(2,20.8,0).applyMatrix4(m);assert(face.y>-7&&face.y<0,'swimming face must stay above the actual water surface');assert(Math.hypot(face.x-person.x,face.z-person.y)<12,'swimming body moved outside its physical water-ripple footprint');assert.equal(batch.held.pistol.count,0);}
  report.poses.push({action,time});
}
batch.update([{x:0,y:0,activity:'coffee'}],()=>0);assert.equal(batch.personal.cup.count,1);batch.update([{x:0,y:0,gait:1}],()=>0);assert.equal(batch.personal.cup.count,0,'cup persisted after the activity');
batch.update([{x:0,y:0,inWater:true,gait:1,swimPhase:0}],()=>0);batch.batches.hand.getMatrixAt(0,m);const hand=m.elements.slice();batch.update([{x:0,y:0,inWater:true,gait:1,swimPhase:1}],()=>0);batch.batches.hand.getMatrixAt(0,m);assert(m.elements.some((n,i)=>Math.abs(n-hand[i])>.1),'crawl stroke did not move the joints');
const walk=characterPose({gait:1,walkPhase:1}),run=characterPose({gait:1,walkPhase:1,runIntent:true});assert(Math.abs(run.legs[0].upper)>Math.abs(walk.legs[0].upper));
for(const hz of [30,60,120]){
  const person={gait:1,knockdownTimer:1};advanceCharacterAnimation(person,1/hz);assert.equal(person.fallElapsed,0);
  for(let i=0;i<hz/2;i++)advanceCharacterAnimation(person,1/hz);assert(characterPose(person).rootPitch<-1.5);
  person.knockdownTimer=0;advanceCharacterAnimation(person,1/hz);assert.equal(characterPose(person).action,'get-up');
  for(let i=0;i<hz;i++)advanceCharacterAnimation(person,1/hz);assert.equal(person.getUpRemaining,0);assert.equal(characterPose(person).action,'walk');
  report.rates.push({hz,fallAndRecovery:true,clock:person.animationTime});
}
const {runtime}=runtimeCity(731),c=runtime.context;
for(const key of ['buildings','trees','solidProps','breakableProps','parkedCars','trafficCars','policeCars','pedestrians','incidentPoliceCars','incidentResponseVehicles','bridges','allIslands','beachZones'])c[key].length=0;
c.piers=[{x:-200,y:-200,w:800,h:800}];c.bridgeRails.length=0;c.streetLights.length=0;c.ambientVents=[];c.cityIncidentDirector.finish();c.cityIncidentDirector.state.cooldown=999999;c.invalidateScenery();c.invalidateTerrain();c.showToast=()=>{};c.raiseWantedFromCrime=()=>{};
c.roam=createFreeRoam(c.player,c.parkedCars,[],[],c.isPositionOnSolidGround,()=>{},[],()=>false,()=>[],{footSupport:(x,y)=>c.getWalkSurface()(x,y),footBlocked:c.isPedestrianSceneryBlocked});c.roam.fleet.length=0;c.roam.resetToFoot(0,100,0);c.player.hp=100;
Object.keys(c.state.keys).forEach(k=>c.state.keys[k]=false);
c.selectWeapon('pistol');runtime.step(.05);assert.equal(characterPose(c.player).action,'weapon-change');c.player.attackRequested=true;runtime.step(.05);assert.equal(characterPose(c.player).action,'fire');assert.equal(c.player.ammo.pistol,11);
c.reloadWeapon();runtime.step(.05);assert.equal(characterPose(c.player).action,'reload');const reloadPose=characterPose(c.player);
c.state.isMenuOpen=true;const paused=JSON.stringify(c.player),clock=c.effectClock;runtime.step(.1);assert.equal(JSON.stringify(c.player),paused);assert.equal(c.effectClock,clock);assert.deepEqual(characterPose(c.player),reloadPose);c.state.isMenuOpen=false;
for(let i=0;i<30;i++)runtime.step(.05);assert.equal(c.player.ammo.pistol,12);assert.equal(c.player.reloadRemaining,0);
const car={type:'sedan',kind:'land',x:45,y:100,angle:0,width:48,height:24,hp:100};c.parkedCars.push(car);c.roam.interact();assert.equal(c.roam.mode,'sedan');const collider={x:c.player.x,y:c.player.y};runtime.step(.05);const actor=presentedCharacters(c.player,[],false)[0];assert(actor&&actor.transitionAction==='enter-vehicle');assert.deepEqual({x:c.player.x,y:c.player.y},collider,'boarding presentation moved the authoritative vehicle');assert(c.player.doorElapsed>0);
c.state.isMenuOpen=true;const door=c.player.doorElapsed;runtime.step(.1);assert.equal(c.player.doorElapsed,door);c.state.isMenuOpen=false;
for(let i=0;i<15;i++)runtime.step(.05);assert.equal(c.player.visualTransition,null);assert.equal(presentedCharacters(c.player,[],false).length,0);
c.roam.interact();assert.equal(c.roam.mode,'foot');assert.equal(characterPose(c.player).action,'exit-vehicle');for(let i=0;i<15;i++)runtime.step(.05);assert.equal(c.player.visualTransition,null);
report.runtime={reload:true,fire:true,pause:true,boarding:true,exiting:true,sharedMeshes:objectCount};
mkdirSync('artifacts/coastal-weapons',{recursive:true});writeFileSync('artifacts/coastal-weapons/animation-matrix.json',JSON.stringify(report,null,2));console.log('CHARACTER_ANIMATION_MATRIX_OK',JSON.stringify({poses:report.poses.length,rates:report.rates,runtime:report.runtime}));
