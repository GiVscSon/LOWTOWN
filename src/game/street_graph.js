import {corridorSegments,projectStreet} from './street_corridors.js';

export function buildCorridorGraph(roads,accessPoints=[]){
  const nodes=[],lookup=new Map(),segments=roads.flatMap(road=>corridorSegments(road).map(segment=>({...segment,nodes:[]})));
  const add=(x,y,segment)=>{
    const key=`${x.toFixed(4)},${y.toFixed(4)}`;let id=lookup.get(key);
    if(id===undefined){id=nodes.length;nodes.push({x,y,edges:new Set(),roads:new Set()});lookup.set(key,id);}
    nodes[id].roads.add(segment.road);segment.nodes.push(id);return id;
  };
  const cells=new Map(),cellSize=256,seen=new Set();
  segments.forEach((s,index)=>{
    add(s.a[0],s.a[1],s);add(s.b[0],s.b[1],s);
    for(const p of accessPoints){const hit=projectStreet(p.x,p.y,s);if(hit.distance<.001)add(hit.x,hit.y,s);}
    for(let x=Math.floor(Math.min(s.a[0],s.b[0])/cellSize);x<=Math.floor(Math.max(s.a[0],s.b[0])/cellSize);x++)
      for(let y=Math.floor(Math.min(s.a[1],s.b[1])/cellSize);y<=Math.floor(Math.max(s.a[1],s.b[1])/cellSize);y++){
        const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(index);
      }
  });
  for(const cell of cells.values())for(let i=0;i<cell.length;i++)for(let j=i+1;j<cell.length;j++){
    const ai=cell[i],bi=cell[j],key=ai<bi?`${ai}:${bi}`:`${bi}:${ai}`;if(seen.has(key))continue;seen.add(key);
    const a=segments[ai],b=segments[bi],cross=a.dx*b.dy-a.dy*b.dx;
    if(Math.abs(cross)>1e-8){
      const dx=b.a[0]-a.a[0],dy=b.a[1]-a.a[1],t=(dx*b.dy-dy*b.dx)/cross,u=(dx*a.dy-dy*a.dx)/cross;
      if(t>=-1e-7&&t<=1+1e-7&&u>=-1e-7&&u<=1+1e-7){const x=a.a[0]+a.dx*t,y=a.a[1]+a.dy*t;add(x,y,a);add(x,y,b);}
    }else for(const [point,other] of [[a.a,b],[a.b,b],[b.a,a],[b.b,a]]){
      const hit=projectStreet(...point,other);if(hit.distance<.001){add(...point,a);add(...point,b);}
    }
  }
  for(const segment of segments){
    const ids=[...new Set(segment.nodes)].sort((a,b)=>projectStreet(nodes[a].x,nodes[a].y,segment).t-projectStreet(nodes[b].x,nodes[b].y,segment).t);
    for(let i=1;i<ids.length;i++){nodes[ids[i-1]].edges.add(ids[i]);nodes[ids[i]].edges.add(ids[i-1]);}
  }
  nodes.organic=true;return nodes;
}

// Fundamental cycles preserve every genuine loop without doing one city-wide
// breadth-first search for each of thousands of curve samples.
export function corridorCircuits(graph){
  const parent=new Map(),depth=new Map(),cycles=[],seen=new Set();
  for(let root=0;root<graph.length;root++){
    if(parent.has(root))continue;parent.set(root,-1);depth.set(root,0);
    const stack=[root];
    while(stack.length){
      const a=stack.pop();
      for(const b of graph[a].edges){
        if(!parent.has(b)){parent.set(b,a);depth.set(b,depth.get(a)+1);stack.push(b);continue;}
        if(parent.get(a)===b||parent.get(b)===a)continue;
        const key=a<b?`${a}:${b}`:`${b}:${a}`;if(seen.has(key))continue;seen.add(key);
        let x=a,y=b;const left=[x],right=[y];
        while(x!==y){
          if(depth.get(x)>=depth.get(y)){x=parent.get(x);left.push(x);}
          else{y=parent.get(y);right.push(y);}
        }
        const ids=[...left,...right.slice(0,-1).reverse()];
        if(ids.length>=4){
          const points=ids.map(id=>({x:graph[id].x,y:graph[id].y}));
          const area=Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
          // Collinear overlaps are support links, not usable driving loops.
          if(area>80000){const closed=simplifyStreetPath([...points,points[0]],2);closed.pop();cycles.push(closed);}
        }
      }
    }
  }
  return cycles;
}

export function simplifyStreetPath(points,tolerance=2){
  if(points.length<3)return points;
  const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];
  while(stack.length){
    const [start,end]=stack.pop(),a=points[start],b=points[end],dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    let farthest=-1,distance=tolerance*tolerance;
    for(let i=start+1;i<end;i++){
      const p=points[i],t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
      const squared=(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;
      if(squared>distance){distance=squared;farthest=i;}
    }
    if(farthest>=0){keep.add(farthest);stack.push([start,farthest],[farthest,end]);}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>points[i]);
}
