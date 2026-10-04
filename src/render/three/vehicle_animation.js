import * as THREE from 'three';

const cache=new Map(),lineMaterial=new THREE.LineBasicMaterial({color:'#172025'}),crackMaterial=new THREE.LineBasicMaterial({color:'#aab8b8',transparent:true,opacity:.7});
function glassPoint(glass,u,v){
  const a=glass[0].map((n,i)=>n+(glass[1][i]-n)*u),b=glass[3].map((n,i)=>n+(glass[2][i]-n)*u);
  const [x,y,z]=a.map((n,i)=>n+(b[i]-n)*v);return new THREE.Vector3(x,z+.1,y);
}
export function createLandAnimation(vehicle,model,makeGeometry,material){
  const stamp=[model.type,model.length,model.breadth,vehicle.color,!!vehicle.isPolice].join(':'),detail=new THREE.Group();
  let data=cache.get(stamp);
  if(!data){
    const body=makeGeometry(model.faces.filter(f=>!f.part)),parts=new Map();
    for(const f of model.faces.filter(f=>f.part)){
      const p=f.part,key=p.type==='wheel'?`${p.type}:${p.x}:${p.side}`:`door:${p.side}`;
      if(!parts.has(key))parts.set(key,{part:p,faces:[]});parts.get(key).faces.push(f);
    }
    const components=[...parts.values()].map(({part,faces})=>{
      const pivot=part.type==='wheel'?new THREE.Vector3(part.x,part.z,part.y):new THREE.Vector3(model.doorSpan.front,model.doorSpan.bottom,part.side*model.doorSpan.side);
      const geometry=makeGeometry(faces);geometry.translate(-pivot.x,-pivot.y,-pivot.z);return {part,pivot,geometry};
    });
    data={body,components};cache.set(stamp,data);
  }
  const body=new THREE.Mesh(data.body,material);detail.add(body);
  const components=data.components.map(({part,pivot,geometry})=>{
    const pivotGroup=new THREE.Group(),mesh=new THREE.Mesh(geometry,material);pivotGroup.position.copy(pivot);pivotGroup.add(mesh);detail.add(pivotGroup);
    return {part,pivotGroup,mesh};
  });
  let wipers=null,cracks=null;
  if(model.windshield){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
    wipers=new THREE.LineSegments(geometry,lineMaterial);wipers.frustumCulled=false;detail.add(wipers);
    const segments=[[[.45,.25],[.58,.7]],[[.58,.7],[.8,.83]],[[.58,.7],[.4,.8]],[[.5,.46],[.34,.4]]];
    cracks=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segments.flatMap(s=>s.map(([u,v])=>glassPoint(model.windshield.points,u,v)))),crackMaterial);cracks.visible=false;detail.add(cracks);
  }
  const smoke=new THREE.Mesh(new THREE.IcosahedronGeometry(2.8,0),new THREE.MeshBasicMaterial({color:'#50585b',transparent:true,opacity:.4,depthWrite:false}));
  smoke.visible=false;detail.add(smoke);
  const brakeLights=new THREE.InstancedMesh(new THREE.BoxGeometry(.15,1.5,model.breadth*.16),new THREE.MeshBasicMaterial({color:'#f66a50'}),2);
  const matrix=new THREE.Matrix4();for(const side of [-1,1]){matrix.makeTranslation(-model.length*.502,6.3*model.breadth/24,side*model.breadth*.245);brakeLights.setMatrixAt(side>0?1:0,matrix);}brakeLights.visible=false;detail.add(brakeLights);
  const state={detail,body,components,wipers,cracks,smoke,brakeLights,model,wheelPhase:0,lastPosition:null,lastSpeed:0,stage:-1,damageStamp:'',owned:new Set()};
  return state;
}
function damagedGeometry(mesh,base,stage,model,damage,state,pivot=new THREE.Vector3()){
  if(mesh.geometry!==base&&state.owned.has(mesh.geometry)){mesh.geometry.dispose();state.owned.delete(mesh.geometry);}
  if(!stage){mesh.geometry=base;return;}
  const geometry=base.clone(),position=geometry.attributes.position,colors=geometry.attributes.color;
  const front=damage.front??1,rear=damage.rear??0,left=damage.left??0,right=damage.right??0;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)+pivot.x,y=position.getY(i)+pivot.y,z=position.getZ(i)+pivot.z,nose=Math.max(0,(x/model.length-.17)/.33),boot=Math.max(0,(-x/model.length-.17)/.33);
    const side=Math.max(0,(Math.abs(z)/model.breadth-.30)/.2)*(z<0?left:right);
    position.setXYZ(i,x-(front*nose-rear*boot)*model.length*.027*stage-pivot.x,y-(front*nose+rear*boot)*stage*.6-pivot.y,z*(1-side*stage*.055)-pivot.z);
    if(colors&&y<11&&nose+boot+side>.2){const wear=1-Math.min(.3,(nose*front+boot*rear+side)*stage*.08);colors.setXYZ(i,colors.getX(i)*wear,colors.getY(i)*wear,colors.getZ(i)*wear);}
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();mesh.geometry=geometry;state.owned.add(geometry);
}
export function updateLandAnimation(state,vehicle,time,weather={},detailed=true){
  const {model}=state,hp=Math.max(0,Math.min(100,vehicle.hp??100)),stage=hp>=85?0:hp>=65?1:hp>=40?2:3;
  state.detail.visible=detailed;
  const moved=state.lastPosition?Math.hypot(vehicle.x-state.lastPosition.x,vehicle.y-state.lastPosition.y):0;
  if(moved<128){const cs=Math.cos(vehicle.angle||0),sn=Math.sin(vehicle.angle||0),forward=state.lastPosition?(vehicle.x-state.lastPosition.x)*cs+(vehicle.y-state.lastPosition.y)*sn:0;state.wheelPhase-=forward/(model.breadth/6);}
  state.lastPosition={x:vehicle.x,y:vehicle.y};
  const age=Number.isFinite(vehicle.doorElapsed)?vehicle.doorElapsed:Number.isFinite(vehicle.doorActionAt)?time-vehicle.doorActionAt:Infinity;
  const opening=age>=0&&age<1.6?Math.sin(Math.PI*Math.min(1,age/1.6))*.95:0;
  for(const {part,pivotGroup} of state.components){
    if(part.type==='wheel'){pivotGroup.rotation.set(0,part.front?-(vehicle.steeringAngle||0):0,state.wheelPhase);}
    else pivotGroup.rotation.y=opening*part.side*(part.side===(vehicle.doorSide||1)?1:0);
  }
  const damage=vehicle.damage||{},stamp=JSON.stringify([stage,damage]);
  if(state.damageStamp!==stamp){
    const data=cache.get([model.type,model.length,model.breadth,vehicle.color,!!vehicle.isPolice].join(':'));
    damagedGeometry(state.body,data.body,stage,model,damage,state);
    state.components.forEach((component,i)=>{if(component.part.type==='door')damagedGeometry(component.mesh,data.components[i].geometry,stage,model,damage,state,data.components[i].pivot);});
    state.damageStamp=stamp;state.stage=stage;
  }
  if(state.wipers){
    const rain=weather.rain??vehicle.rain??0,phase=rain>.15?(.5+.5*Math.sin(time*(rain>.6?8:5))):0;
    const positions=state.wipers.geometry.attributes.position;
    for(let i=0;i<2;i++){
      const u=i===0?.24:.7,pivot=glassPoint(model.windshield.points,u,.9),end=glassPoint(model.windshield.points,Math.max(.04,Math.min(.96,u-.17+phase*.34)),.22);
      positions.setXYZ(i*2,pivot.x,pivot.y,pivot.z);positions.setXYZ(i*2+1,end.x,end.y,end.z);
    }positions.needsUpdate=true;
  }
  if(state.cracks)state.cracks.visible=stage>=2;
  state.brakeLights.visible=stage<3&&(!!vehicle.braking||Math.abs(vehicle.speed||0)<Math.abs(state.lastSpeed)-.04);
  state.lastSpeed=vehicle.speed||0;
  state.smoke.visible=detailed&&stage===3;
  if(state.smoke.visible){const rise=(time*9)%18;state.smoke.position.set(model.length*.3,12+rise,Math.sin(time)*2);state.smoke.scale.setScalar(.8+rise*.065);state.smoke.material.opacity=.45*(1-rise/18);}
  return {stage,doorAngle:opening,wheelPhase:state.wheelPhase,wipers:!!state.wipers&&(weather.rain??vehicle.rain??0)>.15};
}
export function disposeLandAnimation(state){for(const geometry of state.owned)geometry.dispose();state.wipers?.geometry.dispose();state.cracks?.geometry.dispose();state.smoke.geometry.dispose();state.smoke.material.dispose();state.brakeLights.geometry.dispose();state.brakeLights.material.dispose();}
