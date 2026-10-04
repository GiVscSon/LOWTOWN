import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const geometryCache=new Map();
export function streetPropGeometry(type){
  if(geometryCache.has(type))return geometryCache.get(type);
  const parts=[];
  const add=(geometry,color,x,y,z)=>{
    const g=geometry.toNonIndexed();geometry.dispose();g.deleteAttribute('uv');g.translate(x,y,z);
    const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);
  };
  const box=(w,h,d,color,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z);
  if(type==='hydrant'){
    add(new THREE.CylinderGeometry(.23,.27,.65,10),'#a84935',0,.43,0);
    add(new THREE.CylinderGeometry(.31,.32,.10,10),'#715e49',0,.06,0);
    add(new THREE.SphereGeometry(.25,10,5),'#b85840',0,.80,0);
    add(new THREE.CylinderGeometry(.13,.13,.70,8).rotateZ(Math.PI/2),'#994431',0,.55,0);
    for(const side of [-1,1])add(new THREE.CylinderGeometry(.16,.16,.09,8).rotateZ(Math.PI/2),'#bfa380',side*.37,.55,0);
    add(new THREE.CylinderGeometry(.17,.17,.16,8).rotateX(Math.PI/2),'#8f7660',0,.45,.28);
    box(.08,.10,.08,'#7c6b52',0,1.02,0);
  }else{
    box(.94,.70,.84,'#496657',0,.5,0);
    const lid=new THREE.BoxGeometry(.50,.07,.92);lid.rotateZ(-.06);add(lid,'#303c36',-.25,.91,0);
    const second=new THREE.BoxGeometry(.50,.07,.92);second.rotateZ(.06);add(second,'#344139',.25,.91,0);
    for(const x of [-.30,.30]){
      box(.12,.025,.035,'#949986',x,.955,.21);
      box(.035,.40,.86,'#6a7b64',x,.5,0);
      for(const z of [-.32,.32])add(new THREE.CylinderGeometry(.075,.075,.065,8).rotateZ(Math.PI/2),'#252d29',x,.08,z);
    }
    box(.17,.09,.005,'#b7b09a',.19,.61,.424);
    box(.05,.025,.006,'#787c65',.19,.61,.43);
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometryCache.set(type,geometry);return geometry;
}
export function createStreetProps(scene,material,capacity=128){
  const batches={};
  for(const type of ['hydrant','dumpster']){
    const mesh=new THREE.InstancedMesh(streetPropGeometry(type),material,capacity);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);batches[type]=mesh;
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  return {batches,update(props,surface){
    const counts={hydrant:0,dumpster:0};
    for(const prop of props.slice(0,capacity)){
      if(prop.intact===false)continue;
      const type=prop.type==='hydrant'?'hydrant':'dumpster',index=counts[type]++;
      rotation.setFromAxisAngle(axis,-(prop.angle||0));
      matrix.compose(position.set(prop.x,surface(prop.x,prop.y),prop.y),rotation,scale.set(prop.w||14,type==='hydrant'?14:20,prop.h||14));
      batches[type].setMatrixAt(index,matrix);
    }
    for(const type of Object.keys(batches)){batches[type].count=counts[type];batches[type].instanceMatrix.needsUpdate=true;}
    return counts.hydrant+counts.dumpster;
  }};
}
