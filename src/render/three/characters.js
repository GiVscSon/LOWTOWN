import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function combine(parts){
  const geometries=parts.map(([geometry,color,x=0,y=0,z=0,scale=null])=>{
    const g=geometry.index?geometry.toNonIndexed():geometry;
    g.deleteAttribute('uv');if(scale)g.scale(...scale);g.translate(x,y,z);
    const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;
  });
  const result=mergeGeometries(geometries);for(const g of geometries)g.dispose();result.computeBoundingSphere();return result;
}
const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const capsule=(r,length)=>new THREE.CapsuleGeometry(r,length,3,8);
let geometries;
export function characterGeometries(){
  if(geometries)return geometries;
  geometries={
    torso:combine([
      [new THREE.CylinderGeometry(3.25,3.6,8.5,10),'#ffffff',0,14.4,0,[.72,1,1.05]],
      [box(1,5.8,3.1),'#696b68',2.3,15,0], // open coat and shirt
      [box(.6,1.3,3.8),'#ece7d9',2,18,0],
      [box(4.9,1,6.7),'#34383d',0,10.3,0],
      [box(.6,.6,.8),'#c1b89b',2.6,10.4,0],
      [box(.7,2,1.3),'#77766d',2.5,16.6,-2.1],
      [box(.7,2,1.3),'#77766d',2.5,16.6,2.1]
    ]),
    head:combine([
      [new THREE.SphereGeometry(2.25,12,8),'#c8a582',0,20.8,0,[.88,1.12,.86]],
      [new THREE.CylinderGeometry(1.05,1.25,2.1,8),'#bf9977',0,18.4,0],
      [new THREE.SphereGeometry(2.3,12,6,0,Math.PI*2,0,Math.PI*.55),'#302b28',-.22,21.1,0,[.95,1.05,.93]],
      [box(.85,.95,.7),'#bf9674',2.05,20.7,0],
      [box(.2,.22,.45),'#171e21',1.95,21.5,-.85],
      [box(.2,.22,.45),'#171e21',1.95,21.5,.85],
      [box(.15,.17,.9),'#74574b',1.95,19.85,0],
      [new THREE.SphereGeometry(.55,6,4),'#bf9674',0,20.6,-1.95],
      [new THREE.SphereGeometry(.55,6,4),'#bf9674',0,20.6,1.95]
    ]),
    thigh:combine([[capsule(1.4,3.6),'#364454',0,-2.9,0]]),
    shin:combine([[capsule(1.18,3.4),'#303d4d',0,-2.8,0],[box(3.8,1.5,2.6),'#20292c',.7,-5.4,0],[box(3.9,.35,2.7),'#5a5c57',.7,-6.05,0]]),
    upperArm:combine([[capsule(1.15,2.3),'#ffffff',0,-1.9,0]]),
    forearm:combine([[capsule(1,2.2),'#ffffff',0,-1.75,0],[new THREE.SphereGeometry(1.05,8,6),'#c8a582',0,-4,0,[.8,1.3,1]]])
  };
  return geometries;
}
export function createCharacterBatch(scene,capacity=512){
  const material=new THREE.MeshLambertMaterial({vertexColors:true}),batches={};
  for(const [name,geometry] of Object.entries(characterGeometries())){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity*(name==='head'||name==='torso'?1:2));
    mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);batches[name]=mesh;
  }
  const root=new THREE.Matrix4(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),q=new THREE.Quaternion(),localQ=new THREE.Quaternion(),pos=new THREE.Vector3(),size=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0),sideAxis=new THREE.Vector3(0,0,1),color=new THREE.Color();
  const put=(name,index,x,y,z,angle=0,paint=null)=>{
    localQ.setFromAxisAngle(sideAxis,angle);local.compose(pos.set(x,y,z),localQ,size);matrix.multiplyMatrices(root,local);
    batches[name].setMatrixAt(index,matrix);batches[name].setColorAt(index,color.set(paint||'#ffffff'));
  };
  function update(people,surface){
    const count=Math.min(capacity,people.length);
    for(let i=0;i<count;i++){
      const p=people[i],down=p.knockdownTimer>0||p.stance==='down',phase=p.walkPhase||0,gait=p.gait??(phase?1:0),stride=Math.sin(phase)*.42*gait;
      q.setFromAxisAngle(up,-(p.heading??p.angle??0));
      if(down)q.multiply(localQ.setFromAxisAngle(sideAxis,-Math.PI/2));
      root.compose(pos.set(p.x,surface(p.x,p.y)+(down?3:1.2+Math.abs(Math.sin(phase))*.3*gait),p.y),q,size);
      put('torso',i,0,0,0,0,p.shirt||'#99906d');put('head',i,0,0,0);
      for(const side of [-1,1]){
        const index=i*2+(side>0?1:0),swing=down?0:stride*side,knee=Math.max(0,-swing)*.9;
        put('thigh',index,0,11.2,side*1.65,swing);
        put('shin',index,Math.sin(swing)*5.5,11.2-Math.cos(swing)*5.5,side*1.65,swing-knee);
        const arm=-swing*.85+.08;
        put('upperArm',index,0,17.6,side*4.1,arm,p.shirt||'#99906d');
        put('forearm',index,Math.sin(arm)*3.9,17.6-Math.cos(arm)*3.9,side*4.1,arm-.15,p.shirt||'#99906d');
      }
    }
    for(const [name,mesh] of Object.entries(batches)){
      mesh.count=count*(name==='head'||name==='torso'?1:2);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    return count;
  }
  return {update,batches};
}
