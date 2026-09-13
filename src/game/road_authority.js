export const ROAD_GRID=160;
export const ROAD_LIMIT=2720;
export const ROAD_WIDTH=92;

const DIRECTIONS=[[ROAD_GRID,0],[-ROAD_GRID,0],[0,ROAD_GRID],[0,-ROAD_GRID]];

export function buildRoadNetwork({isLand,blocked,limit=ROAD_LIMIT,grid=ROAD_GRID}={}){
  const nodes=[];
  const map=new Map();
  const open=(x,y)=>typeof isLand==='function'&&isLand(x,y)&&!(typeof blocked==='function'&&blocked(x,y));
  for(let x=-limit;x<=limit;x+=grid){
    for(let y=-limit;y<=limit;y+=grid){
      if(!open(x,y))continue;
      const node={x,y,id:`road:${x}:${y}`,links:[]};
      nodes.push(node);map.set(`${x},${y}`,node);
    }
  }
  const corridor=(a,b)=>{
    for(let i=1;i<=16;i++){
      const t=i/16;
      if(!open(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;
    }
    return true;
  };
  for(const node of nodes){
    for(const [dx,dy] of DIRECTIONS){
      const next=map.get(`${node.x+dx},${node.y+dy}`);
      if(next&&corridor(node,next))node.links.push(next);
    }
  }
  return nodes;
}

export function snapToRoad(point,nodes=[]){
  let best=null;
  for(const n of nodes){
    const d=Math.hypot(n.x-point.x,n.y-point.y);
    if(!best||d<best.distance)best={node:n,distance:d};
  }
  if(!best)return null;
  const next=best.node.links[0];
  return {x:best.node.x,y:best.node.y,heading:next?Math.atan2(next.y-best.node.y,next.x-best.node.x):0,distance:best.distance,node:best.node};
}

export function roadSegments(nodes=[]){
  const seen=new Set();
  const segments=[];
  for(const a of nodes){
    for(const b of a.links){
      const key=a.id<b.id?`${a.id}|${b.id}`:`${b.id}|${a.id}`;
      if(seen.has(key))continue;
      seen.add(key);segments.push([a,b]);
    }
  }
  return segments;
}

export function isNearRoad(x,y,nodes=[],radius=ROAD_WIDTH/2){
  for(const n of nodes)if(Math.hypot(n.x-x,n.y-y)<=radius)return true;
  return false;
}
