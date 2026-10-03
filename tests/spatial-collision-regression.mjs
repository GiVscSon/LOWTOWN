import assert from 'node:assert/strict';
import {createSpatialIndex} from '../src/game/spatial_index.js';
import {solveVehicleMotion,captureMotion,contact,chassis} from '../src/game/solid_contacts.js';

// Compare broad-phase candidates with an independent exhaustive overlap search,
// including negative cells, touching edges and very long narrow bridge rails.
let seed=73;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const items=Array.from({length:1000},(_,id)=>{
  const left=random()*40000-20000,top=random()*40000-20000;
  return {id,left,top,right:left+random()*1200,bottom:top+random()*1200};
});
items.push({id:1000,left:-6000,top:-3,right:6000,bottom:3});
const index=createSpatialIndex(items,p=>p);
for(let n=0;n<1000;n++){
  const left=random()*40000-20000,top=random()*40000-20000,right=left+random()*300,bottom=top+random()*300;
  assert.deepEqual(index.query(left,top,right,bottom),items.filter(p=>p.left<=right&&p.right>=left&&p.top<=bottom&&p.bottom>=top));
}
assert(index.query(6000,3,6000,3).includes(items.at(-1)),'a touching bridge endpoint was dropped');

// Exercise the live sweep against a rotated rail, not just the lookup helper.
for(const angle of [0,Math.PI/4,Math.PI/2]){
  const rail={x:0,y:0,width:6000,height:4,angle};
  const cs=Math.cos(angle),sn=Math.sin(angle),along=2900;
  const car={x:along*cs+70*sn,y:along*sn-70*cs,angle:angle+Math.PI/2,width:40,height:20,mass:1500,vx:-100*sn,vy:100*cs};
  const starts=captureMotion([car]);car.x-=140*sn;car.y+=140*cs;
  let impacts=0;
  solveVehicleMotion([car],starts,1/60,{props:[rail],onImpact:()=>impacts++});
  assert(impacts>0,'the narrow phase never saw the rail');
  assert(!contact(chassis(car),chassis(rail)),'vehicle penetrated a thin rotated rail');
  assert((car.x-along*cs)*-sn+(car.y-along*sn)*cs<0,'vehicle crossed the bridge barrier');
}
console.log('PASS spatial candidates match exhaustive search; swept contacts retain thin rotated bridge barriers');
