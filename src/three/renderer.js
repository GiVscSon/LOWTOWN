import * as THREE from 'three';

const COLORS={
  water:0x07151d,land:0x242b24,natural:0x263229,road:0x111417,bridge:0x202832,
  building:0x171c24,roof:0x222b36,runway:0x303838,amber:0xe09a3e,player:0xe8b84a,
  traffic:0x8a9298,police:0x4c6f9c,service:0xd4523a,pedestrian:0xc7aa86
};

function box(w,h,d,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  mesh.scale.set(Math.max(1,w),Math.max(1,h),Math.max(1,d));
  return mesh;
}
function makeGroundShape(points,material,y=0){
  if(!points?.length)return null;
  const shape=new THREE.Shape();
  shape.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);
  shape.closePath();
  const geometry=new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.y=y;
  return mesh;
}
function vehicleColor(vehicle){
  const token=String(vehicle.model||vehicle.type||vehicle.role||'').toLowerCase();
  if(token.includes('police'))return COLORS.police;
  if(token.includes('fire')||token.includes('ambulance')||token.includes('medical'))return COLORS.service;
  return vehicle.color||COLORS.traffic;
}

export function createLowtownThreeRenderer({canvas,world}){
  if(!canvas)throw new Error('Three.js canvas is missing');
  if(!globalThis.WebGL2RenderingContext&&!globalThis.WebGLRenderingContext)throw new Error('WebGL is unavailable');

  const renderer=new THREE.WebGLRenderer({
    canvas,alpha:false,powerPreference:'high-performance',
    antialias:(globalThis.devicePixelRatio||1)<2
  });
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.88;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(COLORS.water);
  scene.fog=new THREE.FogExp2(COLORS.water,.000095);

  const camera=new THREE.PerspectiveCamera(46,1,4,50000);
  camera.position.set(world.width*.5,1100,world.height*.5+900);

  scene.add(new THREE.HemisphereLight(0xb4c8c8,0x151915,1.45));
  const moon=new THREE.DirectionalLight(0xffdfb0,2.4);
  moon.position.set(-1800,2600,-900);scene.add(moon);
  const fill=new THREE.DirectionalLight(0x6f9fc4,.85);
  fill.position.set(1800,1200,2200);scene.add(fill);

  const staticGroup=new THREE.Group();scene.add(staticGroup);
  const waterMaterial=new THREE.MeshStandardMaterial({color:COLORS.water,roughness:.28,metalness:.12});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(world.width+7000,world.height+7000),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(world.width/2,-7,world.height/2);staticGroup.add(water);

  const landMaterial=new THREE.MeshStandardMaterial({color:COLORS.land,roughness:.96,metalness:0,side:THREE.DoubleSide});
  const naturalMaterial=new THREE.MeshStandardMaterial({color:COLORS.natural,roughness:1,metalness:0,side:THREE.DoubleSide});
  for(const island of world.islands||[]){
    const mesh=makeGroundShape(island.points,island.natural?naturalMaterial:landMaterial,0);
    if(mesh)staticGroup.add(mesh);
  }

  const roadMaterial=new THREE.MeshStandardMaterial({color:COLORS.road,roughness:.58,metalness:.18});
  const bridgeMaterial=new THREE.MeshStandardMaterial({color:COLORS.bridge,roughness:.62,metalness:.12});
  for(const road of world.roads||[]){
    if(!Number.isFinite(road.x)||!Number.isFinite(road.y))continue;
    const mesh=box(road.w||26,3,road.h||26,roadMaterial);
    mesh.position.set(road.x+(road.w||0)/2,2,road.y+(road.h||0)/2);staticGroup.add(mesh);
  }
  for(const bridge of world.bridges||[]){
    const mesh=box(bridge.w||26,5,bridge.h||26,bridgeMaterial);
    mesh.position.set(bridge.x+(bridge.w||0)/2,4,bridge.y+(bridge.h||0)/2);staticGroup.add(mesh);
  }

  const runwayMaterial=new THREE.MeshStandardMaterial({color:COLORS.runway,roughness:.5,metalness:.12});
  for(const runway of world.runways||[]){
    const mesh=box(runway.w,3,runway.h,runwayMaterial);
    mesh.position.set(runway.x+runway.w/2,3,runway.y+runway.h/2);staticGroup.add(mesh);
  }

  const buildingMaterial=new THREE.MeshStandardMaterial({color:COLORS.building,roughness:.7,metalness:.08});
  const roofMaterial=new THREE.MeshStandardMaterial({color:COLORS.roof,roughness:.58,metalness:.12});
  for(const building of world.buildings||[]){
    const height=Math.max(22,(building.floors??4)*20);
    const mesh=box(building.w||80,height,building.h||80,buildingMaterial.clone());
    mesh.position.set(building.x+(building.w||0)/2,height/2+4,building.y+(building.h||0)/2);
    const roof=box((building.w||80)*.9,4,(building.h||80)*.9,roofMaterial);
    roof.position.set(mesh.position.x,height+7,mesh.position.z);staticGroup.add(mesh,roof);
  }

  const trees=(world.trees||[]).filter(tree=>Number.isFinite(tree.x)&&Number.isFinite(tree.y));
  if(trees.length){
    const treeGeometry=new THREE.ConeGeometry(10,34,6);
    const treeMaterial=new THREE.MeshStandardMaterial({color:0x294331,roughness:1});
    const instanced=new THREE.InstancedMesh(treeGeometry,treeMaterial,trees.length);
    const matrix=new THREE.Matrix4();
    trees.forEach((tree,index)=>{
      const scale=.72+((index*37)%31)/100;
      matrix.compose(new THREE.Vector3(tree.x,18*scale,tree.y),new THREE.Quaternion(),new THREE.Vector3(scale,scale,scale));
      instanced.setMatrixAt(index,matrix);
    });
    instanced.instanceMatrix.needsUpdate=true;staticGroup.add(instanced);
  }

  const playerMaterial=new THREE.MeshStandardMaterial({color:COLORS.player,roughness:.38,metalness:.24});
  const playerMesh=box(1,1,1,playerMaterial);scene.add(playerMesh);
  const vehicleGeometry=new THREE.BoxGeometry(1,1,1);
  const personGeometry=new THREE.CylinderGeometry(4,5,15,6);
  const vehiclePool=[],personPool=[];
  const ensureVehicle=index=>{
    while(vehiclePool.length<=index){
      const material=new THREE.MeshStandardMaterial({color:COLORS.traffic,roughness:.4,metalness:.2});
      const mesh=new THREE.Mesh(vehicleGeometry,material);scene.add(mesh);vehiclePool.push(mesh);
    }
    return vehiclePool[index];
  };
  const ensurePerson=index=>{
    while(personPool.length<=index){
      const material=new THREE.MeshStandardMaterial({color:COLORS.pedestrian,roughness:.92});
      const mesh=new THREE.Mesh(personGeometry,material);scene.add(mesh);personPool.push(mesh);
    }
    return personPool[index];
  };

  let frames=0,cameraReady=false,lastPlayerPosition=null;
  function resize(){
    const width=Math.max(1,canvas.clientWidth||globalThis.innerWidth||1);
    const height=Math.max(1,canvas.clientHeight||globalThis.innerHeight||1);
    const ratio=Math.min(globalThis.devicePixelRatio||1,1.5);
    const targetW=Math.round(width*ratio),targetH=Math.round(height*ratio);
    if(canvas.width!==targetW||canvas.height!==targetH){
      renderer.setPixelRatio(ratio);renderer.setSize(width,height,false);
      camera.aspect=width/height;camera.updateProjectionMatrix();
    }
  }
  function render(frame){
    resize();
    const p=frame.player||{x:world.width/2,y:world.height/2,angle:0,width:48,height:24};
    const altitude=Math.max(0,frame.altitude||0),foot=frame.mode==='foot';
    playerMesh.scale.set(foot?10:(p.width||48),foot?18:12,foot?10:(p.height||24));
    playerMesh.position.set(p.x,foot?9:6+altitude,p.y);playerMesh.rotation.y=-(p.angle||0);
    playerMesh.material.color.setHex(foot?COLORS.pedestrian:COLORS.player);

    const vehicles=(frame.vehicles||[]).filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y));
    vehicles.forEach((vehicle,index)=>{
      const mesh=ensureVehicle(index),width=vehicle.width||48,depth=vehicle.height||24,lift=Math.max(0,vehicle.altitude||0);
      mesh.visible=true;mesh.position.set(vehicle.x,6+lift,vehicle.y);mesh.scale.set(width,12,depth);mesh.rotation.y=-(vehicle.angle||0);
      mesh.material.color.set(vehicleColor(vehicle));
    });
    for(let i=vehicles.length;i<vehiclePool.length;i++)vehiclePool[i].visible=false;

    const people=(frame.pedestrians||[]).filter(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y));
    people.forEach((person,index)=>{
      const mesh=ensurePerson(index);mesh.visible=true;mesh.position.set(person.x,8,person.y);mesh.rotation.y=-(person.heading||person.angle||0);
    });
    for(let i=people.length;i<personPool.length;i++)personPool[i].visible=false;

    const heading=p.angle||0,distance=680+altitude*1.5;
    const desired=new THREE.Vector3(
      p.x-Math.cos(heading)*distance-Math.sin(heading)*260,
      820+altitude*1.35,
      p.y-Math.sin(heading)*distance+Math.cos(heading)*260
    );
    const teleported=lastPlayerPosition&&Math.hypot(p.x-lastPlayerPosition.x,p.y-lastPlayerPosition.y)>900;
    if(!cameraReady||teleported){camera.position.copy(desired);cameraReady=true;}else camera.position.lerp(desired,.14);
    lastPlayerPosition={x:p.x,y:p.y};
    camera.lookAt(p.x,24+altitude*.35,p.y);
    scene.fog.density=frame.weather?.fog?.000175:.000095;
    scene.background.set(frame.weather?.rain?0x071117:COLORS.water);
    renderer.render(scene,camera);
    frames++;
    globalThis.__lowtownLastFrame=performance.now();
    globalThis.__lowtownThreeStats={
      frames,objects:scene.children.length,vehicles:vehicles.length,pedestrians:people.length,
      camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z,
        distance:Math.hypot(camera.position.x-p.x,camera.position.z-p.y),fov:camera.fov},
      player:{x:p.x,y:p.y,altitude}
    };
  }
  function dispose(){renderer.dispose();staticGroup.traverse(object=>object.geometry?.dispose?.());}
  return {render,dispose,scene,camera,renderer};
}
