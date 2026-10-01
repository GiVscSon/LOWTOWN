// Authored district envelopes and coast control points. No random placement.
export const ARCHIPELAGO_WIDTH=17400;
export const ARCHIPELAGO_HEIGHT=18100;
export const ARTERIAL_X=[1265,6000,10000,14500];
export const ARTERIAL_Y=[1200,5500,10300,15300];
const drafts={
  core:{column:0,row:0,w:2200,h:2200,landmark:'Civic Crescent',
    coast:[[.06,.02],[.20,-.06],[.43,-.04],[.70,-.11],[.94,.01],[1.03,.18],[1.02,.43],[1.01,.65],[.97,.91],[.81,1.04],[.60,1.07],[.44,1.03],[.20,1.08],[.03,.94],[-.03,.71],[-.04,.45],[-.025,.22]]},
  docks:{column:1,row:0,w:3100,h:1800,landmark:'Hammerhead Shipyard',
    coast:[[.03,.05],[.15,-.03],[.37,-.03],[.53,-.08],[.80,-.03],[.98,.04],[1.04,.20],[1.04,.43],[1.03,.70],[.96,.97],[.81,1.04],[.66,1.15],[.53,1.04],[.26,1.02],[.06,.98],[-.03,.76],[-.025,.40],[-.03,.15]]},
  lantern:{column:2,row:0,w:2050,h:2650,landmark:'Beacon Ridge',
    coast:[[.07,.02],[.28,-.06],[.45,-.13],[.62,-.17],[.83,-.06],[.97,.03],[1.04,.25],[1.03,.43],[1.015,.73],[.96,.94],[.74,1.10],[.59,1.04],[.31,1.09],[.06,.95],[-.035,.79],[-.045,.45],[-.02,.19]]},
  oldmill:{column:0,row:1,w:2400,h:2550,landmark:'Millrace Commons',
    coast:[[.04,.03],[.17,-.04],[.44,-.05],[.75,-.08],[.96,.04],[1.04,.23],[1.025,.46],[1.04,.69],[.98,.93],[.75,1.04],[.44,1.04],[.18,1.02],[.05,.93],[-.045,.77],[-.025,.47],[-.02,.23]]},
  redhook:{column:1,row:1,w:2850,h:2100,landmark:'Market Fork',
    coast:[[.06,.02],[.24,-.05],[.52,-.05],[.73,-.02],[.95,.03],[1.03,.20],[1.03,.45],[1.035,.70],[.95,.96],[.83,1.04],[.67,1.12],[.53,1.04],[.29,1.02],[.08,.96],[-.04,.72],[-.025,.46],[-.04,.20]]},
  blackwood:{column:2,row:1,w:1750,h:2900,landmark:'Pineback Trail',
    coast:[[.015,-.04],[.25,-.03],[.46,-.12],[.61,-.18],[.82,-.09],[.97,.02],[1.035,.21],[1.025,.46],[1.045,.72],[.96,.97],[.72,1.10],[.60,1.04],[.33,1.13],[.08,.94],[-.04,.72],[-.035,.46],[-.02,.22]]},
  marrow:{column:0,row:2,w:1900,h:2350,landmark:'Marrow Bluff',
    coast:[[.04,.04],[.21,-.02],[.44,-.05],[.75,-.02],[.95,.04],[1.04,.24],[1.025,.46],[1.03,.78],[.95,.96],[.73,1.08],[.44,1.04],[.22,1.15],[.07,1.02],[-.025,.76],[-.035,.46],[-.025,.20]]},
  southport:{column:1,row:2,w:3200,h:1950,landmark:'Freight Finger',
    coast:[[.04,.03],[.25,-.02],[.53,-.04],[.77,-.02],[.97,.03],[1.045,.23],[1.025,.46],[1.035,.77],[.96,.97],[.83,1.04],[.73,1.16],[.65,1.05],[.53,1.04],[.27,1.05],[.04,.98],[-.03,.75],[-.03,.46],[-.03,.21]]},
  velvet:{column:2,row:2,w:2450,h:1750,landmark:'Velvet Crescent',
    coast:[[.05,.03],[.27,-.05],[.58,-.05],[.83,-.06],[.96,.03],[1.03,.26],[1.025,.46],[1.035,.78],[.96,.96],[.81,1.13],[.59,1.04],[.37,1.10],[.12,1.02],[.04,.94],[-.04,.70],[-.03,.46],[-.025,.21]]},
  eastgate:{column:3,row:0,w:2650,h:2400,landmark:'Gatehouse Terrace',
    coast:[[.06,.03],[.27,-.04],[.55,-.05],[.81,-.07],[.97,.03],[1.04,.25],[1.03,.41],[1.02,.73],[.95,.96],[.76,1.08],[.55,1.04],[.30,1.06],[.06,.93],[-.04,.76],[-.025,.42],[-.03,.20]]},
  cinder:{column:3,row:1,w:2250,h:1850,landmark:'Cinder Garden',
    coast:[[.07,.02],[.26,-.08],[.55,-.05],[.76,-.07],[.97,.03],[1.04,.24],[1.025,.46],[1.04,.77],[.96,.96],[.76,1.05],[.55,1.04],[.34,1.15],[.11,1.03],[.04,.96],[-.035,.69],[-.03,.46],[-.025,.21]]},
  aerodrome:{column:3,row:2,w:3300,h:2500,landmark:'Kingsway Apron',
    coast:[[.04,.04],[.27,-.04],[.55,-.05],[.78,-.03],[.97,.04],[1.04,.25],[1.03,.46],[1.025,.73],[.96,.96],[.81,1.04],[.67,1.14],[.55,1.04],[.25,1.03],[.05,.96],[-.025,.73],[-.035,.46],[-.025,.21]]},
  saints:{column:0,row:3,w:2100,h:2700,landmark:'Memorial Headland',
    coast:[[.015,-.04],[.25,-.05],[.44,-.08],[.69,-.07],[.95,.02],[1.04,.24],[1.025,.46],[1.04,.75],[.97,.94],[.72,1.08],[.45,1.04],[.22,1.10],[.05,.96],[-.04,.75],[-.025,.46],[-.025,.22]]},
  refinery:{column:1,row:3,w:2950,h:1650,landmark:'Ashcroft Tank Point',
    coast:[[.04,.03],[.25,-.04],[.53,-.05],[.78,-.04],[.96,.03],[1.04,.24],[1.025,.46],[1.03,.76],[.96,.97],[.81,1.08],[.68,1.16],[.53,1.04],[.31,1.06],[.06,.98],[-.03,.74],[-.025,.46],[-.025,.19]]},
  campus:{column:2,row:3,w:2350,h:2250,landmark:'Northstar Arboretum',
    coast:[[.06,.03],[.21,-.10],[.42,-.05],[.59,-.08],[.80,-.11],[.96,.03],[1.04,.24],[1.025,.46],[1.03,.73],[.96,.96],[.76,1.10],[.59,1.04],[.33,1.08],[.06,.94],[-.035,.73],[-.025,.46],[-.035,.22]]},
  marina:{column:3,row:3,w:2700,h:2050,landmark:'Kingsport Sail Point',
    coast:[[.05,.03],[.25,-.06],[.55,-.05],[.78,-.04],[.96,.04],[1.035,.24],[1.025,.46],[1.045,.77],[.96,.97],[.84,1.10],[.67,1.05],[.55,1.04],[.35,1.13],[.10,1.04],[.04,.96],[-.035,.73],[-.025,.46],[-.03,.19]]}
};

const legacyColumns=[{x:300,w:2200,spine:1265},{x:2850,w:2000,spine:3915},
  {x:5200,w:1800,spine:6265},{x:7350,w:2200,spine:8565}];
const legacyRows=[{y:300,h:2200,spine:1200},{y:3200,h:2200,spine:4200},
  {y:6200,h:2200,spine:7200},{y:9200,h:2200,spine:10200}];
export const DISTRICT_DRAFTS=Object.fromEntries(Object.entries(drafts).map(([id,d])=>{
  const col=legacyColumns[d.column],row=legacyRows[d.row];
  return [id,{...d,id,x:ARTERIAL_X[d.column]-(col.spine-col.x)/col.w*d.w,
    y:ARTERIAL_Y[d.row]-(row.spine-row.y)/row.h*d.h,
    source:{x:col.x,y:row.y,w:col.w,h:row.h},landmark:d.landmark}];
}));
export function authoredDistricts(legacy){
  return legacy.map(island=>({...island,...DISTRICT_DRAFTS[island.id]}));
}
export function districtPoint(point,id){
  const d=DISTRICT_DRAFTS[id],s=d.source;
  return {x:d.x+(point.x-s.x)*d.w/s.w,y:d.y+(point.y-s.y)*d.h/s.h};
}
const closestBand=(value,bands,axis,size)=>bands.reduce((best,b,i)=>{
  const distance=Math.max(b[axis]-value,0,value-b[axis]-b[size]);
  return distance<best.distance?{index:i,distance}:best;
},{index:0,distance:Infinity}).index;
function mapAcross(value,oldBands,newBands,axis,size){
  for(let i=0;i<oldBands.length;i++){
    const old=oldBands[i],next=newBands[i];
    if(value>=old[axis]&&value<=old[axis]+old[size])return next[axis]+(value-old[axis])*next[size]/old[size];
    if(i&&value>oldBands[i-1][axis]+oldBands[i-1][size]&&value<old[axis]){
      const a=oldBands[i-1][axis]+oldBands[i-1][size],b=old[axis],left=newBands[i-1][axis]+newBands[i-1][size];
      return left+(value-a)/(b-a)*(next[axis]-left);
    }
  }
  const i=closestBand(value,oldBands,axis,size),old=oldBands[i],next=newBands[i];
  return next[axis]+(value-old[axis])*next[size]/old[size];
}
export function worldPoint(point){
  const row=closestBand(point.y,legacyRows,'y','h'),column=closestBand(point.x,legacyColumns,'x','w');
  const horizontal=Object.values(DISTRICT_DRAFTS).filter(d=>d.row===row).sort((a,b)=>a.column-b.column);
  const vertical=Object.values(DISTRICT_DRAFTS).filter(d=>d.column===column).sort((a,b)=>a.row-b.row);
  return {x:mapAcross(point.x,legacyColumns,horizontal,'x','w'),
    y:mapAcross(point.y,legacyRows,vertical,'y','h')};
}
export function sourceDistrict(point){
  const row=closestBand(point.y,legacyRows,'y','h'),column=closestBand(point.x,legacyColumns,'x','w');
  return Object.values(DISTRICT_DRAFTS).find(d=>d.row===row&&d.column===column);
}

export const AUTHORED_ISLETS=[
  {id:'reed-bank',name:'Reed Bank',parent:'core',x:650,y:3300,w:390,h:190,
    coast:[[.05,.45],[.18,.09],[.42,-.04],[.77,.05],[1.02,.33],[.90,.71],[.63,1.03],[.28,.91]]},
  {id:'gull-rock',name:'Gull Rock',parent:'docks',x:6300,y:3300,w:420,h:210,
    coast:[[.02,.44],[.26,.02],[.61,.08],[.84,.25],[1.02,.64],[.76,.91],[.48,1.04],[.19,.74]]},
  {id:'willow-key',name:'Willow Key',parent:'blackwood',x:10630,y:7900,w:370,h:260,
    coast:[[.08,.20],[.45,.02],[.85,.10],[1.03,.44],[.91,.82],[.59,1.02],[.20,.94],[-.02,.57]]},
  {id:'marsh-point',name:'Marsh Point',parent:'marrow',x:1400,y:12800,w:540,h:250,
    coast:[[.02,.39],[.18,.09],[.47,.01],[.81,.13],[1.01,.55],[.73,.91],[.46,1.02],[.12,.80]]},
  {id:'ashcroft-key',name:'Ashcroft Key',parent:'southport',x:6250,y:13050,w:590,h:240,
    coast:[[.02,.33],[.25,.03],[.51,.10],[.82,.04],[1.01,.41],[.87,.82],[.53,1.04],[.21,.86]]},
  {id:'salt-marsh',name:'Salt Marsh',parent:'aerodrome',x:14580,y:12920,w:460,h:310,
    coast:[[.06,.20],[.36,.02],[.73,.05],[.99,.37],[.87,.72],[.59,1.04],[.22,.93],[-.02,.53]]},
  {id:'long-key',name:'Long Key',parent:'cinder',x:16500,y:5500,w:480,h:1100,
    coast:[[.19,.03],[.59,.01],[.89,.17],[.97,.42],[.79,.71],[.73,.96],[.38,1.02],[.14,.81],[.01,.50],[.10,.24]]}
].map(i=>({...i,natural:true}));

export function remapLegacyScene(scene){
  const seen=new WeakSet();
  const move=(object,rectangle=false,owner=null)=>{
    if(!object||seen.has(object))return;
    seen.add(object);
    const district=owner||sourceDistrict({x:object.x+(rectangle?(object.w||0)/2:0),
      y:object.y+(rectangle?(object.h||0)/2:0)});
    const point=rectangle?districtPoint(object,district.id):worldPoint(object);
    if(rectangle){
      object.w*=district.w/district.source.w;object.h*=district.h/district.source.h;
    }
    object.x=point.x;object.y=point.y;
    if(object.serviceParcel)move(object.serviceParcel,true,district);
    if(object.feature)move(object.feature);
  };
  for(const road of scene.roads){
    if(road.bridgeApproach)continue;
    const district=sourceDistrict({x:road.x+road.w/2,y:road.y+road.h/2});
    const horizontal=road.dir==='h',width=horizontal?road.h:road.w;
    const center=districtPoint({x:road.x+road.w/2,y:road.y+road.h/2},district.id);
    move(road,true,district);
    if(horizontal){road.h=width;road.y=center.y-width/2;}
    else{road.w=width;road.x=center.x-width/2;}
  }
  scene.roads.splice(0,scene.roads.length,...scene.roads.filter(r=>!r.bridgeApproach));
  for(const road of scene.scenicRoads){
    const start=road.points[0],owner=sourceDistrict({x:start[0],y:start[1]});
    road.districtId=owner.id;
    road.width=Math.min(58,58*owner.w/owner.source.w,58*owner.h/owner.source.h);
    road.points=road.points.map(([x,y])=>{const p=districtPoint({x,y},owner.id);return [p.x,p.y];});
  }
  for(const key of ['buildings','parkZones','breakableProps','piers'])for(const object of scene[key]||[])move(object,true);
  for(const key of ['trees','parkObstacles','streetProps','solidProps','streetLights','cranes','billboards','pedestrians','parkedCars']){
    for(const object of scene[key]||[])move(object);
  }
  for(const car of scene.trafficCars){
    const old={x:car.x,y:car.y},horizontal=car.axis!=='y';
    const point=worldPoint(old),axis=horizontal?'x':'y',cross=horizontal?'y':'x';
    const band=horizontal?closestBand(old.y,legacyRows,'y','h'):closestBand(old.x,legacyColumns,'x','w');
    const sourceSpine=horizontal?legacyRows[band].spine:legacyColumns[band].spine;
    const spine=horizontal?ARTERIAL_Y[band]:ARTERIAL_X[band];
    const layout=Object.values(DISTRICT_DRAFTS).filter(d=>horizontal?d.row===band:d.column===band)
      .sort((a,b)=>horizontal?a.column-b.column:a.row-b.row);
    const oldBands=horizontal?legacyColumns:legacyRows;
    const size=horizontal?'w':'h';
    car[axis]=point[axis];car[cross]=spine+old[cross]-sourceSpine;
    car.laneCenter=spine+(car.laneCenter??sourceSpine)-sourceSpine;
    for(const key of horizontal?['minX','maxX']:['minY','maxY'])car[key]=mapAcross(car[key],oldBands,layout,axis,size);
  }
}

export function remapBridges(legacy){
  return legacy.map(bridge=>{
    const horizontal=bridge.dir==='h',a=worldPoint({x:horizontal?bridge.x:bridge.x+bridge.w/2,
      y:horizontal?bridge.y+bridge.h/2:bridge.y});
    const b=worldPoint({x:horizontal?bridge.x+bridge.w:bridge.x+bridge.w/2,
      y:horizontal?bridge.y+bridge.h/2:bridge.y+bridge.h});
    return {...bridge,x:horizontal?a.x:a.x-bridge.w/2,y:horizontal?a.y-bridge.h/2:a.y,
      w:horizontal?b.x-a.x:bridge.w,h:horizontal?bridge.h:b.y-a.y};
  });
}

export function isletWalkways(){
  return AUTHORED_ISLETS.flatMap(islet=>{
    const parent=DISTRICT_DRAFTS[islet.parent],end={x:islet.x+islet.w/2,y:islet.y+islet.h/2};
    const start=islet.id==='long-key'?{x:ARTERIAL_X[parent.column],y:ARTERIAL_Y[parent.row]}:
      {x:ARTERIAL_X[parent.column],y:parent.y+parent.h-50};
    const corner={x:end.x,y:start.y},width=56;
    return [[start,corner],[corner,end]].filter(([a,b])=>Math.hypot(a.x-b.x,a.y-b.y)>1).map(([a,b],index)=>{
      const horizontal=a.y===b.y;
      return {id:`walk-${islet.id}-${index}`,name:islet.name+' Boardwalk',footway:true,
        dir:horizontal?'h':'v',x:horizontal?Math.min(a.x,b.x):a.x-width/2,
        y:horizontal?a.y-width/2:Math.min(a.y,b.y),
        w:horizontal?Math.abs(b.x-a.x):width,h:horizontal?width:Math.abs(b.y-a.y)};
    });
  });
}

// Join shortened cross streets to their actual centre lines and collapse
// repeated collinear rectangles before paint and route graphs are built.
export function normalizeStreetGeometry(roads){
  for(const road of roads){
    if(road.bridgeApproach)continue;
    const h=road.dir==='h',axis=h?'x':'y',size=h?'w':'h',cross=h?'y':'x';
    const center=road[cross]+road[h?'h':'w']/2;
    for(const end of [false,true]){
      const value=road[axis]+(end?road[size]:0);
      const joining=roads.find(other=>other.dir!==road.dir&&center>=other[cross]&&
        center<=other[cross]+other[h?'h':'w']&&value>=other[axis]-(road[h?'h':'w']/2+24)&&value<=other[axis]+other[size]+(road[h?'h':'w']/2+24));
      if(!joining)continue;
      const target=joining[axis]+(end?joining[size]:0);
      if(end)road[size]+=target-value;
      else{road[axis]=target;road[size]+=value-target;}
    }
  }
  for(let i=0;i<roads.length;i++)for(let j=roads.length-1;j>i;j--){
    const a=roads[i],b=roads[j],h=a.dir==='h',axis=h?'x':'y',size=h?'w':'h',cross=h?'y':'x',breadth=h?'h':'w';
    if(a.dir!==b.dir||a.serviceAccess||b.serviceAccess||Math.abs(a[cross]-b[cross])>.01||Math.abs(a[breadth]-b[breadth])>.01)continue;
    if(Math.max(a[axis],b[axis])>Math.min(a[axis]+a[size],b[axis]+b[size])+.1)continue;
    const start=Math.min(a[axis],b[axis]),end=Math.max(a[axis]+a[size],b[axis]+b[size]);
    a[axis]=start;a[size]=end-start;a.bridgeApproach=!!a.bridgeApproach&&!!b.bridgeApproach;roads.splice(j,1);
  }
}
