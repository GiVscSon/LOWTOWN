import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {characterPose} from '../shared/character_pose.js';

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
      [new THREE.SphereGeometry(2.25,14,8),'#ffffff',0,20.8,0,[.88,1.12,.86]],
      [new THREE.CylinderGeometry(1.05,1.25,2.1,10),'#d3c3b4',0,18.4,0],
      [new THREE.SphereGeometry(.6,8,6),'#efe3d8',2,20.55,0,[1.2,.8,.55]],
      [new THREE.SphereGeometry(.55,8,5),'#d1bfb1',0,20.6,-1.95,[.6,1,.6]],
      [new THREE.SphereGeometry(.55,8,5),'#d1bfb1',0,20.6,1.95,[.6,1,.6]],
      [new THREE.SphereGeometry(1.1,10,6),'#e8d6c4',1.05,19.15,0,[.65,.55,.8]]
    ]),
    hair:combine([[new THREE.SphereGeometry(2.3,16,7,0,Math.PI*2,0,Math.PI*.56),'#ffffff',-.22,21.1,0,[.95,1.05,.93]],
      [box(.18,.2,.8),'#b9a897',1.85,21.65,-.9],[box(.18,.2,.8),'#b9a897',1.85,21.65,.9]]),
    face:combine([
      ...[-1,1].flatMap(side=>[
        [new THREE.SphereGeometry(.32,8,4),'#ded6c7',1.89,21.22,side*.83,[.42,.7,1]],
        [new THREE.SphereGeometry(.17,6,4),'#333f41',2.035,21.23,side*.85,[.45,.9,1]],
        [box(.12,.17,.62),'#47372d',1.84,21.67,side*.85],
        [new THREE.SphereGeometry(.13,6,4),'#614c41',2.4,20.24,side*.28,[.4,.5,1]],
        [box(.08,.08,.16),'#f4efdf',2.08,21.3,side*.88]
      ]),
      [box(.12,.16,1),'#866453',1.97,19.8,0],
      [box(.12,.035,.7),'#4d3931',2.05,19.83,0],
      [box(.10,.08,.62),'#c19b83',2,19.65,0]
    ]),
    thigh:combine([[capsule(1.4,3.6),'#ffffff',0,-2.9,0],[box(.13,4.5,.2),'#a5aaae',1.25,-2.9,0]]),
    shin:combine([[capsule(1.18,3.4),'#ffffff',0,-2.8,0],[box(.15,.18,2),'#969c9e',.95,-4.7,0]]),
    shoe:combine([[new THREE.SphereGeometry(1,10,6),'#2c3235',.7,-5.4,0,[2,.75,1.25]],[box(3.9,.35,2.7),'#747775',.7,-6.05,0],
      ...[-.15,.3,.75].map(x=>[box(.1,.15,1.5),'#a5a394',x,-4.75,0])]),
    upperArm:combine([[capsule(1.15,2.3),'#ffffff',0,-1.9,0],[box(.12,2.5,.2),'#8e9698',1.05,-1.7,0]]),
    forearm:combine([[capsule(1,2.2),'#ffffff',0,-1.75,0],[new THREE.CylinderGeometry(1.06,1.06,.4,10),'#dad5c8',0,-3.25,0]]),
    hand:combine([[new THREE.SphereGeometry(.85,8,5),'#ffffff',0,-3.85,0,[.8,1.1,1]],
      ...[-.55,-.18,.18,.55].map(z=>[new THREE.CapsuleGeometry(.18,.65,2,5),'#ffffff',.06,-4.75,z]),
      [new THREE.CapsuleGeometry(.25,.45,2,5).rotateZ(-.6),'#dfcfc1',.7,-3.95,0]])
  };
  return geometries;
}
export function characterBaseHeight(person,surface=0,pose=characterPose(person)){
  if(person.inWater)return pose.waterBase+pose.bob;
  // The sole reaches -.525 in the neutral pose; keep it on the actual deck.
  const height=person.visualScale||1;
  return surface+.025+.525*height+(pose.down||pose.gettingUp ? 2.45*height*Math.sin(Math.abs(pose.rootPitch)) : (person.jumpHeight||0)+pose.bob);
}
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
  const personal={};
  for(const [type,geometry] of Object.entries({
    cup:combine([[new THREE.CylinderGeometry(.75,.6,1.6,10),'#d9d3bb',0,.7,0],[new THREE.CylinderGeometry(.58,.58,.1,10),'#594430',0,1.55,0]]),
    phone:combine([[box(.35,2.2,1.3),'#242c30',0,1,0],[box(.12,1.6,1),'#809a9c',.22,1.1,0]]),
    book:combine([[box(2.5,.5,3.4),'#769287',0,0,0],[box(2.1,.2,3.1),'#d4cfb6',0,.3,0]]),
    bag:combine([[box(2.5,4,2),'#ba9870',0,-2,0],[new THREE.TorusGeometry(.65,.12,4,8),'#756045',0,.3,0]])
  })){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);personal[type]=mesh;
  }
  const accessories={};
  const accessoryGeometry={
    cap:combine([[new THREE.SphereGeometry(2.4,16,7,0,Math.PI*2,0,Math.PI*.5),'#698984',0,22,0,[1,.65,1]],[box(2,.2,3),'#486c69',2,22,0]]),
    hardhat:combine([[new THREE.SphereGeometry(2.6,16,8,0,Math.PI*2,0,Math.PI*.55),'#dbb452',0,22,0,[1,.7,1]],[new THREE.CylinderGeometry(2.8,2.8,.3,16),'#c79b36',0,22,0],[box(.25,.7,4),'#edcf76',0,23.8,0]]),
    scarf:combine([[new THREE.CylinderGeometry(1.7,1.7,1,10),'#b17c61',0,18.7,0],[box(.5,4,1.2),'#a36852',2.45,16.4,1.5],[new THREE.SphereGeometry(.55,8,5),'#bc8b71',2.2,18.6,1.5]]),
    glasses:combine([...[-1,1].map(side=>[new THREE.TorusGeometry(.53,.09,6,12).rotateY(Math.PI/2),'#b1aaa0',2.09,21.2,side*.85]),[box(.1,.09,.65),'#b1aaa0',2.13,21.2,0]]),
    beard:combine([[new THREE.SphereGeometry(1.6,14,8),'#42352b',.45,19.35,0,[.9,.56,1]],[box(.18,.2,1.1),'#42352b',2.06,20,0]]),
    backpack:combine([[new THREE.SphereGeometry(2.7,12,8),'#6c816b',-2.45,14.8,0,[.5,1.2,.8]],[box(.3,6,.3),'#313d31',.2,16.5,-2.75],[box(.3,6,.3),'#313d31',.2,16.5,2.75],[box(.5,2,2.7),'#51674f',-3.95,13.5,0]]),
    vest:combine([[box(.4,5.5,5.3),'#273139',2.35,15,0],[box(.3,1.6,1.4),'#53616a',2.65,15,-1.5],[box(.3,1.6,1.4),'#53616a',2.65,15,1.5],[box(.15,.7,.8),'#c4af74',2.73,17,1.5]]),
    ponytail:combine([[new THREE.SphereGeometry(1,12,8),'#ffffff',-1.85,20.8,0,[.7,2.5,.9]],[new THREE.TorusGeometry(.65,.12,5,10).rotateX(Math.PI/2),'#493831',-1.85,21.3,0]])
  };
  for(const [type,geometry] of Object.entries(accessoryGeometry)){
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);accessories[type]=mesh;
  }
  let actions={};
  const root=new THREE.Matrix4(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),wrist=new THREE.Matrix4().makeTranslation(0,-4,0),weaponRotation=new THREE.Matrix4(),q=new THREE.Quaternion(),localQ=new THREE.Quaternion(),yawQ=new THREE.Quaternion(),pos=new THREE.Vector3(),size=new THREE.Vector3(1,1,1),rootSize=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),sideAxis=new THREE.Vector3(0,0,1),forwardAxis=new THREE.Vector3(1,0,0),color=new THREE.Color();
  const put=(name,index,x,y,z,angle=0,paint=null,yaw=0)=>{
    localQ.setFromAxisAngle(sideAxis,angle).multiply(yawQ.setFromAxisAngle(up,yaw));local.compose(pos.set(x,y,z),localQ,size);matrix.multiplyMatrices(root,local);
    batches[name].setMatrixAt(index,matrix);batches[name].setColorAt(index,color.set(paint||'#ffffff'));
  };
  function update(people,surface){
    const weapons={bat:0,pistol:0,shotgun:0,flare:0};
    const items={cup:0,phone:0,book:0,bag:0};actions={};
    const equipped=Object.fromEntries(Object.keys(accessories).map(type=>[type,0]));
    const count=Math.min(capacity,people.length);
    for(let i=0;i<count;i++){
      const p=people[i],swimming=!!p.inWater,pose=characterPose(p),down=pose.down||pose.gettingUp;
      actions[pose.action]=(actions[pose.action]||0)+1;
      q.setFromAxisAngle(up,-(p.heading??p.angle??0));
      q.multiply(localQ.setFromAxisAngle(sideAxis,pose.rootPitch)).multiply(localQ.setFromAxisAngle(forwardAxis,pose.rootRoll));
      const heading=p.heading??p.angle??0;
      const height=swimming?1:(p.visualScale||1),build=p.bodyBuild||1;
      rootSize.set(height*build,height,height*build*(p.gender==='woman'?.93:1));
      root.compose(pos.set(p.x+Math.cos(heading)*pose.waterOffset,characterBaseHeight(p,surface(p.x,p.y),pose),p.y+Math.sin(heading)*pose.waterOffset),q,rootSize);
      for(const type of [p.accessory,p.gender==='woman'?'ponytail':null])if(accessories[type]&&!swimming){
        const mesh=accessories[type],index=equipped[type]++;mesh.setMatrixAt(index,root);mesh.setColorAt(index,color.set(type==='ponytail'?(p.hair||'#302720'):'#ffffff'));
      }
      put('torso',i,Math.sin(pose.torsoPitch)*10,10*(1-Math.cos(pose.torsoPitch)),0,pose.torsoPitch,p.shirt||'#99906d',pose.torsoYaw);
      for(const [name,paint] of [['head',p.skin||'#c8a582'],['hair',p.hair||'#302b28'],['face',null]])put(name,i,Math.sin(pose.headPitch)*18.4,18.4*(1-Math.cos(pose.headPitch)),0,pose.headPitch,paint,pose.headYaw);
      for(const side of [-1,1]){
        const limb=side>0?1:0,index=i*2+limb,swing=pose.legs[limb].upper;
        put('thigh',index,0,11.2,side*1.65,swing,p.pants||'#364454');
        const legX=Math.sin(swing)*5.5,legY=11.2-Math.cos(swing)*5.5;
        put('shin',index,legX,legY,side*1.65,pose.legs[limb].lower,p.pants||'#303d4d');put('shoe',index,legX,legY,side*1.65,pose.legs[limb].lower);
        const arm=pose.arms[limb].upper,lower=pose.arms[limb].lower;
        put('upperArm',index,0,17.6,side*4.1,arm,p.shirt||'#99906d');
        put('forearm',index,Math.sin(arm)*3.9,17.6-Math.cos(arm)*3.9,side*4.1,lower,p.shirt||'#99906d');
        put('hand',index,Math.sin(arm)*3.9,17.6-Math.cos(arm)*3.9,side*4.1,lower,p.skin||'#c8a582');
        if(side===1&&!swimming&&!down&&held[p.weapon]){
          matrix.multiply(wrist).multiply(weaponRotation.makeRotationZ(-lower+pose.weaponPitch));
          held[p.weapon].setMatrixAt(weapons[p.weapon]++,matrix);
        }else if(side===1&&!swimming&&!down&&pose.item){
          matrix.multiply(wrist).multiply(weaponRotation.makeRotationZ(-lower));
          personal[pose.item].setMatrixAt(items[pose.item]++,matrix);
        }
      }
    }
    for(const [type,mesh] of Object.entries(held)){mesh.count=weapons[type];mesh.instanceMatrix.needsUpdate=true;}
    for(const [type,mesh] of Object.entries(personal)){mesh.count=items[type];mesh.instanceMatrix.needsUpdate=true;}
    for(const [type,mesh] of Object.entries(accessories)){mesh.count=equipped[type];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    for(const [name,mesh] of Object.entries(batches)){
      mesh.count=count*(['head','torso','hair','face'].includes(name)?1:2);mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    return count;
  }
  return {update,batches,held,personal,accessories,get actions(){return actions;}};
}
