import * as THREE from 'three';

let texture;
// Opaque, tinted glass keeps depth sorting reliable. An interior texture
// supplies seat backs, headrests and a dashboard beneath the sky reflection.
export function cabinTexture(){
  if(texture)return texture;
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    let value=24+v*10;
    for(const center of [.27,.74]){
      const dx=Math.abs(u-center),seat=dx<.16&&v>.20&&v<.7,head=dx<.10&&v>=.70&&v<.83;
      if(seat)value=48+Math.max(0,1-dx/.16)*23+(Math.floor(x/5)%2?3:0);
      if(head)value=62+Math.max(0,1-dx/.10)*16;
    }
    if(v<.18)value=42+v*80;
    const wheel=Math.hypot((u-.28)*1.2,(v-.17)*1.5);
    if(wheel>.095&&wheel<.115)value=16;
    if(Math.abs(u-.51)<.012&&v<.16)value=84;
    const grain=((x*17+y*31)%13)/13*3;
    data.set([value+grain,value+grain+3,value+grain+5,255],(y*size+x)*4);
  }
  texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;
  texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.needsUpdate=true;return texture;
}
