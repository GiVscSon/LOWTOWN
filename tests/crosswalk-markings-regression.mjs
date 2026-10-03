import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {corridorRoad,onStreetCollection} from '../src/game/street_corridors.js';
import {streetSurfaceGeometry} from '../src/game/street_surface.js';
import {runtimeCity} from './helpers/runtime-city.mjs';
function audit(paint){
  const bands=paint.crossings;
  assert(bands.length>0);
  for(const band of bands){
    const angle=Math.atan2(band.uy,band.ux);
    assert(band.stripes.length>=3);
    for(const stripe of band.stripes){
      assert(Math.abs(stripe.angle+angle)<1e-9,'zebra follows the actual approach tangent');
      const x=stripe.x+stripe.w/2,y=stripe.y+stripe.h/2;
      assert(Math.abs((x-band.cx)*band.ux+(y-band.cy)*band.uy)<1e-8,'all bars belong to one straight transverse row');
      for(const along of [-stripe.w/2,stripe.w/2])for(const across of [-stripe.h/2,stripe.h/2]){
        const px=x+band.ux*along-band.uy*across,py=y+band.uy*along+band.ux*across;
        assert(onStreetCollection(px,py,paint.surfaces),'zebra corner leaves the carriageway');
        assert(!paint.junctions.some(j=>Math.hypot(px-j.cx,py-j.cy)<j.w*.32),'zebra crosses the centre of a junction');
      }
    }
    for(const lane of paint.lanes){
      // Clip the entire segment against the zebra plus its stopping gap.
      let start=0,end=1;
      for(const [ux,uy,r] of [[band.ux,band.uy,band.length/2+13.9],[-band.uy,band.ux,band.width/2]]){
        const p=(lane.x1-band.cx)*ux+(lane.y1-band.cy)*uy,d=(lane.x2-lane.x1)*ux+(lane.y2-lane.y1)*uy;
        if(Math.abs(d)<1e-9){if(Math.abs(p)>r){start=2;break;}}
        else{const a=(-r-p)/d,b=(r-p)/d;start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));}
      }
      assert(start>=end,'yellow centreline reaches a zebra or its stopping gap');
    }
  }
  for(let i=0;i<bands.length;i++)for(let k=i+1;k<bands.length;k++){
    const a=bands[i],b=bands[k],dx=b.cx-a.cx,dy=b.cy-a.cy;
    const separated=[[a.ux,a.uy],[-a.uy,a.ux],[b.ux,b.uy],[-b.uy,b.ux]].some(([x,y])=>{
      const radius=p=>(Math.abs(x*p.ux+y*p.uy)*p.length+Math.abs(-x*p.uy+y*p.ux)*p.width)/2;
      return Math.abs(dx*x+dy*y)>radius(a)+radius(b);
    });
    assert(separated,'two zebra rows overlap at different angles');
  }
  assert.equal(paint.crosswalks.length,bands.reduce((n,b)=>n+b.stripes.length,0),'only separate zebra bars are painted');
  return {junctions:paint.junctions.length,crossings:bands.length,bars:paint.crosswalks.length};
}
const road=(points,dir)=>corridorRoad(points,130,{dir});
const four=streetSurfaceGeometry([road([[-500,0],[500,0]],'h'),road([[0,-500],[0,500]],'v')]);
assert.equal(four.crossings.length,4);audit(four);
const skew=streetSurfaceGeometry([road([[-500,0],[500,0]],'h'),road([[-250,-500],[250,500]],'v'),road([[45,0],[400,-400]],'v')]);
audit(skew);
const city=runtimeCity(73),paint=JSON.parse(city.run('JSON.stringify(buildRoadPaintGeometry())'));
const report={four:audit(four),skew:audit(skew),city:audit(paint)};
assert(report.city.crossings>150,'real city retains crossings on its external approaches');
mkdirSync('artifacts/crosswalk-markings',{recursive:true});writeFileSync('artifacts/crosswalk-markings/geometry.json',JSON.stringify(report,null,2));
console.log('CROSSWALK_MARKINGS_PASS',report);
