const cache = new WeakMap();
export function coastPoints(island) {
  if(cache.has(island))return cache.get(island);
  const { x, y, w, h } = island;
  // Preserve bridge landfalls and street grid; soften undeveloped corners.
  const anchors = [[90,0],[w*.28,-45],[w*.54,0],[w*.78,-25],[w-80,0],[w+25,100],
    [w,h*.32],[w+30,h*.56],[w,h*.82],[w-80,h],[w*.68,h+30],[w*.43,h],
    [w*.2,h+40],[80,h],[0,h-85],[-30,h*.73],[0,h*.5],[-25,h*.25],[0,85]]
    .map(([px,py])=>[x+px,y+py]);
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
