import * as THREE from 'three';
import {createVehicleMesh} from '../game/street_vehicle.js';

const geometries=new Map();
const palette={sirenRed:'#e95642',sirenBlue:'#4199e2',sirenAmber:'#e6b352',tail:'#b54c3e'};
export function landVehicleGeometry(type,width=48,height=24,color='#e8b84a',police=false){
  const key=`${type}:${width}:${height}:${color}:${police}`;
  if(geometries.has(key))return geometries.get(key);
  const model=createVehicleMesh(type,width,height,color,police),positions=[],colors=[],surfaces=[],lights=[];
  for(const face of model.faces){
    const normal=face.normal,drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    const flat=face.points.map(point=>new THREE.Vector2(...point.filter((_,axis)=>axis!==drop)));
    const triangles=THREE.ShapeUtils.triangulateShape(flat,[]),paint=new THREE.Color(palette[face.fill]||face.fill);
    for(const triangle of triangles){
      const vertices=triangle.map(index=>{const [x,y,z]=face.points[index];return new THREE.Vector3(x,z,y);});
      const winding=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      const ordered=winding.dot(new THREE.Vector3(normal[0],normal[2],normal[1]))<0?[...triangle].reverse():triangle;
      for(const vertex of ordered){
        const [x,y,z]=face.points[vertex];positions.push(x,z,y);colors.push(paint.r,paint.g,paint.b);
        const glass=face.fill==='#263b46'||face.fill==='#34474c',chrome=face.fill==='#abb6b4'||face.fill==='#b9c2bf',rubber=face.fill==='#1d2428';
        const lamp=face.fill==='tail'||face.fill.startsWith('siren')||face.fill==='#fff0b7';
        surfaces.push(glass?.18:chrome?.24:rubber?.96:.44,chrome?.82:glass?.25:rubber?0:.28,lamp?1.3:0);
        if(face.fill.startsWith('siren'))lights.push({index:colors.length-3,color:paint.clone(),blue:face.fill==='sirenBlue'});
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('surface',new THREE.Float32BufferAttribute(surfaces,3));
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.userData={type,lights};geometries.set(key,geometry);return geometry;
}

const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.22,side:THREE.DoubleSide});
material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 surface;varying vec3 vehicleSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvehicleSurface=surface;');
  shader.fragmentShader='varying vec3 vehicleSurface;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vehicleSurface.x;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vehicleSurface.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor.rgb*vehicleSurface.z;');
};
material.customProgramCacheKey=()=> 'lowtown-vehicle-surfaces';
const materials=new Map(),unitBox=new THREE.BoxGeometry(1,1,1);
function painted(color){
  if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.6,metalness:.15}));
  return materials.get(color);
}
function part(group,x,y,z,w,h,d,color){
  const mesh=new THREE.Mesh(unitBox,painted(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);return mesh;
}
export function createTransportVisual(vehicle){
  const type=vehicle.model||vehicle.type||'sedan',group=new THREE.Group();group.userData.type=type;
  if(['plane','helicopter','speedboat','tug'].includes(type)){
    const color=vehicle.color||'#b8b8a7';
    if(type==='helicopter'){
      part(group,0,9,0,38,15,20,color);part(group,11,10,0,17,12,21,'#35546b');
      part(group,-32,10,0,45,4,4,color);part(group,-49,15,0,5,14,3,color);
      for(const side of [-1,1])part(group,0,0,side*12,44,2,2,'#45505a');
      const rotor=new THREE.Group();rotor.position.y=20;group.add(rotor);
      part(rotor,0,0,0,86,1,3,'#69777a');part(rotor,0,0,0,3,1,86,'#69777a');group.userData.rotor=rotor;
    }else if(type==='plane'){
      part(group,0,7,0,72,12,13,color);part(group,11,12,0,20,8,11,'#35546b');
      part(group,-4,7,0,17,2,100,color);part(group,-29,10,0,13,2,42,color);part(group,-31,18,0,12,18,2,color);
      for(const side of [-1,1])part(group,-8,2,side*21,4,5,4,'#20272c');
    }else{
      const length=vehicle.width||60,breadth=vehicle.height||25;
      part(group,0,1,0,length,9,breadth,color);part(group,-length*.12,9,0,length*.45,8,breadth*.72,'#ddd7c4');
      part(group,0,14,0,length*.35,7,breadth*.62,'#35546b');
      if(type==='tug')part(group,-length*.25,24,0,6,18,6,'#ba6e39');
    }
  }else{
    group.add(new THREE.Mesh(landVehicleGeometry(type,vehicle.width||48,vehicle.height||24,vehicle.color||'#e8b84a',/police/i.test(type)),material));
  }
  return group;
}
export function updateTransportVisual(group,vehicle,time,altitude=0){
  const water=vehicle.kind==='water'||['tug','speedboat'].includes(group.userData.type);
  group.position.set(vehicle.x,(water?-6:3.6)+altitude,vehicle.y);group.rotation.y=-(vehicle.angle||0);
  if(group.userData.rotor)group.userData.rotor.rotation.y=time*32;
  const geometry=group.children[0]?.geometry;
  if(geometry?.userData.lights?.length){
    const attribute=geometry.getAttribute('color');
    for(const light of geometry.userData.lights){const power=(Math.sin(time*12)>0)!==light.blue?1:.28;
      attribute.array[light.index]=light.color.r*power;attribute.array[light.index+1]=light.color.g*power;attribute.array[light.index+2]=light.color.b*power;}
    attribute.needsUpdate=true;
  }
}
