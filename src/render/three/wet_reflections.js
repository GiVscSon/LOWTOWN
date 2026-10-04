import * as THREE from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {onStreetCollection} from '../../world/street_corridors.js';
export function createWetReflections(scene,world,surfaceY,software=false){
  const width=640,size=64,pixels=new Uint8Array(size*size*4),mask=new THREE.DataTexture(pixels,size,size);
  mask.minFilter=mask.magFilter=THREE.LinearFilter;mask.needsUpdate=true;
  const shader={...Reflector.ReflectorShader,uniforms:{...Reflector.ReflectorShader.uniforms,roadMask:{value:mask},wetness:{value:0}},
    vertexShader:'varying vec2 vWetUv;\n'+Reflector.ReflectorShader.vertexShader.replace('vUv = textureMatrix',`vWetUv=position.xy/${width.toFixed(1)}+.5;\n vUv = textureMatrix`),
    fragmentShader:'varying vec2 vWetUv;uniform sampler2D roadMask;uniform float wetness;\n'+Reflector.ReflectorShader.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',`
      float road=texture2D(roadMask,vWetUv).r;
      float edge=smoothstep(0.0,.12,min(min(vWetUv.x,1.0-vWetUv.x),min(vWetUv.y,1.0-vWetUv.y)));
      float puddle=.55+.45*sin(vWetUv.x*29.0+sin(vWetUv.y*37.0))*sin(vWetUv.y*43.0);
      gl_FragColor=vec4(base.rgb,road*edge*wetness*(.08+puddle*.32));`)};
  const mirror=new Reflector(new THREE.PlaneGeometry(width,width),{textureWidth:software?128:512,textureHeight:software?128:512,multisample:0,clipBias:.003,shader});
  mirror.material.uniforms.roadMask.value=mask;
  mirror.rotation.x=-Math.PI/2;mirror.material.transparent=true;mirror.material.depthWrite=false;mirror.material.toneMapped=true;mirror.renderOrder=1;mirror.visible=false;scene.add(mirror);
  let lastUpdate=-Infinity,lastMask=-Infinity,updates=0,lastCpu=0,autoRetryAt=0;
  const original=mirror.onBeforeRender;
  const omit=[];
  mirror.onBeforeRender=(renderer,renderScene,camera)=>{
    const now=performance.now();if(now-lastUpdate<(software?500:100))return;
    const before=performance.now();const hidden=[];
    for(const object of omit)if(object.visible){hidden.push(object);object.visible=false;}
    try{original.call(mirror,renderer,renderScene,camera);updates++;lastUpdate=now;}finally{for(const object of hidden)object.visible=true;lastCpu=performance.now()-before;}
  };
  function update(player,weather,graphics,cpuMs){
    const now=performance.now(),requested=graphics.reflectionQuality||'auto';
    if(requested==='auto'&&cpuMs>=28)autoRetryAt=now+3000;
    const active=graphics.reflections&&weather.wetness>.18&&requested!=='low'&&
      (requested==='high'||!software&&now>=autoRetryAt)&&surfaceY(player.x,player.y)<5;
    mirror.visible=active;mirror.material.uniforms.wetness.value=weather.wetness||0;
    if(active&&performance.now()-lastMask>500){
      const x=Math.round(player.x/32)*32,z=Math.round(player.y/32)*32;mirror.position.set(x,3.19,z);mirror.updateMatrixWorld();
      for(let iy=0;iy<size;iy++)for(let ix=0;ix<size;ix++){
        const px=x+((ix+.5)/size-.5)*width,pz=z-((iy+.5)/size-.5)*width;
        const road=onStreetCollection(px,pz,world.roads||[])&&surfaceY(px,pz)<5;
        pixels.set([road?255:0,0,0,255],(iy*size+ix)*4);
      }
      mask.needsUpdate=true;lastMask=performance.now();lastUpdate=-Infinity;
    }
    return {mode:active?'planar':'streaks',updates,resolution:software?128:512,lastCpuMs:lastCpu,budgetHz:software?2:10};
  }
  return {update,exclude:objects=>omit.push(...objects),dispose:()=>{mirror.getRenderTarget().dispose();mask.dispose();},mirror};
}
