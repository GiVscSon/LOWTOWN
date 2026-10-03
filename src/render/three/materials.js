import * as THREE from 'three';

// Tiny shared textures use world coordinates, so differently sized road
// rectangles have the same grain and paving scale, including at junctions.
const textureCache=new Map();
export function surfaceTexture(kind){
  if(textureCache.has(kind))return textureCache.get(kind);
  const facade=kind==='plaster'||kind==='concrete';
  const size=facade?256:128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const noise=((Math.imul(x+1,73856093)^Math.imul(y+1,19349663))>>>0)%29;
    let shade=kind==='asphalt'?205+noise:222+noise;
    if(kind==='paving'&&(x%32<2||y%32<2))shade=172+noise;
    if(kind==='wood')shade=(y%16<2?150:214)+noise+Math.round(Math.sin(x*.21+y*.6)*6);
    if(kind==='brick'){
      const row=Math.floor(y/8),joint=y%8<1||(x+(row%2)*16)%32<1;
      shade=(joint?143:210)+noise;
    }
    if(facade){
      const broad=Math.sin(x*.043+y*.021)*Math.sin(y*.035)+Math.sin(x*.17)*.18;
      const panel=x%128<2||y%96<2,streak=Math.max(0,Math.sin(x*.31+Math.sin(x*.071)*2))**12;
      const damp=Math.max(0,Math.sin(y*.014+x*.008))*.18;
      shade=208+noise*.75+broad*15-streak*(10+((y+21)%96)*.3)-damp*75-(panel?29:0);
      if((x+Math.floor(y/7))%113===0&&y%96<48)shade-=27;
    }
    if(kind==='roof')shade=(x%32<1||y%32<1?170:208)+noise;
    const index=(y*size+x)*4;
    data[index]=data[index+1]=data[index+2]=Math.min(255,shade);data[index+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  textureCache.set(kind,texture);return texture;
}

export function surfaceMaterial(kind,color=0xffffff,cheap=false){
  const options={color,map:surfaceTexture(kind),side:THREE.DoubleSide};
  const material=cheap?new THREE.MeshLambertMaterial(options):new THREE.MeshStandardMaterial({...options,roughness:kind==='asphalt'?.88:1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      vec4 surfacePosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        surfacePosition=instanceMatrix*surfacePosition;
      #endif
      surfacePosition=modelMatrix*surfacePosition;
      ${['brick','plaster','concrete'].includes(kind)?`vec3 surfaceNormal=objectNormal;
      #ifdef USE_INSTANCING
        surfaceNormal=mat3(instanceMatrix)*surfaceNormal;
      #endif
      vMapUv=vec2(abs(surfaceNormal.x)>abs(surfaceNormal.z)?surfacePosition.z:surfacePosition.x,surfacePosition.y)/${kind==='brick'?'64.0':'192.0'};`:
      `vMapUv=surfacePosition.xz/${kind==='asphalt'?'96.0':'128.0'};`}`);
  };
  material.customProgramCacheKey=()=>`lowtown-surface-${kind}`;
  return material;
}

export function glowTexture(streaks=false){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
    const fade=Math.max(0,1-u*u-v*v)**2;
    const grain=streaks?.25+((Math.imul(x+3,13)^Math.imul(y+5,31))&31)/42:1;
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*fade*grain);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;
  texture.magFilter=texture.minFilter=THREE.LinearFilter;return texture;
}

export function waterMaterial(cheap=false){
  const material=cheap?new THREE.MeshLambertMaterial({color:'#2d4b59'}):new THREE.MeshStandardMaterial({color:'#2d4b59',roughness:.44,metalness:.16});
  material.onBeforeCompile=shader=>{
    shader.uniforms.rippleTime={value:0};material.userData.shader=shader;
    shader.vertexShader='varying vec2 waterPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
      waterPosition=(modelMatrix*vec4(transformed,1.0)).xz;`);
    shader.fragmentShader='varying vec2 waterPosition;uniform float rippleTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float ripple=sin(waterPosition.x*.028+waterPosition.y*.017+rippleTime*.65)
        *sin(waterPosition.y*.053-waterPosition.x*.012-rippleTime*.4);
      diffuseColor.rgb*=.93+ripple*.12;`);
  };
  material.customProgramCacheKey=()=> 'lowtown-water-ripples';
  return material;
}
