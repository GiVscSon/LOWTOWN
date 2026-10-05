const angleDot=(a,b)=>Math.cos(a.angle-b.angle);
// Junctions derive from the same connected road graph and approach bands as paint.
export function createJunctionPriority(paint){
  const cells=new Map(),reservations=new Map(),controlled=new Set(paint.signals||[]),nodes=paint.junctions||[];
  nodes.forEach((j,id)=>{j.priorityId=id;const key=`${Math.floor(j.cx/256)},${Math.floor(j.cy/256)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(j);});
  const near=car=>{const list=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)list.push(...(cells.get(`${Math.floor(car.x/256)+x},${Math.floor(car.y/256)+y}`)||[]));return list;};
  const approach=(car,j)=>{const dx=j.cx-car.x,dy=j.cy-car.y,c=Math.cos(car.angle),s=Math.sin(car.angle);return {along:dx*c+dy*s,across:Math.abs(-dx*s+dy*c),radius:j.w/2+(car.width||48)/2+12};};
  function update(cars,dt){
    const groups=new Map();
    cars.forEach((car,id)=>{
      car.priorityIdentity??=id;car.junctionGap=Infinity;car.priorityStop=false;
      const j=near(car).filter(j=>!controlled.has(j)).filter(j=>{const a=approach(car,j);return a.along>-a.radius&&a.along<a.radius+100&&a.across<j.w/2+16;}).sort((a,b)=>Math.hypot(a.cx-car.x,a.cy-car.y)-Math.hypot(b.cx-car.x,b.cy-car.y))[0];
      if(!j){car.junctionWait=0;return;}
      const a=approach(car,j);car.junctionGap=a.along-a.radius;car.junctionWait=(car.junctionWait||0)+dt;
      if(!groups.has(j.priorityId))groups.set(j.priorityId,[]);groups.get(j.priorityId).push(car);
    });
    for(const j of nodes){
      const candidates=groups.get(j.priorityId)||[],owner=reservations.get(j.priorityId);
      if(owner&&!candidates.includes(owner))reservations.delete(j.priorityId);
      if(!candidates.length)continue;
      let active=reservations.get(j.priorityId);
      if(!active){
        const entered=candidates.find(c=>c.junctionGap<0);
        const ordered=candidates.slice().sort((a,b)=>a.junctionGap-b.junctionGap||a.priorityIdentity-b.priorityIdentity);
        const first=entered||ordered.find(car=>!candidates.some(other=>{
          if(other===car||Math.abs(angleDot(car,other))>.6||other.junctionGap>car.junctionGap+55)return false;
          return -(other.x-car.x)*Math.sin(car.angle)+(other.y-car.y)*Math.cos(car.angle)>12;
        }))||ordered.slice().sort((a,b)=>b.junctionWait-a.junctionWait||a.priorityIdentity-b.priorityIdentity)[0];
        if(first.junctionGap<50){active=first;reservations.set(j.priorityId,first);}
      }
      for(const car of candidates)if(active&&car!==active&&Math.abs(angleDot(car,active))<.8&&car.junctionGap>=-3)car.priorityStop=true;
    }
  }
  return {update,get reservations(){return reservations.size;},nodes:nodes.length};
}
const signalIndexes=new WeakMap();
function nearbySignalBands(car,paint){
  let cells=signalIndexes.get(paint);
  if(!cells){
    cells=new Map();
    for(const band of paint.crossings||[]){
      const origin=band.approach?.[0];if(!origin||!(paint.signals||[]).some(j=>Math.hypot(j.cx-origin.x,j.cy-origin.y)<1))continue;
      const key=`${Math.floor(band.cx/256)},${Math.floor(band.cy/256)}`;
      if(!cells.has(key))cells.set(key,[]);cells.get(key).push(band);
    }
    signalIndexes.set(paint,cells);
  }
  const bands=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)bands.push(...(cells.get(`${Math.floor(car.x/256)+x},${Math.floor(car.y/256)+y}`)||[]));
  return bands;
}
export function approachSignal(car,paint,signalFor){
  const bands=nearbySignalBands(car,paint);let gap=Infinity;
  for(const band of bands){
    const axis=Math.abs(band.ux)>Math.abs(band.uy)?'x':'y',state=signalFor(axis);
    if(state==='green'||Math.cos(car.angle)*band.ux+Math.sin(car.angle)*band.uy>-.65)continue;
    const dx=car.x-band.cx,dy=car.y-band.cy,along=dx*band.ux+dy*band.uy,across=Math.abs(-dx*band.uy+dy*band.ux);
    const distance=along-(car.width||48)/2-band.length/2-8;
    if(across>band.width/2||distance< -4||distance>160)continue;
    if(state==='red'||distance>Math.abs(car.speed||0)*10)gap=Math.min(gap,distance);
  }
  return gap;
}
