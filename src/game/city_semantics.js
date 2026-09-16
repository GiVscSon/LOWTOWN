const ROAD = Object.freeze({ARTERIAL:'ARTERIAL', AVENUE:'AVENUE', STREET:'STREET', SERVICE:'SERVICE'});
const USE = Object.freeze({VEHICLE:'VEHICLE', PEDESTRIAN:'PEDESTRIAN', BOTH:'BOTH'});

export const CITY_ROADS = Object.freeze([
  {id:'LOWTOWN_BOULEVARD',name:'Lowtown Boulevard',class:ROAD.ARTERIAL,zone:'DOWNTOWN',speed:95,lanes:4,oneWay:false,points:[[-1960,-360],[-1200,-360],[-760,-360],[-520,-360],[-120,-360],[200,-360],[640,-360],[880,-360],[1500,-360]]},
  {id:'RIVER_AVENUE',name:'River Avenue',class:ROAD.AVENUE,zone:'DOWNTOWN',speed:70,lanes:2,oneWay:false,points:[[-760,-1160],[-760,-600],[-760,-360],[-760,0],[-760,80],[-760,600],[-760,1240]]},
  {id:'CENTRAL_AVENUE',name:'Central Avenue',class:ROAD.AVENUE,zone:'DOWNTOWN',speed:70,lanes:2,oneWay:false,points:[[-120,-1160],[-120,-600],[-120,-360],[-120,0],[-120,80],[-120,600],[-120,1240]]},
  {id:'EASTERN_AVENUE',name:'Eastern Avenue',class:ROAD.AVENUE,zone:'DOWNTOWN',speed:75,lanes:2,oneWay:false,points:[[640,-1160],[640,-900],[640,-600],[640,-360],[640,0],[640,80],[640,600],[640,1240]]},
  {id:'MARKET_STREET',name:'Market Street',class:ROAD.STREET,zone:'DOWNTOWN',speed:45,lanes:2,oneWay:false,points:[[-1960,80],[-1200,80],[-760,80],[-520,80],[-120,80],[200,80],[640,80],[900,80],[1500,80]]},
  {id:'HARBOR_LINK',name:'Harbor Link',class:ROAD.ARTERIAL,zone:'DOWNTOWN',speed:80,lanes:2,oneWay:false,points:[[640,160],[1120,160],[1300,-900]]},
  {id:'DOCKSIDE_DRIVE',name:'Dockside Drive',class:ROAD.ARTERIAL,zone:'IRON_HARBOR',speed:85,lanes:4,oneWay:false,points:[[1300,-900],[1500,-900],[2100,-900]]},
  {id:'FREIGHTER_ROW',name:'Freighter Row',class:ROAD.AVENUE,zone:'IRON_HARBOR',speed:55,lanes:2,oneWay:false,points:[[1020,-500],[1500,-500],[2050,-500]]},
  {id:'SHIPYARD_ROAD',name:'Shipyard Road',class:ROAD.STREET,zone:'IRON_HARBOR',speed:40,lanes:2,oneWay:false,points:[[1020,-100],[1500,-100],[2050,-100]]},
  {id:'HARBOR_SPINE',name:'Harbor Spine',class:ROAD.AVENUE,zone:'IRON_HARBOR',speed:60,lanes:2,oneWay:false,points:[[1500,-900],[1500,-500],[1500,-100]]},
  {id:'PINE_ROUTE',name:'Pine Route',class:ROAD.ARTERIAL,zone:'NORTH_RIDGE',speed:80,lanes:2,oneWay:false,points:[[-120,1240],[-520,1400],[-120,1700],[300,1900],[800,2050]]},
  {id:'NORTH_BRIDGE_ROAD',name:'North Bridge',class:ROAD.AVENUE,zone:'DOWNTOWN',speed:60,lanes:2,oneWay:false,points:[[-120,600],[-320,800],[-120,1240]]}
]);

export const CITY_DISTRICTS = Object.freeze([
  {id:'DOWNTOWN',name:'Downtown',center:{x:-560,y:-180},roadIds:['LOWTOWN_BOULEVARD','RIVER_AVENUE','CENTRAL_AVENUE','EASTERN_AVENUE','MARKET_STREET','HARBOR_LINK','NORTH_BRIDGE_ROAD'],pedestrianDensity:1.35,vehicleDensity:1.2},
  {id:'RESIDENTIAL',name:'Residential',center:{x:-520,y:620},roadIds:['CENTRAL_AVENUE','RIVER_AVENUE'],pedestrianDensity:1.1,vehicleDensity:.75},
  {id:'OLD_INDUSTRIAL',name:'Old Industrial',center:{x:430,y:650},roadIds:['EASTERN_AVENUE'],pedestrianDensity:.55,vehicleDensity:.9},
  {id:'IRON_HARBOR',name:'Iron Harbor',center:{x:1700,y:-100},roadIds:['DOCKSIDE_DRIVE','FREIGHTER_ROW','SHIPYARD_ROAD','HARBOR_SPINE'],pedestrianDensity:.7,vehicleDensity:1.45},
  {id:'NORTH_RIDGE',name:'North Ridge',center:{x:0,y:1800},roadIds:['PINE_ROUTE'],pedestrianDensity:.35,vehicleDensity:.45}
]);

export const CITY_DESTINATIONS = Object.freeze([
  {id:'LOWTOWN_APARTMENTS',name:'Lowtown Apartments',kind:'HOME',district:'RESIDENTIAL',roadId:'CENTRAL_AVENUE',index:5},
  {id:'MARKET_HALL',name:'Market Hall',kind:'SHOP',district:'DOWNTOWN',roadId:'MARKET_STREET',index:4},
  {id:'CENTRAL_GARAGE',name:'Central Garage',kind:'GARAGE',district:'DOWNTOWN',roadId:'CENTRAL_AVENUE',index:3},
  {id:'CITY_HALL',name:'City Hall',kind:'CIVIC',district:'DOWNTOWN',roadId:'LOWTOWN_BOULEVARD',index:4},
  {id:'OLD_FOUNDRY',name:'Old Foundry',kind:'JOB',district:'OLD_INDUSTRIAL',roadId:'EASTERN_AVENUE',index:6},
  {id:'DOCK_WORKS',name:'Dock Works',kind:'JOB',district:'IRON_HARBOR',roadId:'DOCKSIDE_DRIVE',index:1},
  {id:'FREIGHT_DEPOT',name:'Freight Depot',kind:'JOB',district:'IRON_HARBOR',roadId:'FREIGHTER_ROW',index:1},
  {id:'NORTH_MOTEL',name:'North Ridge Motel',kind:'LODGING',district:'NORTH_RIDGE',roadId:'PINE_ROUTE',index:2}
]);

const copyPoint = p => ({x:Number(p[0]),y:Number(p[1])});
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function roadById(id){return CITY_ROADS.find(r=>r.id===id)||null;}
export function districtById(id){return CITY_DISTRICTS.find(d=>d.id===id)||null;}
export function destinationById(id){return CITY_DESTINATIONS.find(d=>d.id===id)||null;}
export function destinationPoint(id,side=1){const d=destinationById(id),r=d&&roadById(d.roadId);if(!d||!r)return null;return {...roadPoint(d.roadId,d.index,side*(r.lanes*14+22)),destinationId:d.id,district:d.district,kind:d.kind};}

export function nearestRoad(point,{use=USE.BOTH,zone=null}={}){
  const candidates=CITY_ROADS.filter(r=>!zone||r.zone===zone);let best=null;
  for(const road of candidates)for(let i=0;i<road.points.length;i++){const p=copyPoint(road.points[i]),d=distance(point,p);if(!best||d<best.distance)best={road,point:p,index:i,distance:d,use};}
  return best;
}
export function roadPoint(roadId,index=0,offset=0){
  const road=roadById(roadId);if(!road||!road.points.length)return null;const i=Math.max(0,Math.min(road.points.length-1,index)),p=copyPoint(road.points[i]);
  const a=road.points[Math.max(0,i-1)]||road.points[i],b=road.points[Math.min(road.points.length-1,i+1)]||road.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
  return {x:p.x-dy/len*offset,y:p.y+dx/len*offset,heading:Math.atan2(dy,dx),roadId:road.id};
}
export function vehicleLanePoint(roadId,index=0,lane=0){const road=roadById(roadId);if(!road)return null;const laneWidth=28,total=(road.lanes-1)*laneWidth;return roadPoint(roadId,index,lane*laneWidth-total/2);}
export function sidewalkPoint(roadId,index=0,side=1){return roadPoint(roadId,index,side*(roadById(roadId)?.lanes||2)*14+22);}

export function buildCityGraph(){
  const nodes=[];for(const road of CITY_ROADS)for(let i=0;i<road.points.length;i++)nodes.push({id:`${road.id}:${i}`,roadId:road.id,index:i,x:road.points[i][0],y:road.points[i][1],links:[]});
  const byId=new Map(nodes.map(n=>[n.id,n]));
  for(const road of CITY_ROADS)for(let i=0;i<road.points.length-1;i++){const a=byId.get(`${road.id}:${i}`),b=byId.get(`${road.id}:${i+1}`);a.links.push(b);if(!road.oneWay)b.links.push(a);}
  for(const n of nodes)for(const road of CITY_ROADS)if(road.id!==n.roadId)for(let i=0;i<road.points.length;i++){const p=road.points[i];if(Math.hypot(p[0]-n.x,p[1]-n.y)<90){const other=byId.get(`${road.id}:${i}`);if(other&&!n.links.includes(other))n.links.push(other);}}
  return nodes;
}
export function shortestRoute(start,goal){
  const nodes=buildCityGraph(),nearest=n=>nodes.reduce((a,b)=>!a||distance(n,b)<distance(n,a)?b:a,null),s=nearest(start),g=nearest(goal);if(!s||!g)return [];
  const dist=new Map([[s.id,0]]),prev=new Map(),open=new Set(nodes.map(n=>n.id));
  while(open.size){let current=null,best=Infinity;for(const id of open){const d=dist.get(id)??Infinity;if(d<best){best=d;current=id;}}if(current===null)break;open.delete(current);if(current===g.id)break;const n=nodes.find(v=>v.id===current);for(const v of n.links){if(!open.has(v.id))continue;const nd=best+distance(n,v);if(nd<(dist.get(v.id)??Infinity)){dist.set(v.id,nd);prev.set(v.id,current);}}}
  if(!dist.has(g.id))return [];const path=[];for(let id=g.id;id!==undefined;id=prev.get(id)){const n=nodes.find(n=>n.id===id);if(n)path.unshift(n);if(id===s.id)break;}return path;
}
export function pedestrianRoute(start,goal){return shortestRoute(start,goal).map((n,i)=>sidewalkPoint(n.roadId,n.index,i%2?1:-1)).filter(Boolean);}
export function vehicleRoute(start,goal){return shortestRoute(start,goal).map((n,i)=>vehicleLanePoint(n.roadId,n.index,(i%2)*Math.max(1,(roadById(n.roadId)?.lanes||2)-1))).filter(Boolean);}
export const CITY_USE=USE;
export const CITY_ROAD_CLASSES=ROAD;
