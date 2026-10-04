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
      ,[box(.22,6.5,.15),'#4c5256',2.42,14.5,0]
      ,[box(.18,4.2,.15),'#b5b1a1',2.35,15.6,-.32]
      ,[box(.7,.25,1.25),'#b7b3a1',2.6,15,-2.1]
      ,[box(.7,.25,1.25),'#b7b3a1',2.6,15,2.1]
      ,...[12.3,14,15.7].map(y=>[new THREE.SphereGeometry(.17,6,4),'#d1cabb',2.55,y,.25])
    ]),
    head:combine([
      [new THREE.SphereGeometry(2.25,16,10),'#ffffff',0,20.8,0,[.88,1.12,.86]],
      [new THREE.CylinderGeometry(1.05,1.25,2.1,10),'#d3c3b4',0,18.4,0],
      [new THREE.SphereGeometry(.6,8,6),'#efe3d8',2,20.55,0,[1.2,.8,.55]],
      [new THREE.SphereGeometry(.55,8,5),'#d1bfb1',0,20.6,-1.95,[.6,1,.6]],
      [new THREE.SphereGeometry(.55,8,5),'#d1bfb1',0,20.6,1.95,[.6,1,.6]],
      [new THREE.SphereGeometry(1.1,10,6),'#e8d6c4',1.05,19.15,0,[.65,.55,.8]]
    ]),
    hair:combine([[new THREE.SphereGeometry(2.3,16,7,0,Math.PI*2,0,Math.PI*.56),'#ffffff',-.22,21.1,0,[.95,1.05,.93]],
      [box(.18,.2,.8),'#b9a897',1.85,21.65,-.9],[box(.18,.2,.8),'#b9a897',1.85,21.65,.9]]),
    face:combine([[box(.14,.2,.38),'#20262a',1.94,21.25,-.83],[box(.14,.2,.38),'#20262a',1.94,21.25,.83],
      [box(.10,.10,.95),'#785b50',1.91,19.8,0],[box(.12,.08,.30),'#dfd7cd',2.03,21.3,-.87],[box(.12,.08,.30),'#dfd7cd',2.03,21.3,.87]]),
    thigh:combine([[capsule(1.4,3.6),'#ffffff',0,-2.9,0],[box(.13,4.5,.2),'#a5aaae',1.25,-2.9,0]]),
    shin:combine([[capsule(1.18,3.4),'#ffffff',0,-2.8,0],[box(.15,.18,2),'#969c9e',.95,-4.7,0]]),
    shoe:combine([[new THREE.SphereGeometry(1,10,6),'#2c3235',.7,-5.4,0,[2,.75,1.25]],[box(3.9,.35,2.7),'#747775',.7,-6.05,0],
      ...[-.15,.3,.75].map(x=>[box(.1,.15,1.5),'#a5a394',x,-4.75,0])]),
    upperArm:combine([[capsule(1.15,2.3),'#ffffff',0,-1.9,0],[box(.12,2.5,.2),'#8e9698',1.05,-1.7,0]]),
    forearm:combine([[capsule(1,2.2),'#ffffff',0,-1.75,0],[new THREE.CylinderGeometry(1.06,1.06,.4,10),'#dad5c8',0,-3.25,0]]),
    hand:combine([[new THREE.SphereGeometry(1.05,10,7),'#ffffff',0,-4,0,[.8,1.3,1]],
      [new THREE.SphereGeometry(.36,6,4),'#dfcfc1',.8,-3.7,0]])
  };
  return geometries;
}
export function characterBaseHeight(person,surface=0){return person.inWater?-26+Math.sin(person.swimPhase||0)*.55:surface+(person.knockdownTimer>0||person.stance==='down'?3:1.2+(person.jumpHeight||0)+Math.abs(Math.sin(person.walkPhase||0))*.3*(person.gait||0));}
export function createCharacterBatch(scene,capacity=512,material=new THREE.MeshLambertMaterial({vertexColors:true})){
  const batches={};
  for(const [name,geometry] of Object.entries(characterGeometries())){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity*(['head','torso','hair','face'].includes(name)?1:2));
    mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);batches[name]=mesh;
  }
  const held={};
  for(const type of ['bat','pistol','shotgun','flare']){
    const gun=type!=='bat',long=type==='shotgun';
    const geometry=combine(gun?[
      [box(long?9:4.3,.65,.7),type==='flare'?'#b37248':'#414b50',long?4:1.6,.4,0],
      [box(1.1,2,.7),'#665443',.3,-.4,0],
      [new THREE.CylinderGeometry(.25,.25,long?8:3.4,10).rotateZ(Math.PI/2),'#929692',long?4.4:1.7,.7,0],
      ...(long?[[box(2.5,1,.85),'#876b4b',-.8,.4,0]]:[])
    ]:[[new THREE.CylinderGeometry(.35,.65,12,12).rotateZ(Math.PI/2),'#ae8960',5.3,.1,0],[new THREE.CylinderGeometry(.4,.4,2.5,10).rotateZ(Math.PI/2),'#444a48',.5,.1,0]]);
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);held[type]=mesh;
  }
  const root=new THREE.Matrix4(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),wrist=new THREE.Matrix4().makeTranslation(0,-4,0),weaponRotation=new THREE.Matrix4(),q=new THREE.Quaternion(),localQ=new THREE.Quaternion(),pos=new THREE.Vector3(),size=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0),sideAxis=new THREE.Vector3(0,0,1),color=new THREE.Color();
  const put=(name,index,x,y,z,angle=0,paint=null)=>{
    localQ.setFromAxisAngle(sideAxis,angle);local.compose(pos.set(x,y,z),localQ,size);matrix.multiplyMatrices(root,local);
    batches[name].setMatrixAt(index,matrix);batches[name].setColorAt(index,color.set(paint||'#ffffff'));
  };
  function update(people,surface){
    const weapons={bat:0,pistol:0,shotgun:0,flare:0};
    const count=Math.min(capacity,people.length);
    for(let i=0;i<count;i++){
      const p=people[i],swimming=!!p.inWater,down=!swimming&&(p.knockdownTimer>0||p.stance==='down'),phase=p.walkPhase||0,gait=p.gait??(phase?1:0),stride=Math.sin(phase)*.42*gait;
      q.setFromAxisAngle(up,-(p.heading??p.angle??0));
      if(down)q.multiply(localQ.setFromAxisAngle(sideAxis,-Math.PI/2));
      root.compose(pos.set(p.x,characterBaseHeight(p,surface(p.x,p.y)),p.y),q,size);
      put('torso',i,0,0,0,0,p.shirt||'#99906d');put('head',i,0,0,0,0,p.skin||'#c8a582');put('hair',i,0,0,0,0,p.hair||'#302b28');put('face',i,0,0,0);
      for(const side of [-1,1]){
        const index=i*2+(side>0?1:0),swing=swimming?Math.sin((p.swimPhase||0)*1.5+side)*.55:down?0:p.jumpHeight>0?-.38:stride*side,knee=p.jumpHeight>0?.65:Math.max(0,-swing)*.9;
        put('thigh',index,0,11.2,side*1.65,swing,p.pants||'#364454');
        const legX=Math.sin(swing)*5.5,legY=11.2-Math.cos(swing)*5.5;
        put('shin',index,legX,legY,side*1.65,swing-knee,p.pants||'#303d4d');put('shoe',index,legX,legY,side*1.65,swing-knee);
        const contactTime=p.combatTimer>0?.35:.14,duration=p.combatTimer>0?.7:.42,t=p.attackTime||0;
        const envelope=t<contactTime?Math.sin(t/contactTime*Math.PI/2):Math.max(0,Math.cos(Math.min(1,(t-contactTime)/(duration-contactTime))*Math.PI/2));
        const punch=t>0&&side===(p.attackSide||1)?envelope:0;
        const aiming=held[p.weapon]&&p.weapon!=='bat'&&side===1;
        const arm=swimming?1.7+.55*Math.sin((p.swimPhase||0)+side*Math.PI/2):aiming?1.2+punch*.2:punch>0?1.65*punch-.15:p.jumpHeight>0?-.35:-swing*.85+.08;
        put('upperArm',index,0,17.6,side*4.1,arm,p.shirt||'#99906d');
        put('forearm',index,Math.sin(arm)*3.9,17.6-Math.cos(arm)*3.9,side*4.1,arm-.15,p.shirt||'#99906d');
        put('hand',index,Math.sin(arm)*3.9,17.6-Math.cos(arm)*3.9,side*4.1,arm-.15,p.skin||'#c8a582');
        if(side===1&&!swimming&&!down&&held[p.weapon]){
          matrix.multiply(wrist).multiply(weaponRotation.makeRotationZ(-arm+.15));
          held[p.weapon].setMatrixAt(weapons[p.weapon]++,matrix);
        }
      }
    }
    for(const [type,mesh] of Object.entries(held)){mesh.count=weapons[type];mesh.instanceMatrix.needsUpdate=true;}
    for(const [name,mesh] of Object.entries(batches)){
      mesh.count=count*(['head','torso','hair','face'].includes(name)?1:2);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    return count;
  }
  return {update,batches,held};
}
