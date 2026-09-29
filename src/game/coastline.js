const cache = new WeakMap();
export function coastPoints(island) {
  if(cache.has(island))return cache.get(island);
  const { x, y, w, h } = island;
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
      if(i===8)px=w-12;
      if(i===10)py-=65;
      if(i===12)py+=40+Math.abs(jitter(42,100));
      if(i===15)px+=75;
      if(i===17)px-=25+Math.abs(jitter(43,60));
      return [x+px,y+py];
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
  const points=coastPoints(island); let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[i], [bx,by]=points[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
export function coastPath(ctx,island,scale=1,offsetX=0,offsetY=0) {
  ctx.beginPath(); coastPoints(island).forEach(([x,y],i)=>i?ctx.lineTo(x*scale+offsetX,y*scale+offsetY):ctx.moveTo(x*scale+offsetX,y*scale+offsetY)); ctx.closePath();
}
