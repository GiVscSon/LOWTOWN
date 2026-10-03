// Shared model-space surfaces: x forward, y across, z up. Loft vertices carry
// smooth normals; caps and hardware keep their own hard edges.
export function faceNormal(points){
  const a=points[0],b=points[1],c=points[2],u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
  return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
}
const unit=n=>{const length=Math.hypot(...n);return length>1e-9?n.map(v=>v/length):[0,0,1];};
export function addLoft(faces,rings,paint,{surface='paint',fill=null,caps=true}={}){
  const normals=rings.map(r=>r.map(()=>[0,0,0])),panels=[];
  for(let s=0;s<rings.length-1;s++)for(let j=0;j<rings[s].length;j++){
    const k=(j+1)%rings[s].length,indices=[[s,j],[s+1,j],[s+1,k],[s,k]],points=indices.map(([i,n])=>rings[i][n]);
    const n=faceNormal(points);if(Math.hypot(...n)<1e-8)continue;
    for(const [i,v] of indices)for(let axis=0;axis<3;axis++)normals[i][v][axis]+=n[axis];
    const style=fill?.(s,j)||{fill:paint,surface};panels.push({points,normal:n,trim:false,...style,indices});
  }
  for(const panel of panels){panel.normals=panel.indices.map(([i,j])=>unit(normals[i][j]));delete panel.indices;faces.push(panel);}
  if(caps){for(const [index,reverse] of [[0,false],[rings.length-1,true]]){const points=reverse?[...rings[index]].reverse():rings[index];faces.push({points,normal:faceNormal(points),fill:paint,surface,trim:false});}}
}
export function addBox(faces,x,y,l,b,z0,z1,fill,surface='paint'){
  const bottom=[[x,y,z0],[x+l,y,z0],[x+l,y+b,z0],[x,y+b,z0]],top=bottom.map(([a,c])=>[a,c,z1]);
  for(let i=0;i<4;i++){const j=(i+1)%4,points=[bottom[i],bottom[j],top[j],top[i]];faces.push({points,normal:faceNormal(points),fill,surface,trim:false});}
  faces.push({points:top,normal:faceNormal(top),fill,surface,trim:false});
}
