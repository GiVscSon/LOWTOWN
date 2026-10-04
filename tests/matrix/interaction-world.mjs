import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createNeighbourhood} from '../../src/simulation/neighbourhood.js';
import {runtimeCity} from '../helpers/runtime-city.mjs';
import {createFreeRoam} from '../../src/simulation/free_roam.js';
import {captureMotion,contact,chassis} from '../../src/simulation/solid_contacts.js';
import {applyBodyImpulse,stepBodyResponse,isMovableProp} from '../../src/simulation/body_physics.js';
import {meleeTarget} from '../../src/simulation/character_actions.js';
import {createEffectPool} from '../../src/simulation/effects.js';
import {rectangleClearOfStreets,onStreetCollection} from '../../src/world/street_corridors.js';
import {signalPosts} from '../../src/world/furniture_layout.js';
import {createCharacterBatch} from '../../src/render/three/characters.js';
import {createStreetProps} from '../../src/render/three/props.js';
import * as THREE from 'three';

let neighbourSeed=71;const random=()=>((neighbourSeed=Math.imul(neighbourSeed,1664525)+1013904223>>>0)/4294967296);
const neighbours=Array.from({length:1000},()=>({x:random()*8000,y:random()*8000})),grid=createNeighbourhood(neighbours);
for(let i=0;i<500;i++){const x=random()*8000,y=random()*8000,radius=30+random()*200,predicate=b=>Math.hypot(b.x-x,b.y-y)<radius;assert.equal(grid.some(x,y,radius,predicate),neighbours.some(predicate));}
const {runtime}=runtimeCity(731),c=runtime.context,report={jumps:[],impacts:[],world:{},particles:{}};
const details=[...c.solidProps,...c.breakableProps].filter(p=>p.authoredDetail);
const paint=c.buildRoadPaintGeometry(),posts=signalPosts(paint.signals);
assert(posts.length>0);
for(const p of posts)assert(!onStreetCollection(p.x,p.y,paint.surfaces,4),'signal base obstructs an oblique junction');
assert(details.length>=70&&details.length<=140,'the populated city must contain real, bounded roadside details');
for(const p of details){
  assert(rectangleClearOfStreets({x:p.x-p.width/2,y:p.y-p.height/2,w:p.width,h:p.height},[...c.roads,...c.bridges],4));
  assert(c.getWalkSurface()(p.x,p.y));
  assert(c.walkingRoutes.every(r=>r.points.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>Math.hypot(p.width,p.height)/2+8)),'detail obstructs walking route');
}
report.world={details:details.length,movable:details.filter(isMovableProp).length,vents:c.ambientVents.length,clearSignalPosts:posts.length};
const notices=[];c.showToast=s=>notices.push(s);c.raiseWantedFromCrime=()=>{};
function scene(){
  for(const key of ['buildings','trees','solidProps','breakableProps','parkedCars','trafficCars','policeCars','pedestrians','incidentPoliceCars','incidentResponseVehicles','bridges','allIslands'])c[key].length=0;
  c.piers=[{x:-100,y:-100,w:600,h:600}];c.cityIncidentDirector.finish();c.cityIncidentDirector.state.cooldown=999999;c.invalidateScenery();c.invalidateTerrain();
  c.roam=createFreeRoam(c.player,[],[],[],c.isPositionOnSolidGround,()=>{},[],()=>false,()=>c.breakableProps.filter(p=>isMovableProp(p)&&p.intact!==false),{footSupport:(x,y)=>c.getWalkSurface()(x,y),footBlocked:c.isPedestrianSceneryBlocked});c.roam.fleet.length=0;c.roam.resetToFoot(0,0,0);Object.assign(c.player,{hp:100,hitCooldown:0});
}
for(const hz of [30,60,120]){
  scene();let apex=0;
  for(let i=0;i<hz*1.2;i++){c.roam.step({handbrake:true},1/hz);apex=Math.max(apex,c.player.jumpHeight);}
  assert(Math.abs(apex-22.05)<.05);assert.equal(c.player.jumpHeight,0,'held jump repeated after landing');
  c.roam.step({},1/hz);c.roam.step({handbrake:true},1/hz);assert(c.player.jumpHeight>0);
  c.roam.resetToFoot(495,100);for(let i=0;i<hz;i++)c.roam.step({down:true,handbrake:true},1/hz);
  assert(c.getWalkSurface()(c.player.x,c.player.y),'jump allowed water walking');
  c.roam.resetToSedan();assert.equal(c.player.jumpHeight,0);assert.equal(c.player.attackTime,0);
  report.jumps.push({hz,apex,shoreSupported:true});
  for(const type of ['crate','barrel','dumpster','sedan','person','wall']){
    scene();const person=type==='person',fixed=type==='wall';
    const target={type,x:22,y:0,width:16,height:16,w:16,h:16,mass:person?70:type==='crate'?22:type==='barrel'?45:type==='dumpster'?130:1500,intact:true,hp:100,collisionHeight:23,angle:0};
    if(person)c.pedestrians.push({x:300,y:300,width:9,height:9},target);else if(fixed)c.buildings.push({x:14,y:-8,w:16,h:16,floors:3});else if(type==='sedan')c.parkedCars.push(target);else c.breakableProps.push(target);
    c.invalidateScenery();const x=target.x;
    for(let i=0;i<Math.ceil(hz*.45);i++){const starts=captureMotion(c.cityCollisionBodies());c.stepCharacterActions(1/hz,{attack:true});c.resolveCityMotion(starts,1/hz);}
    assert.equal(target.hp,fixed?100:person?86:type==='sedan'?97:88,'one swing must hit exactly once');
    if(!fixed){assert(target.x>x,'punch failed to move a dynamic object');assert(c.effects.active>0);}
    assert.equal(c.player.hp,100);assert(!notices.some(s=>s.includes('Вас сбила машина')));
    if(person)assert.equal(target.reaction,'fleeing');if(type==='sedan')assert(target.damage.rear>0);
    report.impacts.push({hz,type,displacement:target.x-x,hp:target.hp});
  }
}
scene();c.buildings.push({x:9,y:-10,w:3,h:20,floors:4});c.invalidateScenery();
const behind={x:24,y:0,width:8,height:8,hp:100};
const hit=meleeTarget(c.player,[...c.getCityScenery().contacts.query(-40,-40,40,40),behind]);assert(hit.fixed,'punch passed through wall');
assert.equal(meleeTarget(c.player,[{x:-18,y:0,width:8,height:8}]),null,'punch hit behind the character');
scene();const crate={type:'crate',x:20,y:0,w:14,h:14,mass:22,intact:true,hp:12,collisionHeight:18};c.breakableProps.push(crate);
for(let i=0;i<15;i++)c.stepCharacterActions(1/60,{attack:true});assert.equal(crate.intact,false);assert(!c.cityCollisionBodies().includes(crate));
scene();const fighter={x:22,y:0,width:9,height:9,hp:100,entityType:'pedestrian'};c.pedestrians.push(fighter);
for(let i=0;i<70;i++)c.stepCharacterActions(1/60,{attack:true});assert.equal(fighter.hp,86);assert.equal(c.player.hp,92,'provoked fighter must deliver one visible counter strike');assert.equal(fighter.combatTimer,0);
scene();c.player.jumpRequested=true;c.roam.step({},1/60);assert(c.player.jumpHeight>0,'quick key press lost before physics step');
c.player.attackRequested=true;c.stepCharacterActions(1/60,{});assert(c.player.attackTime>0);
const paused={jump:c.player.jumpHeight,attack:c.player.attackTime,particles:JSON.stringify(c.effects.particles)};c.state.isMenuOpen=true;runtime.step(1);assert.equal(c.player.jumpHeight,paused.jump);assert.equal(c.player.attackTime,paused.attack);assert.equal(JSON.stringify(c.effects.particles),paused.particles);c.state.isMenuOpen=false;
const light={x:0,y:0,width:16,height:16,mass:20},heavy={...light,mass:1500};applyBodyImpulse(light,4200,0,{x:0,y:4});applyBodyImpulse(heavy,4200,0,{x:0,y:4});assert(light.vx>heavy.vx*70);assert(light.angularVelocity<0);
for(let i=0;i<120;i++)stepBodyResponse(light,1/60,true);assert(Math.abs(light.angularVelocity)<.03);assert(Number.isFinite(light.pitch+light.roll));
for(const hz of [30,60,120]){const pool=createEffectPool(64,()=>.5);pool.burst(0,0,10,'chip',5000);assert.equal(pool.particles.length,64);assert.equal(pool.active,64);for(let i=0;i<hz*4;i++)pool.step(1/hz);assert.equal(pool.active,0);report.particles[hz]={capacity:64,expired:true};}
const scene3=new THREE.Group(),batch=createCharacterBatch(scene3,4),p={x:0,y:0,jumpHeight:22,attackTime:.14,attackSide:1};batch.update([p],()=>0);const m=new THREE.Matrix4();batch.batches.torso.getMatrixAt(0,m);assert(m.elements[13]>22);batch.batches.forearm.getMatrixAt(1,m);assert(m.elements[12]>3.7,'fist must extend at the contact moment');
const props=createStreetProps(scene3,new THREE.MeshLambertMaterial());assert.equal(props.update(['crate','barrel','trashcan','cone'].map((type,i)=>({type,x:i*20,y:0,w:16,h:16,intact:true})),()=>0),4);
for(const mesh of Object.values(props.batches))assert(mesh.geometry.attributes.position.array.every(Number.isFinite));
mkdirSync('artifacts/interaction-world',{recursive:true});writeFileSync('artifacts/interaction-world/matrix.json',JSON.stringify(report,null,2));console.log('INTERACTION_WORLD_MATRIX_OK',JSON.stringify(report));
