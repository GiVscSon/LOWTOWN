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
export function ribbonTangent(points,index){
  const p=points[index],incoming=p.clone().sub(points[Math.max(0,index-1)]).normalize(),outgoing=points[Math.min(points.length-1,index+1)].clone().sub(p).normalize();
  const tangent=incoming.add(outgoing);return tangent.lengthSq()>1e-8?tangent.normalize():new THREE.Vector2(1,0);
}
export function ribbonGeometry(points,width,elevation=3.6){
  const vertices=[],indices=[];
  for(let i=0;i<points.length;i++){
    const tangent=ribbonTangent(points,i);
    const nx=-tangent.y*width/2,ny=tangent.x*width/2,p=points[i];
    vertices.push(p.x+nx,elevation,p.y+ny,p.x-nx,elevation,p.y-ny);
    if(i){const a=(i-1)*2,b=i*2;indices.push(a,b,a+1,a+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function createBoxBatch(scene,color,roughness=.85,geometry=new THREE.BoxGeometry(1,1,1),material=null,cellSize=768){
  const items=[];
  return {
    add(x,y,z,w,h,d,paint=color,angle=0){items.push({x,y,z,w,h,d,paint,angle});},
    beam(a,b,h,d=h,paint=color){
      const direction=b.clone().sub(a),length=direction.length();if(length<.01)return;
      const center=a.clone().add(b).multiplyScalar(.5);
      items.push({x:center.x,y:center.y,z:center.z,w:length,h,d,paint,angle:0,
        rotation:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),direction.normalize())});
    },
    flush(){
      if(!items.length)return null;
      const paintMaterial=material||new THREE.MeshStandardMaterial({color:0xffffff,roughness,vertexColors:false});
      // A single city-wide instance batch defeats frustum culling: every
      // facade and railing would be drawn even with the close walking camera.
      // District-sized batches share their geometry and material, but only
      // the visible neighbourhood reaches the GPU.
      const cells=new Map();
      for(const item of items){const key=`${Math.floor(item.x/cellSize)},${Math.floor(item.z/cellSize)}`;
        if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);}
      const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
      let first=null;
      for(const cell of cells.values()){
        const mesh=new THREE.InstancedMesh(geometry,paintMaterial,cell.length);
        cell.forEach((item,index)=>{
          if(item.rotation)rotation.copy(item.rotation);else rotation.setFromAxisAngle(axis,item.angle);
          matrix.compose(new THREE.Vector3(item.x,item.y,item.z),rotation,new THREE.Vector3(item.w,item.h,item.d));
          mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,new THREE.Color(item.paint));
        });
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);first??=mesh;
      }
      return first;
    }
  };
}

// Road triangles have local bounds so the close camera no longer draws the
// entire archipelago's asphalt. Shared materials retain batching per tile.
export function addTiledGeometry(scene,geometry,material,cellSize=768){
  const source=geometry.index?geometry.toNonIndexed():geometry,position=source.attributes.position,cells=new Map();
  for(let i=0;i<position.count;i+=3){
    const x=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3,z=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3;
    const key=`${Math.floor(x/cellSize)}:${Math.floor(z/cellSize)}`;let cell=cells.get(key);if(!cell)cells.set(key,cell=[]);cell.push(i);
  }
  for(const cell of cells.values()){
    const tile=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(source.attributes)){
      const values=new attribute.array.constructor(cell.length*3*attribute.itemSize);let offset=0;
      for(const i of cell){const start=i*attribute.itemSize;values.set(attribute.array.subarray(start,start+3*attribute.itemSize),offset);offset+=3*attribute.itemSize;}
      tile.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize,attribute.normalized));
    }
    tile.computeBoundingSphere();scene.add(new THREE.Mesh(tile,material));
  }
  if(source!==geometry)source.dispose();geometry.dispose();return cells.size;
}
