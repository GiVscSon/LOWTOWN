import * as THREE from 'three';
import {createBoxBatch} from './geometry.js';
import {surfaceMaterial} from './materials.js';

// A single recessed frame is instanced for every window. Smaller facade
// batches keep close-camera detail outside the view from reaching the GPU.
export function windowFrameGeometry(){
  const vertices=[],quad=(a,b,c,d)=>vertices.push(...a,...b,...c,...a,...c,...d);
  const outer=[[-8,-8,0],[8,-8,0],[8,8,0],[-8,8,0]],inner=[[-6,-6,.35],[6,-6,.35],[6,6,.35],[-6,6,.35]],recess=inner.map(([x,y])=>[x,y,-.3]);
  for(let i=0;i<4;i++){const j=(i+1)%4;quad(outer[i],outer[j],inner[j],inner[i]);quad(inner[i],inner[j],recess[j],recess[i]);}
  // The narrow divider shares the frame instead of adding a solid box to
  // every window. It still sits in front of the recessed glass.
  quad([-.35,-6,.15],[.35,-6,.15],[.35,6,.15],[-.35,6,.15]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function facadeDetailTexture(kind){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let value=kind==='shutter'?(y%6<2?70:125):150;
    if(kind==='fan'){const dx=x-31.5,dy=y-31.5,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);value=r<22?(r<5?125:38+Math.max(0,Math.sin(angle*7+r*.09))*52):173;if(r>21&&r<24)value=70;}
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
    if(kind==='leak'){
      const streak=Math.max(0,Math.sin(x*.43+Math.sin(x*.17)*1.9))**7;
      data[i]=31;data[i+1]=28;data[i+2]=22;data[i+3]=Math.round(streak*(y/size)**.7*95);
    }
  }
  const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;
}
export function createBuildingArchitecture(scene,cheap=false,factories={}){
  const surface=factories.surface||((kind,color)=>surfaceMaterial(kind,color,cheap));
  const lit=factories.lit||(options=>cheap?new THREE.MeshLambertMaterial(options):new THREE.MeshStandardMaterial(options));
  const colors=['#b0a48a','#928c7a','#a39d8a','#8b9289','#a4927e','#9b9484'],brickColors=['#786254','#68594e','#7c6957'];
  const walls=createBoxBatch(scene,0xffffff,1,undefined,surface('plaster',0xffffff),768);
  const brick=createBoxBatch(scene,0xffffff,1,undefined,surface('brick',0xffffff),768);
  const roofs=createBoxBatch(scene,0xffffff,1,undefined,surface('roof',0xffffff),768);
  const details=createBoxBatch(scene,0xffffff,.9,undefined,lit({color:0xffffff,roughness:.9}),768);
  const planes=new THREE.PlaneGeometry(1,1),basic=factories.glass?.()||new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
  const windows=createBoxBatch(scene,0xffffff,1,planes,basic,768);
  const frames=createBoxBatch(scene,0xffffff,1,windowFrameGeometry(),lit({color:0xffffff,roughness:.9,side:THREE.DoubleSide}),768);
  const fans=createBoxBatch(scene,0xffffff,1,planes,new THREE.MeshBasicMaterial({map:facadeDetailTexture('fan'),side:THREE.DoubleSide}),768);
  const shutters=createBoxBatch(scene,0xffffff,1,planes,new THREE.MeshBasicMaterial({map:facadeDetailTexture('shutter'),side:THREE.DoubleSide}),768);
  const trim=createBoxBatch(scene,0xffffff,1,undefined,surface('concrete',0xffffff),768);
  const grimeMaterial=new THREE.MeshBasicMaterial({map:facadeDetailTexture('leak'),transparent:true,depthWrite:false,side:THREE.DoubleSide});grimeMaterial.forceSinglePass=true;
  const grime=createBoxBatch(scene,0xffffff,1,planes,grimeMaterial,768);
  const vents=createBoxBatch(scene,0xffffff,1,new THREE.CylinderGeometry(1,1,1,8),lit({color:0xffffff,roughness:.7,metalness:.3}),768);
  const stats={cornices:0,balconies:0,fireEscapeFloors:0,roofVents:0};
  return {windows,roofs,stats,
    add(b,index){
      const height=(b.floors??(2+index%5))*24,x=b.x+b.w/2,z=b.y+b.h/2,isBrick=index%4===1,paint=isBrick?brickColors[index%3]:colors[index%colors.length],frame=isBrick?'#a4937b':'#c0b49a';
      (isBrick?brick:walls).add(x,height/2+3,z,b.w,height,b.h,paint);roofs.add(x,height+4,z,b.w,2,b.h,'#77756b');
      for(const side of [-1,1]){roofs.add(x,height+7,z+side*b.h/2,b.w+2,6,2.5,'#9a9584');roofs.add(x+side*b.w/2,height+7,z,2.5,6,b.h,'#9a9584');}
      for(const sideways of [false,true])for(const direction of [-1,1]){
        const length=sideways?b.h:b.w,angle=sideways?direction*Math.PI/2:direction>0?0:Math.PI,nx=Math.sin(angle),nz=Math.cos(angle);
        const point=(offset,depth)=>({x:sideways?b.x+(direction>0?b.w:0)+nx*depth:b.x+offset,z:sideways?b.y+offset:b.y+(direction>0?b.h:0)+nz*depth});
        for(const [y,width,depth] of [[height+1,length+3,3.3],[height-1,length+1,1.9]]){
          const p=point(length/2,depth/2);trim.add(p.x,y,p.z,width,1.8,depth,isBrick?'#ab9474':'#c1b398',angle);stats.cornices++;
        }
        for(const offset of [2.2,length-2.2]){
          const p=point(offset,.7);trim.add(p.x,height/2+4,p.z,3.8,height-3,1.4,isBrick?'#8b7260':'#a49781',angle);
        }
        for(let floor=0;floor<height/24;floor++){
          if(floor>0){const p=point(length/2,.35);details.add(p.x,floor*24+3,p.z,length,1.2,1.2,isBrick?'#96836b':'#8d8777',angle);}
          for(let offset=18;offset<length-12;offset+=32){
            const seed=Math.floor(offset/32)+floor*17+index*11,lit=seed%13>9,y=15+floor*24,p=point(offset,.55),glass=point(offset,.64),sill=point(offset,1.35);
            frames.add(p.x,y,p.z,1,1,1,frame,angle);windows.add(glass.x,y,glass.z,12,12,1,lit?'#f2c183':'#39434b',angle);
            details.add(sill.x,y-8,sill.z,18,1.5,3.8,frame,angle);
            if(seed%7===2){const cover=point(offset,.78);shutters.add(cover.x,y,cover.z,11,12,1,'#c2bcaa',angle);}
            if(floor>0){const leak=point(offset,.19);grime.add(leak.x,y-11,leak.z,18,16,1,'#ffffff',angle);}
            if(isBrick){const lintel=point(offset,1);trim.add(lintel.x,y+8.2,lintel.z,18,2.1,2,'#ad977a',angle);}
            if(floor>0&&seed%6===0){const ac=point(offset+5,2.2),front=point(offset+5,4.4);details.add(ac.x,y-12,ac.z,9,5.3,4.2,'#b6b09d',angle);fans.add(front.x,y-12,front.z,4.4,4.4,1,'#bdb9a8',angle);}
          }
        }
        const base=point(length/2,.6);details.add(base.x,5,base.z,length,5,1.8,isBrick?'#413b34':'#656356',angle);
        const drain=point(3,1.15);details.add(drain.x,height/2+4,drain.z,.9,height-2,1.1,'#686c64',angle);
        if(index%5===2&&length>95)for(let floor=1;floor<height/24;floor+=2){
          const offset=length*.55,deck=point(offset,4.4),rail=point(offset,7.6),y=floor*24+6;
          trim.add(deck.x,y,deck.z,25,1.8,8,'#9d9480',angle);details.add(rail.x,y+7,rail.z,25,.8,.8,'#3d4644',angle);
          for(const shift of [-11,-5,1,7,11]){const post=point(offset+shift,7.6);details.add(post.x,y+3.5,post.z,.55,7,.55,'#46504c',angle);}
          stats.balconies++;
        }
        if(index%11===3&&height>=72&&length>80&&direction===1&&sideways===Boolean(index%2)){
          const offset=Math.min(length-20,Math.max(20,length*.68));
          for(let floor=1;floor<height/24;floor++){
            const y=floor*24+6,deck=point(offset,4.9),rail=point(offset,8.5);
            details.add(deck.x,y,deck.z,21,1,8,'#55594f',angle);details.add(rail.x,y+7.5,rail.z,22,.65,.65,'#746e5a',angle);
            for(const shift of [-10,-5,0,5,10]){const post=point(offset+shift,8.5);details.add(post.x,y+4,post.z,.55,8,.55,'#6b6b58',angle);}
            for(const depth of [3.8,7]){const start=point(offset-9,depth),end=point(offset+9,depth);details.beam(new THREE.Vector3(start.x,y,start.z),new THREE.Vector3(end.x,y-24,end.z),.6,.65,'#555e58');}
            for(let step=0;step<10;step++){const p=point(offset-9+step*1.8,5.4);details.add(p.x,y-step*2.4,p.z,2.1,.5,3.5,'#777866',angle);}
            stats.fireEscapeFloors++;
          }
        }
      }
      if(b.w>90&&b.h>60){const rx=x-b.w*.13,rz=z-b.h*.14;roofs.add(rx,height+8,rz,24,7,15,'#8d9085');details.add(rx,height+12,rz,20,1,11,'#535e60');
        for(let i=0;i<4;i++)details.add(rx-7+i*4.7,height+12.6,rz,.5,.5,10,'#a0a496');
        if(index%4===1)for(const side of [-1,1]){details.add(rx+side*15,height+11,rz,1,16,23,'#505b5b');details.add(rx,height+11,rz+side*11,31,16,1,'#505b5b');}}
      if(index%3===0){
        const ax=x+b.w*.12,az=z+b.h*.14;details.add(ax,height+10,az,5,5,5,'#5e655f');details.add(ax,height+24,az,.7,28,.7,'#687370');
        for(let i=0;i<4;i++)details.add(ax,height+28-i*3.5,az,14-i*2,.55,.55,'#828b80',index*.7);
      }
      if(b.w>70&&b.h>60)for(const side of [-1,1]){
        const px=x+side*b.w*.26,pz=z+b.h*.24;
        vents.add(px,height+10,pz,3,12,3,'#797b71');vents.add(px,height+16.2,pz,5,1.1,5,'#a2a294');stats.roofVents++;
      }
      return {height,x,z};
    },
    flush(){for(const batch of [walls,brick,roofs,details,windows,frames,fans,shutters,trim,grime,vents])batch.flush();}
  };
}
