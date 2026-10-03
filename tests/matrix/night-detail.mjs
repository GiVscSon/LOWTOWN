import assert from 'node:assert/strict';
import * as THREE from 'three';
import {runtimeCity} from '../helpers/runtime-city.mjs';
import {coastPoints,pointInCoast} from '../../src/world/coastline.js';
import {onStreetCollection} from '../../src/world/street_corridors.js';
import {addStreetDetail,addForecourts} from '../../src/render/three/street_detail.js';

// Check decorative geometry against the real world's support and footprints.
// It must not create new roads, solid bodies, or pavement over open water.
const c=runtimeCity(73).runtime.context,paint=c.buildRoadPaintGeometry();
const world={roads:c.roads,buildings:c.buildings,paint,islands:c.allIslands.map(i=>({points:coastPoints(i)}))};
const before=JSON.stringify({roads:c.roads,buildings:c.buildings,crosswalks:paint.crosswalks}),scene=new THREE.Group();
const detail=addStreetDetail(world,scene),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
assert(detail.manholes>100&&detail.drains>100,'street details should reach the whole city');
for(const mesh of scene.children)for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);
  for(const x of [-.5,.5])for(const z of [-.5,.5]){
    point.set(x,0,z).applyMatrix4(matrix);assert(onStreetCollection(point.x,point.z,c.roads,.002),'a cover or drain extends off the road');assert(point.y<3.15,'flush details must sit below crossings');
  }
}
const courts=new THREE.Group(),count=addForecourts(world,courts,new THREE.MeshBasicMaterial());assert(count>100);
for(const mesh of courts.children){
  const positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getZ(i);assert(c.allIslands.some(island=>pointInCoast(x,y,island)),'forecourt vertex leaves land');
    assert(!c.buildings.some(b=>x>b.x+.01&&x<b.x+b.w-.01&&y>b.y+.01&&y<b.y+b.h-.01),'forecourt crosses a building footprint');
  }
}
assert.equal(JSON.stringify({roads:c.roads,buildings:c.buildings,crosswalks:paint.crosswalks}),before);
console.log('NIGHT_STREET_GEOMETRY_OK',JSON.stringify({...detail,forecourts:count}));
