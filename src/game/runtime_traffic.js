import { LANE_WIDTH } from './road_constants.js';

const EPS=0.001;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((b?.x||0)-(a?.x||0),(b?.y||0)-(a?.y||0));
const angleDelta=(target,current)=>Math.atan2(Math.sin(target-current),Math.cos(target-current));

function hashId(value=''){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}

function outwardCandidates(reached,previous){
  const found=[];
  const seen=new Set();
  const add=node=>{
    if(!node||node===previous||node===reached||seen.has(node.id))return;
    if(dist(reached,node)>EPS){seen.add(node.id);found.push(node);}
  };
  for(const link of reached?.links||[]){
    if(link===previous)continue;
    if(dist(reached,link)>EPS){add(link);continue;}
    for(const second of link?.links||[]) add(second);
  }
  return found;
}

export function nextTrafficSegment(car){
  const segment=car?.currentSegment;
  if(!segment||segment.length<2)return null;
  const [previous,reached]=segment;
  const incoming=Math.atan2(reached.y-previous.y,reached.x-previous.x);
  const candidates=outwardCandidates(reached,previous);

  if(!candidates.length)return [reached,previous];

  const ranked=candidates
    .map(node=>({
      node,
      delta:Math.abs(angleDelta(Math.atan2(node.y-reached.y,node.x-reached.x),incoming))
    }))
    .sort((a,b)=>a.delta-b.delta);

  car.turnCounter=(car.turnCounter||0)+1;
  const selector=(hashId(car.trafficId||car.id)+car.turnCounter)%5;
  const pick=ranked.length>1&&selector===0?ranked[1]:ranked[0];
  return [reached,pick.node];
}

function poseFor(car){
  const [a,b]=car.currentSegment;
  const dx=b.x-a.x,dy=b.y-a.y;
  const len=Math.hypot(dx,dy)||1;
  const heading=Math.atan2(dy,dx);
  const p=clamp(car.segmentProgress||0,0,1);

  // Fade lane offset to zero close to junctions so lane changes at corners
  // do not create sideways jumps.
  const edgeBlend=clamp(Math.min(p,1-p)*5,0,1);
  const laneOffset=(car.laneOffset??LANE_WIDTH*.52)*edgeBlend;
  const rightX=dy/len,rightY=-dx/len;

  car.x=a.x+dx*p+rightX*laneOffset;
  car.y=a.y+dy*p+rightY*laneOffset;
  car.angle=heading;
  car.segmentLength=len;
  return car;
}

export function initializeTrafficCar(car){
  if(!car?.currentSegment)return car;
  const [a,b]=car.currentSegment;
  if((car.speed||0)<0){
    car.currentSegment=[b,a];
    car.segmentProgress=1-clamp(car.segmentProgress||0,0,1);
    car.speed=Math.abs(car.speed);
  }
  car.cruiseSpeed=Math.max(28,Math.abs(car.cruiseSpeed??car.speed??70));
  car.speed=Math.max(0,Math.abs(car.speed??car.cruiseSpeed));
  car.laneOffset=Math.max(7,Math.min(LANE_WIDTH*.7,Math.abs(car.laneOffset??LANE_WIDTH*.52)));
  car.turnCounter=car.turnCounter||0;
  return poseFor(car);
}

function directedKey(car){
  const [a,b]=car.currentSegment||[];
  return a&&b?`${a.id}>${b.id}`:'';
}

export function stepTrafficFleet(cars,dt=1/60){
  const h=clamp(Number(dt)||1/60,0.001,0.1);

  // Headway is solved before motion. Cars stay on their road path instead of
  // being pushed sideways into curbs or buildings.
  for(const car of cars){
    if(!car.currentSegment)continue;
    const key=directedKey(car);
    const length=Math.max(1,car.segmentLength||dist(car.currentSegment[0],car.currentSegment[1]));
    let nearest=Infinity;
    for(const other of cars){
      if(other===car||directedKey(other)!==key)continue;
      const gap=(other.segmentProgress-car.segmentProgress)*length;
      if(gap>0&&gap<nearest)nearest=gap;
    }

    let target=car.cruiseSpeed||70;
    if(nearest<95){
      const factor=clamp((nearest-24)/71,0,1);
      target*=factor;
    }
    const accel=target<car.speed?150:55;
    const delta=clamp(target-car.speed,-accel*h,accel*h);
    car.speed=Math.max(0,car.speed+delta);
    car.braking=target<car.cruiseSpeed*.75;
  }

  for(const car of cars){
    if(!car.currentSegment)continue;
    let remaining=Math.max(0,car.speed*h);
    let guard=0;

    while(remaining>EPS&&guard++<6){
      const length=Math.max(1,car.segmentLength||dist(car.currentSegment[0],car.currentSegment[1]));
      const toEnd=(1-clamp(car.segmentProgress,0,1))*length;
      if(remaining<toEnd){
        car.segmentProgress+=remaining/length;
        remaining=0;
        break;
      }

      remaining-=Math.max(0,toEnd);
      car.segmentProgress=1;
      const next=nextTrafficSegment(car);
      if(!next||dist(next[0],next[1])<=EPS){
        car.currentSegment=[car.currentSegment[1],car.currentSegment[0]];
      }else{
        car.currentSegment=next;
      }
      car.segmentProgress=0;
      car.segmentLength=Math.max(1,dist(car.currentSegment[0],car.currentSegment[1]));
    }

    poseFor(car);
  }

  return cars;
}
