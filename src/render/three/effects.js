import * as THREE from 'three';

export function createWorldEffects(scene,capacity=256){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const context=canvas.getContext('2d'),gradient=context.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.35,'rgba(255,255,255,.45)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  context.fillStyle=gradient;context.fillRect(0,0,32,32);const texture=new THREE.CanvasTexture(canvas);
  const mist=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide});mist.forceSinglePass=true;
  const glow=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});glow.forceSinglePass=true;
  const ring=new THREE.MeshBasicMaterial({color:'#a7d3dc',transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});ring.forceSinglePass=true;
  const batches={mist:new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),mist,capacity),spark:new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),glow,capacity),chip:new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshLambertMaterial({color:0xffffff}),capacity),ripple:new THREE.InstancedMesh(new THREE.RingGeometry(.8,1,24).rotateX(-Math.PI/2),ring,capacity)};
  for(const mesh of Object.values(batches)){mesh.count=0;mesh.frustumCulled=false;scene.add(mesh);}
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color(),axis=new THREE.Vector3(0,1,0);
  return {batches,update(particles,camera,surface,visible,quality='high'){
    const counts={mist:0,spark:0,chip:0,ripple:0},limit=quality==='off'?0:quality==='medium'?96:capacity;let total=0;
    for(const p of particles||[]){if(p.life<=0||total>=limit||!visible(p,24))continue;
      const type=p.kind==='ripple'?'ripple':p.kind==='chip'?'chip':p.kind==='spark'?'spark':'mist',index=counts[type]++;
      const fade=Math.min(1,p.life/.25),growth=p.kind==='ripple'?1+p.age*8:p.kind==='steam'?1+p.age*1.5:1+p.age*.5,size=p.size*growth*fade;
      if(type==='ripple')q.identity();else if(type==='chip')q.setFromAxisAngle(axis,p.serial+p.age*8);else q.copy(camera.quaternion);
      matrix.compose(position.set(p.x,(p.baseY??surface(p.x,p.y))+p.z,p.y),q,scale.set(size,type==='spark'?size*.28:size,size));batches[type].setMatrixAt(index,matrix);
      color.set({ripple:'#a7d3dc',chip:'#ad9774',spark:'#ffc670',water:'#b4dae2',dust:'#a39883',steam:'#a8b0af'}[p.kind]);batches[type].setColorAt(index,color);total++;
    }
    for(const [type,mesh] of Object.entries(batches)){mesh.count=counts[type];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    return total;
  }};
}
