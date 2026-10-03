import * as THREE from 'three';

export function roundedBridgePoints(points,width){
  if(!points?.length)return [];
  const result=[new THREE.Vector2(points[0].x,points[0].y)];
  for(let i=1;i<points.length-1;i++){
    const a=new THREE.Vector2(points[i-1].x,points[i-1].y),b=new THREE.Vector2(points[i].x,points[i].y),c=new THREE.Vector2(points[i+1].x,points[i+1].y);
    // Keep the inner edge inside the actual overlapping collision decks.
    // A wide visual radius alone creates asphalt over unsupported water.
    const trim=Math.min(width*.5,a.distanceTo(b)*.34,b.distanceTo(c)*.34);
    const entry=b.clone().add(a.clone().sub(b).normalize().multiplyScalar(trim)),exit=b.clone().add(c.clone().sub(b).normalize().multiplyScalar(trim));
    result.push(entry,...new THREE.QuadraticBezierCurve(entry,b,exit).getPoints(12).slice(1));
  }
  result.push(new THREE.Vector2(points.at(-1).x,points.at(-1).y));return result;
}
export function ribbonGeometry(points,width,elevation=3.6){
  const vertices=[],indices=[];
  for(let i=0;i<points.length;i++){
    const previous=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],tangent=next.clone().sub(previous).normalize();
    const nx=-tangent.y*width/2,ny=tangent.x*width/2,p=points[i];
    vertices.push(p.x+nx,elevation,p.y+ny,p.x-nx,elevation,p.y-ny);
    if(i){const a=(i-1)*2,b=i*2;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function createBoxBatch(scene,color,roughness=.85,geometry=new THREE.BoxGeometry(1,1,1)){
  const items=[];
  return {
    add(x,y,z,w,h,d,paint=color,angle=0){items.push({x,y,z,w,h,d,paint,angle});},
    flush(){
      if(!items.length)return null;
      const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:0xffffff,roughness,vertexColors:false}),items.length);
      const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
      items.forEach((item,index)=>{
        rotation.setFromAxisAngle(axis,item.angle);matrix.compose(new THREE.Vector3(item.x,item.y,item.z),rotation,new THREE.Vector3(item.w,item.h,item.d));
        mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,new THREE.Color(item.paint));
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
    }
  };
}
