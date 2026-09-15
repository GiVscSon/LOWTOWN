import { CITY_ROADS, CITY_DISTRICTS, CITY_DESTINATIONS, roadPoint, buildCityGraph } from './city_semantics.js';

const CITY_GRAPH=buildCityGraph();
if(typeof globalThis!=='undefined')globalThis.__LOWTOWN_CITY_GRAPH=CITY_GRAPH;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(x,y,n=0){const v=Math.sin(x*12.9898+y*78.233+n*37.719)*43758.5453;return v-Math.floor(v);}
function rgba(hex,a){return hex.replace(')',`,${a})`).replace('rgb','rgba');}

function buildingDetails(ctx,iso,b,t){
  const [x,y,w,h]=b;
  const seed=hash(x,y,w+h);
  const z=0;
  const height=clamp(46+Math.max(w,h)*.18,58,112);
  const top=[iso(x,y,z),iso(x+w,y,z),iso(x+w,y+h,z),iso(x,y+h,z)];
  const roof=top.map(p=>({x:p.x,y:p.y-height}));

  ctx.save();
  ctx.lineJoin='round';
  ctx.shadowColor='rgba(0,0,0,.45)';
  ctx.shadowBlur=10;
  ctx.shadowOffsetY=7;
  ctx.fillStyle=seed>.78?'#3a3936':'#303337';
  ctx.beginPath();roof.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
  ctx.shadowColor='transparent';

  ctx.fillStyle=seed>.5?'#25282b':'#202326';
  ctx.beginPath();ctx.moveTo(roof[0].x,roof[0].y);ctx.lineTo(roof[1].x,roof[1].y);ctx.lineTo(top[1].x,top[1].y);ctx.lineTo(top[0].x,top[0].y);ctx.closePath();ctx.fill();
  ctx.fillStyle='#191c20';
  ctx.beginPath();ctx.moveTo(roof[1].x,roof[1].y);ctx.lineTo(roof[2].x,roof[2].y);ctx.lineTo(top[2].x,top[2].y);ctx.lineTo(top[1].x,top[1].y);ctx.closePath();ctx.fill();

  ctx.strokeStyle='rgba(8,10,12,.8)';ctx.lineWidth=1;ctx.beginPath();roof.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();

  const rows=Math.max(1,Math.floor(h/42));
  const cols=Math.max(2,Math.floor(w/38));
  for(let row=0;row<rows;row++){
    for(let col=0;col<cols;col++){
      const wx=x+(col+.5)*w/cols, wy=y+(row+.55)*h/rows;
      const lit=hash(wx,wy,seed)>0.58;
      const p=iso(wx,wy,z);
      ctx.fillStyle=lit?'rgba(224,154,62,.55)':'rgba(70,76,82,.22)';
      ctx.fillRect(p.x-2.5,p.y-height*.42,5,3.2);
      if(lit&&hash(wx,wy,seed+4)>.78){ctx.fillStyle='rgba(255,205,118,.12)';ctx.fillRect(p.x-6,p.y-height*.42-2,12,7);}
    }
  }

  if(w>105&&h>90){
    const p=iso(x+w*.7,y+h*.25,z);
    ctx.fillStyle='#0b0d0f';ctx.fillRect(p.x-8,p.y-height-5,16,9);
    ctx.strokeStyle='rgba(154,160,168,.38)';ctx.strokeRect(p.x-8,p.y-height-5,16,9);
    ctx.strokeStyle='rgba(154,160,168,.28)';ctx.beginPath();ctx.moveTo(p.x-4,p.y-height-5);ctx.lineTo(p.x-4,p.y-height-14);ctx.moveTo(p.x+4,p.y-height-5);ctx.lineTo(p.x+4,p.y-height-14);ctx.stroke();
  }
  if(seed>.68&&w>90){
    const p=iso(x+w*.52,y+h*.08,z);
    ctx.fillStyle='#0b0d10';ctx.fillRect(p.x-19,p.y-height-5,38,12);
    ctx.strokeStyle='rgba(224,154,62,.45)';ctx.strokeRect(p.x-19,p.y-height-5,38,12);
    ctx.fillStyle='rgba(224,154,62,.72)';ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillText(seed>.84?'MOTEL':'LOW',p.x,p.y-height+3);
  }
  if(seed<.3&&w>100){
    const p=iso(x+w*.22,y+h*.55,z);
    ctx.strokeStyle='rgba(154,160,168,.3)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y-height*.55);ctx.lineTo(p.x,p.y-height*.78);ctx.stroke();
    ctx.fillStyle='rgba(154,160,168,.35)';ctx.fillRect(p.x-5,p.y-height*.8,10,3);
  }
  ctx.restore();
  void t;
}

function roadGeometry(ctx,iso){
  for(const road of CITY_ROADS){
    const width=road.class==='ARTERIAL'?66:road.class==='AVENUE'?52:road.class==='STREET'?40:30;
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();road.points.forEach(([x,y],i)=>{const p=iso(x,y);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});
    ctx.strokeStyle='rgba(3,5,7,.9)';ctx.lineWidth=width+14;ctx.stroke();
    ctx.strokeStyle=road.class==='ARTERIAL'?'#36393d':'#292c30';ctx.lineWidth=width;ctx.stroke();
    ctx.strokeStyle='rgba(94,99,103,.16)';ctx.lineWidth=width*.38;ctx.stroke();
    ctx.strokeStyle='rgba(224,154,62,.38)';ctx.lineWidth=2;ctx.setLineDash(road.oneWay?[22,13]:[15,20]);ctx.stroke();ctx.setLineDash([]);
    if(road.lanes>2){
      ctx.strokeStyle='rgba(190,194,196,.12)';ctx.lineWidth=1;
      for(let lane=1;lane<road.lanes;lane++){
        const offset=(lane-road.lanes/2)*15;
        ctx.beginPath();road.points.forEach(([x,y],i)=>{const a=road.points[Math.max(0,i-1)]||road.points[i],b=road.points[Math.min(road.points.length-1,i+1)]||road.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,p=iso(x-dy/len*offset,y+dx/len*offset);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function crosswalks(ctx,iso){
  for(const road of CITY_ROADS){
    if(road.points.length<2)continue;
    for(let i=0;i<road.points.length-1;i++){
      const [x,y]=road.points[i], [nx,ny]=road.points[i+1];
      const nearby=CITY_ROADS.some(other=>other!==road&&other.points.some(p=>Math.hypot(p[0]-nx,p[1]-ny)<4));
      if(!nearby)continue;
      const dx=nx-x,dy=ny-y,len=Math.hypot(dx,dy)||1;
      const p=iso(nx-dy/len*18,ny+dx/len*18);
      ctx.strokeStyle='rgba(210,207,197,.34)';ctx.lineWidth=2;
      for(let s=-2;s<=2;s++){ctx.beginPath();ctx.moveTo(p.x+s*5-8,p.y-5);ctx.lineTo(p.x+s*5+8,p.y+5);ctx.stroke();}
    }
  }
}

function puddles(ctx,iso,buildings,t){
  for(let i=0;i<buildings.length;i+=2){
    const [x,y,w,h]=buildings[i];
    const p=iso(x+w*.55,y+h+10);
    const pulse=.65+.35*Math.sin(t*1.4+i);
    ctx.save();ctx.globalAlpha=.16*pulse;ctx.strokeStyle='#9aa0a8';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(p.x,p.y,clamp(w*.18,12,34),clamp(h*.045,3,8),-.18,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
}

function streetAtmosphere(ctx,iso,lamps,t){
  for(let i=0;i<lamps.length;i++){
    const [x,y]=lamps[i],p=iso(x,y),pulse=.88+.12*Math.sin(t*2.4+i*.73),r=clamp(30*pulse,18,34);
    const g=ctx.createRadialGradient(p.x,p.y-38,1,p.x,p.y-38,r);
    g.addColorStop(0,'rgba(255,219,145,.35)');g.addColorStop(.25,'rgba(224,154,62,.18)');g.addColorStop(1,'rgba(224,154,62,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y-38,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(75,79,83,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-34);ctx.stroke();
    ctx.fillStyle='#f0b75d';ctx.beginPath();ctx.arc(p.x,p.y-39,3,0,Math.PI*2);ctx.fill();
  }
}

function trafficGlow(ctx,iso){
  for(const road of CITY_ROADS){
    if(road.points.length<2)continue;
    const p=iso(road.points[Math.floor(road.points.length/2)][0],road.points[Math.floor(road.points.length/2)][1]);
    const g=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,45);
    g.addColorStop(0,'rgba(224,154,62,.045)');g.addColorStop(1,'rgba(224,154,62,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,45,0,Math.PI*2);ctx.fill();
  }
}

function roadLabels(ctx,iso){
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  for(const road of CITY_ROADS){const mid=Math.floor((road.points.length-1)/2),p=roadPoint(road.id,mid,road.lanes*18+18);if(!p)continue;const q=iso(p.x,p.y);ctx.translate(q.x,q.y-8);ctx.rotate(-p.heading*.55);ctx.font=road.class==='ARTERIAL'?'bold 8px monospace':'7px monospace';ctx.fillStyle='rgba(224,154,62,.72)';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=3;ctx.fillText(road.name.toUpperCase(),0,0);ctx.setTransform(1,0,0,1,0,0);}
  ctx.restore();
}

function districtLabels(ctx,iso){
  ctx.save();ctx.textAlign='center';
  for(const district of CITY_DISTRICTS){const p=iso(district.center.x,district.center.y);ctx.fillStyle='rgba(7,9,11,.68)';ctx.fillRect(p.x-54,p.y-11,108,20);ctx.strokeStyle='rgba(224,154,62,.26)';ctx.strokeRect(p.x-54,p.y-11,108,20);ctx.fillStyle='rgba(154,160,168,.78)';ctx.font='bold 7px monospace';ctx.fillText(district.name.toUpperCase(),p.x,p.y+2);}
  ctx.restore();
}

function destinationSigns(ctx,iso){
  for(const d of CITY_DESTINATIONS){const p=roadPoint(d.roadId,d.index,(CITY_ROADS.find(r=>r.id===d.roadId)?.lanes||2)*14+30);if(!p)continue;const q=iso(p.x,p.y);ctx.fillStyle='rgba(7,9,11,.86)';ctx.fillRect(q.x-31,q.y-29,62,12);ctx.strokeStyle='rgba(224,154,62,.22)';ctx.strokeRect(q.x-31,q.y-29,62,12);ctx.fillStyle='rgba(190,194,196,.78)';ctx.font='6px monospace';ctx.textAlign='center';ctx.fillText(d.name.toUpperCase(),q.x,q.y-20);}
}

export function createCityVisuals(){
  return {version:'CITY_CINEMATIC_4',draw(ctx,iso,buildings,lamps,t){
    roadGeometry(ctx,iso);
    puddles(ctx,iso,buildings,t);
    for(const b of buildings)buildingDetails(ctx,iso,b,t);
    crosswalks(ctx,iso);
    trafficGlow(ctx,iso);
    streetAtmosphere(ctx,iso,lamps,t);
    roadLabels(ctx,iso);
    districtLabels(ctx,iso);
    destinationSigns(ctx,iso);
  }};
}
