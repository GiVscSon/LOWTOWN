// Conservative AABB broad phase. Queries preserve insertion order so using
// nearby candidates does not change the simulation's collision priorities.
export function createSpatialIndex(items,bounds,cellSize=256){
  const cells=new Map(),entries=items.map((item,order)=>({item,order,...bounds(item)}));
  for(const entry of entries){
    for(let x=Math.floor(entry.left/cellSize);x<=Math.floor(entry.right/cellSize);x++)
      for(let y=Math.floor(entry.top/cellSize);y<=Math.floor(entry.bottom/cellSize);y++){
        const key=`${x}:${y}`;let cell=cells.get(key);
        if(!cell)cells.set(key,cell=[]);cell.push(entry);
      }
  }
  return {
    query(left,top,right,bottom){
      const found=new Set();
      for(let x=Math.floor(left/cellSize);x<=Math.floor(right/cellSize);x++)
        for(let y=Math.floor(top/cellSize);y<=Math.floor(bottom/cellSize);y++)
          for(const entry of cells.get(`${x}:${y}`)||[])
            if(entry.left<=right&&entry.right>=left&&entry.top<=bottom&&entry.bottom>=top)found.add(entry);
      return [...found].sort((a,b)=>a.order-b.order).map(entry=>entry.item);
    }
  };
}
