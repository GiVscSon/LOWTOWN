import * as THREE from 'three';
import {signalPosts} from '../../world/furniture_layout.js';
import {nearestStreet} from '../../world/street_corridors.js';

export function addStreetFurniture(world,{details,reflectors,pools,roadReflection,mountedSign,scene}){
  const point=(prop,u,v,angle)=>({x:prop.x+Math.cos(angle)*u+Math.sin(angle)*v,z:prop.y-Math.sin(angle)*u+Math.cos(angle)*v});
  for(const prop of world.props||[]){
    const w=prop.width||prop.w||16,h=prop.height||prop.h||16,hit=nearestStreet(prop.x,prop.y,world.roads||[]),angle=-(hit?.angle||0);
    const add=(u,y,v,a,b,c,color)=>{const p=point(prop,u,v,angle);details.add(p.x,y,p.z,a,b,c,color,angle);};
    if(prop.type==='bench'){
      for(const side of [-1,1]){add(side*w*.34,5,0,2,10,8,'#303d42');add(side*w*.34,12,3,2,14,2,'#303d42');}
      for(let i=0;i<3;i++){add(0,8,-3+i*3,w,1.1,2.4,'#947050');add(0,12+i*2.2,4,w,1.5,1.2,'#856044');}
    }else if(prop.type==='bin'){
      add(0,7,0,w*.65,14,h*.65,'#49615c');add(0,14,0,w*.75,1.5,h*.75,'#2d3e42');add(0,13.6,0,w*.36,.3,h*.35,'#121e23');
      for(const side of [-1,1])add(side*w*.3,8,0,.6,9,h*.65,'#718077');
    }else if(prop.type==='phone'){
      add(0,13,0,w*.85,26,h*.75,'#34484f');add(0,27,0,w,2,h,'#597a7d');add(0,13,h*.4,w*.6,20,.5,'#152831');
      add(0,18,h*.44,w*.44,3,.7,'#d2b883');add(0,13,h*.44,w*.35,6,.7,'#748b88');
    }else if(prop.type==='shelter'){
      add(0,25,0,w+4,3,h+4,'#687976');
      for(const side of [-1,1]){add(side*w*.45,12,0,2,24,2,'#83908c');add(side*w*.42,14,h*.35,1.5,16,h*.5,'#354f5a');}
      add(0,13,h*.4,w*.8,18,1,'#354f5a');add(0,8,h*.15,w*.7,2.5,6,'#957653');
      const sign=mountedSign('BUS',Math.min(30,w*.45),'#b7d4cc');sign.position.set(prop.x,23,prop.y-h*.5);sign.rotation.y=angle;scene.add(sign);
    }else if(prop.type==='bollard'){
      add(0,6,0,4,12,4,'#687578');add(0,10,0,4.2,1.5,4.2,'#ddc487');
    }else if(prop.type==='stall'||prop.type==='kiosk'){
      add(0,10,0,w,20,h,'#7b7869');add(0,22,0,w+5,3,h+5,'#725347');add(0,13,h*.51,w*.7,10,1,'#273b43');
      add(0,7,h*.56,w*.9,2,5,'#b2a27b');
    }else if(prop.type==='gardenbed'||prop.type==='pond'||prop.type==='fountain'){
      add(0,2,0,w,4,h,'#777d70');add(0,4,0,w*.88,1,h*.85,prop.type==='gardenbed'?'#4c6144':'#396371');
      if(prop.type==='fountain'){add(0,8,0,8,12,8,'#8c978c');add(0,15,0,w*.45,2,h*.45,'#939b8a');}
    }else {
      add(0,9,0,w,18,h,prop.type==='workzone'?'#ba8249':'#657563');
    }
  }
  for(const stop of world.stops||[]){
    details.add(stop.x,17,stop.y,1.5,34,1.5,'#8c927d');details.add(stop.x,32,stop.y,10,9,1,'#debc72');
    details.add(stop.x,32,stop.y+.6,6,5,.2,'#335162');
  }
  for(const lamp of world.lights||[]){
    const hit=nearestStreet(lamp.x,lamp.y,world.roads||[]),dx=(hit?.x??lamp.x+8)-lamp.x,dz=(hit?.y??lamp.y)-lamp.y,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d;
    details.add(lamp.x,3,lamp.y,7,6,7,'#3e4a4c');details.add(lamp.x,32,lamp.y,2,64,2,'#6d7878');
    details.beam(new THREE.Vector3(lamp.x,60,lamp.y),new THREE.Vector3(lamp.x+ux*13,65,lamp.y+uz*13),1.5,1.5,'#77817d');
    details.add(lamp.x+ux*13,64,lamp.y+uz*13,10,3,5,'#3d4747',-(hit?.angle||0));
    reflectors.add(lamp.x+ux*13,62,lamp.y+uz*13,8,.5,4,'#ffca81',-(hit?.angle||0));
    pools.add(lamp.x+ux*14,3.3,lamp.y+uz*14,115,1,130,'#ff942e');roadReflection(lamp.x,lamp.y);
  }
  const signals=[];
  for(const post of signalPosts(world.paint?.signals)){
    const {x,y:z,direction,axis}=post,cs=Math.cos(direction),sn=Math.sin(direction),angle=-direction;
    details.add(x,20,z,2,40,2,'#71807b');details.add(x,42,z,7,17,4,'#152228',angle);
    for(let i=0;i<3;i++)signals.push({x:x-cs*2.1,y:47-i*5,z:z-sn*2.1,angle,axis,phase:['red','amber','green'][i]});
  }
  const lamps=new THREE.InstancedMesh(new THREE.SphereGeometry(1.65,8,5),new THREE.MeshBasicMaterial({color:0xffffff}),Math.max(1,signals.length));lamps.frustumCulled=false;lamps.count=0;scene.add(lamps);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),pos=new THREE.Vector3(),color=new THREE.Color();
  return {signals:signals.length/3,update(phases,visible){
    let count=0;for(const lamp of signals){if(!visible({x:lamp.x,y:lamp.z},65))continue;
      matrix.compose(pos.set(lamp.x,lamp.y,lamp.z),q,scale);lamps.setMatrixAt(count,matrix);
      color.set(phases?.[lamp.axis]===lamp.phase?{red:'#fa6656',amber:'#f3bc46',green:'#89e3aa'}[lamp.phase]:'#233531');lamps.setColorAt(count++,color);
    }lamps.count=count;lamps.instanceMatrix.needsUpdate=true;if(lamps.instanceColor)lamps.instanceColor.needsUpdate=true;
    return count/3;
  }};
}
