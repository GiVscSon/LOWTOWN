import * as THREE from 'three';

const textures=new Map();
export const textureNoise=(x,y)=>{let n=Math.imul(x+1,73856093)^Math.imul(y+1,19349663);n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967295;};
const hash=textureNoise;
const clamp=value=>Math.max(0,Math.min(255,Math.round(value)));

// Repeatable, mipmapped detail remains legible at both walking and aerial
// distances. Stains are broad; aggregate and mortar have their own scale.
export function surfaceTextures(kind){
  if(textures.has(kind))return textures.get(kind);
  const size=256,albedo=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),height=new Float32Array(size*size);
  const tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=hash(x,y),u=x/size*tau,v=y/size*tau;
    const stain=Math.sin(u+Math.sin(v))*Math.cos(v*2)+Math.sin(u*3-v*2)*.36;
    let shade=222+noise*28,relief=noise*.08,polish=240;
    if(kind==='asphalt'){
      const crack=Math.abs(Math.sin(u+.28*Math.sin(v*2)+.1*Math.sin(v*7)))<.012&&Math.cos(v)>.2;
      const aggregate=noise>.92?32:noise<.08?-24:noise*22;
      shade=171+aggregate+stain*24-(crack?31:0);
      relief=noise*.28-(crack?.25:0);polish=181+stain*38+noise*30;
    }else if(kind==='paving'){
      const row=Math.floor(y/32),sx=(x+(row%2)*16)%32,joint=sx<1.5||y%32<1.5;
      const slab=hash(Math.floor((x+(row%2)*16)/32),row);
      shade=joint?137+noise*18:181+slab*34+noise*12+stain*9;
      if(!joint&&(sx<3||y%32<3))shade+=16;
      relief=joint?-.25:noise*.05;polish=joint?253:220+slab*20;
    }else if(kind==='wood'){
      shade=(y%16<2?130:203)+noise*27+Math.sin(x*.21+y*.6)*9;relief=(y%16<2?-.2:0)+noise*.05;
    }else if(kind==='brick'){
      const row=Math.floor(y/16),sx=(x+(row%2)*16)%32,joint=y%16<2||sx<2;
      shade=joint?132+noise*20:183+hash(Math.floor((x+(row%2)*16)/32),row)*39+noise*20+stain*13;
      relief=joint?-.25:noise*.08;
    }else if(kind==='plaster'||kind==='concrete'){
      const panel=x%128<2||y%96<2,streak=Math.max(0,Math.sin(x*.31+Math.sin(x*.071)*2))**12;
      shade=205+noise*20+stain*14-streak*(10+((y+21)%96)*.3)-Math.max(0,Math.sin(y*.014+x*.008))*14-(panel?29:0);
      if((x+Math.floor(y/7))%113===0&&y%96<48)shade-=27;
      relief=noise*.07-(panel?.12:0);
    }else if(kind==='roof'){
      shade=(x%32<1||y%32<1?141:185)+noise*29+stain*14;relief=noise*.07;
    }
    const i=(y*size+x)*4;color(albedo,i,shade,shade*.995,shade*.975,255);
    color(roughness,i,polish,polish,polish,255);height[y*size+x]=relief;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
    const length=Math.hypot(dx,dy,1),i=(y*size+x)*4;color(normal,i,128-dx/length*127,128-dy/length*127,128+127/length,255);
  }
  const make=(data,srgb=false)=>{const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;if(srgb)texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return texture;};
  const result={map:make(albedo,true),roughnessMap:make(roughness),normalMap:make(normal)};textures.set(kind,result);return result;
}
function color(data,i,r,g,b,a){data[i]=clamp(r);data[i+1]=clamp(g);data[i+2]=clamp(b);data[i+3]=a;}
