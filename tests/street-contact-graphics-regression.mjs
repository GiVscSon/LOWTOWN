import assert from 'node:assert/strict';
import * as THREE from 'three';
import {captureMotion,solveVehicleMotion,contact} from '../src/game/solid_contacts.js';
import {runtimeCity} from './helpers/runtime-city.mjs';
import {ribbonGeometry,createBoxBatch} from '../src/three/geometry.js';
import {CAMERA_PRESETS,cameraFraming} from '../src/three/camera.js';
import {landVehicleGeometry} from '../src/three/vehicles.js';

// Sweep a walking player through a stationary resident, including a long
// frame and sustained input. Neither may swap sides or trigger car injuries.
let impacts=0;
const player={x:-35,y:0,angle:0,hp:100},resident={x:0,y:0,angle:0,hp:100};
const people=new Set([player,resident]);
for(let frame=0;frame<90;frame++){
  const starts=captureMotion([player,resident]);player.x+=frame===0?70:2.4;
  solveVehicleMotion([player,resident],starts,1/60,{player,people,onImpact:()=>impacts++});
  assert(player.x<resident.x-8.99,'walking player tunneled through resident');
  assert.equal(contact({x:player.x,y:player.y,angle:0,length:9,breadth:9},
    {x:resident.x,y:resident.y,angle:0,length:9,breadth:9}),null);
}
assert.equal(impacts,0);assert.equal(player.hp,100);assert.equal(resident.hp,100);
// Two walkers approaching each other stop without oscillation; a glancing
// walker can keep moving tangentially instead of sticking to the other body.
const a={x:-20,y:0,angle:0},b={x:20,y:0,angle:0};
const starts=captureMotion([a,b]);a.x=20;b.x=-20;
solveVehicleMotion([a,b],starts,1/60,{people:new Set([a,b]),onImpact:()=>impacts++});
assert(a.x<b.x-8.99);const resting=[a.x,b.x];
a.contactVx=a.contactVy=b.contactVx=b.contactVy=0;
for(let i=0;i<30;i++)solveVehicleMotion([a,b],captureMotion([a,b]),1/60,{people:new Set([a,b])});
assert(Math.abs(a.x-resting[0])<.001&&Math.abs(b.x-resting[1])<.001);
const slider={x:-10,y:7,angle:0},still={x:0,y:0,angle:0};
const glance=captureMotion([slider,still]);slider.x+=5;slider.y+=5;
solveVehicleMotion([slider,still],glance,1/60,{player:slider,people:new Set([slider,still])});
assert(slider.y>10,'contact removed tangent walking motion');assert.equal(impacts,0);
const pinned={x:0,y:0,angle:0},walker={x:-12,y:0,angle:0};
for(let frame=0;frame<30;frame++){
  const starts=captureMotion([walker,pinned]);walker.x+=2.4;
  solveVehicleMotion([walker,pinned],starts,1/60,{player:walker,people:new Set([walker,pinned]),
    canOccupy:(body,pose)=>body===pinned?pose.x<=0:pose.x<=-8.99});
  assert(pinned.x<=0,'contact pushed resident into the wall');assert(walker.x<=-8.99,'player passed a resident pinned at a wall');
}

const city=runtimeCity(73);
const audit=JSON.parse(city.run(`JSON.stringify({
  roads:roads.length,bridges:bridges.length,paths:scenicRoads.length,
  badRoads:roads.filter(r=>Array.from({length:41},(_,i)=>i/40).some(t=>
    ![-.48,0,.48].every(edge=>isPositionOnSolidGround(
      r.x+r.w*(r.dir==='h'?t:.5+edge),r.y+r.h*(r.dir==='v'?t:.5+edge))))),
  badEnds:scenicRoads.filter(r=>[r.points[0],r.points.at(-1)].some(([x,y])=>
    !roads.some(s=>x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h))),
  scenic:scenicRoads.map(r=>({points:r.points,width:r.width,district:r.districtId})),
  badBridges:bridges.filter(r=>Array.from({length:41},(_,i)=>i/40).some(t=>
    !isPositionOnSolidGround(r.x+r.w*(r.dir==='h'?t:.5),r.y+r.h*(r.dir==='v'?t:.5))))
})`));
assert.equal(audit.badRoads.length,0,'road carriageway extends over water');
assert.equal(audit.badEnds.length,0,'waterfront paths terminate without joining a street');
assert.equal(audit.badBridges.length,0,'bridge centerline has a support gap');
for(const road of audit.scenic){
  assert(road.width<=28,'remapping widened a footpath into a road');
  const geometry=ribbonGeometry(road.points.map(p=>new THREE.Vector2(...p)),road.width),pos=geometry.attributes.position;
  const points=Array.from({length:pos.count},(_,i)=>[pos.getX(i),pos.getZ(i)]);
  const bad=city.run(`(${JSON.stringify(points)}).some(([x,y])=>!isPositionOnSolidGround(x,y)||buildings.some(b=>x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h))`);
  assert.equal(bad,false,'painted footpath goes through a building or unsupported water: '+road.district);geometry.dispose();
}
for(const foot of [true,false])for(const mobile of [true,false]){
  const frames=CAMERA_PRESETS.map(preset=>cameraFraming(preset,foot,mobile));
  assert(frames[0].height<frames[1].height&&frames[1].height<frames[2].height);
  assert(frames[0].distance<frames[1].distance&&frames[1].distance<frames[2].distance);
}
const scene=new THREE.Scene(),batch=createBoxBatch(scene,'#ffffff');
batch.add(0,0,0,10,10,10);batch.add(10000,0,10000,10,10,10);batch.flush();
assert.equal(scene.children.length,2,'distant districts cannot share one uncullable instance mesh');
assert.equal(scene.children[0].geometry,scene.children[1].geometry);
assert.equal(scene.children[0].material,scene.children[1].material);
assert(scene.children.every(mesh=>mesh.boundingSphere.radius<10),'chunk bounds include the whole city');
for(const model of ['sedan','coupe','sports','taxi']){
  const geometry=landVehicleGeometry(model),surface=geometry.attributes.surface;
  assert.equal(surface.count,geometry.attributes.position.count);
  assert([...surface.array].every(Number.isFinite));
  assert([...surface.array].some((value,i)=>i%3===2&&value>1),'head and tail lamps do not emit light');
}
console.log('PASS pedestrian contacts without injuries, connected supported streets/footpaths/bridges, three camera presets and detailed vehicle surfaces',
  {roads:audit.roads,bridges:audit.bridges,paths:audit.paths});
