import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createBoxBatch} from './geometry.js';

export function foliageGeometry(){
  const parts=[];
  for(const [cx,cy,cz,sx,sy,sz] of [[0,.05,0,.48,.6,.48],[-.26,-.16,.11,.34,.37,.32],[.24,-.13,-.12,.35,.4,.34]]){
    const geometry=new THREE.SphereGeometry(1,8,6),position=geometry.attributes.position;
    const colors=new Float32Array(position.count*3),paint=new THREE.Color();
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const shape=1+.07*Math.sin(x*8+z*5)*Math.sin(y*9+z*4);
      position.setXYZ(i,cx+x*sx*shape,cy+y*sy*shape,cz+z*sz*shape);
      paint.set('#ffffff').multiplyScalar(.80+.20*(y+1)/2);colors.set([paint.r,paint.g,paint.b],i*3);
    }
    geometry.computeVertexNormals();geometry.deleteAttribute('uv');geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(geometry);
  }
  const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());result.computeBoundingSphere();return result;
}
export function foliageMaterial(simple=false){
  const options={color:0xffffff,vertexColors:true};
  const material=simple?new THREE.MeshLambertMaterial(options):new THREE.MeshStandardMaterial({...options,roughness:.97});
  material.userData.wind={time:{value:0},strength:{value:0}};
  material.onBeforeCompile=shader=>{
    shader.uniforms.windTime=material.userData.wind.time;shader.uniforms.windStrength=material.userData.wind.strength;
    shader.vertexShader='uniform float windTime;uniform float windStrength;varying vec3 leafPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nleafPosition=position;transformed.x+=sin(windTime*1.7+instanceMatrix[3].x*.02)*windStrength*(position.y+.6)*.035;');
    shader.fragmentShader='varying vec3 leafPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat leaf=fract(sin(dot(floor(leafPosition*42.0),vec3(12.97,41.73,78.23)))*43758.54);diffuseColor.rgb*=.79+leaf*.28;');
  };
  material.customProgramCacheKey=()=>simple?'lowtown-leaves-simple':'lowtown-leaves-pbr';return material;
}
export function addUrbanTrees(scene,trees,{material,lit,shadows}){
  const crowns=createBoxBatch(scene,0xffffff,1,foliageGeometry(),material);
  const wood=lit({color:0xffffff,roughness:.97});
  const trunks=createBoxBatch(scene,0xffffff,1,new THREE.CylinderGeometry(.48,.68,1,7),wood);
  const branches=createBoxBatch(scene,0xffffff,1,new THREE.CylinderGeometry(.5,.7,1,6).rotateZ(-Math.PI/2),wood);
  const palette=['#405239','#4c5b39','#384d35','#535a39'];
  for(const [index,tree] of trees.entries()){
    const size=tree.size||20;
    trunks.add(tree.x,size*.49,tree.y,4,size*.98,4,'#62513d');
    for(const side of [-1,1])branches.beam(new THREE.Vector3(tree.x,size*.65,tree.y),new THREE.Vector3(tree.x+side*size*.24,size*1.04,tree.y+side*size*.1),1.35,1.35,'#65543e');
    crowns.add(tree.x,size*1.2,tree.y,size*1.38,size*1.05,size*1.25,palette[index%palette.length],index*2.399);
    shadows.add(tree.x+size*.25,3.22,tree.y+size*.2,size*1.3,1,size*.95);
  }
  trunks.flush();branches.flush();crowns.flush();
  return {count:trees.length,canopyTriangles:foliageGeometryTriangleCount(scene,material)};
}
function foliageGeometryTriangleCount(scene,material){
  const crown=scene.children.find(object=>object.material===material);
  return crown?((crown.geometry.index?.count||crown.geometry.attributes.position.count)/3):0;
}
