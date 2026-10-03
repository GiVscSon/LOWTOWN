import {coastPoints,pointInCoast,pointInBeach,BEACH_WIDTH} from './coastline.js';
import {corridorContains} from './street_corridors.js';
import {createSpatialIndex} from '../simulation/spatial_index.js';

// Feet use the visible shoreline/deck, without the generous driving margins.
export function createWalkSurface({islands=[],piers=[],bridges=[]}={}){
  const shores=islands.map(island=>{
    const points=coastPoints(island),width=(island.natural?42:BEACH_WIDTH)-.3;
    return {island,width,left:Math.min(...points.map(p=>p[0]))-width,right:Math.max(...points.map(p=>p[0]))+width,
      top:Math.min(...points.map(p=>p[1]))-width,bottom:Math.max(...points.map(p=>p[1]))+width};
  });
  const decks=[...piers,...bridges].map(deck=>{
    if(!deck.points)return {deck,left:deck.x,right:deck.x+deck.w,top:deck.y,bottom:deck.y+deck.h};
    const half=(deck.width||deck.w||100)/2;
    return {deck,left:Math.min(...deck.points.map(p=>p[0]))-half,right:Math.max(...deck.points.map(p=>p[0]))+half,
      top:Math.min(...deck.points.map(p=>p[1]))-half,bottom:Math.max(...deck.points.map(p=>p[1]))+half};
  });
  const index=createSpatialIndex([...shores,...decks],item=>item,512);
  const edges=islands.flatMap(island=>{const points=coastPoints(island);return points.map((a,i)=>{
    const b=points[(i+1)%points.length];return {left:Math.min(a[0],b[0]),right:Math.max(a[0],b[0]),top:Math.min(a[1],b[1]),bottom:Math.max(a[1],b[1])};
  });});
  const edgeIndex=createSpatialIndex(edges,item=>item,128),interior=new Map(),cellSize=128;
  function dryCell(cx,cy){
    const key=`${cx}:${cy}`;if(interior.has(key))return interior.get(key);
    const left=cx*cellSize,top=cy*cellSize,right=left+cellSize,bottom=top+cellSize;
    // No shoreline segment enters this cell: one inside test certifies its
    // whole area. Boundary cells always use the exact footprint below.
    const inside=!edgeIndex.query(left,top,right,bottom).length&&
      index.query(left,top,right,bottom).some(item=>item.island&&pointInCoast(left+64,top+64,item.island));
    interior.set(key,inside);return inside;
  }
  function supported(x,y,radius=4.5){
    if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    const x0=Math.floor((x-radius)/cellSize),x1=Math.floor((x+radius)/cellSize),y0=Math.floor((y-radius)/cellSize),y1=Math.floor((y+radius)/cellSize);
    if(dryCell(x0,y0)&&dryCell(x1,y0)&&dryCell(x0,y1)&&dryCell(x1,y1))return true;
    const nearby=index.query(x-radius,y-radius,x+radius,y+radius);
    return [[0,0],[-radius,-radius],[-radius,radius],[radius,-radius],[radius,radius]].every(([dx,dy])=>{
      const px=x+dx,py=y+dy;
      return nearby.some(item=>item.island?pointInCoast(px,py,item.island)||pointInBeach(px,py,item.island,item.width):
        item.deck.points?corridorContains(px,py,item.deck,0):px>=item.left&&px<=item.right&&py>=item.top&&py<=item.bottom);
    });
  }
  return supported;
}
