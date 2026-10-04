import * as THREE from 'three';
import {bridgeRailOpenAt} from '../../world/bridge_rails.js';
import {roundedBridgePoints,ribbonGeometry,ribbonTangent} from './geometry.js';

const BASE=3.6;
const smooth=t=>t*t*(3-2*t);

// The same sampled surface drives the deck, vehicles, pedestrians, shadows
// and camera. Endpoints stay at street height; elevation is continuous even
// on the remapped bridges with two rounded bends.
export function createBridgeProfiles(paths){
  return paths.map(bridge=>{
    const rounded=bridge.organic?bridge.path.map(p=>new THREE.Vector2(p.x,p.y)):roundedBridgePoints(bridge.path,bridge.width),samples=[{point:rounded[0],distance:0}];
    let length=0;
    for(let i=1;i<rounded.length;i++){
      const a=rounded[i-1],b=rounded[i],span=a.distanceTo(b),steps=Math.max(1,Math.ceil(span/36));
      for(let step=1;step<=steps;step++)samples.push({point:a.clone().lerp(b,step/steps),distance:length+span*step/steps});
      length+=span;
    }
    const ramp=Math.min(420,length*.3),rise=Math.min(90,length*.065);
    const points=samples.map(sample=>sample.point);
    samples.forEach((sample,index)=>sample.tangent=ribbonTangent(points,index));
    for(const sample of samples)sample.height=BASE+rise*smooth(Math.min(1,sample.distance/ramp,(length-sample.distance)/ramp));
    return {...bridge,samples,length,ramp,rise};
  });
}

export function bridgeSurfaceIndex(profiles){
  const size=512,cells=new Map();
  for(const profile of profiles)for(let i=1;i<profile.samples.length;i++){
    const a=profile.samples[i-1],b=profile.samples[i],padding=profile.width/2+10;
    const segment={a,b,width:profile.width,id:profile.id};
    for(let x=Math.floor((Math.min(a.point.x,b.point.x)-padding)/size);x<=Math.floor((Math.max(a.point.x,b.point.x)+padding)/size);x++)
      for(let y=Math.floor((Math.min(a.point.y,b.point.y)-padding)/size);y<=Math.floor((Math.max(a.point.y,b.point.y)+padding)/size);y++){
        const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(segment);
      }
  }
  return (x,y)=>{
    let nearest=null,distance=Infinity;
    for(const segment of cells.get(`${Math.floor(x/size)},${Math.floor(y/size)}`)||[]){
      const {a,b,width}=segment,dx=b.point.x-a.point.x,dy=b.point.y-a.point.y,length2=dx*dx+dy*dy;
      const t=Math.max(0,Math.min(1,((x-a.point.x)*dx+(y-a.point.y)*dy)/length2));
      const d=(x-a.point.x-dx*t)**2+(y-a.point.y-dy*t)**2;
      if(d<distance&&d<=(width/2+8)**2){distance=d;nearest={height:a.height+(b.height-a.height)*t,id:segment.id};}
    }
    return nearest;
  };
}

export function bridgePointAt(profile,distance){
  const d=Math.max(0,Math.min(profile.length,distance)),samples=profile.samples;
  for(let i=1;i<samples.length;i++)if(samples[i].distance>=d){
    const a=samples[i-1],b=samples[i],t=(d-a.distance)/(b.distance-a.distance);
    const point=a.point.clone().lerp(b.point,t),tangent=a.tangent.clone().lerp(b.tangent,t).normalize();
    return {point,tangent,height:a.height+(b.height-a.height)*t};
  }
  return {point:samples.at(-1).point,tangent:new THREE.Vector2(1,0),height:BASE};
}

export function raisedBridgeGeometry(profile,underside=false){
  const geometry=ribbonGeometry(profile.samples.map(sample=>sample.point),profile.width);
  const position=geometry.getAttribute('position');
  for(let i=0;i<profile.samples.length;i++)for(const side of [0,1])position.setY(i*2+side,profile.samples[i].height-(underside?12:0));
  if(underside){const index=geometry.index;for(let i=0;i<index.count;i+=3){const swap=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,swap);}}
  geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function addBridgeStructures(profile,{details,reflectors}){
  const point=(sample,side,inset=2,offset=0)=>{
    const normal=new THREE.Vector2(-sample.tangent.y,sample.tangent.x);
    return new THREE.Vector3(sample.point.x+normal.x*side*(profile.width/2-inset),sample.height+offset,
      sample.point.y+normal.y*side*(profile.width/2-inset));
  };
  const beam=(a,b,h,d,color)=>details.beam(a,b,h,d,color);
  for(let i=1;i<profile.samples.length;i++){
    const a=bridgePointAt(profile,profile.samples[i-1].distance),b=bridgePointAt(profile,profile.samples[i].distance);
    for(const side of [-1,1]){
      beam(point(a,side,0,-6),point(b,side,0,-6),12,7,'#455d6c');
      const pa=point(a,side,2),pb=point(b,side,2);
      if(bridgeRailOpenAt(profile,(pa.x+pb.x)/2,(pa.z+pb.z)/2))continue;
      beam(point(a,side,2,3),point(b,side,2,3),5,5,'#b1afa0');
      beam(point(a,side,2,21),point(b,side,2,21),3,3,'#92a8af');
      beam(point(a,side,8,.25),point(b,side,8,.25),.3,2,'#dbd9be');
    }
  }
  for(let distance=0;distance<=profile.length;distance+=90){
    const sample=bridgePointAt(profile,distance);
    for(const side of [-1,1]){
      const p=point(sample,side,2,10);
      if(bridgeRailOpenAt(profile,p.x,p.z))continue;
      details.add(p.x,p.y,p.z,4,20,4,'#899ca5');reflectors.add(p.x,p.y+10,p.z,5,3,5,'#e9d9a5');
    }
  }
  for(let distance=8;distance<profile.length-8;distance+=36){
    const a=bridgePointAt(profile,distance),b=bridgePointAt(profile,Math.min(profile.length,distance+16));
    beam(point(a,0,0,.35),point(b,0,0,.35),.3,2.5,'#d7ae52');
  }
  const pier=distance=>{
    const sample=bridgePointAt(profile,distance),height=sample.height;
    beam(point(sample,-1,10,-16),point(sample,1,10,-16),12,12,'#667c87');
    for(const side of [-1,1]){
      const p=point(sample,side,18),columnHeight=height+13;
      details.add(p.x,-20+columnHeight/2,p.z,19,columnHeight,19,'#81918b');
      details.add(p.x,-9,p.z,34,10,34,'#a0aaa0');
      const lower=p.clone();lower.y=-8;
      const upper=point(sample,side,34,-15);
      beam(lower,upper,9,9,'#637b88');
    }
  };
  let piers=0,arches=0;
  for(let distance=profile.ramp;distance<profile.length-profile.ramp/2;distance+=420){pier(distance);piers++;}
  if(profile.organic){
    const start=profile.ramp*.65,usable=profile.length-start*2,count=Math.max(1,Math.ceil(usable/900)),span=usable/count;
    for(let arch=0;arch<count;arch++){
      const rise=Math.min(190,span*.28);
      const at=(t,side,high=true)=>point(bridgePointAt(profile,start+span*(arch+t)),side,-7,6+(high?4*t*(1-t)*rise:0));
      for(const side of [-1,1]){
        for(let step=1;step<=20;step++)beam(at((step-1)/20,side),at(step/20,side),10,9,'#aac1c7');
        for(let step=1;step<8;step++)beam(at(step/8,side,false),at(step/8,side),2,2,'#809fa9');
        for(const t of [0,1]){const p=at(t,side,false),height=p.y+20;
          details.add(p.x,-20+height/2,p.z,24,height,24,'#8f9f99');details.add(p.x,-8,p.z,40,12,40,'#a2aea3');}
      }
      for(const t of [.25,.5,.75])beam(at(t,-1),at(t,1),6,6,'#7e9eaa');arches++;
    }
  }
  // Straight spans carry tied steel arches. Bends keep open parapets, so a
  // rigid overhead frame cannot cut across the supported turning lane.
  for(let leg=1;!profile.organic&&leg<profile.path.length;leg++){
    const a=new THREE.Vector2(profile.path[leg-1].x,profile.path[leg-1].y),b=new THREE.Vector2(profile.path[leg].x,profile.path[leg].y);
    const tangent=b.clone().sub(a).normalize(),normal=new THREE.Vector2(-tangent.y,tangent.x),length=a.distanceTo(b);
    const inset=profile.width*.75,usable=length-inset*2;if(usable<340)continue;
    const count=Math.max(1,Math.ceil(usable/900)),span=usable/count;
    for(let arch=0;arch<count;arch++){
      const start=a.clone().addScaledVector(tangent,inset+arch*span),rise=Math.min(190,span*.28);
      const at=(t,side,high=true)=>{
        const p=start.clone().addScaledVector(tangent,span*t),sample=bridgePointAt(profile,
          profile.samples.reduce((best,sample)=>sample.point.distanceToSquared(p)<best.point.distanceToSquared(p)?sample:best).distance);
        return new THREE.Vector3(p.x+normal.x*side*(profile.width/2+7),sample.height+6+(high?4*t*(1-t)*rise:0),p.y+normal.y*side*(profile.width/2+7));
      };
      for(const side of [-1,1]){
        for(let step=1;step<=20;step++)beam(at((step-1)/20,side),at(step/20,side),10,9,'#aac1c7');
        for(let step=1;step<8;step++)beam(at(step/8,side,false),at(step/8,side),2,2,'#809fa9');
        for(const t of [0,1]){
          const p=at(t,side,false),columnHeight=p.y+20;
          details.add(p.x,-20+columnHeight/2,p.z,24,columnHeight,24,'#8f9f99');
          details.add(p.x,-8,p.z,40,12,40,'#a2aea3');
        }
      }
      for(const t of [.25,.5,.75])beam(at(t,-1),at(t,1),6,6,'#7e9eaa');
      arches++;
    }
  }
  for(const distance of [0,profile.length]){
    const sample=bridgePointAt(profile,distance);
    for(const side of [-1,1]){
      const p=point(sample,side,3,12);
      if(bridgeRailOpenAt(profile,p.x,p.z))continue;
      details.add(p.x,p.y,p.z,8,25,8,'#b4b39b');
      for(let stripe=0;stripe<4;stripe++)details.add(p.x,sample.height+4+stripe*6,p.z,8.3,3,8.3,stripe%2?'#d6c68c':'#33404a');
      reflectors.add(p.x,sample.height+26,p.z,9,3,9,'#f2ce85');
    }
    beam(point(sample,-1,9,.35),point(sample,1,9,.35),.3,3,'#939e99');
  }
  return {piers,arches};
}
