import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const geometryCache=new Map();
export function streetPropGeometry(type){
  if(geometryCache.has(type))return geometryCache.get(type);
  const parts=[];
  const add=(geometry,color,x,y,z)=>{
    const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');g.translate(x,y,z);
    const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)colors.set([c.r,c.g,c.b],i);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(g);
  };
  const box=(w,h,d,color,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z);
  if(type==='hydrant'){
    add(new THREE.CylinderGeometry(.23,.27,.65,16),'#a84935',0,.43,0);
    add(new THREE.CylinderGeometry(.31,.32,.10,10),'#715e49',0,.06,0);
    add(new THREE.SphereGeometry(.25,10,5),'#b85840',0,.80,0);
    add(new THREE.CylinderGeometry(.13,.13,.70,8).rotateZ(Math.PI/2),'#994431',0,.55,0);
    for(const side of [-1,1])add(new THREE.CylinderGeometry(.16,.16,.09,8).rotateZ(Math.PI/2),'#bfa380',side*.37,.55,0);
    add(new THREE.CylinderGeometry(.17,.17,.16,8).rotateX(Math.PI/2),'#8f7660',0,.45,.28);
    box(.08,.10,.08,'#7c6b52',0,1.02,0);
    for(let n=0;n<6;n++){const a=n*Math.PI/3;add(new THREE.CylinderGeometry(.025,.025,.06,6),'#bdb09a',Math.cos(a)*.27,.1,Math.sin(a)*.27);}
    add(new THREE.TorusGeometry(.08,.012,4,10).rotateY(Math.PI/2),'#736b58',-.37,.55,.04);
    for(let n=0;n<4;n++)box(.014,.045,.014,'#a3967e',-.36+n*.055,.43-n*.055,.04);
  }else if(type==='crate'){
    box(.9,.85,.9,'#806141',0,.48,0);
    for(const side of [-1,1])for(const z of [-.32,0,.32])box(.035,.85,.025,'#443b2c',side*.46,.48,z);
    for(const side of [-1,1])for(const y of [.17,.78]){box(.96,.08,.04,'#b09870',0,y,side*.47);box(.04,.08,.96,'#b09870',side*.47,y,0);}
    for(const x of [-.28,.28])box(.1,.045,.94,'#a7895d',x,.93,0);
    for(const side of [-1,1])for(const y of [.2,.75])for(const x of [-.38,.38])add(new THREE.SphereGeometry(.018,6,4),'#b8b7a3',x,y,side*.496);
    for(const y of [.32,.51,.7])for(const side of [-1,1])box(.92,.013,.009,'#443829',0,y,side*.456);
  }else if(type==='barrel'||type==='trashcan'||type==='bin'){
    const steel=type==='barrel';
    add(new THREE.CylinderGeometry(.4,.38,.85,20),steel?'#8a5842':'#5a6762',0,.47,0);
    for(const y of [.17,.72])add(new THREE.CylinderGeometry(.42,.42,.06,12),'#38413f',0,y,0);
    add(new THREE.CylinderGeometry(.43,.43,.05,12),steel?'#89614a':'#738079',0,.92,0);
    if(steel)add(new THREE.CylinderGeometry(.055,.055,.015,8),'#343d3b',.21,.95,.16);
    else box(.22,.055,.08,'#303c39',0,.98,0);
    for(const y of [.14,.75,.92])add(new THREE.TorusGeometry(.405,.015,5,20).rotateX(Math.PI/2),'#9e9f89',0,y,0);
    if(steel){box(.16,.2,.008,'#ccb78f',0,.52,.401);box(.11,.035,.009,'#3e453b',0,.54,.409);}
    else for(let n=0;n<12;n++){const a=n*Math.PI/6;add(new THREE.CylinderGeometry(.012,.012,.52,5),'#8b9890',Math.cos(a)*.4,.45,Math.sin(a)*.4);}
  }else if(type==='cone'){
    box(.95,.06,.95,'#282f32',0,.03,0);
    add(new THREE.CylinderGeometry(.05,.32,.82,10),'#d88636',0,.48,0);
    add(new THREE.CylinderGeometry(.13,.18,.17,10),'#d8d2b7',0,.62,0);
  }else if(type==='bench'){
    for(const x of [-.34,.34]){box(.055,.55,.42,'#3a484b',x,.3,0);box(.055,.5,.05,'#495856',x,.72,.30);}
    for(let i=0;i<4;i++){box(.95,.035,.15,'#967554',0,.52,-.27+i*.16);box(.95,.06,.035,'#846344',0,.67+i*.09,.31);}
    for(const x of [-.34,.34])for(const y of [.7,.9])add(new THREE.SphereGeometry(.015,6,4),'#c0b69b',x,y,.335);
  }else if(type==='phone'){
    box(.83,.87,.7,'#42585c',0,.47,0);box(.92,.07,.82,'#87928a',0,.98,0);box(.52,.64,.016,'#1c3239',0,.5,.363);
    box(.35,.12,.02,'#b9ad85',0,.77,.38);box(.25,.25,.02,'#91a09a',.09,.51,.38);box(.07,.25,.05,'#202a2c',-.18,.56,.4);
    for(let u=-1;u<=1;u++)for(let v=0;v<3;v++)box(.025,.025,.012,'#d0d0be',u*.055,.30+v*.047,.4);
  }else if(type==='bollard'){
    add(new THREE.CylinderGeometry(.18,.22,.9,16),'#6d7c7a',0,.48,0);add(new THREE.SphereGeometry(.18,12,6),'#8b9690',0,.94,0);
    add(new THREE.CylinderGeometry(.19,.19,.12,16),'#e7d3a4',0,.76,0);box(.58,.07,.58,'#465653',0,.035,0);
  }else if(type==='planter'){
    box(.95,.40,.95,'#918979',0,.23,0);box(1,.07,1,'#b7ad93',0,.47,0);box(.84,.025,.84,'#4c4433',0,.515,0);
    for(const [x,z] of [[-.18,-.2],[.2,.1],[-.15,.23]])add(new THREE.IcosahedronGeometry(.29,1),'#5a7b47',x,.72,z);
  }else if(type==='bikeRack'){
    for(const x of [-.34,0,.34]){
      add(new THREE.TorusGeometry(.38,.045,6,14,Math.PI).rotateY(Math.PI/2),'#9ea9a3',x,.48,0);
      for(const z of [-.38,.38])add(new THREE.CylinderGeometry(.045,.045,.48,8),'#7d8d8a',x,.24,z);
    }
  }else if(type==='mailbox'){
    box(.14,.45,.14,'#677984',0,.24,0);box(.76,.47,.75,'#416c82',0,.70,0);add(new THREE.CylinderGeometry(.38,.38,.75,14,1,false,0,Math.PI).rotateX(Math.PI/2),'#7095a1',0,.93,0);
    box(.40,.04,.02,'#142e3a',0,.85,.389);box(.29,.15,.022,'#b2b7a4',0,.65,.39);box(.04,.07,.03,'#dfcba4',.30,.73,.41);
  }else if(type==='parasol'){
    add(new THREE.CylinderGeometry(.04,.05,.93,10),'#c0b091',0,.48,0);add(new THREE.ConeGeometry(2,.26,16,1,true),'#ba7e5a',0,.88,0);
    for(let n=0;n<8;n++){const a=n*Math.PI/4;box(.025,.05,.4,'#d8c3a2',Math.cos(a)*1.4,.8,Math.sin(a)*1.4);}
    box(.5,.025,.5,'#7f8880',0,.015,0);
  }else if(['stall','kiosk','workzone'].includes(type)){
    box(.94,.72,.94,'#867c64',0,.4,0);box(1.08,.08,1.08,'#a7825e',0,.83,0);box(.6,.4,.018,'#2a444a',0,.5,.48);box(.92,.06,.2,'#c5b793',0,.25,.54);
  }else{
    box(.94,.70,.84,'#496657',0,.5,0);
    const lid=new THREE.BoxGeometry(.50,.07,.92);lid.rotateZ(-.06);add(lid,'#303c36',-.25,.91,0);
    const second=new THREE.BoxGeometry(.50,.07,.92);second.rotateZ(.06);add(second,'#344139',.25,.91,0);
    for(const x of [-.30,.30]){
      box(.12,.025,.035,'#949986',x,.955,.21);
      box(.035,.40,.86,'#6a7b64',x,.5,0);
      for(const z of [-.32,.32])add(new THREE.CylinderGeometry(.075,.075,.065,8).rotateZ(Math.PI/2),'#252d29',x,.08,z);
      box(.09,.02,.035,'#797e6b',x,.92,-.44);
    }
    box(.17,.09,.005,'#b7b09a',.19,.61,.424);
    box(.05,.025,.006,'#787c65',.19,.61,.43);
    for(const x of [-.42,.42])box(.08,.07,.03,'#939c87',x,.68,.44);
    for(const y of [.28,.51])box(.8,.015,.007,'#273c31',0,y,.424);
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();geometryCache.set(type,geometry);return geometry;
}
export function createStreetProps(scene,material,capacity=512){
  const batches={};
  for(const type of ['hydrant','dumpster','crate','barrel','trashcan','cone','bench','bin','phone','bollard','planter','bikeRack','mailbox','parasol','stall','kiosk','workzone']){
    const mesh=new THREE.InstancedMesh(streetPropGeometry(type),material,capacity);mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);batches[type]=mesh;
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  return {batches,update(props,surface){
    const counts=Object.fromEntries(Object.keys(batches).map(type=>[type,0]));
    for(const prop of props.slice(0,capacity)){
      if(prop.intact===false)continue;
      const type=batches[prop.type]?prop.type:'dumpster',index=counts[type]++;
      rotation.setFromAxisAngle(axis,-(prop.angle||0));
      matrix.compose(position.set(prop.x,surface(prop.x,prop.y),prop.y),rotation,scale.set(prop.w||14,prop.collisionHeight||(type==='hydrant'?14:20),prop.h||14));
      batches[type].setMatrixAt(index,matrix);
    }
    for(const type of Object.keys(batches)){batches[type].count=counts[type];batches[type].instanceMatrix.needsUpdate=true;}
    return Object.values(counts).reduce((a,b)=>a+b,0);
  }};
}
