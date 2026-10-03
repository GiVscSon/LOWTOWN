import * as THREE from 'three';

import {surfaceTextures,textureNoise} from './surface_textures.js';

export function surfaceTexture(kind){return surfaceTextures(kind).map;}

export function surfaceMaterial(kind,color=0xffffff,cheap=false){
  const textures=surfaceTextures(kind),options={color,map:textures.map,side:THREE.DoubleSide};
  const material=cheap?new THREE.MeshLambertMaterial(options):new THREE.MeshStandardMaterial({...options,roughness:kind==='asphalt'?.88:1,roughnessMap:textures.roughnessMap,normalMap:textures.normalMap,normalScale:new THREE.Vector2(.32,.32)});
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
      `vMapUv=surfacePosition.xz/${kind==='asphalt'?'192.0':'128.0'};`}
      #ifdef USE_NORMALMAP
        vNormalMapUv=vMapUv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv=vMapUv;
      #endif`);
  };
  material.customProgramCacheKey=()=>`lowtown-surface-${kind}`;
  return material;
}

export function glowTexture(streaks=false){
  const size=streaks?128:64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
    const fade=Math.max(0,1-u*u-v*v)**2;
    const shard=textureNoise(x,Math.floor(y/3)),burst=textureNoise(Math.floor(x/5),7);
    const cross=streaks?Math.exp(-v*v*18):1;
    const grain=streaks?cross*(.15+burst*.65)*(.2+shard*.8):1;
    const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(255*fade*grain);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;return texture;
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
