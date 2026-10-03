import * as THREE from 'three';
import {addLoft,addBox,faceNormal} from '../game/vehicle_shapes.js';
import {createVehicleMesh} from '../game/street_vehicle.js';

const geometries=new Map();
const palette={sirenRed:'#e95642',sirenBlue:'#4199e2',sirenAmber:'#e6b352',tail:'#b54c3e'};
export function landVehicleGeometry(type,width=48,height=24,color='#e8b84a',police=false){
  const key=`${type}:${width}:${height}:${color}:${police}`;
  if(geometries.has(key))return geometries.get(key);
  const geometry=surfaceGeometry(createVehicleMesh(type,width,height,color,police).faces);
  geometry.userData.type=type;geometries.set(key,geometry);return geometry;
}
export function surfaceGeometry(faces){
  const positions=[],colors=[],normals=[],surfaces=[],lights=[];
  for(const face of faces){
    const normal=face.normal,drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
    const flat=face.points.map(point=>new THREE.Vector2(...point.filter((_,axis)=>axis!==drop)));
    const triangles=THREE.ShapeUtils.triangulateShape(flat,[]),paint=new THREE.Color(palette[face.fill]||face.fill);
    for(const triangle of triangles){
      const vertices=triangle.map(index=>{const [x,y,z]=face.points[index];return new THREE.Vector3(x,z,y);});
      const winding=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      const ordered=winding.dot(new THREE.Vector3(normal[0],normal[2],normal[1]))<0?[...triangle].reverse():triangle;
      for(const vertex of ordered){
        const [x,y,z]=face.points[vertex];positions.push(x,z,y);colors.push(paint.r,paint.g,paint.b);
        const smooth=face.normals?.[vertex]||normal,n=new THREE.Vector3(smooth[0],smooth[2],smooth[1]).normalize();normals.push(n.x,n.y,n.z);
        const glass=face.surface==='glass'||face.fill==='#263b46'||face.fill==='#34474c',chrome=face.surface==='chrome'||face.fill==='#abb6b4'||face.fill==='#b9c2bf',rubber=face.surface==='rubber'||face.fill==='#1d2428';
        const lamp=face.surface==='lamp'||face.fill==='tail'||face.fill.startsWith('siren')||face.fill==='#fff0b7';
        surfaces.push(glass?.18:chrome?.24:rubber?.96:.44,chrome?.82:glass?.25:rubber?0:.28,lamp?1.3:0);
        if(face.fill.startsWith('siren'))lights.push({index:colors.length-3,color:paint.clone(),blue:face.fill==='sirenBlue'});
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('surface',new THREE.Float32BufferAttribute(surfaces,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingSphere();
  geometry.userData={lights};return geometry;
}

const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.22,side:THREE.DoubleSide});
material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 surface;varying vec3 vehicleSurface;varying vec3 vehiclePosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvehicleSurface=surface;vehiclePosition=position;');
  shader.fragmentShader='varying vec3 vehicleSurface;varying vec3 vehiclePosition;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float grain=fract(sin(dot(floor(vehiclePosition*7.0),vec3(12.9898,78.233,37.719)))*43758.5453);
    if(vehicleSurface.x>.3 && vehicleSurface.z<.1){float wear=sin(vehiclePosition.x*.63+vehiclePosition.z*1.9)*sin(vehiclePosition.y*.83);diffuseColor.rgb*=.90+grain*.12+wear*.035;}
    if(vehicleSurface.x<.21){float sky=smoothstep(-.3,.9,sin(vehiclePosition.z*.42+vehiclePosition.x*.045));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.38,.43),sky*.38);}
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vehicleSurface.x;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vehicleSurface.y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor.rgb*vehicleSurface.z;');
};
material.customProgramCacheKey=()=> 'lowtown-vehicle-surfaces';
// Boats and aircraft use the same continuous surfaces as the cars. Their
// silhouette, glass and hardware are cached independently of their pose.
const transportGeometries=new Map();
function airWaterGeometry(type,length,breadth,color,medical){
  const key=[type,length,breadth,color,medical].join(':');if(transportGeometries.has(key))return transportGeometries.get(key);
  const shell=[],equipment=[],hardware=[];
  const face=(list,points,fill,surface='paint')=>list.push({points,normal:faceNormal(points),fill,surface,trim:false});
  const box=(list,x,y,l,b,z0,z1,fill,surface='paint')=>addBox(list,x,y,l,b,z0,z1,fill,surface);
  const oval=(list,stations,fill,surface='paint',segments=12,selector=null)=>addLoft(list,stations.map(([x,y,z,ry,rz])=>Array.from({length:segments},(_,i)=>{const a=-i*Math.PI*2/segments;return [x,y+Math.cos(a)*ry,z+Math.sin(a)*rz];})),fill,{surface,fill:selector});
  const beam=(list,a,b,r,fill)=>{const dir=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),u=new THREE.Vector3(0,0,1);if(Math.abs(dir.dot(u))>.9)u.set(0,1,0);u.cross(dir).normalize();const v=dir.clone().cross(u);const rings=[a,b].map(p=>Array.from({length:6},(_,i)=>{const q=new THREE.Vector3(...p).addScaledVector(u,Math.cos(-i*Math.PI/3)*r).addScaledVector(v,Math.sin(-i*Math.PI/3)*r);return q.toArray();}));addLoft(list,rings,fill,{surface:'chrome'});};
  const panel=(x0,x1,y,z0,z1,fill)=>face(equipment,[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],fill,'glass');
  if(type==='helicopter'){
    const paint=medical?'#e5e2d6':color;
    oval(shell,[[-length*.72,0,12,1.3,1.7],[-length*.38,0,11,2.3,2.2],[-length*.23,0,9,7,6],[-length*.10,0,10,10,8],[length*.12,0,9,10,7],[length*.30,0,7,7,5],[length*.39,0,6.5,1,1.5]],paint,'paint',12,(station,band)=>({fill:station===4&&band>=6?'#263b46':paint,surface:station===4&&band>=6?'glass':'paint'}));
    for(const side of [-1,1]){
      panel(-length*.13,length*.05,side*9.5,7,14,'#263b46');panel(length*.065,length*.19,side*8.6,7,13,'#263b46');
      face(equipment,[[length*.20,side*8.5,7],[length*.33,side*5.3,7],[length*.24,side*5,12],[length*.13,side*7.5,14]],'#263b46','glass');
      beam(hardware,[-length*.24,side*12,0],[length*.28,side*12,0],.7,'#69736f');beam(hardware,[length*.28,side*12,0],[length*.34,side*12,2],.7,'#69736f');
      for(const x of [-length*.17,length*.16])beam(hardware,[x,side*6,5],[x,side*12,0],.55,'#69736f');
      if(medical){box(equipment,-length*.24,side*9.7,9,.25,7.5,10,'#bc4339');box(equipment,-length*.18,side*9.7,2.5,.25,5,12.5,'#bc4339');}
    }
    box(equipment,-length*.08,-5,9,10,17,20,paint);
    face(shell,[[-length*.71,-1,12],[-length*.61,-1,12],[-length*.68,-1,24],[-length*.77,-1,22]],paint);face(shell,[[-length*.71,1,12],[-length*.61,1,12],[-length*.68,1,24],[-length*.77,1,22]],paint);
    box(equipment,-length*.59,-10,7,20,11.5,12.5,paint);
    beam(hardware,[0,0,18],[0,0,23],1.2,'#555d60');
  }else if(type==='plane'){
    oval(shell,[[-length*.46,0,10,1.1,1.8],[-length*.32,0,9,3.2,3],[-length*.08,0,8,6,5],[length*.18,0,8,6,5],[length*.35,0,7,4.5,4],[length*.46,0,7,2.5,2.5]],color);
    addLoft(shell,[[-length*.06,13],[-length*.025,16],[length*.16,16],[length*.25,12]].map(([x,z])=>[[x,-4.3,11],[x,-3.7,z],[x,3.7,z],[x,4.3,11]]),color,{caps:false,fill:(s,j)=>({fill:j===0||j===2?'#263b46':color,surface:j===0||j===2?'glass':'paint'})});
    for(const side of [-1,1]){
      face(equipment,[[length*.03,side*5.8,9],[length*.23,side*5.3,8],[length*.16,side*4,15],[-length*.02,side*4.4,16]],'#263b46','glass');
      face(equipment,[[length*.22,side*5.2,8],[length*.31,side*3.5,9],[length*.19,side*3.6,15],[length*.16,side*4,15]],'#263b46','glass');
      const span=breadth*.51;const wing=[[length*.055,side*4,14],[length*.0,side*span,15],[-length*.13,side*span,15],[-length*.18,side*4,14]];
      face(shell,wing,color);face(shell,wing.map(([x,y,z])=>[x,y,z-1]),color);for(let i=0;i<4;i++){const a=wing[i],b=wing[(i+1)%4];face(shell,[a,b,[b[0],b[1],b[2]-1],[a[0],a[1],a[2]-1]],color);}
      face(shell,[[-length*.33,side*2,11],[-length*.36,side*breadth*.22,12],[-length*.47,side*breadth*.22,12],[-length*.46,side*2,11]],color);
      beam(hardware,[-length*.08,side*4,6],[-length*.10,side*10,1.8],.65,'#6c7370');oval(hardware,[[-length*.13,side*10,1.8,1.9,1.9],[-length*.09,side*10,1.8,1.9,1.9]],'#1d2428','rubber',10);
      beam(hardware,[-length*.05,side*6,6],[-length*.04,side*span*.66,14],.4,'#7d8785');
    }
    face(shell,[[-length*.31,0,11],[-length*.42,0,29],[-length*.47,0,28],[-length*.47,0,11]],color);
    face(equipment,[[length*.16,-3.7,16],[length*.16,3.7,16],[length*.25,4.3,12],[length*.25,-4.3,12]],'#263b46','glass');
    oval(equipment,[[length*.455,0,7,2.7,2.7],[length*.50,0,7,.3,.3]],'#aeb6b4','chrome');
    beam(hardware,[length*.2,0,5],[length*.22,0,1.8],.6,'#626b6f');
  }else{
    const tug=type==='tug',l=length,b=breadth,paint=tug?'#38474b':color;
    const stations=[[-.49,.32],[-.40,.47],[-.16,.5],[.20,.46],[.38,.31],[.50,.025]].map(([x,width])=>[[x*l,-width*b,5],[x*l,-width*b*.93,0],[x*l,-width*b*.50,-5],[x*l,0,-7],[x*l,width*b*.50,-5],[x*l,width*b*.93,0],[x*l,width*b,5]]);
    addLoft(shell,stations,paint,{fill:(s,j)=>({fill:!tug&&j>=1&&j<=4?'#743c3a':paint,surface:'paint'})});
    const deck=stations.map(r=>r[0]).concat(stations.map(r=>r.at(-1)).reverse());face(equipment,deck,tug?'#716957':'#d4cdbb');
    if(tug){
      box(equipment,-l*.18,-b*.30,l*.36,b*.60,5,21,'#b49153');box(equipment,-l*.20,-b*.32,l*.40,b*.64,21,23,'#5f6056');
      for(const side of [-1,1])for(let i=0;i<3;i++)panel(-l*.155+i*l*.11,-l*.075+i*l*.11,side*b*.305,13,19,'#263b46');
      for(let i=0;i<3;i++)face(equipment,[[l*.185,-b*.26+i*b*.18,13],[l*.185,-b*.11+i*b*.18,13],[l*.185,-b*.11+i*b*.18,19],[l*.185,-b*.26+i*b*.18,19]],'#263b46','glass');
      oval(hardware,[[-l*.3,0,9,3.2,3.2],[-l*.19,0,9,3.2,3.2]],'#525b5b','chrome');
      beam(hardware,[-l*.05,0,23],[-l*.05,0,43],.65,'#c1b295');beam(hardware,[-l*.05,-7,35],[-l*.05,7,35],.5,'#b6aa87');
      oval(equipment,[[-l*.29,0,12,3,3],[-l*.25,0,12,3,3]],'#985f3e');
      for(const side of [-1,1])for(const x of [-.36,-.14,.08,.28]){const y=side*b*(Math.abs(x)>.25?.45:.51);const ring=Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return [x*l+Math.cos(a)*3.5,y,1+Math.sin(a)*3.5];});face(hardware,ring,'#1d2428','rubber');const hole=ring.map(([a,c,z])=>[x*l+(a-x*l)*.48,c+side*.03,1+(z-1)*.48]);face(hardware,hole,'#0f1619','rubber');}
    }else{
      box(equipment,-l*.30,-b*.30,l*.30,b*.6,5,6.5,'#b5a78e');for(const side of [-1,1]){box(equipment,-l*.25,side<0?-b*.27:b*.07,l*.12,b*.20,6.5,10,'#8c4a40');}
      face(equipment,[[l*.11,-b*.33,6],[l*.11,b*.33,6],[-l*.015,b*.29,13],[-l*.015,-b*.29,13]],'#263b46','glass');
      for(const side of [-1,1])beam(hardware,[l*.11,side*b*.33,6],[-l*.015,side*b*.29,13],.45,'#aeb6b4');
      oval(equipment,[[-l*.50,0,10,3.5,5],[-l*.42,0,10,3.5,5]],'#343e44');
    }
    for(const side of [-1,1]){const points=stations.map(r=>r[side<0?0:r.length-1]);for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];beam(hardware,[a[0],a[1],8],[b[0],b[1],8],.35,'#939a92');if(i%2===0)beam(hardware,[a[0],a[1],5],[a[0],a[1],8],.3,'#939a92');}}
  }
  const result=[shell,equipment,hardware].map(faces=>surfaceGeometry(faces));transportGeometries.set(key,result);return result;
}
export function createTransportVisual(vehicle){
  const type=vehicle.model||vehicle.type||'sedan',group=new THREE.Group();group.userData.type=type;
  if(['plane','helicopter','speedboat','tug'].includes(type)){
    const defaults={plane:[86,80],helicopter:[64,26],speedboat:[66,26],tug:[90,38]},[length,breadth]=defaults[type];
    for(const geometry of airWaterGeometry(type,vehicle.width||length,vehicle.height||breadth,vehicle.color||'#b8b8a7',!!vehicle.medical))group.add(new THREE.Mesh(geometry,material));
    if(type==='helicopter'||type==='plane'){
      const rotor=new THREE.Group(),faces=[];
      if(type==='helicopter'){addBox(faces,-43,-1.2,86,2.4,-.3,.3,'#546267','chrome');addBox(faces,-1.2,-43,2.4,86,-.3,.3,'#546267','chrome');rotor.position.y=23;group.userData.rotor=rotor;}
      else{addBox(faces,-.35,-1, .7,2,-6,6,'#384346');rotor.position.set((vehicle.width||length)*.48,7,0);group.userData.propeller=rotor;}
      rotor.add(new THREE.Mesh(surfaceGeometry(faces),material));group.add(rotor);
    }
  }else group.add(new THREE.Mesh(landVehicleGeometry(type,vehicle.width||48,vehicle.height||24,vehicle.color||'#e8b84a',/police/i.test(type)||!!vehicle.isPolice),material));
  return group;
}
export function updateTransportVisual(group,vehicle,time,altitude=0){
  const water=vehicle.kind==='water'||['tug','speedboat'].includes(group.userData.type);
  group.position.set(vehicle.x,(water?-6:3.6)+altitude,vehicle.y);group.rotation.y=-(vehicle.angle||0);
  if(group.userData.rotor)group.userData.rotor.rotation.y=time*32;
  if(group.userData.propeller)group.userData.propeller.rotation.x=time*40;
  const geometry=group.children[0]?.geometry;
  if(geometry?.userData.lights?.length){
    const attribute=geometry.getAttribute('color');
    for(const light of geometry.userData.lights){const power=(Math.sin(time*12)>0)!==light.blue?1:.28;
      attribute.array[light.index]=light.color.r*power;attribute.array[light.index+1]=light.color.g*power;attribute.array[light.index+2]=light.color.b*power;}
    attribute.needsUpdate=true;
  }
}
