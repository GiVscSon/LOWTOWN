import { WORLD } from './world.js';
import { isLand } from './islands.js';
import { ROAD_WIDTH, ROAD_EDGE_TOLERANCE } from './road_authority.js';

const ROAD_HALF_WIDTH=ROAD_WIDTH/2;

function pointInBuilding(x,y,margin=0){
  return WORLD.buildings.some(([bx,by,bw,bh])=>x>bx-margin&&x<bx+bw+margin&&y>by-margin&&y<by+bh+margin);
}

function nearestRoadDistance(x,y,roadLines=[]){
  let best=Infinity;
  for(const [a,b] of roadLines){
    const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len2));
    const px=a.x+dx*t,py=a.y+dy*t;
    best=Math.min(best,Math.hypot(x-px,y-py));
  }
  return best;
}

function footprintPoints(x,y,a,length=56,width=28){
  const fx=Math.cos(a),fy=Math.sin(a),rx=-fy,ry=fx,hl=length/2,hw=width/2;
  return [
    {x,y},
    {x:x+fx*hl+rx*hw,y:y+fy*hl+ry*hw},
    {x:x+fx*hl-rx*hw,y:y+fy*hl-ry*hw},
    {x:x-fx*hl+rx*hw,y:y-fy*hl+ry*hw},
    {x:x-fx*hl-rx*hw,y:y-fy*hl-ry*hw}
  ];
}

export function vehicleWorldBlocked(x,y,a,roadLines=[],options={}){
  const length=Math.max(30,Number(options.length)||56);
  const width=Math.max(18,Number(options.width)||28);
  const buildingMargin=Math.max(0,Number(options.buildingMargin)||4);
  const roadTolerance=Math.max(0,Number(options.roadTolerance)??ROAD_EDGE_TOLERANCE);
  const points=footprintPoints(x,y,a,length,width);
  for(const p of points){
    if(!isLand(p.x,p.y)||pointInBuilding(p.x,p.y,buildingMargin))return true;
  }
  if(roadLines.length&&nearestRoadDistance(x,y,roadLines)>ROAD_HALF_WIDTH+roadTolerance)return true;
  return false;
}

export function nearestRoadDistanceForVehicle(x,y,roadLines=[]){return nearestRoadDistance(x,y,roadLines);}
