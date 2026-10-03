// Authored district envelopes and coast control points. No random placement.
export const ARCHIPELAGO_WIDTH=18500;
export const ARCHIPELAGO_HEIGHT=19800;
export const ARTERIAL_X=[1265,6000,10000,14500];
export const ARTERIAL_Y=[1200,5500,10300,15300];
const drafts={
  core:{column:0,row:0,w:2200,h:2200,landmark:'Civic Crescent',
    coast:[[0.03,0.04],[0.18,-0.07],[0.37,-0.1],[0.63,-0.08],[0.92,0.02],[1.06,0.1],[1.24,0.19],[1.28,0.28],[1.08,0.38],[1.025,0.46],[1.02,0.68],[0.99,0.91],[0.88,1.07],[0.78,1.25],[0.73,1.30],[0.59,1.34],[0.51,1.34],[0.55,1.12],[0.38,1.04],[0.17,1.12],[0.03,0.96],[-0.04,0.71],[-0.06,0.42],[-0.03,0.18]]},
  docks:{column:1,row:0,w:3100,h:1800,landmark:'Hammerhead Shipyard',
    coast:[[0.04,0.03],[0.17,-0.11],[0.33,-0.17],[0.49,-0.06],[0.69,-0.12],[0.9,-0.05],[1.05,0.1],[1.1,0.28],[1.02,0.46],[1.03,0.72],[0.98,0.96],[0.85,1.12],[0.74,1.38],[0.66,1.54],[0.58,1.34],[0.66,1.1],[0.44,1.03],[0.24,1.16],[0.1,1.38],[-0.02,1.3],[-0.14,1.02],[-0.06,0.83],[-0.03,0.64],[-0.03,0.4],[-0.08,0.25],[-0.03,0.11]]},
  lantern:{column:2,row:0,w:2050,h:2650,landmark:'Beacon Ridge',
    coast:[[0.03,0.04],[0.23,0.01],[0.46,-0.018],[0.75,-0.02],[0.94,0.05],[1.04,0.2],[1.22,0.29],[1.36,0.43],[1.27,0.52],[1.06,0.51],[1.02,0.69],[1.06,0.89],[0.92,1.06],[0.81,1.16],[0.62,1.13],[0.48,1.24],[0.32,1.19],[0.21,1.07],[0.05,1.02],[-0.04,0.84],[-0.09,0.69],[-0.29,0.72],[-0.37,0.59],[-0.21,0.47],[-0.045,0.44],[-0.05,0.23]]},
  oldmill:{column:0,row:1,w:2400,h:2550,landmark:'Millrace Commons',
    coast:[[0.04,0.04],[0.18,-0.14],[0.32,-0.18],[0.47,-0.16],[0.54,-0.02],[0.7,-0.09],[0.87,-0.06],[1.03,0.09],[1.07,0.33],[1.03,0.49],[1.12,0.65],[1.22,0.74],[1.25,0.85],[1.21,0.94],[1.04,0.91],[0.94,1.05],[0.7,1.1],[0.52,1.05],[0.34,1.18],[0.21,1.25],[0.04,1.08],[-0.03,0.88],[-0.16,0.66],[-0.21,0.48],[-0.06,0.33],[-0.02,0.16]]},
  redhook:{column:1,row:1,w:2850,h:2100,landmark:'Market Fork',
    coast:[[0.03,0.04],[0.15,-0.1],[0.25,-0.33],[0.4,-0.45],[0.49,-0.31],[0.43,-0.1],[0.59,-0.035],[0.79,-0.08],[0.94,0.04],[1.04,0.18],[1.08,0.39],[1.035,0.62],[1.1,0.82],[1.02,1.0],[0.79,1.1],[0.63,1.24],[0.49,1.27],[0.35,1.08],[0.18,1.03],[0.02,0.96],[-0.11,0.77],[-0.07,0.63],[-0.03,0.43],[-0.13,0.24],[-0.06,0.09]]},
  blackwood:{column:2,row:1,w:1750,h:2900,landmark:'Pineback Trail',
    coast:[[0.03,0.04],[0.17,-0.11],[0.29,-0.22],[0.41,-0.12],[0.52,-0.03],[0.63,-0.16],[0.83,-0.27],[0.96,-0.16],[1.03,0.06],[1.08,0.27],[1.035,0.45],[1.15,0.66],[1.26,0.78],[1.18,0.96],[1.01,1.13],[0.82,1.27],[0.7,1.13],[0.51,1.06],[0.35,1.2],[0.14,1.11],[0.01,0.91],[-0.09,0.71],[-0.29,0.61],[-0.37,0.44],[-0.26,0.31],[-0.045,0.34],[-0.03,0.19]]},
  marrow:{column:0,row:2,w:1900,h:2350,landmark:'Marrow Bluff',
    coast:[[0.03,0.04],[0.2,-0.05],[0.46,-0.08],[0.63,-0.26],[0.8,-0.32],[0.96,-0.17],[1.02,0.04],[1.11,0.22],[1.2,0.29],[1.06,0.4],[1.035,0.64],[1.02,0.9],[0.91,1.1],[0.74,1.37],[0.59,1.46],[0.48,1.23],[0.49,1.06],[0.33,1.05],[0.17,1.19],[0.02,1.11],[-0.045,0.9],[-0.075,0.7],[-0.045,0.46],[-0.025,0.22]]},
  southport:{column:1,row:2,w:3200,h:1950,landmark:'Freight Finger',
    coast:[[0.03,0.04],[0.2,-0.06],[0.39,-0.035],[0.56,-0.17],[0.7,-0.28],[0.85,-0.2],[0.97,-0.07],[1.04,0.14],[1.08,0.38],[1.025,0.54],[1.06,0.76],[1.02,0.96],[0.9,1.08],[0.76,1.33],[0.66,1.4],[0.59,1.22],[0.63,1.07],[0.43,1.045],[0.25,1.16],[0.11,1.37],[-0.02,1.34],[-0.09,1.08],[-0.04,0.84],[-0.03,0.62],[-0.06,0.41],[-0.02,0.16]]},
  velvet:{column:2,row:2,w:2450,h:1750,landmark:'Velvet Crescent',
    coast:[[0.04,0.04],[0.18,-0.1],[0.32,-0.23],[0.44,-0.25],[0.52,-0.07],[0.74,-0.05],[0.91,0.015],[1.06,0.12],[1.15,0.31],[1.04,0.42],[1.035,0.66],[1.12,0.8],[1.04,1.06],[0.87,1.2],[0.66,1.27],[0.52,1.1],[0.44,1.18],[0.4,1.49],[0.24,1.65],[0.08,1.49],[0.08,1.11],[-0.05,0.94],[-0.08,0.72],[-0.03,0.47],[-0.12,0.27],[-0.06,0.13]]},
  eastgate:{column:3,row:0,w:2650,h:2400,landmark:'Gatehouse Terrace',
    coast:[[0.04,0.04],[0.19,-0.035],[0.4,-0.04],[0.68,-0.015],[0.92,0.04],[1.08,0.16],[1.28,0.2],[1.36,0.34],[1.24,0.47],[1.055,0.43],[1.03,0.65],[1.08,0.85],[1.02,1.0],[0.8,1.09],[0.65,1.2],[0.51,1.35],[0.35,1.32],[0.31,1.12],[0.11,1.04],[-0.03,0.88],[-0.11,0.7],[-0.045,0.46],[-0.025,0.23]]},
  cinder:{column:3,row:1,w:2250,h:1850,landmark:'Cinder Garden',
    coast:[[0.03,0.04],[0.18,-0.08],[0.35,-0.22],[0.44,-0.27],[0.53,-0.08],[0.76,-0.05],[0.95,0.05],[1.07,0.21],[1.29,0.25],[1.43,0.37],[1.46,0.58],[1.3,0.72],[1.1,0.61],[1.04,0.76],[1.06,0.98],[0.87,1.11],[0.71,1.07],[0.53,1.28],[0.39,1.36],[0.22,1.24],[0.04,1.08],[-0.04,0.88],[-0.07,0.65],[-0.045,0.44],[-0.08,0.23]]},
  aerodrome:{column:3,row:2,w:3300,h:2500,landmark:'Kingsway Apron',
    coast:[[0.03,0.04],[0.23,-0.025],[0.43,-0.09],[0.63,-0.04],[0.84,-0.03],[1.0,0.05],[1.09,0.23],[1.21,0.36],[1.29,0.48],[1.17,0.57],[1.04,0.59],[1.08,0.8],[1.01,1.01],[0.83,1.12],[0.64,1.07],[0.5,1.17],[0.33,1.39],[0.16,1.41],[0.08,1.17],[-0.03,0.94],[-0.08,0.68],[-0.04,0.45],[-0.02,0.19]]},
  saints:{column:0,row:3,w:2100,h:2700,landmark:'Memorial Headland',
    coast:[[0.03,0.04],[0.18,-0.16],[0.35,-0.26],[0.46,-0.14],[0.53,-0.02],[0.73,-0.07],[0.93,0.03],[1.05,0.22],[1.13,0.36],[1.04,0.48],[1.045,0.75],[1.0,0.98],[0.86,1.18],[0.78,1.38],[0.64,1.47],[0.49,1.29],[0.53,1.11],[0.31,1.08],[0.15,1.23],[-0.015,1.14],[-0.06,0.91],[-0.08,0.64],[-0.02,0.44],[-0.025,0.21]]},
  refinery:{column:1,row:3,w:2950,h:1650,landmark:'Ashcroft Tank Point',
    coast:[[0.03,0.04],[0.19,-0.06],[0.39,-0.04],[0.53,-0.2],[0.69,-0.29],[0.87,-0.23],[0.99,-0.04],[1.04,0.22],[1.07,0.42],[1.03,0.69],[1.1,0.85],[1.0,1.08],[0.84,1.3],[0.71,1.61],[0.54,1.67],[0.47,1.48],[0.53,1.13],[0.34,1.065],[0.16,1.18],[0.02,1.09],[-0.04,0.89],[-0.08,0.68],[-0.045,0.42],[-0.02,0.18]]},
  campus:{column:2,row:3,w:2350,h:2250,landmark:'Northstar Arboretum',
    coast:[[0.03,0.04],[0.16,-0.08],[0.31,-0.2],[0.49,-0.24],[0.6,-0.08],[0.78,-0.06],[0.94,0.035],[1.04,0.18],[1.12,0.36],[1.035,0.47],[1.045,0.7],[1.19,0.85],[1.21,1.0],[1.08,1.18],[0.92,1.11],[0.74,1.07],[0.57,1.25],[0.44,1.4],[0.28,1.31],[0.19,1.1],[0.02,1.04],[-0.04,0.86],[-0.08,0.62],[-0.03,0.42],[-0.02,0.19]]},
  marina:{column:3,row:3,w:2700,h:2050,landmark:'Kingsport Sail Point',
    coast:[[0.03,0.04],[0.21,-0.075],[0.42,-0.04],[0.64,-0.09],[0.84,-0.05],[1.01,0.06],[1.09,0.26],[1.04,0.43],[1.03,0.7],[1.12,0.9],[1.05,1.09],[0.89,1.25],[0.82,1.44],[0.65,1.55],[0.52,1.42],[0.54,1.17],[0.36,1.07],[0.21,1.14],[0.07,1.36],[-0.08,1.36],[-0.18,1.18],[-0.13,1.01],[-0.045,0.82],[-0.03,0.62],[-0.065,0.4],[-0.02,0.18]]}
};

// Town parcels are staggered along three coastal belts; shoreline profiles
// are authored separately from the rectangular building parcels.
const DISTRICT_OFFSETS={core:[0,0],docks:[0,0],lantern:[0,0],eastgate:[0,0],
  oldmill:[200,-150],redhook:[-350,500],blackwood:[550,350],cinder:[-250,250],
  marrow:[-50,350],southport:[250,-400],velvet:[350,550],aerodrome:[500,-250],
  saints:[400,100],refinery:[-300,650],campus:[600,-200],marina:[-100,400]};
const TERRAIN_ANCHORS={core:[[.64,1.17,190,'woodland']],docks:[[.09,1.17,150,'rock'],[.69,1.27,160,'marsh']],
 lantern:[[1.19,.40,170,'bluff'],[-.22,.60,170,'woodland']],oldmill:[[.32,-.11,170,'woodland'],[1.15,.82,120,'rock']],
 redhook:[[.34,-.26,190,'marsh']],blackwood:[[-.20,.43,180,'woodland'],[.80,-.14,160,'bluff']],
 marrow:[[.75,-.18,160,'bluff'],[.66,1.20,180,'woodland']],southport:[[.70,-.16,175,'rock'],[.10,1.18,145,'marsh']],
 velvet:[[.23,1.38,190,'woodland']],eastgate:[[1.20,.31,190,'bluff']],cinder:[[1.27,.45,230,'woodland']],
 aerodrome:[[.24,1.23,190,'marsh'],[1.17,.45,170,'rock']],saints:[[.68,1.26,180,'woodland']],
 refinery:[[.67,1.44,180,'rock']],campus:[[.45,1.22,180,'woodland']],marina:[[-.05,1.20,160,'marsh'],[.73,1.32,170,'woodland']]};

const legacyColumns=[{x:300,w:2200,spine:1265},{x:2850,w:2000,spine:3915},
  {x:5200,w:1800,spine:6265},{x:7350,w:2200,spine:8565}];
const legacyRows=[{y:300,h:2200,spine:1200},{y:3200,h:2200,spine:4200},
  {y:6200,h:2200,spine:7200},{y:9200,h:2200,spine:10200}];
export const DISTRICT_DRAFTS=Object.fromEntries(Object.entries(drafts).map(([id,d])=>{
  const col=legacyColumns[d.column],row=legacyRows[d.row];
  return [id,{...d,id,x:ARTERIAL_X[d.column]-(col.spine-col.x)/col.w*d.w+DISTRICT_OFFSETS[id][0],
    y:ARTERIAL_Y[d.row]-(row.spine-row.y)/row.h*d.h+DISTRICT_OFFSETS[id][1],
    source:{x:col.x,y:row.y,w:col.w,h:row.h},landmark:d.landmark}];
}));
export const AUTHORED_TERRAIN=Object.entries(TERRAIN_ANCHORS).flatMap(([id,anchors])=>anchors.map(([u,v,radius,kind],index)=>{
 const island=DISTRICT_DRAFTS[id];return {id:`${id}-${index}`,islandId:id,x:island.x+u*island.w,y:island.y+v*island.h,radius,kind};
}));
export function migrateWorld2Point(point){
 let owner=null,best=Infinity;
 for(const d of Object.values(DISTRICT_DRAFTS)){
  const [dx,dy]=DISTRICT_OFFSETS[d.id],x=d.x-dx,y=d.y-dy;
  const distance=Math.hypot(Math.max(x-point.x,0,point.x-x-d.w),Math.max(y-point.y,0,point.y-y-d.h));
  if(distance<best){best=distance;owner=d;}
 }
 const offset=DISTRICT_OFFSETS[owner.id];return {x:point.x+offset[0],y:point.y+offset[1]};
}

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
  {id:'willow-key',name:'Willow Key',parent:'blackwood',x:11900,y:8400,w:370,h:260,
    coast:[[.08,.20],[.45,.02],[.85,.10],[1.03,.44],[.91,.82],[.59,1.02],[.20,.94],[-.02,.57]]},
  {id:'marsh-point',name:'Marsh Point',parent:'marrow',x:550,y:13050,w:540,h:250,
    coast:[[.02,.39],[.18,.09],[.47,.01],[.81,.13],[1.01,.55],[.73,.91],[.46,1.02],[.12,.80]]},
  {id:'ashcroft-key',name:'Ashcroft Key',parent:'southport',x:6250,y:13050,w:590,h:240,
    coast:[[.02,.33],[.25,.03],[.51,.10],[.82,.04],[1.01,.41],[.87,.82],[.53,1.04],[.21,.86]]},
  {id:'salt-marsh',name:'Salt Marsh',parent:'aerodrome',x:14580,y:12920,w:460,h:310,
    coast:[[.06,.20],[.36,.02],[.73,.05],[.99,.37],[.87,.72],[.59,1.04],[.22,.93],[-.02,.53]]},
  {id:'reed-satellite',name:'Reed Shoal',parent:'reed-bank',x:360,y:3600,w:180,h:105,
    coast:[[.08,.30],[.34,.03],[.76,.08],[1.01,.43],[.75,.90],[.36,1.03],[.02,.69]]},
  {id:'gull-satellite',name:'Gull Skerry',parent:'gull-rock',x:6890,y:3700,w:210,h:130,
    coast:[[.06,.42],[.24,.06],[.64,-.02],[.95,.25],[1.04,.67],[.66,1.00],[.24,.86]]},
  {id:'willow-satellite',name:'Willow Shoal',parent:'willow-key',x:12190,y:8830,w:240,h:135,
    coast:[[.02,.37],[.30,.02],[.58,.11],[.88,.03],[1.03,.44],[.85,.80],[.48,1.02],[.12,.84]]},
  {id:'marsh-satellite',name:'Marsh Skerry',parent:'marsh-point',x:290,y:13560,w:165,h:115,
    coast:[[.07,.24],[.42,.02],[.87,.10],[1.01,.49],[.70,.97],[.24,.91],[-.01,.54]]},
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
    const width=road.width||28;
    road.width=Math.min(width,width*owner.w/owner.source.w,width*owner.h/owner.source.h);
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
  return legacy.flatMap(bridge=>{
    const horizontal=bridge.dir==='h',a=worldPoint({x:horizontal?bridge.x:bridge.x+bridge.w/2,
      y:horizontal?bridge.y+bridge.h/2:bridge.y});
    const b=worldPoint({x:horizontal?bridge.x+bridge.w:bridge.x+bridge.w/2,
      y:horizontal?bridge.y+bridge.h/2:bridge.y+bridge.h});
    const cross=horizontal?'y':'x',axis=horizontal?'x':'y';
    if(Math.abs(a[cross]-b[cross])<.01)return [{...bridge,
      x:horizontal?a.x:a.x-bridge.w/2,y:horizontal?a.y-bridge.h/2:a.y,
      w:horizontal?b.x-a.x:bridge.w,h:horizontal?bridge.h:b.y-a.y,
      logicalId:bridge.id,bridgePath:[{x:a.x,y:a.y},{x:b.x,y:b.y}],bridgePathIndex:0,
      landfallStart:true,landfallEnd:true}];
    const mid=(a[axis]+b[axis])/2,width=horizontal?bridge.h:bridge.w;
    // Keep the orthogonal rectangles for collision/navmesh compatibility, but
    // also retain their shared centerline. The renderer can turn the hard
    // square elbow into a continuous, rounded causeway without changing the
    // authoritative road graph used by traffic and pedestrians.
    const points=[a,{...a,[axis]:mid},{...b,[axis]:mid},b];
    return points.slice(1).map((end,index)=>{
      const start=points[index],h=Math.abs(end.y-start.y)<.01;
      // Overlapping corner decks keep the complete vehicle footprint supported.
      return {...bridge,id:`${bridge.id}-${index}`,logicalId:bridge.id,dir:h?'h':'v',
        bridgePath:points.map(point=>({x:point.x,y:point.y})),bridgePathIndex:index,
        x:Math.min(start.x,end.x)-(!h||index>0?width/2:0),
        y:Math.min(start.y,end.y)-(!h?index>0?width/2:0:width/2),
        w:h?Math.abs(end.x-start.x)+(index>0?width/2:0)+(index<2?width/2:0):width,
        h:h?width:Math.abs(end.y-start.y)+width,
        landfallStart:index===0,landfallEnd:index===2};
    });
  });
}

export function isletWalkways(){
  return AUTHORED_ISLETS.flatMap(islet=>{
    const parent=DISTRICT_DRAFTS[islet.parent]||AUTHORED_ISLETS.find(i=>i.id===islet.parent),end={x:islet.x+islet.w/2,y:islet.y+islet.h/2};
    const start=parent.natural?{x:parent.x+parent.w/2,y:parent.y+parent.h/2}:islet.id==='long-key'?{x:ARTERIAL_X[parent.column]+DISTRICT_OFFSETS[parent.id][0],y:ARTERIAL_Y[parent.row]+DISTRICT_OFFSETS[parent.id][1]}:
      {x:parent.x+parent.w*.44,y:parent.y+parent.h-50};
    const corner={x:end.x,y:start.y},width=56;
    return [[start,corner],[corner,end]].filter(([a,b])=>Math.hypot(a.x-b.x,a.y-b.y)>1).map(([a,b],index)=>{
      const horizontal=a.y===b.y;
      return {id:`walk-${islet.id}-${index}`,name:islet.name+' Boardwalk',footway:true,
        // Extend both ends by half the deck width. Butt-ended perpendicular
        // strips leave an unsupported quarter-square at their shared corner.
        // The same rectangles are consumed by painting and ground support.
        dir:horizontal?'h':'v',x:horizontal?Math.min(a.x,b.x)-width/2:a.x-width/2,
        y:horizontal?a.y-width/2:Math.min(a.y,b.y)-width/2,
        w:horizontal?Math.abs(b.x-a.x)+width:width,h:horizontal?width:Math.abs(b.y-a.y)+width};
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
