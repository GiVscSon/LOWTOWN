import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {runtimeCity} from '../helpers/runtime-city.mjs';
import {createFreeRoam} from '../../src/simulation/free_roam.js';
import {bridgeRailBodies,bridgeRailOpenAt} from '../../src/world/bridge_rails.js';
import {createBridgeProfiles} from '../../src/render/three/bridges.js';
import {characterGeometries,createCharacterBatch,characterBaseHeight} from '../../src/render/three/characters.js';
import {WEAPONS,weaponRay} from '../../src/simulation/weapons.js';
import {streetPropGeometry} from '../../src/render/three/props.js';
import {captureMotion} from '../../src/simulation/solid_contacts.js';

const {runtime}=runtimeCity(731),c=runtime.context,report={water:[],weapons:[],bridges:[],beaches:{},models:{}};
assert.equal(c.beachZones.length,3);assert.equal(c.pedestrians.filter(p=>p.beachRoute).length,30);
assert(c.pedestrians.filter(p=>p.beachRoute).every(p=>Number.isFinite(p.visualScale)&&p.route.points.length>=5&&p.route.points===p.beachRoute));
assert(c.bridgeRails.every(r=>r.footway),'obsolete motor bridge rail survived organic remapping');
for(const beach of c.beachZones){assert(beach.w>=800&&beach.h>=300);assert(c.getWalkSurface()(beach.x+beach.w/2,beach.y+beach.h/2));}
report.beaches={count:3,residents:30,swimmers:c.pedestrians.filter(p=>p.waterIntent).length};
const dynamicTypes=['bench','bin','phone','bollard','planter','bikeRack','mailbox','parasol'];
for(const type of dynamicTypes){assert(!c.solidProps.some(p=>p.type===type&&Math.max(p.width||16,p.height||16)<=80));assert(c.breakableProps.some(p=>p.type===type&&p.movable),type+': small street object is fixed');}
assert(c.breakableProps.filter(p=>p.type==='hydrant').every(p=>p.movable));
const originalPaths=c.buildRoadPaintGeometry().bridgePaths;
for(const path of originalPaths){
  const profile=createBridgeProfiles([path])[0],rails=bridgeRailBodies([path]);assert(rails.length>0&&rails.length<=(profile.samples.length-1)*2);
  for(const rail of rails){
    const i=rail.sampleIndex,side=rail.side,a=profile.samples[i],b=profile.samples[i+1],offset=side*(profile.width/2-2);
    const x=(a.point.x-a.tangent.y*offset+b.point.x-b.tangent.y*offset)/2,y=(a.point.y+a.tangent.x*offset+b.point.y+b.tangent.x*offset)/2;
    assert(Math.hypot(rail.x-x,rail.y-y)<1e-6,'solid parapet differs from visible bridge edge');
    assert(!bridgeRailOpenAt(profile,x,y),'a road entrance is walled off');
    assert(!c.emergencyPassingGroundClear({...rail,width:48,height:24}),'passing planner ignores a parapet');
  }
  report.bridges.push({id:path.id,segments:rails.length});
}
function scene(){
  for(const key of ['buildings','trees','solidProps','breakableProps','parkedCars','trafficCars','policeCars','pedestrians','incidentPoliceCars','incidentResponseVehicles','bridges','allIslands','beachZones'])c[key].length=0;
  c.streetLights.length=0;c.bridgeRails.length=0;c.piers=[{x:-200,y:0,w:400,h:200}];c.cityIncidentDirector.finish();c.cityIncidentDirector.state.cooldown=999999;c.invalidateScenery();c.invalidateTerrain();c.burningBodies.clear();
  c.roam=createFreeRoam(c.player,[],[],[],c.isPositionOnSolidGround,()=>{},[],()=>false,()=>c.cityCollisionBodies().filter(p=>p!==c.player),{footSupport:(x,y)=>c.getWalkSurface()(x,y),footBlocked:c.isPedestrianSceneryBlocked});c.roam.fleet.length=0;
  c.roam.resetToFoot(0,100,0);Object.assign(c.player,{hp:100,weapon:'fists',weaponCooldown:0,reloadRemaining:0,ammo:{},waterSafe:null});
  Object.keys(c.state.keys).forEach(key=>c.state.keys[key]=false);c.state.isMenuOpen=false;c.showToast=()=>{};c.raiseWantedFromCrime=()=>{};c.ambientVents=[];
}
for(const hz of [30,60,120]){
  scene();const beachWalker={x:150,y:100,width:9,height:9,hp:100,beachRoute:[{x:150,y:100},{x:185,y:100}],beachRouteIndex:1,knockdownTimer:1,stance:'down'};c.pedestrians.push(beachWalker);for(let i=0;i<hz*2;i++)runtime.step(1/hz);assert.equal(beachWalker.knockdownTimer,0);assert.notEqual(beachWalker.stance,'down');assert(beachWalker.x>160,'beach resident did not recover movement after a collision');
  scene();c.roam.resetToFoot(190,100);c.state.keys.right=true;
  for(let i=0;i<hz;i++)runtime.step(1/hz);
  assert(c.player.inWater&&c.player.x>210,'shore movement was blocked or instantly snapped back');assert.equal(c.player.jumpHeight,0);assert(c.player.swimPhase>0);assert(c.effects.particles.some(p=>p.life>0&&p.kind==='ripple'&&p.baseY===-7));
  const x=c.player.x;c.state.keys.right=false;c.state.keys.left=true;for(let i=0;i<hz*2;i++)runtime.step(1/hz);
  assert(c.player.x<x);assert(!c.player.inWater,'swimmer could not return to shore');assert.equal(c.player.hp,100);
  c.roam.resetToFoot(190,100);c.state.keys.left=false;c.state.keys.right=true;c.state.keys.handbrake=true;for(let i=0;i<hz;i++)runtime.step(1/hz);assert(c.player.inWater);assert.equal(c.player.jumpHeight,0,'airborne water crossing did not splash on landing');
  const frozen=c.player.waterTime;c.state.isMenuOpen=true;runtime.step(1);assert.equal(c.player.waterTime,frozen);c.state.isMenuOpen=false;
  const swimmer={x:230,y:90,width:9,height:9,hp:100,waterSafe:{x:150,y:90},weapon:'pistol'};c.pedestrians.push(swimmer);for(let i=0;i<hz*4;i++)runtime.step(1/hz);assert(!swimmer.inWater);assert(swimmer.x<200,'NPC swimmer stayed beyond shore');
  report.water.push({hz,entry:true,return:true,npcReturn:true,pause:true});
  scene();const path={id:'test',organic:true,width:100,path:[{x:0,y:100},{x:500,y:100}]};c.piers=[{x:0,y:50,w:500,h:100}];c.bridges=[{points:[[0,100],[500,100]],width:100}];c.invalidateScenery();c.invalidateTerrain();c.roam.resetToFoot(250,100);c.player.jumpHeight=22;
  for(let i=0;i<hz;i++){const starts=captureMotion(c.cityCollisionBodies());c.player.y-=180/hz;c.resolveCityMotion(starts,1/hz);}
  assert(c.player.y>55,'jump bypassed a visible parapet');assert(c.getWalkSurface()(c.player.x,c.player.y,0));
  for(const id of ['bat','pistol','shotgun','flare']){
    scene();const target={type:'sedan',x:34,y:100,width:24,height:24,angle:0,hp:100,mass:1500,speed:id==='pistol'?2:0};c.parkedCars.push(target);c.selectWeapon(id);
    c.player.attackRequested=true;for(let n=0;n<Math.ceil(hz*.2);n++)c.stepCharacterActions(1/hz,{});
    assert(target.hp<100,id+': missing damage');assert(target.damage,id+': missing panel damage');
    if(id==='flare')assert.equal(c.cityIncidentDirector.current()?.kind,'fire');
    if(id==='pistol')assert.equal(c.cityIncidentDirector.current()?.kind,'crash');
    if(WEAPONS[id].capacity){assert.equal(c.player.ammo[id],WEAPONS[id].capacity-1);c.reloadWeapon();for(let n=0;n<hz*2;n++)c.stepCharacterActions(1/hz,{});assert.equal(c.player.ammo[id],WEAPONS[id].capacity);}
    report.weapons.push({hz,id,hp:target.hp,incident:c.cityIncidentDirector.current()?.kind||null});
  }
  scene();c.buildings.push({x:10,y:90,w:6,h:20,floors:4});const person={x:40,y:100,width:9,height:9,hp:100};c.pedestrians.push(person);c.invalidateScenery();c.selectWeapon('pistol');c.player.attackRequested=true;c.stepCharacterActions(1/hz,{});assert.equal(person.hp,100,'bullet passed through a wall');assert(weaponRay(c,c.player,0,600).fixed);
  scene();const npc={x:80,y:100,width:9,height:9,hp:100,weapon:'pistol',provokedTimer:2};c.pedestrians.push(npc);for(let i=0;i<hz;i++)c.stepCharacterActions(1/hz,{});assert(c.player.hp<100,'armed NPC never reacted');
  for(const type of dynamicTypes){scene();const prop={type,x:24,y:100,width:16,height:16,mass:40,movable:true,intact:true,hp:90};c.breakableProps.push(prop);c.player.attackRequested=true;for(let i=0;i<Math.ceil(hz*.3);i++)runtime.step(1/hz);assert(prop.x>24&&prop.hp<90,type+': dynamic street prop did not react');}
}
const batches=createCharacterBatch(new THREE.Group(),4);batches.update([{x:0,y:0,inWater:true,swimPhase:1,skin:'#bf916b',weapon:'pistol'}],()=>0);assert.equal(batches.held.pistol.count,0);assert(characterBaseHeight({inWater:true,swimPhase:1})<-25);const m=new THREE.Matrix4();batches.batches.hand.getMatrixAt(1,m);assert(m.elements.every(Number.isFinite));
batches.update([{x:0,y:0,weapon:'shotgun'}],()=>0);assert.equal(batches.held.shotgun.count,1);
for(const [name,g] of Object.entries(characterGeometries())){assert(g.attributes.position.array.every(Number.isFinite));report.models[name]=g.attributes.position.count/3;}
assert(Object.values(report.models).reduce((a,b)=>a+b,0)<2600,'character geometry exceeded the shared model budget');
for(const type of ['hydrant','dumpster','crate','barrel','trashcan','cone'])assert(streetPropGeometry(type).attributes.position.array.every(Number.isFinite));
mkdirSync('artifacts/coastal-weapons',{recursive:true});writeFileSync('artifacts/coastal-weapons/matrix.json',JSON.stringify(report,null,2));console.log('COASTAL_WEAPONS_MATRIX_OK',JSON.stringify({water:report.water,weapons:report.weapons.length,bridges:report.bridges.length,beaches:report.beaches,models:report.models}));
