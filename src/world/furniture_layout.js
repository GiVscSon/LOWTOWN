import {onStreetCollection} from './street_corridors.js';
// Rendering and collision use the same pole positions at every junction.
export function signalPosts(junctions=[]){
  return junctions.flatMap(junction=>{
    const cx=junction.cx??junction.x+junction.w/2,cy=junction.cy??junction.y+junction.h/2;
    const offset=Math.max(junction.w,junction.h)/2+12;
    const roads=[...(junction.horizontalRoads||[]),...(junction.verticalRoads||[])];
    return (junction.directions||[0,Math.PI/2,Math.PI,Math.PI*1.5]).flatMap(direction=>{
      const cs=Math.cos(direction),sn=Math.sin(direction);
      // At an oblique junction the adjacent carriageway can cover the old
      // square corner. Move out along the approach until the whole base is
      // on the pavement, keeping the signal beside its own traffic stream.
      for(let along=offset;along<=offset*6;along+=4){
        const x=cx+cs*along-sn*offset,y=cy+sn*along+cs*offset;
        if(roads.length&&[[0,0],[-4,-4],[-4,4],[4,-4],[4,4]].some(([dx,dy])=>onStreetCollection(x+dx,y+dy,roads)))continue;
        return [{x,y,direction,axis:Math.abs(cs)>Math.abs(sn)?'x':'y'}];
      }
      return [];
    });
  });
}
export function infrastructureColliders(lights=[],junctions=[]){
  return [...lights.map(l=>({x:l.x,y:l.y,width:7,height:7,type:'lampPole'})),
    ...signalPosts(junctions).map(p=>({...p,width:4,height:4,type:'signalPole'}))];
}
