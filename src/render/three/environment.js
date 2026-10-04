import * as THREE from 'three';

// A small, linear HDR night sky supplies broad highlights without adding
// per-car lights or reflection cameras. PMREM is generated once per renderer.
export function nightEnvironmentTexture(width=128,height=64){
  const pixels=new Float32Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width,v=(y+.5)/height;
    const sky=Math.max(0,Math.cos(v*Math.PI)),horizon=Math.exp(-(((v-.5)/.11)**2));
    const angular=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b));
    const moon=Math.exp(-((angular(u,.17)/.055)**2)-((v-.22)/.12)**2);
    const shop=Math.exp(-((angular(u,.70)/.065)**2)-((v-.51)/.08)**2);
    const strip=Math.exp(-((angular(u,.43)/.025)**2)-((v-.43)/.17)**2);
    const i=(y*width+x)*4;
    pixels[i]=.025+sky*.13+horizon*.09+moon*2.3+shop*3.8+strip*1.1;
    pixels[i+1]=.032+sky*.20+horizon*.08+moon*2.7+shop*1.8+strip*1.35;
    pixels[i+2]=.041+sky*.31+horizon*.075+moon*3.5+shop*.55+strip*1.6;
    pixels[i+3]=1;
  }
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat,THREE.FloatType);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
  texture.needsUpdate=true;return texture;
}
export function createNightEnvironment(renderer){
  const source=nightEnvironmentTexture(),generator=new THREE.PMREMGenerator(renderer);
  const target=generator.fromEquirectangular(source);source.dispose();generator.dispose();
  return {texture:target.texture,dispose:()=>target.dispose()};
}

export function contactShadowTexture(){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const edge=Math.max(Math.abs((x+.5)/size*2-1),Math.abs((y+.5)/size*2-1));
    const alpha=Math.max(0,Math.min(1,(1-edge)/.38));
    data.set([255,255,255,Math.round(alpha*alpha*255)],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;return texture;
}
