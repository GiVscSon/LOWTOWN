import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clipSurfaceX} from '../../src/assets/vehicle_shapes.js';
import {createVehicleMesh} from '../../src/render/shared/street_vehicle.js';
import {createBuildingArchitecture} from '../../src/render/three/buildings.js';
import {foliageGeometry,addUrbanTrees,foliageMaterial} from '../../src/render/three/foliage.js';
import {nightEnvironmentTexture,contactShadowTexture} from '../../src/render/three/environment.js';
import {createStreetProps} from '../../src/render/three/props.js';
import {createTransportVisual,setTransportEnvironment,disposeTransportVisual} from '../../src/render/three/vehicles.js';

const face={points:[[0,0,0],[2,0,0],[2,1,0],[0,1,0]],normals:[[0,0,1],[.6,0,.8],[.6,0,.8],[0,0,1]],uvs:[[0,0],[1,0],[1,1],[0,1]]};
const clipped=clipSurfaceX(face,1,true);
for(let i=0;i<clipped.points.length;i++){
  const point=clipped.points[i],normal=clipped.normals[i],uv=clipped.uvs[i];
  assert(Math.abs(Math.hypot(...normal)-1)<1e-6);
  if(point[0]===1){assert(normal[0]>.3&&normal[0]<.35);assert.equal(uv[0],.5);}
}
assert.equal(face.points.length,4,'clipping must not mutate the shared body');
let panels=0;
for(const type of ['sedan','coupe','sports','wagon','taxi','police','van','bus','truck','ambulance','fireEngine','armoredPolice','nationalGuard']){
  const model=createVehicleMesh(type);
  const smoothDoors=model.faces.filter(f=>f.part?.type==='door'&&f.normals);
  assert(smoothDoors.length>0,type+': moving doors lost curved surface normals');
  for(const f of model.faces){
    if(f.normals)for(const n of f.normals)assert(Math.abs(Math.hypot(...n)-1)<1e-5);
    if(f.surface==='glass'){assert.equal(f.uvs.length,f.points.length);for(const uv of f.uvs)assert(uv.every(v=>v>=-1e-6&&v<=1.000001));panels++;}
  }
}
const source=nightEnvironmentTexture();assert(source.image.data.every(Number.isFinite));assert(Math.max(...source.image.data)>2);assert.equal(source.mapping,THREE.EquirectangularReflectionMapping);
const transport=createTransportVisual({type:'sedan',width:48,height:24,color:'#e8b84a'}),finishes=new Set();
transport.traverse(object=>{if(object.material?.isMeshPhysicalMaterial)finishes.add(object.material);});assert(finishes.size>0);
setTransportEnvironment(source);const version=[...finishes][0].version;
for(const finish of finishes){assert.equal(finish.envMap,source);assert.equal(finish.envMapIntensity,.65);}
setTransportEnvironment(source,0);assert.equal([...finishes][0].version,version,'reflection toggle must not recompile shaders');assert.equal([...finishes][0].envMapIntensity,0);
setTransportEnvironment(null,0);assert.equal([...finishes][0].envMap,null);disposeTransportVisual(transport);source.dispose();
const shadow=contactShadowTexture(),d=shadow.image.data,s=shadow.image.width;
assert.equal(d[3],0);assert(d[(s/2*s+s/2)*4+3]>240,'contact shadow must soften at the edges, not remove its centre');
const canopy=foliageGeometry(),triangles=canopy.index.count/3;assert(triangles>100&&triangles<350);assert(canopy.attributes.normal.array.every(Number.isFinite));
const trees=[{x:50,y:60,size:20},{x:5000,y:5000,size:28}],saved=structuredClone(trees),forest=new THREE.Group();
const material=foliageMaterial(),report=addUrbanTrees(forest,trees,{material,lit:o=>new THREE.MeshStandardMaterial(o),shadows:{add(){}}});assert.deepEqual(trees,saved);
assert.equal(report.count,2);assert(forest.children.every(m=>m.isInstancedMesh&&m.boundingSphere.radius<1000));
const scene=new THREE.Group(),architecture=createBuildingArchitecture(scene),buildings=[{x:100,y:120,w:160,h:110,floors:6},{x:5000,y:5000,w:130,h:120,floors:4}];
const before=structuredClone(buildings);architecture.add(buildings[0],3);architecture.add(buildings[1],2);architecture.flush();assert.deepEqual(buildings,before);
assert(architecture.stats.fireEscapeFloors>0&&architecture.stats.balconies>0&&architecture.stats.roofVents>0);
for(const object of scene.children){assert(object.isInstancedMesh);assert(object.boundingSphere.radius<1000);assert(object.geometry.attributes.position.array.every(Number.isFinite));}
const street=new THREE.Group(),props=createStreetProps(street,new THREE.MeshStandardMaterial({vertexColors:true}));
assert.equal(props.update([{type:'hydrant',x:10,y:20,w:14,h:14,intact:true},{type:'dumpster',x:30,y:40,intact:false}],()=>3.6),1);
assert.equal(props.batches.dumpster.count,0,'destroyed containers must disappear from the instanced scene');
const transform=new THREE.Matrix4();props.batches.hydrant.getMatrixAt(0,transform);assert(Math.abs(transform.elements[13]-3.6)<1e-6);
for(const [type,mesh] of Object.entries(props.batches)){mesh.geometry.computeBoundingBox();assert(mesh.geometry.boundingBox.max.x<(type==='parasol'?2.1:.55),type+': model exceeds its footprint/canopy');assert(mesh.geometry.boundingBox.min.y>=-1e-6);}
console.log('VISUAL_POLISH_MATRIX_OK',JSON.stringify({glassPanels:panels,canopyTriangles:triangles,architecture:architecture.stats}));
