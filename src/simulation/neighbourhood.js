// Centre buckets contain each actor once. Queries only test a boolean predicate,
// so they need neither temporary result arrays nor duplicate removal/sorting.
export function createNeighbourhood(items,cellSize=128){
  const cells=new Map();
  for(const item of items){const key=`${Math.floor(item.x/cellSize)}:${Math.floor(item.y/cellSize)}`;let cell=cells.get(key);if(!cell)cells.set(key,cell=[]);cell.push(item);}
  return {some(x,y,radius,predicate){
    for(let cx=Math.floor((x-radius)/cellSize);cx<=Math.floor((x+radius)/cellSize);cx++)for(let cy=Math.floor((y-radius)/cellSize);cy<=Math.floor((y+radius)/cellSize);cy++){
      const cell=cells.get(`${cx}:${cy}`);if(cell)for(const item of cell)if(predicate(item))return true;
    }return false;
  }};
}
