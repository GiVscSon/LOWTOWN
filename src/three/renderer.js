import * as THREE from 'three';
import {createTransportVisual,updateTransportVisual} from './vehicles.js';
import {createBoxBatch,ribbonGeometry} from './geometry.js';
import {nearestStreet,streetWidth} from '../game/street_corridors.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surfaceMaterial,glowTexture,waterMaterial as createWaterMaterial} from './materials.js';
import {CAMERA_PRESETS,CAMERA_STORAGE_KEY,cameraFraming} from './camera.js';
import {createBridgeProfiles,bridgeSurfaceIndex,raisedBridgeGeometry,addBridgeStructures} from './bridges.js';

function ground(points,material,elevation=0){
  if(!points?.length)return null;
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=elevation;return mesh;
}
function mountedSign(text,width,color='#f4ad52'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#10191f';ctx.fillRect(0,0,512,64);
  ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.lineWidth=3;ctx.strokeRect(2,2,508,60);
  ctx.fillStyle=color;ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,33,490);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,Math.min(12,width/8)),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
}

export function createLowtownThreeRenderer({canvas,world,forceFullMaterials=false}){
  if(!canvas)throw new Error('Three.js canvas is missing');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:false,powerPreference:'high-performance',antialias:(globalThis.devicePixelRatio||1)<2});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=debug&&/swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
  const lowCostMaterials=!!software&&!forceFullMaterials;
  const litMaterial=options=>lowCostMaterials?new THREE.MeshLambertMaterial({color:options.color,side:options.side||THREE.FrontSide}):new THREE.MeshStandardMaterial(options);
  let renderQuality=software?.5:1,frameAverage=16,qualityFrames=0;
  let cameraPreset='normal';
  try{const saved=localStorage.getItem(CAMERA_STORAGE_KEY);if(CAMERA_PRESETS.includes(saved))cameraPreset=saved;}catch{}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#07151d');scene.fog=new THREE.FogExp2('#10202a',.000095);
  const camera=new THREE.PerspectiveCamera(46,1,2,18000);
  scene.add(new THREE.HemisphereLight('#9aaec4','#211912',1.25));
  const moon=new THREE.DirectionalLight('#b7c9db',1.8);moon.position.set(-1800,2600,-900);scene.add(moon);
  const fill=new THREE.DirectionalLight('#8aa7bd',.6);fill.position.set(1800,1200,2200);scene.add(fill);
  const staticGroup=new THREE.Group();scene.add(staticGroup);
  const bridgeProfiles=createBridgeProfiles(world.paint?.bridgePaths||[]),bridgeSurface=bridgeSurfaceIndex(bridgeProfiles);
  const groundRise=(x,y)=>Math.max(0,(bridgeSurface(x,y)?.height||3.6)-3.6);
  const surfaceY=(x,y)=>bridgeSurface(x,y)?.height||3.15;
  const land=litMaterial({color:'#303a2c',roughness:1,side:THREE.DoubleSide});
  const beach=litMaterial({color:'#857853',roughness:1,side:THREE.DoubleSide});
  for(const island of world.islands||[]){
    const bank=ground(island.points,beach,-.8),mesh=ground(island.points,land,0);
    if(bank){bank.geometry.computeBoundingBox();const center=bank.geometry.boundingBox.getCenter(new THREE.Vector3());
      bank.geometry.translate(-center.x,0,-center.z);bank.scale.set(1.018,1,1.018);bank.position.set(center.x,-.8,center.z);staticGroup.add(bank);}
    if(mesh)staticGroup.add(mesh);
  }
  const waterMaterial=createWaterMaterial(lowCostMaterials);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(world.width+7000,world.height+7000),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(world.width/2,-7,world.height/2);staticGroup.add(water);
  const groundBoxes=createBoxBatch(staticGroup,'#161c20',1,undefined,litMaterial({color:0xffffff,roughness:1})),details=createBoxBatch(staticGroup,'#606451',.85,undefined,litMaterial({color:0xffffff,roughness:.85}));
  const pavingMaterial=surfaceMaterial('paving',0xffffff,lowCostMaterials),asphaltMaterial=surfaceMaterial('asphalt',0xffffff,lowCostMaterials),woodMaterial=surfaceMaterial('wood',0xffffff,lowCostMaterials);
  const paving=createBoxBatch(staticGroup,'#625f53',1,undefined,pavingMaterial);
  const asphalt=createBoxBatch(staticGroup,'#31383b',.88,undefined,asphaltMaterial);
  const timber=createBoxBatch(staticGroup,'#887050',1,undefined,woodMaterial);
  const reflectors=createBoxBatch(staticGroup,'#dfc991',1,undefined,new THREE.MeshBasicMaterial({color:0xffffff}));
  const shadowMaterial=new THREE.MeshBasicMaterial({color:'#050d13',transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide});
  shadowMaterial.forceSinglePass=true;
  const staticShadows=createBoxBatch(staticGroup,'#ffffff',1,new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),shadowMaterial);
  const glowMaterial=new THREE.MeshBasicMaterial({color:0xffffff,map:glowTexture(),transparent:true,opacity:.36,blending:THREE.AdditiveBlending,depthWrite:false});
  const reflectionMaterial=new THREE.MeshBasicMaterial({color:0xffffff,map:glowTexture(true),transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false});
  glowMaterial.forceSinglePass=reflectionMaterial.forceSinglePass=true;
  const pools=createBoxBatch(staticGroup,'#ff942e',1,new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),glowMaterial);
  const reflections=createBoxBatch(staticGroup,'#ffb458',1,new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),reflectionMaterial);
  const roadReflection=(x,z,color='#ffb458')=>{
    if(world.paint?.organic){
      const hit=nearestStreet(x,z,world.roads||[]);if(!hit||hit.distance>120)return;
      reflections.add(hit.x,3.28,hit.y,100,1,23,color,-hit.angle);return;
    }
    let closest=null;
    for(const road of world.roads||[]){const px=Math.max(road.x+8,Math.min(road.x+road.w-8,x)),pz=Math.max(road.y+8,Math.min(road.y+road.h-8,z)),distance=Math.hypot(px-x,pz-z);
      if(!closest||distance<closest.distance)closest={x:px,z:pz,distance,road};}
    if(!closest||closest.distance>120)return;
    const h=closest.road.dir==='h';
    reflections.add(closest.x,3.28,closest.z,h?100:23,1,h?23:100,color);
  };
  const line=(a,b,width,color,elevation=4)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)return;
    details.add((a.x+b.x)/2,elevation,(a.y+b.y)/2,length,.25,width,color,-Math.atan2(dy,dx));
  };
  const dashed=(points,color,width=2.5,phase=0)=>{
    const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve(points[i-1],points[i]));
    const length=curve.getLength();for(let distance=-(phase%36);distance<length;distance+=36){
      if(distance+16<=0)continue;
      const a=curve.getPoint(Math.max(0,distance)/length),b=curve.getPoint(Math.min(1,(distance+16)/length));line({x:a.x,y:a.y},{x:b.x,y:b.y},width,color);
    }
  };
  const streetDecks=[],pavementDecks=[];
  for(const road of world.roads||[]){
    // Offshore approach rectangles do not acquire an unsupported sidewalk.
    const shoulder=road.bridgeApproach?0:80;
    if(road.points){
      const points=road.points.map(p=>new THREE.Vector2(...p)),width=streetWidth(road);
      pavementDecks.push(ribbonGeometry(points,width+shoulder,1.5));streetDecks.push(ribbonGeometry(points,width,3));
      for(const p of [points[0],points.at(-1)])for(const [decks,radius,height] of [[streetDecks,width/2,3],[pavementDecks,(width+shoulder)/2,1.5]]){
        const cap=new THREE.CircleGeometry(radius,20).rotateX(-Math.PI/2).translate(p.x,height,p.y);cap.deleteAttribute('uv');decks.push(cap);
      }
      continue;
    }
    paving.add(road.x+road.w/2,1,road.y+road.h/2,road.w+shoulder,1,road.h+shoulder);
    asphalt.add(road.x+road.w/2,2.5,road.y+road.h/2,road.w,1,road.h);
  }
  const scenicDecks=[],motorDecks=[],bridgeUndersides=[];
  for(const road of world.scenicRoads||[]){
    const points=road.points.map(([x,y])=>new THREE.Vector2(x,y));
    scenicDecks.push(ribbonGeometry(points,road.width,2.9));
  }
  const motorMaterial=surfaceMaterial('asphalt','#3e4b54',lowCostMaterials);
  let bridgeArches=0,bridgePiers=0;
  for(const profile of bridgeProfiles){
    motorDecks.push(raisedBridgeGeometry(profile));bridgeUndersides.push(raisedBridgeGeometry(profile,true));
    const structure=addBridgeStructures(profile,{details,reflectors});bridgeArches+=structure.arches;bridgePiers+=structure.piers;
  }
  const mergeDecks=(decks,material)=>{if(!decks.length)return;const mesh=new THREE.Mesh(mergeGeometries(decks),material);staticGroup.add(mesh);for(const deck of decks)deck.dispose();};
  mergeDecks(scenicDecks,surfaceMaterial('paving','#a39b7e',lowCostMaterials));mergeDecks(motorDecks,motorMaterial);
  const streetMaterial=surfaceMaterial('asphalt','#26313a',lowCostMaterials);
  mergeDecks(streetDecks,streetMaterial);mergeDecks(pavementDecks,surfaceMaterial('paving','#716c60',lowCostMaterials));
  mergeDecks(bridgeUndersides,litMaterial({color:'#344a59',roughness:1,side:THREE.DoubleSide}));
  for(const bridge of world.bridges||[])if(bridge.footway){
    timber.add(bridge.x+bridge.w/2,1.5,bridge.y+bridge.h/2,bridge.w,3,bridge.h);
    const horizontal=bridge.dir==='h',length=horizontal?bridge.w:bridge.h;
    for(let d=30;d<length;d+=100){
      const x=bridge.x+(horizontal?d:bridge.w/2),z=bridge.y+(horizontal?bridge.h/2:d);
      details.add(x,-2,z,horizontal?4:bridge.w,7,horizontal?bridge.h:4,'#655b47');
    }
  }
  // Use the actual open rail intervals: railings must not close boardwalk
  // elbows, connected landings, or perpendicular streets.
  for(const rail of world.bridgeRails||[]){
    if(!(world.bridges||[]).some(b=>b.footway&&rail.x+rail.w>=b.x-14&&rail.x<=b.x+b.w+14&&rail.y+rail.h>=b.y-14&&rail.y<=b.y+b.h+14))continue;
    const vertical=rail.axis==='x',length=vertical?rail.h:rail.w,x=rail.x+rail.w/2,z=rail.y+rail.h/2;
    details.add(x,18,z,vertical?3:length,3,vertical?length:3,'#b49b73');
    for(let d=8;d<length;d+=75)details.add(vertical?x:rail.x+d,10,vertical?rail.y+d:z,4,18,4,'#8c795b');
  }
  for(const end of world.roadEnds||[]){
    if(Number.isFinite(end.angle)){
      const cs=Math.cos(end.angle),sn=Math.sin(end.angle),x=end.x-cs*10,z=end.y-sn*10;
      line({x:x-sn*end.width*.4,y:z+cs*end.width*.4},{x:x+sn*end.width*.4,y:z-cs*end.width*.4},3,'#d6ceac',3.4);
      for(const side of [-1,1])details.add(x-sn*side*end.width*.4,10,z+cs*side*end.width*.4,4,14,4,'#b9b297');continue;
    }
    const h=end.dir==='h',inset=16,center={x:end.x-(h?end.side*inset:0),y:end.y-(h?0:end.side*inset)};
    line({x:center.x-(h?0:end.width*.38),y:center.y-(h?end.width*.38:0)},
      {x:center.x+(h?0:end.width*.38),y:center.y+(h?end.width*.38:0)},4,'#d6ceac',3.5);
    // A cap and paired bollards give a deliberate, readable street ending.
    paving.add(end.x-(h?end.side*3:0),4,end.y-(h?0:end.side*3),h?6:end.width,3,h?end.width:6);
    for(const side of [-1,1])details.add(center.x+(h?0:side*end.width*.4),10,center.y+(h?side*end.width*.4:0),4,14,4,'#b9b297');
  }
  for(const edge of world.paint?.curbs||[])if(!edge.bridge)line({x:edge.x1,y:edge.y1},{x:edge.x2,y:edge.y2},2,'#817e67',3.5);
  for(const lane of world.paint?.lanes||[])if(!lane.bridge)dashed([new THREE.Vector2(lane.x1,lane.y1),new THREE.Vector2(lane.x2,lane.y2)],'#d5a752',2.5,lane.phase||0);
  for(const stripe of world.crosswalks||[])groundBoxes.add(stripe.x+stripe.w/2,3.15,stripe.y+stripe.h/2,stripe.w,.2,stripe.h,'#b3b5a2',stripe.angle||0);
  for(const pier of world.piers||[])timber.add(pier.x+pier.w/2,-1,pier.y+pier.h/2,pier.w,8,pier.h,'#807052');
  for(const park of world.parks||[])groundBoxes.add(park.x+park.w/2,.4,park.y+park.h/2,park.w,.6,park.h,'#314630');
  for(const runway of world.runways||[]){
    groundBoxes.add(runway.x+runway.w/2,2.6,runway.y+runway.h/2,runway.w,1,runway.h,'#34413d');
    dashed([new THREE.Vector2(runway.x+50,runway.y+runway.h/2),new THREE.Vector2(runway.x+runway.w-50,runway.y+runway.h/2)],'#d6d7bd',3);
    for(let x=runway.x+24;x<runway.x+runway.w;x+=72)for(const side of [0,1])details.add(x,4,runway.y+side*runway.h,3,2,3,'#eedc97');
  }
  for(const pad of world.helipads||[]){
    groundBoxes.add(pad.x,1.4,pad.y,120,2,120,'#435657');
    for(const side of [-1,1])groundBoxes.add(pad.x+side*15,2.5,pad.y,5,.3,45,'#dfcb80');
    groundBoxes.add(pad.x,2.5,pad.y,30,.3,5,'#dfcb80');
  }
  const walls=createBoxBatch(staticGroup,'#4b4540',1,undefined,surfaceMaterial('brick',0xffffff,lowCostMaterials)),windows=createBoxBatch(staticGroup,'#b99b56',1,new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide})),roofs=createBoxBatch(staticGroup,'#37434a',1,undefined,surfaceMaterial('roof',0xffffff,lowCostMaterials));
  const wallColors=['#715347','#615451','#6d5946','#40525c','#555c4b','#5b4b5a'];
  for(const [index,b] of (world.buildings||[]).entries()){
    const height=(b.floors??(2+index%5))*24,x=b.x+b.w/2,z=b.y+b.h/2;
    walls.add(x,height/2+3,z,b.w,height,b.h,wallColors[index%wallColors.length]);roofs.add(x,height+4,z,b.w+2,2,b.h+2,'#39444b');
    staticShadows.add(x+height*.16,3.24,z+height*.1,b.w+height*.32,1,b.h+height*.2);
    roofs.add(x,height+6,z-b.h/2,b.w+4,5,3,'#566066');roofs.add(x,height+6,z+b.h/2,b.w+4,5,3,'#566066');
    roofs.add(x-b.w/2,height+6,z,3,5,b.h,'#566066');roofs.add(x+b.w/2,height+6,z,3,5,b.h,'#566066');
    for(let floor=0;floor<height/24;floor++)for(const side of [0,1])for(const direction of [-1,1]){
      const length=side?b.h:b.w;
      for(let offset=16;offset<length-10;offset+=32){const lit=(offset+floor*17+index*11)%13>4,color=lit?(floor===0?'#f2be71':'#c79653'):'#15222b';
        const wx=side?(direction>0?b.x+b.w+.4:b.x-.4):b.x+offset,wz=side?b.y+offset:(direction>0?b.y+b.h+.4:b.y-.4),angle=side?direction*Math.PI/2:(direction>0?0:Math.PI);
        windows.add(wx,7+floor*24,wz,16,2,1,'#9c8a72',angle);
        windows.add(wx,14+floor*24,wz,14,14,1,'#11171b',angle);
        windows.add(wx+(side?direction*.04:0),14+floor*24,wz+(side?0:direction*.04),10,10,1,color,angle);
        windows.add(wx+(side?direction*.06:0),14+floor*24,wz+(side?0:direction*.06),1,10,1,'#554a3b',angle);}
    }
    if(b.w>90&&b.h>60)roofs.add(x-10,height+9,z-8,Math.min(28,b.w*.15),8,Math.min(18,b.h*.15),'#66716d');
    const neon=b.neon||'#efaa56',angle=({north:Math.PI,south:0,east:Math.PI/2,west:-Math.PI/2})[b.streetFacing]||0;
    const sideways=b.streetFacing==='east'||b.streetFacing==='west',length=sideways?b.h:b.w;
    const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle);
    const facade=(offset=0,depth=0)=>({x:x+nx*((sideways?b.w:b.h)/2+.7+depth)+tx*offset,
      z:z+nz*((sideways?b.w:b.h)/2+.7+depth)+tz*offset});
    if(b.w>90&&b.h>60){
      for(const side of [-1,1]){
        const p=facade(side*length*.24),glow=facade(side*length*.24,18);
        windows.add(p.x,14,p.z,Math.min(34,length*.2),20,1,'#e4a75b',angle);
        details.add(p.x,24,p.z,Math.min(38,length*.22),3,4,'#897358',angle);
        details.add(p.x,14,p.z,1.5,20,2,'#4f4031',angle);
        pools.add(glow.x,3.3,glow.z,58,1,65,'#ff942e',angle);roadReflection(p.x,p.z,neon);
      }
      const door=facade(0,.1),handle=facade(6,1),canopy=facade(0,5);
      windows.add(door.x,12,door.z,14,22,1,'#14212a',angle);
      details.add(handle.x,12,handle.z,1,2,1,'#d8ba72',angle);
      details.add(canopy.x,27,canopy.z,Math.min(110,length*.65),3,13,neon,angle);
      const band=facade(0,.3);
      for(let floor=1;floor<height/24;floor++)details.add(band.x,floor*24+2,band.z,length,2,3,'#544940',angle);
    }
    if(b.sign){const sign=mountedSign(b.sign,Math.min(length*.78,210),neon),p=facade(0,.3);
      sign.position.set(p.x,35,p.z);sign.rotation.y=angle;staticGroup.add(sign);}

  }
  const foliage=createBoxBatch(staticGroup,'#3a5940',1,new THREE.IcosahedronGeometry(.65,0),litMaterial({color:0xffffff,roughness:1}));
  for(const tree of world.trees||[]){const size=tree.size||20;details.add(tree.x,size*.5,tree.y,4,size,4,'#5e4834');foliage.add(tree.x,size*1.2,tree.y,size*1.25,size,size*1.25,'#3a5940');staticShadows.add(tree.x+size*.25,3.22,tree.y+size*.2,size*1.25,1,size*.85);}
  for(const prop of world.props||[]){
    const w=prop.width||prop.w||16,h=prop.height||prop.h||16;
    if(prop.type==='shelter'){
      details.add(prop.x,25,prop.y,w+4,3,h+4,'#63746e');for(const side of [-1,1])details.add(prop.x+side*w*.45,12,prop.y,2,24,2,'#7a8682');details.add(prop.x,8,prop.y+5,w*.75,3,6,'#846d4e');
    }else details.add(prop.x,prop.type==='bollard'?7:12,prop.y,w,prop.type==='bollard'?14:24,h,prop.type==='phone'?'#50798a':'#62715b');
  }
  for(const stop of world.stops||[]){details.add(stop.x,17,stop.y,2,34,2,'#8c927d');details.add(stop.x,32,stop.y,10,9,2,'#debc72');}
  for(const lamp of world.lights||[]){details.add(lamp.x,32,lamp.y,2,64,2,'#657069');reflectors.add(lamp.x+5,64,lamp.y,13,2,5,'#ffc36c');
    pools.add(lamp.x+5,3.3,lamp.y,115,1,130,'#ff942e');roadReflection(lamp.x,lamp.y);}
  for(const board of world.billboards||[]){details.add(board.x,32,board.y,4,64,4,'#606a61');const sign=mountedSign(board.text,95);sign.position.set(board.x,62,board.y);staticGroup.add(sign);}
  for(const crane of world.cranes||[]){details.add(crane.x,65,crane.y,5,130,5,'#b88845');details.add(crane.x+crane.reach/2,130,crane.y,Math.abs(crane.reach),5,5,'#b88845');}
  groundBoxes.flush();paving.flush();asphalt.flush();timber.flush();reflectors.flush();staticShadows.flush();pools.flush();reflections.flush();details.flush();walls.flush();windows.flush();roofs.flush();const crowns=foliage.flush();
  if(crowns)crowns.material.onBeforeCompile=shader=>{
    shader.uniforms.windTime={value:0};shader.uniforms.windStrength={value:0};crowns.material.userData.shader=shader;
    shader.vertexShader='uniform float windTime;uniform float windStrength;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(windTime*2.0+instanceMatrix[3].x*.02)*windStrength*(position.y+.7)*.08;');
  };

  const actors=new Map(),personBatch=new THREE.InstancedMesh(new THREE.CylinderGeometry(3.7,4.6,10,6),litMaterial({color:0xffffff,roughness:1}),512);
  const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(3.1,6,4),litMaterial({color:'#c1a17b',roughness:1}),512);
  personBatch.frustumCulled=heads.frustumCulled=false;scene.add(personBatch,heads);
  const legs=new THREE.InstancedMesh(new THREE.BoxGeometry(2.4,7,2.4),litMaterial({color:'#344451',roughness:1}),1024);
  legs.frustumCulled=false;scene.add(legs);
  const arms=new THREE.InstancedMesh(new THREE.BoxGeometry(2,8,2),litMaterial({color:0xffffff,roughness:1}),1024);
  arms.frustumCulled=false;scene.add(arms);
  const actorShadows=new THREE.InstancedMesh(new THREE.CircleGeometry(.5,12).rotateX(-Math.PI/2),shadowMaterial,1024);
  actorShadows.frustumCulled=false;scene.add(actorShadows);
  const lampReflections=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),reflectionMaterial,512);
  lampReflections.frustumCulled=false;scene.add(lampReflections);
  const props=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),litMaterial({color:0xffffff,roughness:.75}),128);
  const parts=new THREE.InstancedMesh(new THREE.OctahedronGeometry(6),new THREE.MeshBasicMaterial({color:'#e9b94e'}),32);
  props.frustumCulled=parts.frustumCulled=false;scene.add(props,parts);
  const headlight=new THREE.SpotLight('#ffdea2',1600,260,.45,.5,1);headlight.target=new THREE.Object3D();scene.add(headlight,headlight.target);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(1,1,1);
  const rainPositions=new Float32Array(240*6),rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#9bb6c6',transparent:true,opacity:.35}));rain.frustumCulled=false;scene.add(rain);
  const fireGroup=new THREE.Group();scene.add(fireGroup);
  const flameMaterial=new THREE.MeshBasicMaterial({color:'#ea7738',transparent:true,opacity:.8}),smokeMaterial=new THREE.MeshBasicMaterial({color:'#3b4348',transparent:true,opacity:.28,depthWrite:false});
  const flames=Array.from({length:12},()=>{const mesh=new THREE.Mesh(new THREE.ConeGeometry(7,28,5),flameMaterial);fireGroup.add(mesh);return mesh;});
  const smoke=Array.from({length:10},()=>{const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(11,0),smokeMaterial);fireGroup.add(mesh);return mesh;});
  let frames=0,cameraReady=false,lastPlayerPosition=null,lastTime=performance.now(),contextLost=false;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;});canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;cameraReady=false;});
  function render(frame){
    const now=performance.now(),elapsed=Math.max(0,now-lastTime),dt=Math.min(.1,elapsed/1000),time=now/1000;lastTime=now;
    if(!document.hidden&&frames>4){frameAverage=frameAverage*.9+Math.min(300,elapsed)*.1;qualityFrames++;
      if(qualityFrames>=20&&frameAverage>70){renderQuality=Math.max(.5,renderQuality-.1);qualityFrames=0;}
      else if(!software&&qualityFrames>=120&&frameAverage<25){renderQuality=Math.min(1,renderQuality+.05);qualityFrames=0;}}
    const width=Math.max(1,canvas.clientWidth||innerWidth),height=Math.max(1,canvas.clientHeight||innerHeight),ratio=Math.min(devicePixelRatio||1,1.5)*renderQuality;
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){
      renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }
    const p=frame.player,altitude=Math.max(0,frame.altitude||0),foot=frame.mode==='foot',live=new Set();
    const drawVehicle=(key,vehicle,lift=0)=>{
      live.add(key);const type=vehicle.model||vehicle.type||'sedan',stamp=`${type}:${vehicle.width}:${vehicle.height}:${vehicle.color}`;let entry=actors.get(key);
      if(!entry||entry.stamp!==stamp){if(entry)scene.remove(entry.group);entry={group:createTransportVisual(vehicle),stamp};actors.set(key,entry);scene.add(entry.group);}
      const water=vehicle.kind==='water'||['tug','speedboat'].includes(type),airborne=lift>12;
      const rise=water||airborne?0:groundRise(vehicle.x,vehicle.y),heading=vehicle.angle||0,length=vehicle.width||48;
      updateTransportVisual(entry.group,vehicle,time,lift+rise);
      const slope=water||airborne?0:Math.atan2(groundRise(vehicle.x+Math.cos(heading)*length/2,vehicle.y+Math.sin(heading)*length/2)
        -groundRise(vehicle.x-Math.cos(heading)*length/2,vehicle.y-Math.sin(heading)*length/2),length);
      entry.group.quaternion.setFromAxisAngle(axis,-heading).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),slope));
    };
    if(!foot)drawVehicle(p,{...p,type:frame.mode,model:frame.mode},altitude);
    for(const vehicle of frame.vehicles||[])if(vehicle!==p&&Number.isFinite(vehicle.x)&&Number.isFinite(vehicle.y))drawVehicle(vehicle,vehicle,vehicle.altitude||0);
    for(const [key,entry] of actors)if(!live.has(key)){scene.remove(entry.group);actors.delete(key);}
    const people=foot?[...(frame.pedestrians||[]),{...p,heading:p.angle,shirt:'#b99964'}]:frame.pedestrians||[];personBatch.count=heads.count=Math.min(512,people.length);legs.count=arms.count=personBatch.count*2;
    for(let i=0;i<personBatch.count;i++){
      const person=people[i],down=person.knockdownTimer>0||person.stance==='down',rise=groundRise(person.x,person.y)+3.6;rotation.setFromAxisAngle(axis,-(person.heading||0));
      if(down)rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));const bob=down?0:Math.sin(person.walkPhase||0)*.5;
      matrix.compose(new THREE.Vector3(person.x,rise+(down?4:12+bob),person.y),rotation,scale);personBatch.setMatrixAt(i,matrix);personBatch.setColorAt(i,new THREE.Color(person.shirt||'#99906d'));
      matrix.compose(new THREE.Vector3(person.x,rise+(down?4:18+bob),person.y+(down?7:0)),rotation,scale);heads.setMatrixAt(i,matrix);
      for(const side of [-1,1]){const heading=person.heading||0,stride=down?0:Math.sin(person.walkPhase||0)*side*2;
        matrix.compose(new THREE.Vector3(person.x-Math.sin(heading)*side*2+Math.cos(heading)*stride,rise+(down?4:3.5),person.y+Math.cos(heading)*side*2+Math.sin(heading)*stride-(down?7:0)),rotation,scale);legs.setMatrixAt(i*2+(side>0?1:0),matrix);}
      for(const side of [-1,1]){
        const heading=person.heading||0,stride=down?0:-Math.sin(person.walkPhase||0)*side*1.5;
        matrix.compose(new THREE.Vector3(person.x-Math.sin(heading)*side*4+Math.cos(heading)*stride,rise+(down?4:11+bob),person.y+Math.cos(heading)*side*4+Math.sin(heading)*stride),rotation,scale);
        const index=i*2+(side>0?1:0);arms.setMatrixAt(index,matrix);arms.setColorAt(index,new THREE.Color(person.shirt||'#99906d'));
      }
    }
    personBatch.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=legs.instanceMatrix.needsUpdate=true;if(personBatch.instanceColor)personBatch.instanceColor.needsUpdate=true;
    arms.instanceMatrix.needsUpdate=true;if(arms.instanceColor)arms.instanceColor.needsUpdate=true;
    const grounded=[...new Set([...(foot?[]:[p]),...(frame.vehicles||[])])].filter(v=>v!==p||!foot).filter(v=>v.kind!=='water'&&!['speedboat','tug'].includes(v.type)&&!(v.altitude>12)&&!(v===p&&altitude>12));
    let shadowCount=0,reflectionCount=0;
    for(const actor of [...people,...grounded]){
      if(shadowCount>=1024)break;const person=shadowCount<people.length,w=person?12:(actor.width||48)*1.12,h=person?9:(actor.height||24)*1.08;
      rotation.setFromAxisAngle(axis,-(actor.angle||0));matrix.compose(new THREE.Vector3(actor.x+2,surfaceY(actor.x+2,actor.y+1)+.08,actor.y+1),rotation,new THREE.Vector3(w,1,h));actorShadows.setMatrixAt(shadowCount++,matrix);
    }
    for(const vehicle of grounded){
      if(reflectionCount>=510)break;const heading=vehicle.angle||0,w=vehicle.width||48,h=vehicle.height||24;
      rotation.setFromAxisAngle(axis,-heading);
      for(const side of [-1,1]){
        const x=vehicle.x+Math.cos(heading)*w*side*.75,z=vehicle.y+Math.sin(heading)*w*side*.75;
        matrix.compose(new THREE.Vector3(x,surfaceY(x,z)+.14,z),rotation,new THREE.Vector3(w*.9,1,h*.85));
        lampReflections.setMatrixAt(reflectionCount,matrix);lampReflections.setColorAt(reflectionCount++,new THREE.Color(side<0?'#d73a22':'#e0be83'));
      }
    }
    actorShadows.count=shadowCount;actorShadows.instanceMatrix.needsUpdate=true;lampReflections.count=reflectionCount;lampReflections.instanceMatrix.needsUpdate=true;
    if(lampReflections.instanceColor)lampReflections.instanceColor.needsUpdate=true;
    const intact=(frame.props||[]).filter(prop=>prop.intact!==false);props.count=Math.min(128,intact.length);
    for(let i=0;i<props.count;i++){const prop=intact[i],hydrant=prop.type==='hydrant';rotation.setFromAxisAngle(axis,-(prop.angle||0));
      matrix.compose(new THREE.Vector3(prop.x,groundRise(prop.x,prop.y)+(hydrant?7:10),prop.y),rotation,new THREE.Vector3(prop.w||14,hydrant?14:20,prop.h||14));props.setMatrixAt(i,matrix);props.setColorAt(i,new THREE.Color(hydrant?'#be4636':'#487050'));}
    props.instanceMatrix.needsUpdate=true;if(props.instanceColor)props.instanceColor.needsUpdate=true;
    const collectibles=(frame.parts||[]).filter(part=>!part.found);parts.count=Math.min(32,collectibles.length);rotation.setFromAxisAngle(axis,time);
    for(let i=0;i<parts.count;i++){const part=collectibles[i];matrix.compose(new THREE.Vector3(part.x,16+Math.sin(time*2+i)*3,part.y),rotation,scale);parts.setMatrixAt(i,matrix);}parts.instanceMatrix.needsUpdate=true;
    const heading=p.angle||0,cameraHeading=foot?-Math.PI*.75:heading,mobile=width<700,framing=cameraFraming(cameraPreset,foot,mobile);
    const playerRise=altitude>12?0:groundRise(p.x,p.y);
    const distance=framing.distance+altitude*1.5,sideOffset=framing.sideOffset,desired=new THREE.Vector3(p.x-Math.cos(cameraHeading)*distance-Math.sin(cameraHeading)*sideOffset,framing.height+playerRise+altitude*1.35,p.y-Math.sin(cameraHeading)*distance+Math.cos(cameraHeading)*sideOffset);
    const teleported=lastPlayerPosition&&Math.hypot(p.x-lastPlayerPosition.x,p.y-lastPlayerPosition.y)>900;
    if(!cameraReady||teleported){camera.position.copy(desired);cameraReady=true;}else camera.position.lerp(desired,1-Math.exp(-9*dt));
    lastPlayerPosition={x:p.x,y:p.y};camera.lookAt(p.x,24+playerRise+altitude*.35,p.y);
    headlight.visible=!foot&&altitude<12;headlight.position.set(p.x+Math.cos(heading)*23,12+playerRise,p.y+Math.sin(heading)*23);headlight.target.position.set(p.x+Math.cos(heading)*130,surfaceY(p.x+Math.cos(heading)*130,p.y+Math.sin(heading)*130),p.y+Math.sin(heading)*130);
    const weather=frame.weather||{},amount=weather.rain||0;scene.fog.density=.000095+(weather.fog||0)*.0004;motorMaterial.roughness=.72-.32*(weather.wetness||0);waterMaterial.roughness=.44+amount*.12;
    asphaltMaterial.roughness=streetMaterial.roughness=.88-.3*(weather.wetness||0);moon.intensity=1.8+(weather.flash||0)*5;
    reflectionMaterial.opacity=.08+.38*(weather.wetness||0);
    if(waterMaterial.userData.shader)waterMaterial.userData.shader.uniforms.rippleTime.value=time;
    if(crowns?.material.userData.shader){crowns.material.userData.shader.uniforms.windTime.value=time;crowns.material.userData.shader.uniforms.windStrength.value=weather.wind||0;}
    rain.visible=amount>.03;if(rain.visible){
      for(let i=0;i<240;i++){const x=p.x+((i*173.31+time*(weather.wind||1)*32)%1600)-800,z=p.y+((i*117.13)%1600)-800,y=(i*37.19-time*500)%600+600;rainPositions.set([x,y,z,x-6*(weather.wind||1),y-18,z+3],i*6);}
      rainGeometry.attributes.position.needsUpdate=true;rain.material.opacity=.15+amount*.4;
    }
    const incident=frame.incident;fireGroup.visible=!!incident&&incident.kind==='fire';if(fireGroup.visible){
      smokeMaterial.color.set(incident.fireSuppressed?'#839c99':'#3b4348');smokeMaterial.opacity=incident.fireSuppressed?.12:.28;
      fireGroup.position.set(incident.x,4,incident.y);flames.forEach((flame,i)=>{flame.visible=!incident.fireSuppressed;flame.position.set(Math.sin(i*2.3)*20,12,Math.cos(i*2.3)*20);flame.scale.y=.7+Math.sin(time*9+i)*.25;});
      smoke.forEach((mesh,i)=>{const rise=(time*18+i*17)%180;mesh.position.set(Math.sin(i*2.3)*16+rise*.17,30+rise,Math.cos(i*2.3)*16);mesh.scale.setScalar(1+rise*.012);});
    }
    if(!contextLost)renderer.render(scene,camera);frames++;globalThis.__lowtownLastFrame=performance.now();
    globalThis.__lowtownThreeStats={frames,vehicles:actors.size,pedestrians:people.length,objects:scene.children.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,contextLost,renderQuality,software:!!software,lowCostMaterials,
      bridges:{spans:bridgeProfiles.length,arches:bridgeArches,piers:bridgePiers},
      camera:{preset:cameraPreset,x:camera.position.x,y:camera.position.y,z:camera.position.z,distance:Math.hypot(camera.position.x-p.x,camera.position.z-p.y),fov:camera.fov},player:{x:p.x,y:p.y,altitude,groundElevation:playerRise,visualY:foot?playerRise+3.6:actors.get(p)?.group.position.y}};
  }
  function dispose(){const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    for(const geometry of geometries)geometry.dispose();for(const material of materials){material.map?.dispose();material.dispose();}renderer.dispose();}
  return {render,dispose,scene,camera,renderer,bridgeProfiles,bridgeSurface,get cameraPreset(){return cameraPreset;},
    setCameraPreset(preset){if(!CAMERA_PRESETS.includes(preset))return cameraPreset;cameraPreset=preset;
      try{localStorage.setItem(CAMERA_STORAGE_KEY,preset);}catch{}return cameraPreset;}};
}
