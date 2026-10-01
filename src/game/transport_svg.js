// Original LOWTOWN artwork. Model-space geometry is projected after heading
// rotation, so roof height stays upright in every SVG view.
export const SVG_TRANSPORT_TYPES=['sedan','coupe','sports','wagon','black','taxi','van','truck','bus','police','armoredPolice','nationalGuard','ambulance','fireEngine','bike','speedboat','tug','helicopter','plane'];
const palettes={sedan:'#bd864f',coupe:'#83949b',sports:'#b9523d',wagon:'#65765b',black:'#414950',taxi:'#d5ac44',van:'#9ba4a0',truck:'#827762',bus:'#617b77',police:'#cbd6d7',armoredPolice:'#475760',nationalGuard:'#727b56',ambulance:'#e0e0cf',fireEngine:'#b84235',bike:'#bb6948',speedboat:'#ccc6ac',tug:'#a7864e',helicopter:'#7d896e',plane:'#c4cec8'};
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function createTransportSVG(type='sedan',heading=0){
  if(!SVG_TRANSPORT_TYPES.includes(type))throw new Error('Unknown transport type: '+type);
  if(!Number.isFinite(heading))throw new Error('Heading must be finite');
  const cs=Math.cos(heading),sn=Math.sin(heading),parts=[],details=[];
  const rotate=([x,y,z=0])=>[x*cs-y*sn,x*sn+y*cs,z];
  const project=point=>{const [x,y,z]=rotate(point);return [110+(x-y)*Math.sqrt(3)/2,113+(x+y)/2-z];};
  const points=vertices=>vertices.map(p=>project(p).map(n=>n.toFixed(2)).join(',')).join(' ');
  const polygon=(vertices,fill,stroke='#182124',line=.8)=>`<polygon points="${points(vertices)}" fill="${fill}" stroke="${stroke}" stroke-width="${line}" stroke-linejoin="round"/>`;
  const line=(a,b,color='#a9b4ac',width=1)=>`<path d="M${project(a).join(' ')}L${project(b).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const shape=(w,h)=>[[-w/2+5,-h/2],[w/2-6,-h/2],[w/2,-h/2+5],[w/2,h/2-5],[w/2-6,h/2],[-w/2+5,h/2],[-w/2,h/2-5],[-w/2,-h/2+5]];
  function volume(base,z,height,paint,detail=''){
    const bottom=base.map(([x,y])=>[x,y,z]),top=base.map(([x,y])=>[x,y,z+height]);
    let svg='';
    // CCW footprints: only faces whose normal points toward the camera show.
    for(let i=0;i<base.length;i++){
      const a=rotate(bottom[i]),b=rotate(bottom[(i+1)%base.length]);
      const nx=b[1]-a[1],ny=a[0]-b[0];
      if(nx+ny>0)svg+=polygon([bottom[i],bottom[(i+1)%base.length],top[(i+1)%base.length],top[i]],nx>ny?'#394344':'#263337');
    }
    svg+=polygon(top,paint);
    parts.push({depth:base.reduce((sum,p)=>{const q=rotate(p);return sum+q[0]+q[1];},0)/base.length,z,svg:svg+detail});
    return z+height;
  }
  const paint=palettes[type],air=['plane','helicopter'].includes(type),water=['speedboat','tug'].includes(type);
  const size=type==='truck'||type==='fireEngine'||type==='nationalGuard'?[80,32]:type==='bus'?[82,30]:type==='tug'?[86,34]:type==='speedboat'?[67,26]:type==='wagon'?[58,25]:type==='bike'?[32,12]:type==='van'||type==='ambulance'||type==='armoredPolice'?[62,29]:[50,25];
  const [w,h]=size;
  let shadow=`<ellipse cx="112" cy="117" rx="${air?49:w*.65}" ry="${air?24:h*.65}" fill="#000" opacity=".3"/>`;
  if(water){
    const hull=[[-w*.5,-h*.26],[w*.27,-h*.5],[w*.52,0],[w*.27,h*.5],[-w*.5,h*.26]];
    volume(hull,1,7,paint);
    volume(rect(-w*.3,-h*.27,w*.44,h*.54),8,type==='tug'?14:7,type==='tug'?'#b5a27a':'#375b67');
    if(type==='tug'){
      volume(rect(-w*.21,-h*.2,w*.26,h*.4),22,5,'#b3b3a0');
      volume(rect(-w*.3,-3,7,6),27,9,'#394448');
      details.push(line([-21,-12,28],[2,-12,28],'#9cc0c6',3),line([-21,12,28],[2,12,28],'#496d7a',3));
      for(const y of [-h*.42,h*.42])for(let x=-w*.4;x<w*.3;x+=14)volume(rect(x-2,y-2,4,4),5,4,'#172b31');
    }else{
      details.push(polygon([[8,-h*.23,16],[19,-h*.12,12],[19,h*.12,12],[8,h*.23,16]],'#75a7ad'));
      volume(rect(-w*.4,-h*.2,8,h*.4),9,2,'#74674f');
    }
    for(const y of [-h*.43,h*.43])details.push(line([-w*.43,y,9],[w*.21,y,9],'#d8d1b0',1.2));
  }else if(type==='plane'){
    const wings=[[-12,-43],[1,-40],[5,-9],[30,-4],[49,0],[30,4],[5,9],[1,40],[-12,43],[-9,8],[-34,18],[-47,15],[-37,0],[-47,-15],[-34,-18],[-9,-8]];
    volume(wings,5,2,paint);volume(shape(83,10),7,8,'#dae0d5');
    details.push(polygon([[12,-4,16],[26,-3,15],[34,0,13],[26,3,15],[12,4,16]],'#406775'));
    for(const y of [-39,39])details.push(line([-10,y,8],[0,y,8],y<0?'#d24d3d':'#64a087',2.4));
    details.push(line([-40,0,15],[-40,0,27],'#b4c4c2',4),line([44,-12,10],[44,12,10],'#5c7174',2));
    details.push(line([-29,-3,16],[-17,-3,16],'#d6ad5d',1.6));
  }else if(type==='helicopter'){
    volume([[-49,-3],[-20,-6],[-8,-14],[14,-12],[28,0],[14,12],[-8,14],[-20,6],[-49,3]],9,10,paint);
    details.push(polygon([[10,-11,20],[22,-6,20],[28,0,17],[22,6,20],[10,11,20]],'#557f88'));
    for(const y of [-18,18])details.push(line([-22,y,2],[21,y,2],'#9baba7',2.3),line([-10,y,2],[-5,y*.6,10],'#3a4b4b',2),line([11,y,2],[6,y*.6,10],'#3a4b4b',2));
    volume(rect(-2,-2,4,4),19,8,'#445354');
    details.push(line([-55,0,28],[55,0,28],'#889c96',2.6),line([0,-55,28],[0,55,28],'#889c96',2.6),line([-45,-7,18],[-45,7,18],'#b6c5ba',2));
  }else if(type==='bike'){
    for(const x of [-12,12])volume(rect(x-5,-2,10,4),0,7,'#141e22');
    volume(shape(25,8),5,5,paint);volume(rect(-10,-3,13,6),10,3,'#303b3a');
    details.push(line([10,-7,14],[10,7,14],'#bac3b9',1.5),line([-4,3,5],[13,3,5],'#718c8b',1.4));
    volume(rect(13,-2,3,4),10,3,'#efdaab');
  }else{
    const heavy=['truck','fireEngine','nationalGuard','bus'].includes(type),van=['van','ambulance','armoredPolice'].includes(type);
    for(const x of heavy?[-w*.34,-w*.16,w*.31]:[-w*.29,w*.27])for(const y of [-h*.53,h*.38]){
      volume(rect(x-5,y,10,4),0,5,'#172123');
      details.push(line([x-3,y+2,3],[x+3,y+2,3],'#768985',1));
    }
    volume(shape(w,h),3,6,paint);
    const cabin=heavy&&type!=='bus'?rect(w*.16,-h*.38,w*.29,h*.76):rect(-w*(van?.36:type==='wagon'?.34:.23),-h*.35,w*(van?.65:type==='wagon'?.57:.43),h*.7);
    const roof=volume(cabin,9,heavy||van?9:type==='sports'?4:type==='coupe'?5:7,'#53727b');
    const [x,y]=cabin[0];volume(rect(x+3,y+2,cabin[1][0]-x-6,h*.7-4),roof,1,paint);
    details.push(line([cabin[1][0],-h*.29,roof-.8],[cabin[1][0],h*.29,roof-.8],'#a2c3c5',.9));
    if(type==='truck'||type==='fireEngine'){
      volume(rect(-w*.46,-h*.44,w*.58,h*.88),9,type==='truck'?15:10,type==='truck'?'#8c8977':paint);
      for(let i=0;i<4;i++)details.push(line([-w*.42+i*10,-h*.39,24],[-w*.42+i*10,h*.39,24],type==='truck'?'#b6b4a1':'#cbc9b6',.8));
      if(type==='fireEngine'){
        for(const y of [-7,7])details.push(line([-w*.4,y,23],[w*.08,y,23],'#d1cfba',2));
        for(let i=0;i<6;i++)details.push(line([-w*.4+i*7,-7,23],[-w*.4+i*7,7,23],'#d1cfba',1));
      }
    }
    if(type==='sports')details.push(line([-w*.39,0,10],[w*.36,0,10],'#d9c28a',2));
    if(type==='bus')for(const y of [-h*.37,h*.37])for(let i=0;i<5;i++)details.push(line([-w*.34+i*w*.13,y,14],[-w*.25+i*w*.13,y,14],'#8eb2b4',3.5));
    if(['police','armoredPolice','ambulance','fireEngine','taxi','nationalGuard'].includes(type)){
      const stripe=type==='police'||type==='armoredPolice'?'#31577a':type==='ambulance'?'#b4523d':'#dbc379';
      for(const y of [-h*.46,h*.46])details.push(line([-w*.39,y,8],[w*.38,y,8],stripe,2));
      if(type==='taxi')volume(rect(-5,-3,11,6),roof+1,3,'#ebc877');
      else if(type==='nationalGuard'){volume(rect(-10,-8,20,16),roof+1,4,'#4f654a');details.push(line([-3,0,roof+6],[22,0,roof+6],'#454f42',2));}
      else{
        volume(rect(-5,-7,10,14),roof+1,2,'#3e4d52');
        details.push(polygon(rect(-4,-6,8,5).map(p=>[...p,roof+3.5]),'#b85645'),polygon(rect(-4,1,8,5).map(p=>[...p,roof+3.5]),'#5c9bad'));
      }
      if(type==='ambulance'){
        details.push(polygon(rect(-w*.24,-2,12,4).map(p=>[...p,roof+2]),'#bb5540'),polygon(rect(-w*.18-2,-6,4,12).map(p=>[...p,roof+2]),'#bb5540'));
      }
    }
    for(const y of [-h*.32,h*.25]){
      volume(rect(w*.45,y,3,4),7,2,'#f0ddb2');volume(rect(-w*.49,y,3,4),7,1,'#ad4d3e');
      details.push(line([-3,y,9],[1,y,9],'#c2c7b9',.8));
    }
    details.push(line([w*.4,-h*.16,8],[w*.4,h*.16,8],'#17252b',2));
  }
  parts.sort((a,b)=>a.depth-b.depth||a.z-b.z);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="170" viewBox="0 0 220 170" role="img" aria-label="LOWTOWN ${xml(type)}"><title>LOWTOWN ${xml(type)}</title><metadata>Original LOWTOWN vector artwork; heading ${heading.toFixed(6)} radians</metadata>${shadow}${parts.map(p=>p.svg).join('')}<g>${details.join('')}</g></svg>`;
}
export const transportSVGUri=(type,heading=.1)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(createTransportSVG(type,heading));
