// Rendering and collision use the same pole positions at every junction.
export function signalPosts(junctions=[]){
  return junctions.flatMap(junction=>{
    const cx=junction.cx??junction.x+junction.w/2,cy=junction.cy??junction.y+junction.h/2;
    const offset=Math.max(junction.w,junction.h)/2+12;
    return (junction.directions||[0,Math.PI/2,Math.PI,Math.PI*1.5]).map(direction=>{
      const cs=Math.cos(direction),sn=Math.sin(direction);
      return {x:cx+cs*offset-sn*offset,y:cy+sn*offset+cs*offset,direction,axis:Math.abs(cs)>Math.abs(sn)?'x':'y'};
    });
  });
}
export function infrastructureColliders(lights=[],junctions=[]){
  return [...lights.map(l=>({x:l.x,y:l.y,width:7,height:7,type:'lampPole'})),
    ...signalPosts(junctions).map(p=>({...p,width:4,height:4,type:'signalPole'}))];
}
