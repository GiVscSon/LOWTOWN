export const BEACH_WIDTH = 108;
const cache = new WeakMap();
const boundsCache = new WeakMap();
function coastBounds(island){
  if(!boundsCache.has(island)){
    const points=coastPoints(island);
    boundsCache.set(island,{left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
      top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))});
  }
  return boundsCache.get(island);
}
const CITY_SHAPES = {
  core:      { sx: 1.025, sy: 1.055, wave: .045, phase: .2, lobes: 3, coves: [4] },
  docks:     { sx: 1.085, sy: 1.025, wave: .035, phase: 1.1, lobes: 5, coves: [9, 14] },
  lantern:   { sx: 1.025, sy: 1.105, wave: .060, phase: 2.2, lobes: 3, coves: [4, 18] },
  oldmill:   { sx: 1.055, sy: 1.035, wave: .070, phase: 3.3, lobes: 4, coves: [13] },
  redhook:   { sx: 1.095, sy: 1.065, wave: .040, phase: 4.4, lobes: 6, coves: [4, 9] },
  blackwood: { sx: 1.025, sy: 1.105, wave: .075, phase: 5.5, lobes: 4, coves: [13, 18] },
  marrow:    { sx: 1.095, sy: 1.025, wave: .060, phase: 6.6, lobes: 3, coves: [4] },
  southport: { sx: 1.065, sy: 1.035, wave: .040, phase: 7.7, lobes: 6, coves: [9, 13] },
  velvet:    { sx: 1.035, sy: 1.095, wave: .075, phase: 8.8, lobes: 4, coves: [4, 18] },
  eastgate:  { sx: 1.085, sy: 1.035, wave: .050, phase: 9.9, lobes: 5, coves: [13] },
  cinder:    { sx: 1.035, sy: 1.095, wave: .075, phase: 11, lobes: 3, coves: [4, 9] },
  aerodrome: { sx: 1.105, sy: 1.025, wave: .040, phase: 12, lobes: 4, coves: [13, 18] },
  saints:    { sx: 1.025, sy: 1.105, wave: .065, phase: 13, lobes: 5, coves: [4] },
  refinery:  { sx: 1.115, sy: 1.025, wave: .035, phase: 14, lobes: 6, coves: [9, 14] },
  campus:    { sx: 1.035, sy: 1.055, wave: .080, phase: 15, lobes: 3, coves: [4, 18] },
  marina:    { sx: 1.085, sy: 1.095, wave: .060, phase: 16, lobes: 4, coves: [9, 13] }
};
// Unequal headlands give the northern/southern coasts recognisable profiles.
// Only undeveloped shoreline anchors move; side channels and landfalls retain
// their existing envelope. Extensions are capped inside the city world bounds.
const HEADLANDS={core:[35,15,20,55],docks:[10,65,35,10],lantern:[95,20,15,65],
  oldmill:[15,95,70,10],redhook:[50,10,15,70],blackwood:[85,30,60,20],
  marrow:[20,70,80,15],southport:[65,15,10,75],velvet:[25,95,65,20],
  eastgate:[70,20,20,40],cinder:[30,85,75,20],aerodrome:[15,70,20,60],
  saints:[60,25,25,60],refinery:[20,65,60,15],campus:[95,15,20,80],marina:[35,80,70,15]};
export function coastPoints(island) {
  if(cache.has(island))return cache.get(island);
  const { x, y, w, h } = island;
  if(island.coast){
    const anchors=island.coast.map(([u,v])=>[x+u*w,y+v*h]),points=[];
    for(let i=0;i<anchors.length;i++){
      const p0=anchors[(i-1+anchors.length)%anchors.length],p1=anchors[i],p2=anchors[(i+1)%anchors.length],p3=anchors[(i+2)%anchors.length];
      for(let step=0;step<6;step++){
        const t=step/6,t2=t*t,t3=t2*t;
        points.push([0,1].map(a=>.5*(2*p1[a]+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t2+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t3)));
      }
    }
    cache.set(island,points);return points;
  }

  // Every district gets its own stable shoreline silhouette. The coast always
  // bulges outwards near bridge landfalls, so roads remain connected while the
  // archipelago stops reading as a repeated rectangular grid.
  const key=String(island.id||`${x}:${y}`);let seed=2166136261;
  for(let i=0;i<key.length;i++){seed^=key.charCodeAt(i);seed=Math.imul(seed,16777619);}
  const jitter=(n,amount)=>{let v=(seed+Math.imul(n+1,374761393))>>>0;v=Math.imul(v^(v>>>13),1274126177)>>>0;return (((v^(v>>>16))>>>0)/4294967295-.5)*amount;};
  if(island.natural){
    const points=Array.from({length:72},(_,i)=>{const a=i*Math.PI/36,r=1+.13*Math.sin(a*3+seed%9)+.07*Math.cos(a*5+seed%5);return [x+w/2+Math.cos(a)*w*.46*r,y+h/2+Math.sin(a)*h*.44*r];});
    cache.set(island,points);return points;
  }
  const shape=CITY_SHAPES[island.id]||{sx:1.04,sy:1.04,wave:.055,phase:seed%17,lobes:4,coves:[]};
  const protectedLandfalls=new Set([1,2,3,5,6,7,8,10,11,12,15,16,17]);
  const anchors = [[75+jitter(0,80),0],[w*.20+jitter(1,100),-38-jitter(2,55)],[w*.43,-28-Math.abs(jitter(4,25))],[w*.67+jitter(5,80),-48-jitter(6,55)],[w-95+jitter(7,55),0],[w+35+jitter(8,35),105+jitter(9,75)],
    [w+Math.abs(jitter(10,45)),h*.29+jitter(11,90)],[w+35+Math.abs(jitter(12,35)),h*.52+jitter(13,100)],[w+Math.abs(jitter(14,38)),h*.78+jitter(15,85)],[w-70+jitter(16,70),h],[w*.73+jitter(17,70),h+32+Math.abs(jitter(18,45))],[w*.49,h+24+Math.abs(jitter(20,25))],
    [w*.23+jitter(21,100),h+42+Math.abs(jitter(22,48))],[72+jitter(23,55),h],[-28-Math.abs(jitter(24,35)),h-105+jitter(25,70)],[-42-Math.abs(jitter(26,32)),h*.72+jitter(27,90)],[-Math.abs(jitter(28,32)),h*.48+jitter(29,80)],[-35-Math.abs(jitter(30,30)),h*.24+jitter(31,70)],[0,78+jitter(32,50)]]
    .map(([px,py],i)=>{
      // Larger unequal capes and shallow coves, with protected bridge landfalls.
      // The developed street envelope remains 120 units inside the coastline.
      if(i===1)py-=50+Math.abs(jitter(40,150));
      if(i===2)py-=12;
      if(i===3)py-=35+Math.abs(jitter(41,120));
      if(i===6)px-=45;
      // Preserve dry eastern landings on the two bridges that cross the bay.
      // Other island templates keep their established open-water contour.
      if(i===7)px=(island.id==='core'||island.id==='blackwood')?w+20:w-50;
      // Keep a shallow indentation beside the established east-side piers.
      if(i===8)px=w-50;
      if(i===10)py-=65;
      if(i===12)py+=40+Math.abs(jitter(42,100));
      if(i===15)px+=75;
      if(i===17)px-=25+Math.abs(jitter(43,60));
      const angle=Math.atan2(py-h/2,px-w/2);
      const wave=shape.wave*(Math.sin(angle*shape.lobes+shape.phase)+.38*Math.sin(angle*5-shape.phase));
      const cove=shape.coves.includes(i)?-.075:0;
      // Keep bridge approaches and the outer street envelope on dry land; the
      // profile changes only the undeveloped coast beyond those protected arcs.
      const radial=protectedLandfalls.has(i)?Math.max(1.015,1+wave):Math.max(.94,1+wave+cove);
      let coastY=y+h/2+(py-h/2)*shape.sy*radial;
      const capes=HEADLANDS[island.id]||[0,0,0,0];
      if(i===1)coastY-=capes[0];if(i===3)coastY-=capes[1];
      if(i===10)coastY+=capes[2];if(i===12)coastY+=capes[3];
      return [x+w/2+(px-w/2)*shape.sx*radial,Math.max(y-230,Math.min(y+h+200,coastY))];
    });
  // Closed Catmull-Rom shoreline: the same dense curve drives rendering and collision.
  const points=[];
  for(let i=0;i<anchors.length;i++) {
    const p0=anchors[(i-1+anchors.length)%anchors.length],p1=anchors[i],p2=anchors[(i+1)%anchors.length],p3=anchors[(i+2)%anchors.length];
    for(let step=0;step<6;step++) {
      const t=step/6,t2=t*t,t3=t2*t;
      points.push([
        .5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
      ]);
    }
  }
  cache.set(island,points);return points;
}
export function pointInCoast(x,y,island) {
  const bounds=coastBounds(island);
  if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return false;
  const points=coastPoints(island); let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[i], [bx,by]=points[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
function distanceToCoastSquared(x,y,points) {
  let best=Infinity;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
    const px=a[0]+dx*t,py=a[1]+dy*t,d2=(x-px)**2+(y-py)**2;
    if(d2<best)best=d2;
  }
  return best;
}
export function pointInBeach(x,y,island,width=island.natural?42:BEACH_WIDTH) {
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(width)||width<=0)return false;
  const bounds=coastBounds(island);
  if(x<bounds.left-width||x>bounds.right+width||y<bounds.top-width||y>bounds.bottom+width)return false;
  if(pointInCoast(x,y,island))return false;
  return distanceToCoastSquared(x,y,coastPoints(island))<=width*width;
}
export function coastPath(ctx,island,scale=1,offsetX=0,offsetY=0) {
  ctx.beginPath(); coastPoints(island).forEach(([x,y],i)=>i?ctx.lineTo(x*scale+offsetX,y*scale+offsetY):ctx.moveTo(x*scale+offsetX,y*scale+offsetY)); ctx.closePath();
}
