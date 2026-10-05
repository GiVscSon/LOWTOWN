import {createWetReflections} from './wet_reflections.js';
import {createBuildingArchitecture} from './buildings.js';
import {addStreetDetail,addForecourts} from './street_detail.js';
import {mountedSign,apartmentGlassMaterial,createStorefronts} from './storefronts.js';
import * as THREE from 'three';
import {createTransportVisual,updateTransportVisual,setTransportLighting,setTransportEnvironment,disposeTransportVisual} from './vehicles.js';
import {createBoxBatch,ribbonGeometry,addTiledGeometry} from './geometry.js';
import {createCharacterBatch,characterBaseHeight} from './characters.js';
import {characterPose,presentedCharacters} from '../shared/character_pose.js';
import {loadGraphics,changeGraphics,createViewportSizer} from './graphics_settings.js';
import {BEACH_WIDTH} from '../../world/coastline.js';
import {addStreetFurniture} from './street_furniture.js';
import {nearestStreet,streetWidth,onStreetCollection} from '../../world/street_corridors.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {surfaceMaterial,surfaceTexture,glowTexture,waterMaterial as createWaterMaterial} from './materials.js';
import {CAMERA_PRESETS,CAMERA_STORAGE_KEY,cameraFraming} from './camera.js';
import {createBridgeProfiles,bridgeSurfaceIndex,raisedBridgeGeometry,addBridgeStructures} from './bridges.js';
import {createNightEnvironment,contactShadowTexture} from './environment.js';
import {addUrbanTrees,foliageMaterial} from './foliage.js';
import {createWorldEffects} from './effects.js';
import {createStreetProps} from './props.js';

function ground(points,material,elevation=0){
  if(!points?.length)return null;
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=elevation;return mesh;
}

export function createLowtownThreeRenderer({canvas,world,forceFullMaterials=false}){
  if(!canvas)throw new Error('Three.js canvas is missing');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:false,powerPreference:'high-performance',antialias:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const software=debug&&/swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
  let graphics=loadGraphics(),lowCostMaterials=graphics.lighting==='simple'&&!forceFullMaterials;
  const materialPairs=[];
  const pairedMaterial=factory=>{
    const pair={simple:factory(true),detailed:factory(false)};materialPairs.push(pair);return pair[lowCostMaterials?'simple':'detailed'];
  };
  const litMaterial=options=>pairedMaterial(cheap=>cheap?new THREE.MeshLambertMaterial({color:options.color,side:options.side||THREE.FrontSide,vertexColors:!!options.vertexColors}):new THREE.MeshStandardMaterial(options));
  const citySurface=(kind,color)=>pairedMaterial(cheap=>surfaceMaterial(kind,color,cheap));
  let cameraPreset='normal';
  try{const saved=localStorage.getItem(CAMERA_STORAGE_KEY);if(CAMERA_PRESETS.includes(saved))cameraPreset=saved;}catch{}
  const scene=new THREE.Scene();scene.background=new THREE.Color('#07151d');scene.fog=new THREE.FogExp2('#10202a',.000095);
  const environment=createNightEnvironment(renderer);setTransportEnvironment(environment.texture);
  const camera=new THREE.PerspectiveCamera(46,1,2,18000);
  const viewport=createViewportSizer(renderer,camera);
  const ambient=new THREE.HemisphereLight('#9aaec4','#211912',1.25);scene.add(ambient);
  const nightSky=new THREE.Color('#07151d'),daySky=new THREE.Color('#829fac'),duskSky=new THREE.Color('#8b6b71'),nightFog=new THREE.Color('#10202a'),dayFog=new THREE.Color('#98aeb2');
  const nightLight=new THREE.Color('#b7c9db'),dayLight=new THREE.Color('#fff0d0');
  const moon=new THREE.DirectionalLight('#b7c9db',1.8);moon.position.set(-1800,2600,-900);scene.add(moon);
  const fill=new THREE.DirectionalLight('#8aa7bd',.6);fill.position.set(1800,1200,2200);scene.add(fill);
  const staticGroup=new THREE.Group();scene.add(staticGroup);
  const shadowGroup=new THREE.Group(),reflectionGroup=new THREE.Group();staticGroup.add(shadowGroup,reflectionGroup);
  const bridgeProfiles=createBridgeProfiles(world.paint?.bridgePaths||[]),bridgeSurface=bridgeSurfaceIndex(bridgeProfiles);
  const groundRise=(x,y)=>Math.max(0,(bridgeSurface(x,y)?.height||3.6)-3.6);
  const surfaceY=(x,y)=>bridgeSurface(x,y)?.height||3.15;
  const land=litMaterial({color:'#303a2c',roughness:1,side:THREE.DoubleSide});
  const beach=litMaterial({color:'#857853',roughness:1,side:THREE.DoubleSide});
  for(const island of world.islands||[]){
    const mesh=ground(island.points,island.beach?beach:land,island.beach?-.4:0),shore=[],width=island.natural?42:BEACH_WIDTH;
    // Match the collision beach's constant distance from each coast segment.
    // The old scaled polygon exposed walkable ground as visible open water.
    for(let i=0;i<island.points.length;i++){
      const a=new THREE.Vector2(...island.points[i]),b=new THREE.Vector2(...island.points[(i+1)%island.points.length]);
      shore.push(ribbonGeometry([a,b],width*2,-.8));
      const cap=new THREE.CircleGeometry(width,48).rotateX(-Math.PI/2).translate(a.x,-.8,a.y);cap.deleteAttribute('uv');shore.push(cap);
    }
    addTiledGeometry(staticGroup,mergeGeometries(shore),beach);for(const deck of shore)deck.dispose();
    if(mesh)staticGroup.add(mesh);
  }
  const waterMaterial=pairedMaterial(cheap=>createWaterMaterial(cheap));
  const water=new THREE.Mesh(new THREE.PlaneGeometry(world.width+7000,world.height+7000),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(world.width/2,-7,world.height/2);staticGroup.add(water);
  const groundBoxes=createBoxBatch(staticGroup,'#161c20',1,undefined,litMaterial({color:0xffffff,roughness:1})),details=createBoxBatch(staticGroup,'#606451',.85,undefined,litMaterial({color:0xffffff,roughness:.85}));
  const pavingMaterial=citySurface('paving',0xffffff),asphaltMaterial=citySurface('asphalt',0xffffff),woodMaterial=citySurface('wood',0xffffff);
  const paving=createBoxBatch(staticGroup,'#625f53',1,undefined,pavingMaterial);
  const asphalt=createBoxBatch(staticGroup,'#31383b',.88,undefined,asphaltMaterial);
  const timber=createBoxBatch(staticGroup,'#887050',1,undefined,woodMaterial);
  const reflectors=createBoxBatch(staticGroup,'#dfc991',1,undefined,new THREE.MeshBasicMaterial({color:0xffffff}));
  const shadowMaterial=new THREE.MeshBasicMaterial({color:'#050d13',map:contactShadowTexture(),transparent:true,opacity:.29,depthWrite:false,side:THREE.DoubleSide});
  shadowMaterial.forceSinglePass=true;
  const staticShadows=createBoxBatch(shadowGroup,'#ffffff',1,new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),shadowMaterial);
  const glowMaterial=new THREE.MeshBasicMaterial({color:0xffffff,map:glowTexture(),transparent:true,opacity:.36,blending:THREE.AdditiveBlending,depthWrite:false});
  const reflectionMaterial=new THREE.MeshBasicMaterial({color:0xffffff,map:glowTexture(true),transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  glowMaterial.forceSinglePass=reflectionMaterial.forceSinglePass=true;
  const pools=createBoxBatch(staticGroup,'#ff942e',1,new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),glowMaterial);
  const reflections=createBoxBatch(reflectionGroup,'#ffb458',1,new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),reflectionMaterial);
  const roadReflection=(x,z,color='#ffb458')=>{
    if(world.paint?.organic){
      const hit=nearestStreet(x,z,world.roads||[]);if(!hit||hit.distance>120)return;
      let length=190;const cs=Math.cos(hit.angle),sn=Math.sin(hit.angle),width=Math.min(62,streetWidth(hit.road)*.48);
      while(length>35&&![-1,1].every(a=>[-1,1].every(b=>onStreetCollection(hit.x+cs*a*length/2-sn*b*width/2,hit.y+sn*a*length/2+cs*b*width/2,world.roads))))length*=.7;
      if(length>35)reflections.add(hit.x,surfaceY(hit.x,hit.y)+.13,hit.y,length,1,width,color,-hit.angle);return;
    }
    let closest=null;
    for(const road of world.roads||[]){const px=Math.max(road.x+8,Math.min(road.x+road.w-8,x)),pz=Math.max(road.y+8,Math.min(road.y+road.h-8,z)),distance=Math.hypot(px-x,pz-z);
      if(!closest||distance<closest.distance)closest={x:px,z:pz,distance,road};}
    if(!closest||closest.distance>120)return;
    const h=closest.road.dir==='h';
    reflections.add(closest.x,3.28,closest.z,h?180:60,1,h?60:180,color);
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
  const motorMaterial=citySurface('asphalt','#3e4b54');
  let bridgeArches=0,bridgePiers=0;
  for(const profile of bridgeProfiles){
    motorDecks.push(raisedBridgeGeometry(profile));bridgeUndersides.push(raisedBridgeGeometry(profile,true));
    const structure=addBridgeStructures(profile,{details,reflectors});bridgeArches+=structure.arches;bridgePiers+=structure.piers;
  }
  const mergeDecks=(decks,material)=>{if(!decks.length)return;addTiledGeometry(staticGroup,mergeGeometries(decks),material);for(const deck of decks)deck.dispose();};
  mergeDecks(scenicDecks,citySurface('paving','#a39b7e'));mergeDecks(motorDecks,motorMaterial);
  const streetMaterial=citySurface('asphalt','#41484d');
  mergeDecks(streetDecks,streetMaterial);mergeDecks(pavementDecks,citySurface('paving','#716c60'));
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
  const streetDetail=addStreetDetail(world,staticGroup);
  streetDetail.forecourts=addForecourts(world,staticGroup,citySurface('paving','#716c60'));
  const architecture=createBuildingArchitecture(staticGroup,lowCostMaterials,{surface:citySurface,lit:litMaterial,glass:apartmentGlassMaterial});
  const storefronts=createStorefronts(staticGroup,{details,pools,roadReflection,lit:citySurface});
  for(const [index,b] of (world.buildings||[]).entries()){
    const placement=architecture.add(b,index),{height,x,z}=placement;
    staticShadows.add(x+height*.16,3.24,z+height*.1,b.w+height*.32,1,b.h+height*.2);
    storefronts.add(b,placement,index);
  }
  const storefrontDetail=storefronts.flush();
  const trees=addUrbanTrees(staticGroup,world.trees||[],{material:pairedMaterial(foliageMaterial),lit:litMaterial,shadows:staticShadows});
  const furniture=addStreetFurniture(world,{details,reflectors,pools,roadReflection,mountedSign,scene:staticGroup});
  for(const board of world.billboards||[]){details.add(board.x,32,board.y,4,64,4,'#606a61');const sign=mountedSign(board.text,95);sign.position.set(board.x,62,board.y);staticGroup.add(sign);}
  for(const crane of world.cranes||[]){details.add(crane.x,65,crane.y,5,130,5,'#b88845');details.add(crane.x+crane.reach/2,130,crane.y,Math.abs(crane.reach),5,5,'#b88845');}
  groundBoxes.flush();paving.flush();asphalt.flush();timber.flush();reflectors.flush();staticShadows.flush();pools.flush();reflections.flush();details.flush();architecture.flush();

  const actors=new Map(),characters=createCharacterBatch(scene,512,litMaterial({color:0xffffff,vertexColors:true,roughness:.92}));
  const actorShadows=new THREE.InstancedMesh(new THREE.CircleGeometry(.5,12).rotateX(-Math.PI/2),shadowMaterial,1024);
  actorShadows.frustumCulled=false;scene.add(actorShadows);
  const lampReflections=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),reflectionMaterial,512);
  lampReflections.frustumCulled=false;scene.add(lampReflections);
  const worldEffects=createWorldEffects(scene);
  const props=createStreetProps(scene,litMaterial({color:0xffffff,vertexColors:true,roughness:.8,metalness:.12}));
  const parts=new THREE.InstancedMesh(new THREE.OctahedronGeometry(6),new THREE.MeshBasicMaterial({color:'#e9b94e'}),32);
  parts.frustumCulled=false;scene.add(parts);
  const markerCanvas=document.createElement('canvas');markerCanvas.width=markerCanvas.height=64;
  const markerContext=markerCanvas.getContext('2d');markerContext.fillStyle='#ffb828';markerContext.strokeStyle='#191813';markerContext.lineWidth=6;
  markerContext.beginPath();markerContext.moveTo(12,13);markerContext.lineTo(52,13);markerContext.lineTo(32,51);markerContext.closePath();markerContext.fill();markerContext.stroke();
  const playerMarker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(markerCanvas),toneMapped:false,depthWrite:false}));
  playerMarker.scale.set(13,13,1);scene.add(playerMarker);
  const headlight=new THREE.SpotLight('#ffdea2',1600,260,.45,.5,1);headlight.target=new THREE.Object3D();scene.add(headlight,headlight.target);
  const pursuitLight=new THREE.SpotLight('#b6d5ef',1800,650,.48,.65,1);pursuitLight.target=new THREE.Object3D();scene.add(pursuitLight,pursuitLight.target);
  const searchCone=new THREE.Mesh(new THREE.ConeGeometry(90,180,24,1,true),new THREE.MeshBasicMaterial({color:'#b6d5ef',transparent:true,opacity:.045,depthWrite:false,side:THREE.DoubleSide}));scene.add(searchCone);
  const wetReflections=createWetReflections(scene,world,surfaceY,software);wetReflections.exclude([shadowGroup,reflectionGroup,actorShadows,lampReflections,playerMarker]);
  let previousRenderCpu=0;
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(1,1,1);
  const rainPositions=new Float32Array(240*6),rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
  const rain=new THREE.LineSegments(rainGeometry,new THREE.LineBasicMaterial({color:'#9bb6c6',transparent:true,opacity:.35}));rain.frustumCulled=false;scene.add(rain);
  wetReflections.exclude([rain,searchCone,...Object.values(worldEffects.batches)]);
  const fireGroup=new THREE.Group();scene.add(fireGroup);
  const flameMaterial=new THREE.MeshBasicMaterial({color:'#ea7738',transparent:true,opacity:.8}),smokeMaterial=new THREE.MeshBasicMaterial({color:'#3b4348',transparent:true,opacity:.28,depthWrite:false});
  const flames=Array.from({length:12},()=>{const mesh=new THREE.Mesh(new THREE.ConeGeometry(7,28,5),flameMaterial);fireGroup.add(mesh);return mesh;});
  const smoke=Array.from({length:10},()=>{const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(11,0),smokeMaterial);fireGroup.add(mesh);return mesh;});
  staticGroup.updateMatrixWorld(true);
  const staticBounds=[];
  staticGroup.traverse(object=>{
    if(!object.isMesh||!object.frustumCulled)return;
    object.matrixAutoUpdate=false;
    if(object.isInstancedMesh){object.computeBoundingSphere();staticBounds.push({object,sphere:object.boundingSphere.clone().applyMatrix4(object.matrixWorld)});}
    else {object.geometry.computeBoundingSphere();staticBounds.push({object,sphere:object.geometry.boundingSphere.clone().applyMatrix4(object.matrixWorld)});}
  });
  const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4(),actorSphere=new THREE.Sphere();
  let frames=0,cameraReady=false,lastPlayerPosition=null,lastMode=null,lastTime=performance.now(),contextLost=false;
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;});canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;cameraReady=false;});
  function render(frame){
    const now=performance.now(),elapsed=Math.max(0,now-lastTime),dt=Math.min(.1,elapsed/1000),time=frame.animationTime??now/1000;lastTime=now;
    const width=Math.max(1,canvas.clientWidth||innerWidth),height=Math.max(1,canvas.clientHeight||innerHeight),ratio=graphics.resolution;
    viewport.update(width,height,ratio);
    const p=frame.player,altitude=Math.max(0,frame.altitude||0),foot=frame.mode==='foot',live=new Set();
    const heading=p.angle||0,cameraHeading=foot?-Math.PI*.75:heading,mobile=width<700,framing=cameraFraming(cameraPreset,foot,mobile);
    const playerRise=altitude>12?0:groundRise(p.x,p.y);
    const distance=framing.distance+altitude*1.5,sideOffset=framing.sideOffset,desired=new THREE.Vector3(p.x-Math.cos(cameraHeading)*distance-Math.sin(cameraHeading)*sideOffset,framing.height+playerRise+altitude*1.35,p.y-Math.sin(cameraHeading)*distance+Math.cos(cameraHeading)*sideOffset);
    const teleported=lastPlayerPosition&&Math.hypot(p.x-lastPlayerPosition.x,p.y-lastPlayerPosition.y)>900;
    if(!cameraReady||teleported||lastMode!==frame.mode){camera.position.copy(desired);cameraReady=true;}else camera.position.lerp(desired,1-Math.exp(-9*dt));
    lastMode=frame.mode;lastPlayerPosition={x:p.x,y:p.y};camera.lookAt(p.x,24+playerRise+altitude*.35,p.y);camera.updateMatrixWorld();
    viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
    const range=({near:1400,normal:2400,far:3800}[graphics.distance])+altitude*3;
    const visible=(actor,radius=48)=>{
      if(Math.hypot(actor.x-p.x,actor.y-p.y)>range+radius)return false;
      actorSphere.center.set(actor.x,(actor.altitude||0)+groundRise(actor.x,actor.y)+18,actor.y);actorSphere.radius=radius;
      return frustum.intersectsSphere(actorSphere);
    };
    const visibleSignals=furniture.update(frame.signals,visible);
    for(const {object,sphere} of staticBounds)object.visible=Math.hypot(sphere.center.x-p.x,sphere.center.z-p.y)<=range+sphere.radius;
    shadowGroup.visible=actorShadows.visible=graphics.shadows;
    reflectionGroup.visible=lampReflections.visible=graphics.reflections;
    let visibleVehicles=0;
    const drawVehicle=(key,vehicle,lift=0)=>{
      live.add(key);const type=vehicle.model||vehicle.type||'sedan',stamp=`${type}:${vehicle.width}:${vehicle.height}:${vehicle.color}:${!!vehicle.medical}:${!!vehicle.isPolice}`;let entry=actors.get(key);
      if(key!==p&&!visible({...vehicle,altitude:lift},Math.max(48,(vehicle.width||48)*.8))){if(entry)entry.group.visible=false;return;}
      if(!entry||entry.stamp!==stamp){if(entry){disposeTransportVisual(entry.group);scene.remove(entry.group);}entry={group:createTransportVisual(vehicle),stamp};actors.set(key,entry);scene.add(entry.group);}
      entry.group.visible=true;visibleVehicles++;setTransportLighting(entry.group,lowCostMaterials);
      const water=vehicle.kind==='water'||['tug','speedboat'].includes(type),airborne=lift>12;
      const rise=water||airborne?0:groundRise(vehicle.x,vehicle.y),heading=vehicle.angle||0,length=vehicle.width||48;
      updateTransportVisual(entry.group,vehicle,time,lift+rise-(vehicle.inWater?Math.min(25,(vehicle.waterTime||0)*9):0),frame.weather||{},key===p||(vehicle.hp??100)<85||Math.hypot(vehicle.x-p.x,vehicle.y-p.y)<650);
      const slope=water||airborne?0:Math.atan2(groundRise(vehicle.x+Math.cos(heading)*length/2,vehicle.y+Math.sin(heading)*length/2)
        -groundRise(vehicle.x-Math.cos(heading)*length/2,vehicle.y-Math.sin(heading)*length/2),length);
      entry.group.quaternion.setFromAxisAngle(axis,-heading).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),slope));
    };
    if(!foot)drawVehicle(p,{...p,type:frame.mode,model:frame.mode,color:p.bodyColor||p.color},altitude);
    for(const vehicle of frame.vehicles||[])if(vehicle!==p&&Number.isFinite(vehicle.x)&&Number.isFinite(vehicle.y))drawVehicle(vehicle,vehicle,vehicle.altitude||0);
    for(const [key,entry] of actors)if(!live.has(key)){disposeTransportVisual(entry.group);scene.remove(entry.group);actors.delete(key);}
    const allPeople=presentedCharacters(p,frame.pedestrians||[],foot);
    const people=allPeople.filter(person=>visible(person,24));characters.update(people,(x,y)=>groundRise(x,y)+3.6);
    const grounded=[...new Set([...(foot?[]:[p]),...(frame.vehicles||[])])].filter(v=>v!==p||!foot).filter(v=>v.kind!=='water'&&!['speedboat','tug'].includes(v.type)&&!(v.altitude>12)&&!(v===p&&altitude>12)&&visible(v,Math.max(48,v.width||48)));
    let shadowCount=0,reflectionCount=0;
    for(const actor of graphics.shadows?[...people,...grounded]:[]){
      if(actor.inWater)continue;
      if(shadowCount>=1024)break;const person=shadowCount<people.length,jumpScale=1-Math.min(.35,(actor.jumpHeight||0)*.012),w=person?12*jumpScale:(actor.width||48)*1.12,h=person?9*jumpScale:(actor.height||24)*1.08;
      rotation.setFromAxisAngle(axis,-(actor.angle||0));matrix.compose(new THREE.Vector3(actor.x+2,surfaceY(actor.x+2,actor.y+1)+.08,actor.y+1),rotation,new THREE.Vector3(w,1,h));actorShadows.setMatrixAt(shadowCount++,matrix);
    }
    for(const vehicle of graphics.reflections?grounded:[]){
      if(reflectionCount>=508)break;const heading=vehicle.angle||0,w=vehicle.width||48,h=vehicle.height||24;
      const cs=Math.cos(heading),sn=Math.sin(heading),reflectionAngle=Math.atan2(camera.position.z-vehicle.y,camera.position.x-vehicle.x);
      rotation.setFromAxisAngle(axis,-reflectionAngle);
      for(const end of [-1,1])for(const side of [-1,1]){
        const length=end<0?w*1.25:w*1.7,dx=Math.cos(reflectionAngle)*length*.3,dz=Math.sin(reflectionAngle)*length*.3;
        const x=vehicle.x+cs*w*end*.46-sn*h*side*.32+dx,z=vehicle.y+sn*w*end*.46+cs*h*side*.32+dz;
        if(!onStreetCollection(x,z,world.roads||[])&&!bridgeSurface(x,z))continue;
        matrix.compose(new THREE.Vector3(x,surfaceY(x,z)+.14,z),rotation,new THREE.Vector3(length,1,h*.7));
        lampReflections.setMatrixAt(reflectionCount,matrix);lampReflections.setColorAt(reflectionCount++,new THREE.Color(end<0?'#e93219':'#f2c16c'));
      }
    }
    actorShadows.count=shadowCount;actorShadows.instanceMatrix.needsUpdate=true;lampReflections.count=reflectionCount;lampReflections.instanceMatrix.needsUpdate=true;
    if(lampReflections.instanceColor)lampReflections.instanceColor.needsUpdate=true;
    playerMarker.position.set(p.x,p.inWater?12:playerRise+altitude+(foot?35+(p.jumpHeight||0):28),p.y);playerMarker.visible=altitude<12;
    const intact=(frame.props||[]).filter(prop=>prop.intact!==false&&visible(prop,32));
    const propCount=props.update(intact,(x,y)=>groundRise(x,y)+3.6);
    const collectibles=(frame.parts||[]).filter(part=>!part.found&&visible(part,24));parts.count=Math.min(32,collectibles.length);rotation.setFromAxisAngle(axis,time);
    for(let i=0;i<parts.count;i++){const part=collectibles[i];matrix.compose(new THREE.Vector3(part.x,16+Math.sin(time*2+i)*3,part.y),rotation,scale);parts.setMatrixAt(i,matrix);}parts.instanceMatrix.needsUpdate=true;
    const air=frame.pursuitAir;
    pursuitLight.visible=searchCone.visible=!!air&&Math.hypot(air.x-p.x,air.y-p.y)<800;
    if(air){const target=air.searchTarget||p,start=new THREE.Vector3(air.x,air.altitude,air.y),finish=new THREE.Vector3(target.x,surfaceY(target.x,target.y),target.y),beam=new THREE.Vector3().subVectors(start,finish);pursuitLight.position.copy(start);pursuitLight.target.position.copy(finish);searchCone.position.copy(start).add(finish).multiplyScalar(.5);searchCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),beam.clone().normalize());searchCone.scale.y=beam.length()/180;}
    headlight.visible=!foot&&altitude<12;headlight.position.set(p.x+Math.cos(heading)*23,12+playerRise,p.y+Math.sin(heading)*23);headlight.target.position.set(p.x+Math.cos(heading)*130,surfaceY(p.x+Math.cos(heading)*130,p.y+Math.sin(heading)*130),p.y+Math.sin(heading)*130);
    const weather=frame.weather||{},amount=weather.rain||0;setTransportEnvironment(environment.texture,graphics.reflections?.65:0);scene.fog.density=.000095+(weather.fog||0)*.0004;motorMaterial.roughness=.72-.32*(weather.wetness||0);waterMaterial.roughness=.44+amount*.12;
    const daylight=weather.daylight||0,lamps=weather.lamps??1,twilight=weather.twilight||0;
    scene.background.copy(nightSky).lerp(daySky,daylight).lerp(duskSky,twilight*.32);scene.fog.color.copy(nightFog).lerp(dayFog,daylight);
    ambient.intensity=1.25+daylight*.65;ambient.color.copy(nightLight).lerp(dayLight,daylight);
    moon.color.copy(nightLight).lerp(dayLight,daylight);moon.intensity=(1.8+daylight*.9)*(1-amount*.28)+(weather.flash||0)*5;
    if(daylight>.01)moon.position.set(Math.cos((weather.hour-6)*Math.PI/12)*2800,800+Math.max(0,weather.solar||0)*2800,-900);else moon.position.set(-1800,2600,-900);
    fill.intensity=.6+daylight*.3;glowMaterial.opacity=.36*lamps;
    for(const pair of materialPairs)for(const material of [pair.simple,pair.detailed])if(material.map===surfaceTexture('asphalt'))material.roughness=.9-.44*(weather.wetness||0);
    reflectionMaterial.opacity=(.08+.8*(weather.wetness||0))*lamps;
    for(const pair of materialPairs)for(const material of [pair.simple,pair.detailed])if(material.userData.shader?.uniforms.rippleTime)material.userData.shader.uniforms.rippleTime.value=time;
    for(const pair of materialPairs)for(const material of [pair.simple,pair.detailed])if(material.userData.wind){material.userData.wind.time.value=time;material.userData.wind.strength.value=weather.wind||0;}
    rain.visible=graphics.rain&&amount>.03;if(rain.visible){
      for(let i=0;i<240;i++){const x=p.x+((i*173.31+time*(weather.wind||1)*32)%1600)-800,z=p.y+((i*117.13)%1600)-800,y=(i*37.19-time*500)%600+600;rainPositions.set([x,y,z,x-6*(weather.wind||1),y-18,z+3],i*6);}
      rainGeometry.attributes.position.needsUpdate=true;rain.material.opacity=.15+amount*.4;
    }
    const incident=frame.incident;fireGroup.visible=!!incident&&incident.kind==='fire'&&visible(incident,240);if(fireGroup.visible){
      smokeMaterial.color.set(incident.fireSuppressed?'#839c99':'#3b4348');smokeMaterial.opacity=incident.fireSuppressed?.12:.28;
      fireGroup.position.set(incident.x,4,incident.y);flames.forEach((flame,i)=>{flame.visible=!incident.fireSuppressed;flame.position.set(Math.sin(i*2.3)*20,12,Math.cos(i*2.3)*20);flame.scale.y=.7+Math.sin(time*9+i)*.25;});
      smoke.forEach((mesh,i)=>{const rise=(time*18+i*17)%180;mesh.position.set(Math.sin(i*2.3)*16+rise*.17,30+rise,Math.cos(i*2.3)*16);mesh.scale.setScalar(1+rise*.012);});
    }
    const visibleEffects=worldEffects.update(frame.effects,camera,(x,y)=>groundRise(x,y)+3.6,visible,graphics.effects);
    const wetReflectionStats=wetReflections.update(p,weather,graphics,previousRenderCpu);
    if(!contextLost)renderer.render(scene,camera);previousRenderCpu=performance.now()-now;frames++;globalThis.__lowtownLastFrame=performance.now();
    globalThis.__lowtownThreeStats={frames,vehicles:(frame.vehicles||[]).length+(foot?0:1),visibleVehicles,pedestrians:allPeople.length,visiblePedestrians:people.length,objects:scene.children.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,contextLost,renderQuality:ratio/Math.min(globalThis.devicePixelRatio||1,1.5),software:!!software,lowCostMaterials,
      graphics:{...graphics},resolution:{ratio,width:canvas.width,height:canvas.height,resizes:viewport.resizes},renderCpuMs:performance.now()-now,
      streetDetail:{...streetDetail,shopWindows:storefrontDetail.windows},
      visualDetail:{environment:true,trees:trees.count,canopyTriangles:trees.canopyTriangles,architecture:{...architecture.stats},props:propCount,effects:visibleEffects},
      streetFurniture:{lights:(world.lights||[]).length,props:(world.props||[]).length,signals:furniture.signals,visibleSignals},
      bridges:{spans:bridgeProfiles.length,arches:bridgeArches,piers:bridgePiers},
      wetReflections:wetReflectionStats,pursuitSearchLight:pursuitLight.visible,peopleTypes:Object.fromEntries([...new Set(allPeople.map(p=>p.personType||'player'))].map(type=>[type,allPeople.filter(p=>(p.personType||'player')===type).length])),
      characterActions:{...characters.actions},
      climate:{hour:weather.hour??22,daylight,lamps,kind:weather.kind,rain:amount},
      camera:{preset:cameraPreset,x:camera.position.x,y:camera.position.y,z:camera.position.z,distance:Math.hypot(camera.position.x-p.x,camera.position.z-p.y),fov:camera.fov},player:{x:p.x,y:p.y,altitude,groundElevation:playerRise,jumpHeight:p.jumpHeight||0,attackTime:p.attackTime||0,inWater:!!p.inWater,waterTime:p.waterTime||0,animation:foot?characterPose(p).action:p.visualTransition?'enter-vehicle':'driving',visualY:foot?characterBaseHeight(p,playerRise+3.6):actors.get(p)?.group.position.y}};
  }
  function dispose(){wetReflections.dispose();const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    for(const geometry of geometries)geometry.dispose();for(const material of materials){for(const key of ['map','normalMap','roughnessMap'])material[key]?.dispose();material.userData.cabinTexture?.dispose();material.dispose();}setTransportEnvironment(null,0);environment.dispose();renderer.dispose();}
  return {render,dispose,scene,camera,renderer,bridgeProfiles,bridgeSurface,get cameraPreset(){return cameraPreset;},get graphics(){return {...graphics};},
    setGraphics(patch){
      graphics=changeGraphics(graphics,patch);lowCostMaterials=graphics.lighting==='simple'&&!forceFullMaterials;
      const replacements=new Map();for(const pair of materialPairs){const selected=pair[lowCostMaterials?'simple':'detailed'];replacements.set(pair.simple,selected);replacements.set(pair.detailed,selected);}
      scene.traverse(object=>{if(replacements.has(object.material))object.material=replacements.get(object.material);});
      return {...graphics};
    },
    setCameraPreset(preset){if(!CAMERA_PRESETS.includes(preset))return cameraPreset;cameraPreset=preset;cameraReady=false;
      try{localStorage.setItem(CAMERA_STORAGE_KEY,preset);}catch{}return cameraPreset;}};
}
