import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVehicleMesh,projectedVehicleFaces} from '../src/render/shared/street_vehicle.js';
import {landVehicleGeometry,createTransportVisual,updateTransportVisual} from '../src/render/three/vehicles.js';
import {createBuildingArchitecture,windowFrameGeometry} from '../src/render/three/buildings.js';
import {surfaceTexture} from '../src/render/three/materials.js';

const models=['sedan','coupe','sports','wagon','taxi','van','bus','truck','bike','police','armoredPolice','nationalGuard','fireEngine','ambulance'];
const report={};
for(const type of models){
  const model=createVehicleMesh(type),geometry=landVehicleGeometry(type),position=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  let smooth=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),flat=new THREE.Vector3(),n=new THREE.Vector3();
  for(let i=0;i<position.count;i+=3){a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);flat.copy(b).sub(a).cross(c.clone().sub(a)).normalize();for(let j=0;j<3;j++){n.fromBufferAttribute(normals,i+j);assert(Math.abs(n.length()-1)<1e-5);if(n.dot(flat)<.98)smooth++;}}
  assert(smooth>position.count*.15,`${type}: loft surfaces must interpolate shading rather than keep a box silhouette`);
  // Splitting the actual door surfaces adds edges without replacing the
  // curved shell. The six-wheel guard vehicle remains below 2,000 triangles.
  assert(position.count/3<2000,`${type}: close-view detail exceeded the vehicle budget`);
  for(let heading=0;heading<Math.PI*2;heading+=Math.PI/12){const faces=projectedVehicleFaces(model,heading,0,1.2);assert(faces.length>10);assert(faces.every(f=>f.points.every(p=>p.every(Number.isFinite))));}
  report[type]={triangles:position.count/3,smoothVertices:smooth};
}
for(const type of ['plane','helicopter','speedboat','tug']){
  const group=createTransportVisual({type}),copy=createTransportVisual({type});assert.equal(group.children[0].geometry,copy.children[0].geometry,'stationary geometry must be cached');
  let triangles=0;group.traverse(object=>{if(!object.geometry)return;const p=object.geometry.getAttribute('position'),n=object.geometry.getAttribute('normal');for(const value of p.array)assert(Number.isFinite(value));for(const value of n.array)assert(Number.isFinite(value));triangles+=p.count/3;});assert(triangles>200&&triangles<1400);
  updateTransportVisual(group,{x:100,y:200,angle:.7,kind:type==='tug'||type==='speedboat'?'water':'air'},2,30);assert.equal(group.position.x,100);assert.equal(group.position.z,200);assert.equal(group.rotation.y,-.7);
  if(type==='tug'||type==='speedboat'){assert.equal(group.userData.wake.visible,false);updateTransportVisual(group,{x:100,y:200,speed:4,kind:'water'},3);assert(group.userData.wake.visible);}
  if(type==='helicopter')assert.equal(group.userData.rotor.rotation.y,64);if(type==='plane')assert.equal(group.userData.propeller.rotation.x,80);report[type]={triangles};
}
const scene=new THREE.Group(),architecture=createBuildingArchitecture(scene);
const building={x:120,y:180,w:160,h:110,floors:6};const original=structuredClone(building);architecture.add(building,0);architecture.add({...building,x:5000},3);architecture.flush();assert.deepEqual(building,original,'visual detail must not move roads or collision footprints');
const frame=windowFrameGeometry();frame.computeBoundingBox();assert(frame.boundingBox.max.z>frame.boundingBox.min.z,'windows need a physical recess');
assert(scene.children.every(mesh=>mesh.isInstancedMesh),'facade details must remain in shared instance batches');assert(scene.children.every(mesh=>mesh.boundingSphere.radius<1000),'distant detail batches should be culled separately');
const texture=surfaceTexture('plaster');assert.equal(surfaceTexture('plaster'),texture);assert(texture.image.width>=256);assert(new Set(texture.image.data).size>50,'weathering needs more than a uniform wall color');
console.log('REFINED_TRANSPORT_OK',JSON.stringify(report));
