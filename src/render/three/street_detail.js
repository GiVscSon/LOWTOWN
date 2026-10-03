import * as THREE from 'three';
import {createBoxBatch,addTiledGeometry} from './geometry.js';
import {streetPoints,streetWidth,onStreetCollection,nearestStreet} from '../../world/street_corridors.js';

function coverTexture(grate){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=x-63.5,dy=y-63.5,r=Math.hypot(dx,dy),noise=((x*13^y*31)&15);
    const outside=!grate&&r>59,frame=grate?(x<8||x>119||y<8||y>119):r>53||r<48&&r>45;
    const slot=grate?x%15<6&&y>13&&y<115:(x%12<3||y%12<3)&&r<44;
    const shade=frame?82+noise:slot?18+noise:49+noise;
    const i=(y*size+x)*4;data[i]=shade;data[i+1]=shade+3;data[i+2]=shade+3;data[i+3]=outside?0:255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.needsUpdate=true;return texture;
}

// Flush decoration follows existing road tangents and adds no solid body.
// Reject entire stamps at a road edge rather than drawing a half cover on grass.
export function addStreetDetail(world,scene){
  const plane=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const batch=grate=>createBoxBatch(scene,0xffffff,1,plane,new THREE.MeshBasicMaterial({map:coverTexture(grate),transparent:true,alphaTest:.05,depthWrite:false}),768);
  const covers=batch(false),grates=batch(true),placed=new Set(),report={manholes:0,drains:0};
  const roads=world.roads||[];
  const fits=(x,y,w,d,angle)=>[-1,1].every(a=>[-1,1].every(b=>onStreetCollection(x+Math.cos(angle)*a*w/2-Math.sin(angle)*b*d/2,y+Math.sin(angle)*a*w/2+Math.cos(angle)*b*d/2,roads)));
  for(const [index,road] of roads.entries()){
    if(road.bridgeApproach||road.footway)continue;
    const points=streetPoints(road),width=streetWidth(road);let remaining=120+(index%3)*42;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
      while(remaining<length){
        const t=remaining/length,cx=a[0]+(b[0]-a[0])*t,cy=a[1]+(b[1]-a[1])*t;
        const side=index%2?1:-1,x=cx-Math.sin(angle)*width*.18*side,y=cy+Math.cos(angle)*width*.18*side;
        const key='cover:'+Math.round(x/18)+','+Math.round(y/18);
        if(!placed.has(key)&&fits(x,y,13,13,angle)){placed.add(key);covers.add(x,3.11,y,13,1,13,0xffffff,-angle);report.manholes++;}
        remaining+=260;
      }
      remaining-=length;
    }
  }
  for(const edge of world.paint?.curbs||[]){
    if(edge.bridge)continue;
    const length=Math.hypot(edge.x2-edge.x1,edge.y2-edge.y1);if(length<25)continue;
    const cx=(edge.x1+edge.x2)/2,cy=(edge.y1+edge.y2)/2,hit=nearestStreet(cx,cy,roads);
    if(!hit||hit.distance>90)continue;
    const dx=hit.x-cx,dy=hit.y-cy,distance=Math.hypot(dx,dy)||1,x=cx+dx/distance*6,y=cy+dy/distance*6,angle=Math.atan2(edge.y2-edge.y1,edge.x2-edge.x1);
    const key='drain:'+Math.round(x/140)+','+Math.round(y/140);
    if(placed.has(key)||!fits(x,y,14,7,angle))continue;
    placed.add(key);grates.add(x,3.12,y,14,1,7,0xffffff,-angle);report.drains++;
  }
  covers.flush();grates.flush();return report;
}

function inside(x,y,points){
  let result=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}

// Fill the actual setback with a forecourt connected to the curved sidewalk.
// Sampling and checking each small quad prevents paving across an inlet or
// through a neighbouring building, while leaving the road footprint intact.
export function addForecourts(world,scene,material){
  const vertices=[];let count=0;
  for(const b of world.buildings||[]){
    const road=world.roads?.find(r=>r.id===b.streetId);if(!road||road.bridgeApproach)continue;
    const angle=({north:Math.PI,south:0,east:Math.PI/2,west:-Math.PI/2})[b.streetFacing];if(!Number.isFinite(angle))continue;
    const sideways=b.streetFacing==='east'||b.streetFacing==='west',length=sideways?b.h:b.w,nx=Math.sin(angle),ny=Math.cos(angle),tx=Math.cos(angle),ty=-Math.sin(angle);
    const cx=b.x+b.w/2+nx*((sideways?b.w:b.h)/2+.6),cy=b.y+b.h/2+ny*((sideways?b.w:b.h)/2+.6),steps=Math.ceil(length/24);let previous=null,added=false;
    for(let i=0;i<=steps;i++){
      const offset=(i/steps-.5)*length,x=cx+tx*offset,y=cy+ty*offset,hit=nearestStreet(x,y,[road]);
      if(!hit||hit.distance>220){previous=null;continue;}
      const d=hit.distance||1,shoulder=streetWidth(road)/2+36,q={a:[x,y],b:[hit.x+(x-hit.x)/d*shoulder,hit.y+(y-hit.y)/d*shoulder]};
      if(hit.distance<shoulder){previous=null;continue;}
      if(previous){const corners=[previous.a,q.a,q.b,previous.b],samples=[...corners,...corners.map((p,j)=>[(p[0]+corners[(j+1)%4][0])/2,(p[1]+corners[(j+1)%4][1])/2]),[(previous.a[0]+q.b[0])/2,(previous.a[1]+q.b[1])/2]];
        const valid=samples.every(p=>(world.islands||[]).some(island=>inside(p[0],p[1],island.points)))&&samples.every(p=>!(world.buildings||[]).some(other=>other!==b&&p[0]>other.x&&p[0]<other.x+other.w&&p[1]>other.y&&p[1]<other.y+other.h));
        if(valid){for(const j of [0,1,2,0,2,3])vertices.push(corners[j][0],1.45,corners[j][1]);added=true;}
      }
      previous=q;
    }
    if(added)count++;
  }
  if(vertices.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();addTiledGeometry(scene,geometry,material);}
  return count;
}
