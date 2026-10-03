import {corridorRoad,streetPoints,streetWidth,rectangleClearOfStreets} from './street_corridors.js';

// Districts keep their coast and identities; every street is regenerated as
// a terrain-aware centreline. Shared junction coordinates are transformed
// once by the same field, so connecting roads cannot drift apart.
export function organicStreetNetwork(roads,bridges,districts,nodes){
  const bend=p=>{
    const district=districts.find(d=>p.x>=d.x&&p.x<=d.x+d.w&&p.y>=d.y&&p.y<=d.y+d.h);
    if(!district)return {...p};
    const u=(p.x-district.x)/district.w,v=(p.y-district.y)/district.h;
    const weight=Math.sin(Math.PI*u)*Math.sin(Math.PI*v),phase=districts.indexOf(district)*.83;
    const amount=Math.min(district.w,district.h)*.075;
    return {x:p.x+amount*weight*Math.sin(v*Math.PI*2+phase),y:p.y+amount*weight*Math.sin(u*Math.PI*2+phase*.7)};
  };
  const streets=roads.map((road,index)=>{
    const horizontal=road.dir==='h',points=streetPoints(road),a=points[0],b=points.at(-1),axis=horizontal?0:1,cross=horizontal?1:0;
    const anchors=[a,...nodes.filter(n=>Math.abs((horizontal?n.y:n.x)-a[cross])<.05&&
      (horizontal?n.x:n.y)>a[axis]+.05&&(horizontal?n.x:n.y)<b[axis]-.05).map(n=>[n.x,n.y]),b]
      .sort((a,b)=>a[axis]-b[axis]);
    const samples=[];
    for(let i=1;i<anchors.length;i++){
      const start=anchors[i-1],end=anchors[i],steps=Math.max(1,Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])/40));
      for(let step=0;step<steps;step++){
        const p=bend({x:start[0]+(end[0]-start[0])*step/steps,y:start[1]+(end[1]-start[1])*step/steps});samples.push([p.x,p.y]);
      }
    }
    const last=bend({x:b[0],y:b[1]});samples.push([last.x,last.y]);
    return corridorRoad(samples,streetWidth(road),{...road,id:road.id||`street-${index}`,organic:true,
      hierarchy:road.bridgeApproach?'connector':road.name?'arterial':'local'});
  });
  const motor=new Map(),footways=bridges.filter(b=>b.footway);
  for(const bridge of bridges.filter(b=>!b.footway)){
    const id=bridge.logicalId||bridge.id;if(motor.has(id))continue;
    const path=bridge.bridgePath||streetPoints(bridge).map(([x,y])=>({x,y})),a=path[0],b=path.at(-1);
    const horizontal=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y),axis=horizontal?'x':'y',direction=Math.sign(b[axis]-a[axis])||1;
    const before=bend({...a,[axis]:a[axis]-direction*80}),after=bend({...b,[axis]:b[axis]+direction*80});
    const start=bend(a),end=bend(b),scale=Math.abs(b[axis]-a[axis])*.38;
    const t1={x:start.x-before.x,y:start.y-before.y},t2={x:after.x-end.x,y:after.y-end.y};
    const l1=Math.hypot(t1.x,t1.y)||1,l2=Math.hypot(t2.x,t2.y)||1;
    const c={x:start.x+t1.x/l1*scale,y:start.y+t1.y/l1*scale},d={x:end.x-t2.x/l2*scale,y:end.y-t2.y/l2*scale};
    const points=[],steps=Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/36);
    for(let i=0;i<=steps;i++){const t=i/steps,s=1-t;points.push([s*s*s*start.x+3*s*s*t*c.x+3*s*t*t*d.x+t*t*t*end.x,
      s*s*s*start.y+3*s*s*t*c.y+3*s*t*t*d.y+t*t*t*end.y]);}
    motor.set(id,corridorRoad(points,130,{...bridge,id,logicalId:id,organic:true,dir:horizontal?'h':'v',
      bridgePath:points.map(([x,y])=>({x,y})),landfallStart:true,landfallEnd:true}));
  }
  return {roads:streets,bridges:[...motor.values(),...footways],bend};
}

export function fitBuildingsToStreets(buildings,roads,landAt,districts=[],reserved=[]){
  const placed=[];
  const priority=b=>b.serviceParcel?0:b.feature?1:2;
  const ordered=[...buildings].sort((a,b)=>priority(a)-priority(b));
  const clear=b=>rectangleClearOfStreets(b,roads,20)&&
    !reserved.some(o=>b.x+b.w+12>o.x&&b.x-12<o.x+o.w&&b.y+b.h+12>o.y&&b.y-12<o.y+o.h)&&
    [[0,0],[1,0],[0,1],[1,1],[.5,.5]].every(([u,v])=>landAt(b.x+b.w*u,b.y+b.h*v))&&
    !placed.some(o=>b.x+b.w+12>o.x&&b.x-12<o.x+o.w&&b.y+b.h+12>o.y&&b.y-12<o.y+o.h);
  const lots=new Map(districts.map(d=>[d.id,[]]));
  for(const road of roads){
    if(road.bridgeApproach||road.footway||!road.organic)continue;
    const points=streetPoints(road);
    for(let i=1;i<points.length-1;i+=2){
      const a=points[i-1],p=points[i],b=points[i+1],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
      const owner=districts.find(d=>p[0]>=d.x&&p[0]<=d.x+d.w&&p[1]>=d.y&&p[1]<=d.y+d.h);
      if(owner)for(const side of [-1,1])lots.get(owner.id).push({x:p[0],y:p[1],angle,side,width:streetWidth(road),roadId:road.id});
    }
  }
  for(const [index,b] of ordered.entries()){
    const center={x:b.x+b.w/2,y:b.y+b.h/2};
    const owner=districts.find(d=>center.x>=d.x&&center.x<=d.x+d.w&&center.y>=d.y&&center.y<=d.y+d.h)||
      districts.reduce((best,d)=>!best||Math.hypot(center.x-d.x-d.w/2,center.y-d.y-d.h/2)<Math.hypot(center.x-best.x-best.w/2,center.y-best.y-best.h/2)?d:best,null);
    const candidates=lots.get(owner?.id)||[];let candidate=null;
    for(let step=0;step<candidates.length;step++){
      const lot=candidates[(step+index*37)%candidates.length],nx=-Math.sin(lot.angle)*lot.side,ny=Math.cos(lot.angle)*lot.side;
      const facing=Math.abs(nx)>Math.abs(ny)?(nx>0?'west':'east'):(ny>0?'north':'south');
      const sideways=facing==='west'||facing==='east',w=sideways?b.h:b.w,h=sideways?b.w:b.h;
      const setback=b.serviceParcel?96:58,normalHalf=Math.abs(nx)*w/2+Math.abs(ny)*h/2;
      const distance=lot.width/2+normalHalf+setback;
      const p={...b,x:lot.x+nx*distance-w/2,y:lot.y+ny*distance-h/2,w,h,streetFacing:facing,streetId:lot.roadId};
      if(clear(p)){candidate=p;break;}
    }
    if(!candidate)throw new Error(`No clear street parcel for ${b.sign||b.districtId}`);
    const dx=candidate.x-b.x,dy=candidate.y-b.y;Object.assign(b,candidate,{districtId:owner?.id});
    if(b.serviceParcel)Object.assign(b.serviceParcel,{x:b.x-100,y:b.y-100,w:b.w+200,h:b.h+200});
    if(b.feature){b.feature.x+=dx;b.feature.y+=dy;}
    placed.push(b);
  }
}
