import * as THREE from 'three';
import {createBoxBatch} from './geometry.js';
import {glowTexture} from './materials.js';

function glassTexture(shop=false){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=shop?128:256;
  const ctx=canvas.getContext('2d'),h=canvas.height;
  const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#6d6d6d');gradient.addColorStop(.25,'#eeeeee');gradient.addColorStop(1,'#969696');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,h);
  if(shop){
    for(let row=0;row<3;row++){ctx.fillStyle='#575757';ctx.fillRect(0,49+row*23,256,3);
      for(let n=0;n<12;n++){ctx.fillStyle=n%3?'#b1b1b1':'#737373';ctx.fillRect(n*23+4,31+row*23,9+n%4,18);}}
    ctx.fillStyle='#282828';ctx.fillRect(121,0,5,h);ctx.fillRect(0,h-13,256,13);
  }else{
    ctx.fillStyle='#555555';ctx.fillRect(8,0,35,h);ctx.fillRect(221,0,27,h);
    ctx.fillStyle='#c4c4c4';for(let x=11;x<43;x+=8)ctx.fillRect(x,0,2,h);
    ctx.fillStyle='#2d2d2d';ctx.fillRect(125,0,6,h);ctx.fillRect(0,143,256,5);
  }
  ctx.fillStyle='rgba(255,255,255,.14)';ctx.beginPath();ctx.moveTo(80,0);ctx.lineTo(116,0);ctx.lineTo(210,h);ctx.lineTo(174,h);ctx.fill();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export const apartmentGlassMaterial=()=>new THREE.MeshBasicMaterial({map:glassTexture(),color:0xffffff,side:THREE.DoubleSide});

export function mountedSign(text,width,color='#f4ad52',vertical=false){
  const canvas=document.createElement('canvas');canvas.width=vertical?96:512;canvas.height=vertical?512:96;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.fillStyle='#211b18';ctx.fillRect(0,0,w,h);
  for(let i=0;i<160;i++){ctx.fillStyle=i%2?'#332721':'#12181c';ctx.fillRect((i*137)%w,(i*67)%h,1+i%11,1+i%3);}
  ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=9;ctx.lineWidth=3;ctx.strokeRect(6,6,w-12,h-12);
  ctx.fillStyle=color;ctx.font=`bold ${vertical?57:51}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  if(vertical){[...text].forEach((letter,i)=>ctx.fillText(letter,w/2,42+i*(h-75)/text.length));}
  else ctx.fillText(text,w/2,h/2+2,w-32);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,vertical?width*5.3:Math.min(24,width*.1875)),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
}

export function createStorefronts(scene,{details,pools,roadReflection,lit}){
  const glass=createBoxBatch(scene,0xffffff,1,new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:glassTexture(true),color:0xffffff,side:THREE.DoubleSide,toneMapped:false}),768);
  const halos=createBoxBatch(scene,0xffffff,1,new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:glowTexture(),color:0xffffff,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),768);
  const forecourts=createBoxBatch(scene,0xffffff,1,undefined,lit('paving',0xffffff),768);
  let count=0;
  return {add(b,{height,x,z},index){
    const angle=({north:Math.PI,south:0,east:Math.PI/2,west:-Math.PI/2})[b.streetFacing]||0,sideways=b.streetFacing==='east'||b.streetFacing==='west',length=sideways?b.h:b.w;
    const pawn=/pawn/i.test(b.sign||''),bar=/bar|tavern|club/i.test(b.sign||'');
    const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle),neon=pawn?'#f6bd54':bar?'#ff4128':b.neon||'#ffac46';
    const facade=(offset=0,depth=0)=>({x:x+nx*((sideways?b.w:b.h)/2+.7+depth)+tx*offset,z:z+nz*((sideways?b.w:b.h)/2+.7+depth)+tz*offset});
    if(b.w>90&&b.h>60){
      const apron=facade(0,6);forecourts.add(apron.x,1.8,apron.z,length,1,12,'#736e61',angle);
      for(const side of [-1,1]){
        const w=Math.min(42,length*.22),p=facade(side*length*.24),glow=facade(side*length*.24,18);
        glass.add(p.x,14,p.z,w,20,1,'#e7ab62',angle);halos.add(p.x+.05*nx,17,p.z+.05*nz,w*1.6,38,1,'#fda14c',angle);
        for(const offset of [-w/2,w/2]){const frame=facade(side*length*.24+offset,.5);details.add(frame.x,14,frame.z,1.5,23,2,'#867a62',angle);}
        details.add(p.x,25,p.z,w+4,2.5,4,'#88775d',angle);details.add(p.x,3.7,p.z,w+4,2,4,'#5e5748',angle);
        pools.add(glow.x,3.3,glow.z,70,1,80,'#ff9f35',angle);roadReflection(p.x,p.z,neon);count++;
      }
      const door=facade(0,.1),handle=facade(6,1),canopy=facade(0,5);
      glass.add(door.x,12,door.z,14,22,1,'#655446',angle);details.add(handle.x,12,handle.z,1,2,1,'#d8ba72',angle);
      details.add(canopy.x,27,canopy.z,Math.min(110,length*.65),3,13,neon,angle);
      const band=facade(0,.3);for(let floor=1;floor<height/24;floor++)details.add(band.x,floor*24+2,band.z,length,2,3,'#544940',angle);
    }
    if(b.sign){const sign=mountedSign(b.sign,Math.min(length*.78,210),neon),p=facade(0,1.3);sign.position.set(p.x,36,p.z);sign.rotation.y=angle;scene.add(sign);}
    // Secondary neon identifies small businesses without renaming civic sites,
    // missions, or saved locations. Pawn shops get the reference's vertical sign.
    if(height>=48&&(pawn||bar||(b.archetype==='shop'&&!b.civicType&&index%5===0))){
      const label=pawn?'LOANS':bar?'BAR':'OPEN',p=facade(length*.4,4),sign=mountedSign(label,9,pawn||bar?'#ff4228':'#ffc15a',true);
      sign.position.set(p.x,Math.min(height-12,60),p.z);sign.rotation.y=angle;scene.add(sign);
      const face=facade(length*.4,.9);halos.add(face.x,sign.position.y,face.z,22,65,1,'#f34a25',angle);roadReflection(p.x,p.z,'#fc4424');
    }
  },flush(){glass.flush();halos.flush();forecourts.flush();return {windows:count};}};
}
