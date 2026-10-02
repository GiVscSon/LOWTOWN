import assert from 'node:assert/strict';
import * as THREE from 'three';
import {landVehicleGeometry,createTransportVisual} from '../src/three/vehicles.js';
import {roundedBridgePoints,ribbonGeometry} from '../src/three/geometry.js';
import {pwaIcon} from '../scripts/pwa-icons.mjs';
import {runtimeCity} from './helpers/runtime-city.mjs';
const models=['sedan','coupe','sports','wagon','taxi','van','bus','truck','bike','police','armoredPolice','nationalGuard','fireEngine','ambulance'];
const shapes=new Set();
for(const type of models){
  const geometry=landVehicleGeometry(type),position=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
  assert(position.count>100);assert.equal(position.count%3,0);
  for(const value of position.array)assert(Number.isFinite(value));
  for(let vertex=0;vertex<position.count;vertex++)assert(Math.abs(new THREE.Vector3().fromBufferAttribute(normals,vertex).length()-1)<1e-5,'degenerate vehicle triangle');
  shapes.add(JSON.stringify([...position.array]));geometry.computeBoundingBox();
  assert(geometry.boundingBox.max.y<40,'roof equipment detached from the chassis');
  assert.equal(landVehicleGeometry(type),geometry,'vehicle geometry should be shared rather than rebuilt every frame');
}
assert.equal(shapes.size,models.length);
for(const type of ['helicopter','plane','speedboat','tug'])assert(createTransportVisual({type}).children.length>=3);
const control=[{x:0,y:0},{x:600,y:0},{x:600,y:500},{x:1200,y:500}],points=roundedBridgePoints(control,130),deck=ribbonGeometry(points,130);
assert(points.length>control.length);assert.deepEqual(points[0].toArray(),[0,0]);assert.deepEqual(points.at(-1).toArray(),[1200,500]);
const position=deck.getAttribute('position');
for(let i=0;i<points.length;i++){
  const a=new THREE.Vector3().fromBufferAttribute(position,i*2),b=new THREE.Vector3().fromBufferAttribute(position,i*2+1);
  assert(Math.abs(a.distanceTo(b)-130)<.001,'curved bridge width changed at a bend');
  assert(Math.abs((a.x+b.x)/2-points[i].x)<.001&&Math.abs((a.z+b.z)/2-points[i].y)<.001,'bridge edges drifted from their centre line');
}
for(const size of [192,512]){const icon=pwaIcon(size);assert.equal(icon.subarray(1,4).toString(),'PNG');assert.equal(icon.readUInt32BE(16),size);assert.equal(icon.readUInt32BE(20),size);}
const city=runtimeCity(73),paint=JSON.parse(city.run('JSON.stringify(buildRoadPaintGeometry())'));
for(const bridge of paint.bridgePaths){
  const geometry=ribbonGeometry(roundedBridgePoints(bridge.path,bridge.width),bridge.width),position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getZ(i);
    assert(paint.surfaces.some(surface=>x>=surface.x-.1&&x<=surface.x+surface.w+.1&&y>=surface.y-.1&&y<=surface.y+surface.h+.1),'visible bridge edge extends over unsupported water: '+JSON.stringify({bridge:bridge.id,x,y}));
  }
}
console.log('PASS 18 distinct Three transport models, finite normals, constant-width curved bridges and install icons');
