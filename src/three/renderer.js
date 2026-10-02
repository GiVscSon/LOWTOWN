import * as THREE from 'three';
import {createTransportVisual,updateTransportVisual} from './vehicles.js';
import {createBoxBatch,roundedBridgePoints,ribbonGeometry} from './geometry.js';

function ground(points,material,elevation=0){
  if(!points?.length)return null;
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=elevation;return mesh;
}
function mountedSign(text,width){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#10191f';ctx.fillRect(0,0,512,64);
  ctx.strokeStyle='#ba954f';ctx.lineWidth=3;ctx.strokeRect(2,2,508,60);
  ctx.fillStyle='#e1c083';ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,33,490);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,Math.min(12,width/8)),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
}

export function createLowtownThreeRenderer({canvas,world}){
  if(!canvas)throw new Error('Three.js canvas is missing');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:false,powerPreference:'high-performance',antialias:(globalThis.devicePixelRatio||1)<2});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#07151d');scene.fog=new THREE.FogExp2('#10202a',.000095);
  const camera=new THREE.PerspectiveCamera(46,1,2,18000);
  scene.add(new THREE.HemisphereLight('#bccdd6','#282a1f',1.8));
  const moon=new THREE.DirectionalLight('#efd2a5',2);moon.position.set(-1800,2600,-900);scene.add(moon);
  const fill=new THREE.DirectionalLight('#6f9fc4',.9);fill.position.set(1800,1200,2200);scene.add(fill);
  const staticGroup=new THREE.Group();scene.add(staticGroup);
  const land=new THREE.MeshStandardMaterial({color:'#303a2c',roughness:1,side:THREE.DoubleSide});
  const beach=new THREE.MeshStandardMaterial({color:'#857853',roughness:1,side:THREE.DoubleSide});
  for(const island of world.islands||[]){
    const bank=ground(island.points,beach,-.8),mesh=ground(island.points,land,0);
    if(bank){bank.geometry.computeBoundingBox();const center=bank.geometry.boundingBox.getCenter(new THREE.Vector3());
      bank.geometry.translate(-center.x,0,-center.z);bank.scale.set(1.018,1,1.018);bank.position.set(center.x,-.8,center.z);staticGroup.add(bank);}
    if(mesh)staticGroup.add(mesh);
  }
  const waterMaterial=new THREE.MeshStandardMaterial({color:'#102631',roughness:.34,metalness:.32});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(world.width+7000,world.height+7000),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(world.width/2,-7,world.height/2);staticGroup.add(water);
  const groundBoxes=createBoxBatch(staticGroup,'#161c20'),details=createBoxBatch(staticGroup,'#606451');
  const line=(a,b,width,color,elevation=4)=>{
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.01)return;
    details.add((a.x+b.x)/2,elevation,(a.y+b.y)/2,length,.25,width,color,-Math.atan2(dy,dx));
  };
  const dashed=(points,color,width=2.5)=>{
    const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve(points[i-1],points[i]));
    const length=curve.getLength();for(let distance=0;distance<length;distance+=36){
      const a=curve.getPoint(distance/length),b=curve.getPoint(Math.min(1,(distance+16)/length));line({x:a.x,y:a.y},{x:b.x,y:b.y},width,color);
    }
  };
  for(const road of world.roads||[]){
    groundBoxes.add(road.x+road.w/2,1,road.y+road.h/2,road.w+68,1,road.h+68,'#3b3932');
    groundBoxes.add(road.x+road.w/2,2.5,road.y+road.h/2,road.w,1,road.h,'#141a1d');
  }
  for(const road of world.scenicRoads||[]){
    const points=road.points.map(([x,y])=>new THREE.Vector2(x,y));
    staticGroup.add(new THREE.Mesh(ribbonGeometry(points,road.width,2.9),new THREE.MeshStandardMaterial({color:road.footway?'#595b48':'#26312d',roughness:1,side:THREE.DoubleSide})));
  }
  const motorMaterial=new THREE.MeshStandardMaterial({color:'#151f26',roughness:.6,side:THREE.DoubleSide});
  for(const bridge of world.paint?.bridgePaths||[]){
    const points=roundedBridgePoints(bridge.path,bridge.width),deck=ribbonGeometry(points,bridge.width,3.6);
    staticGroup.add(new THREE.Mesh(deck,motorMaterial));dashed(points,'#d5a752');
    const vertices=deck.getAttribute('position');
    // The longitudinal edges get parapets; both entries stay open.
    for(let i=1;i<points.length;i++)for(const side of [0,1]){
      const a=(i-1)*2+side,b=i*2+side,x1=vertices.getX(a),y1=vertices.getZ(a),x2=vertices.getX(b),y2=vertices.getZ(b),length=Math.hypot(x2-x1,y2-y1);
      details.add((x1+x2)/2,9,(y1+y2)/2,length,8,3,'#697b7c',-Math.atan2(y2-y1,x2-x1));
    }
  }
  for(const bridge of world.bridges||[])if(bridge.footway)groundBoxes.add(bridge.x+bridge.w/2,1.5,bridge.y+bridge.h/2,bridge.w,3,bridge.h,'#75664d');
  for(const edge of world.paint?.curbs||[])if(!edge.bridge)line({x:edge.x1,y:edge.y1},{x:edge.x2,y:edge.y2},2,'#817e67',3.5);
  for(const lane of world.paint?.lanes||[])if(!lane.bridge)dashed([new THREE.Vector2(lane.x1,lane.y1),new THREE.Vector2(lane.x2,lane.y2)],'#d5a752');
  for(const stripe of world.crosswalks||[])groundBoxes.add(stripe.x+stripe.w/2,3.15,stripe.y+stripe.h/2,stripe.w,.2,stripe.h,'#b3b5a2');
  for(const pier of world.piers||[])groundBoxes.add(pier.x+pier.w/2,-1,pier.y+pier.h/2,pier.w,8,pier.h,'#605c4b');
  for(const park of world.parks||[])groundBoxes.add(park.x+park.w/2,.4,park.y+park.h/2,park.w,.6,park.h,'#314630');
  for(const runway of world.runways||[]){
    groundBoxes.add(runway.x+runway.w/2,2.6,runway.y+runway.h/2,runway.w,1,runway.h,'#34413d');
    dashed([new THREE.Vector2(runway.x+50,runway.y+runway.h/2),new THREE.Vector2(runway.x+runway.w-50,runway.y+runway.h/2)],'#d6d7bd',3);
    for(let x=runway.x+24;x<runway.x+runway.w;x+=72)for(const side of [0,1])details.add(x,4,runway.y+side*runway.h,3,2,3,'#eedc97');
  }
  const walls=createBoxBatch(staticGroup,'#4b4540'),windows=createBoxBatch(staticGroup,'#b99b56',1,new THREE.PlaneGeometry(1,1)),roofs=createBoxBatch(staticGroup,'#37434a');
  const wallColors=['#4e3c32','#4a4546','#4f4536','#354b53','#444d40','#493e50'];
  for(const [index,b] of (world.buildings||[]).entries()){
    const height=(b.floors??(2+index%5))*24,x=b.x+b.w/2,z=b.y+b.h/2;
    walls.add(x,height/2+3,z,b.w,height,b.h,wallColors[index%wallColors.length]);roofs.add(x,height+4,z,b.w+2,2,b.h+2,'#39444b');
    for(let floor=0;floor<height/24;floor++)for(const side of [0,1])for(const direction of [-1,1]){
      const length=side?b.h:b.w;
      for(let offset=16;offset<length-10;offset+=32){const color=(offset+floor*17+index*11)%13>4?'#c2a05d':'#192c36';
        windows.add(side?(direction>0?b.x+b.w+.2:b.x-.2):b.x+offset,14+floor*24,side?b.y+offset:(direction>0?b.y+b.h+.2:b.y-.2),12,12,1,color,side?direction*Math.PI/2:(direction>0?0:Math.PI));}
    }
    if(b.w>90&&b.h>60)roofs.add(x-10,height+9,z-8,Math.min(28,b.w*.15),8,Math.min(18,b.h*.15),'#66716d');
    if(b.sign){const sign=mountedSign(b.sign,Math.min(b.w*.78,210));sign.position.set(x,28,b.y+b.h+.5);staticGroup.add(sign);}
  }
  const foliage=createBoxBatch(staticGroup,'#3a5940',1,new THREE.IcosahedronGeometry(.65,0));
  for(const tree of world.trees||[]){const size=tree.size||20;details.add(tree.x,size*.5,tree.y,4,size,4,'#5e4834');foliage.add(tree.x,size*1.2,tree.y,size*1.25,size,size*1.25,'#3a5940');}
  for(const prop of world.props||[]){
    const w=prop.width||prop.w||16,h=prop.height||prop.h||16;
    if(prop.type==='shelter'){
      details.add(prop.x,25,prop.y,w+4,3,h+4,'#63746e');for(const side of [-1,1])details.add(prop.x+side*w*.45,12,prop.y,2,24,2,'#7a8682');details.add(prop.x,8,prop.y+5,w*.75,3,6,'#846d4e');
    }else details.add(prop.x,prop.type==='bollard'?7:12,prop.y,w,prop.type==='bollard'?14:24,h,prop.type==='phone'?'#50798a':'#62715b');
  }
  for(const stop of world.stops||[]){details.add(stop.x,17,stop.y,2,34,2,'#8c927d');details.add(stop.x,32,stop.y,10,9,2,'#debc72');}
  for(const lamp of world.lights||[]){details.add(lamp.x,32,lamp.y,2,64,2,'#657069');details.add(lamp.x+5,64,lamp.y,13,2,5,'#e2bb71');}
  for(const board of world.billboards||[]){details.add(board.x,32,board.y,4,64,4,'#606a61');const sign=mountedSign(board.text,95);sign.position.set(board.x,62,board.y);staticGroup.add(sign);}
  for(const crane of world.cranes||[]){details.add(crane.x,65,crane.y,5,130,5,'#b88845');details.add(crane.x+crane.reach/2,130,crane.y,Math.abs(crane.reach),5,5,'#b88845');}
  const pavement=groundBoxes.flush();details.flush();walls.flush();const windowMesh=windows.flush();roofs.flush();const crowns=foliage.flush();
  if(windowMesh){windowMesh.material.dispose();windowMesh.material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});}
  if(crowns)crowns.material.onBeforeCompile=shader=>{
    shader.uniforms.windTime={value:0};shader.uniforms.windStrength={value:0};crowns.material.userData.shader=shader;
    shader.vertexShader='uniform float windTime;uniform float windStrength;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(windTime*2.0+instanceMatrix[3].x*.02)*windStrength*(position.y+.7)*.08;');
  };

  const actors=new Map(),personBatch=new THREE.InstancedMesh(new THREE.CylinderGeometry(3.7,4.6,10,6),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),512);
  const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(3.1,6,4),new THREE.MeshStandardMaterial({color:'#c1a17b',roughness:1}),512);
  personBatch.frustumCulled=heads.frustumCulled=false;scene.add(personBatch,heads);
  const legs=new THREE.InstancedMesh(new THREE.BoxGeometry(2.4,7,2.4),new THREE.MeshStandardMaterial({color:'#344451'}),1024);
  legs.frustumCulled=false;scene.add(legs);
  const props=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.75}),128);
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
    const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-lastTime)/1000)),time=now/1000;lastTime=now;
    const width=Math.max(1,canvas.clientWidth||innerWidth),height=Math.max(1,canvas.clientHeight||innerHeight),ratio=Math.min(devicePixelRatio||1,1.5);
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){
      renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }
    const p=frame.player,altitude=Math.max(0,frame.altitude||0),foot=frame.mode==='foot',live=new Set();
    const drawVehicle=(key,vehicle,lift=0)=>{
      live.add(key);const type=vehicle.model||vehicle.type||'sedan',stamp=`${type}:${vehicle.width}:${vehicle.height}:${vehicle.color}`;let entry=actors.get(key);
      if(!entry||entry.stamp!==stamp){if(entry)scene.remove(entry.group);entry={group:createTransportVisual(vehicle),stamp};actors.set(key,entry);scene.add(entry.group);}
      updateTransportVisual(entry.group,vehicle,time,lift);
    };
    if(!foot)drawVehicle(p,{...p,type:frame.mode,model:frame.mode},altitude);
    for(const vehicle of frame.vehicles||[])if(vehicle!==p&&Number.isFinite(vehicle.x)&&Number.isFinite(vehicle.y))drawVehicle(vehicle,vehicle,vehicle.altitude||0);
    for(const [key,entry] of actors)if(!live.has(key)){scene.remove(entry.group);actors.delete(key);}
    const people=foot?[...(frame.pedestrians||[]),{...p,shirt:'#b99964'}]:frame.pedestrians||[];personBatch.count=heads.count=Math.min(512,people.length);legs.count=personBatch.count*2;
    for(let i=0;i<personBatch.count;i++){
      const person=people[i],down=person.knockdownTimer>0||person.stance==='down';rotation.setFromAxisAngle(axis,-(person.heading||0));
      if(down)rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));const bob=down?0:Math.sin(person.walkPhase||0)*.5;
      matrix.compose(new THREE.Vector3(person.x,down?4:12+bob,person.y),rotation,scale);personBatch.setMatrixAt(i,matrix);personBatch.setColorAt(i,new THREE.Color(person.shirt||'#99906d'));
      matrix.compose(new THREE.Vector3(person.x,down?4:18+bob,person.y+(down?7:0)),rotation,scale);heads.setMatrixAt(i,matrix);
      for(const side of [-1,1]){const heading=person.heading||0,stride=down?0:Math.sin(person.walkPhase||0)*side*2;
        matrix.compose(new THREE.Vector3(person.x-Math.sin(heading)*side*2+Math.cos(heading)*stride,down?4:3.5,person.y+Math.cos(heading)*side*2+Math.sin(heading)*stride-(down?7:0)),rotation,scale);legs.setMatrixAt(i*2+(side>0?1:0),matrix);}
    }
    personBatch.instanceMatrix.needsUpdate=heads.instanceMatrix.needsUpdate=legs.instanceMatrix.needsUpdate=true;if(personBatch.instanceColor)personBatch.instanceColor.needsUpdate=true;
    const intact=(frame.props||[]).filter(prop=>prop.intact!==false);props.count=Math.min(128,intact.length);
    for(let i=0;i<props.count;i++){const prop=intact[i],hydrant=prop.type==='hydrant';rotation.setFromAxisAngle(axis,-(prop.angle||0));
      matrix.compose(new THREE.Vector3(prop.x,hydrant?7:10,prop.y),rotation,new THREE.Vector3(prop.w||14,hydrant?14:20,prop.h||14));props.setMatrixAt(i,matrix);props.setColorAt(i,new THREE.Color(hydrant?'#be4636':'#487050'));}
    props.instanceMatrix.needsUpdate=true;if(props.instanceColor)props.instanceColor.needsUpdate=true;
    const collectibles=(frame.parts||[]).filter(part=>!part.found);parts.count=Math.min(32,collectibles.length);rotation.setFromAxisAngle(axis,time);
    for(let i=0;i<parts.count;i++){const part=collectibles[i];matrix.compose(new THREE.Vector3(part.x,16+Math.sin(time*2+i)*3,part.y),rotation,scale);parts.setMatrixAt(i,matrix);}parts.instanceMatrix.needsUpdate=true;
    const heading=p.angle||0,mobile=width<700,distance=(mobile?480:680)+altitude*1.5,desired=new THREE.Vector3(p.x-Math.cos(heading)*distance-Math.sin(heading)*260,(mobile?580:820)+altitude*1.35,p.y-Math.sin(heading)*distance+Math.cos(heading)*260);
    const teleported=lastPlayerPosition&&Math.hypot(p.x-lastPlayerPosition.x,p.y-lastPlayerPosition.y)>900;
    if(!cameraReady||teleported){camera.position.copy(desired);cameraReady=true;}else camera.position.lerp(desired,1-Math.exp(-9*dt));
    lastPlayerPosition={x:p.x,y:p.y};camera.lookAt(p.x,24+altitude*.35,p.y);
    headlight.visible=!foot&&altitude<12;headlight.position.set(p.x+Math.cos(heading)*23,12,p.y+Math.sin(heading)*23);headlight.target.position.set(p.x+Math.cos(heading)*130,1,p.y+Math.sin(heading)*130);
    const weather=frame.weather||{},amount=weather.rain||0;scene.fog.density=.000095+(weather.fog||0)*.0004;motorMaterial.roughness=.65-.35*(weather.wetness||0);waterMaterial.roughness=.34+amount*.15;
    if(pavement)pavement.material.roughness=.85-.3*(weather.wetness||0);moon.intensity=2+(weather.flash||0)*5;
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
    if(!contextLost)renderer.render(scene,camera);frames++;globalThis.__lowtownLastFrame=now;
    globalThis.__lowtownThreeStats={frames,vehicles:actors.size,pedestrians:people.length,objects:scene.children.length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,contextLost,
      camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z,distance:Math.hypot(camera.position.x-p.x,camera.position.z-p.y),fov:camera.fov},player:{x:p.x,y:p.y,altitude}};
  }
  function dispose(){const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);});
    for(const geometry of geometries)geometry.dispose();for(const material of materials){material.map?.dispose();material.dispose();}renderer.dispose();}
  return {render,dispose,scene,camera,renderer};
}
