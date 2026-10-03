import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {streetSurfaceGeometry} from '../src/world/street_surface.js';
import {createVehicleMesh,projectedVehicleFaces,drawStreetVehicle} from '../src/render/shared/street_vehicle.js';
import {onStreetCollection} from '../src/world/street_corridors.js';
import {runtimeCity} from './helpers/runtime-city.mjs';
const contains=(surfaces,x,y)=>onStreetCollection(x,y,surfaces);
function audit(paint){
  const seen=new Set();
  for(const edge of paint.curbs){
    const key=JSON.stringify([edge.x1,edge.y1,edge.x2,edge.y2]);assert(!seen.has(key),'duplicate asphalt boundary');seen.add(key);
    const horizontal=edge.y1===edge.y2;
    for(const t of [.15,.37,.61,.85]){
      const x=edge.x1+(edge.x2-edge.x1)*t,y=edge.y1+(edge.y2-edge.y1)*t;
      const length=Math.hypot(edge.x2-edge.x1,edge.y2-edge.y1);
      const dx=paint.organic?-(edge.y2-edge.y1)/length*edge.side*1.2:(horizontal?0:edge.side*.1),
        dy=paint.organic?(edge.x2-edge.x1)/length*edge.side*1.2:(horizontal?edge.side*.1:0);
      assert(contains(paint.surfaces,x-dx,y-dy),'kerb is detached from asphalt '+JSON.stringify({edge,x,y,dx,dy}));
      assert(!contains(paint.surfaces,x+dx,y+dy),'internal seam drawn across supported asphalt '+JSON.stringify({edge,x,y,dx,dy}));
    }
  }
  for(const lane of paint.lanes)for(const t of [.01,.25,.5,.75,.99]){
    const x=lane.x1+(lane.x2-lane.x1)*t,y=lane.y1+(lane.y2-lane.y1)*t;
    assert(contains(paint.surfaces,x,y),'lane stripe painted outside its road');
    const horizontal=lane.y1===lane.y2;
    assert(paint.organic?!paint.junctions.some(j=>Math.hypot(x-j.cx,y-j.cy)<j.w*.32):!paint.surfaces.some(r=>r.dir===(horizontal?'v':'h')&&contains([r],x,y)),'centreline runs through a crossing or bridge turn');
  }
}
const road={x:0,y:0,w:300,h:100,dir:'h'};
const deck={x:200,y:0,w:100,h:300,dir:'v'};
const bend=streetSurfaceGeometry([road],[deck]);audit(bend);
assert(!bend.curbs.some(e=>e.y1===100&&e.y2===100&&e.x2>200),'overlapping L decks retain an internal edge');
const smooth=streetSurfaceGeometry([], [{...deck,logicalId:'bridge-a',bridgePath:[{x:200,y:50},{x:300,y:50},{x:300,y:250},{x:300,y:350}]}]);
assert.equal(smooth.bridgePaths.length,1,'motor bridge should expose one render path per logical crossing');
assert.equal(smooth.bridgePaths[0].path.length,4,'rounded bridge path must retain both landfalls and its bend controls');
assert(smooth.curbs.some(edge=>edge.bridge==='bridge-a'),'bridge boundary must remain tagged for the renderer');
const split=streetSurfaceGeometry([road,{...road,x:200,w:300}],[]);audit(split);
assert.equal(split.lanes.length,1,'same straight must have a continuous dash phase');
assert.equal(split.lanes[0].x2,500);
assert.equal(streetSurfaceGeometry([road],[{...deck,footway:true}]).surfaces.length,1,'boardwalk is not motor asphalt');
const city=runtimeCity(73),paint=JSON.parse(city.run('JSON.stringify(buildRoadPaintGeometry())'));audit(paint);
assert(paint.crosswalkJunctions.length<paint.junctions.length,'facility accesses must not receive full urban zebra sets');
for(const j of paint.crosswalkJunctions){
  assert(j.horizontalRoads.some(r=>!r.serviceAccess&&!r.bridgeApproach));
  assert(j.verticalRoads.some(r=>!r.serviceAccess&&!r.bridgeApproach));
}
const types=['sedan','coupe','sports','wagon','taxi','van','bus','truck','bike','police','armoredPolice','nationalGuard','fireEngine','ambulance'];
const shapes=new Set();let projections=0,depth=0;
const ctx=new Proxy({save(){depth++;},restore(){depth--;assert(depth>=0);}}, {get(o,k){return k in o?o[k]:(...args)=>{for(const n of args)if(typeof n==='number')assert(Number.isFinite(n),`${k} receives a nonfinite coordinate`);};}});
for(const type of types){
  const mesh=createVehicleMesh(type,48,24);shapes.add(JSON.stringify(mesh.faces));
  for(let step=0;step<72;step++){
    const angle=step*Math.PI/36,faces=projectedVehicleFaces(mesh,angle,7,step/12);
    assert(faces.length>10&&faces.length<mesh.faces.length,'only camera-facing surfaces should draw');
    const repeated=projectedVehicleFaces(mesh,angle,7,step/12);
    assert.deepEqual(faces.map(face=>face.order),repeated.map(face=>face.order),'turn render order must be deterministic at diagonal headings');
    for(const face of faces){assert(Number.isFinite(face.depth));for(const point of face.points)assert(point.every(Number.isFinite));}
    const raised=projectedVehicleFaces(mesh,angle,8,step/12);
    assert.equal(raised.length,faces.length);
    for(let i=0;i<faces.length;i++)for(let p=0;p<faces[i].points.length;p++)for(let axis=0;axis<2;axis++)assert(Math.abs(faces[i].points[p][axis]-raised[i].points[p][axis]-1)<1e-10,'height must remain vertical at every heading');
    drawStreetVehicle(ctx,{type,x:10,y:20,width:48,height:24,angle,hp:40,rain:1},step/12);assert.equal(depth,0);projections++;
  }
}
assert.equal(shapes.size,types.length,'land models must have distinct bodies and equipment');
mkdirSync('artifacts/street-transport',{recursive:true});
const report={surfaces:paint.surfaces.length,boundaries:paint.curbs.length,lanes:paint.lanes.length,junctions:paint.junctions.length,crosswalkJunctions:paint.crosswalkJunctions.length,models:types.length,projections};
writeFileSync('artifacts/street-transport/geometry-renderer.json',JSON.stringify(report,null,2));console.log('PASS street union, bridge bends, road markings, original land meshes and 360-degree projections',report);
