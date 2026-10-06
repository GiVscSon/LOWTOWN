export const GRAPHICS_STORAGE_KEY='lowtown_graphics_settings_v1';
export const GRAPHICS_PRESETS={
  performance:{reflectionQuality:'low',distance:'near',reflections:false,shadows:true,rain:false,lighting:'simple',effects:'medium'},
  balanced:{reflectionQuality:'low',distance:'normal',reflections:true,shadows:true,rain:true,lighting:'simple',effects:'medium'},
  high:{reflectionQuality:'auto',distance:'far',reflections:true,shadows:true,rain:true,lighting:'detailed',effects:'high'}
};
export const DEFAULT_GRAPHICS={preset:'balanced',resolution:1,fps:60,adaptive:true,...GRAPHICS_PRESETS.balanced};
export function normalizeGraphics(value={},base=DEFAULT_GRAPHICS){
  const next={...base};
  if(['performance','balanced','high','custom'].includes(value.preset))next.preset=value.preset;
  if([.75,1,1.25,1.5,2].includes(Number(value.resolution)))next.resolution=Number(value.resolution);
  if([30,60,0].includes(Number(value.fps)))next.fps=Number(value.fps);
  if(['near','normal','far'].includes(value.distance))next.distance=value.distance;
  if(['auto','low','high'].includes(value.reflectionQuality))next.reflectionQuality=value.reflectionQuality;
  if(['simple','detailed'].includes(value.lighting))next.lighting=value.lighting;
  if(['off','medium','high'].includes(value.effects))next.effects=value.effects;
  for(const key of ['reflections','shadows','rain','adaptive'])if(typeof value[key]==='boolean')next[key]=value[key];
  return next;
}
export function loadGraphics(storage=globalThis.localStorage){
  try{return normalizeGraphics(JSON.parse(storage?.getItem(GRAPHICS_STORAGE_KEY))||{});}catch{return {...DEFAULT_GRAPHICS};}
}
export function changeGraphics(current,patch,storage=globalThis.localStorage){
  const preset=GRAPHICS_PRESETS[patch.preset];
  const next=normalizeGraphics(preset?{...preset,...patch}:{...patch,preset:'custom'},current);
  try{storage?.setItem(GRAPHICS_STORAGE_KEY,JSON.stringify(next));}catch{}
  return next;
}

// Resolution changes use hysteresis, keeping the HUD/text and saved choices
// intact while the world canvas adapts to measured frame pressure.
export function createAdaptiveResolution(software=false){
  let ceiling=2,samples=0,slow=0,fast=0,mean=0;
  return {reset(){ceiling=2;samples=slow=fast=0;mean=0;},sample(elapsed,graphics,paused=false){
    if(!graphics.adaptive||software||paused){samples=slow=fast=0;mean=0;return;}
    if(!Number.isFinite(elapsed)||elapsed<=0)return;
    const budget=1000/(graphics.fps||60);mean=samples?mean*.8+elapsed*.2:elapsed;samples++;
    if(samples<=8)return;
    slow=mean>budget*1.5?slow+1:0;fast=mean<budget*1.15?fast+1:0;
    if(slow>=8){ceiling=Math.max(.75,Math.min(ceiling,graphics.resolution)-.25);slow=fast=0;}
    else if(fast>=240){ceiling=Math.min(graphics.resolution,ceiling+.25);slow=fast=0;}
  },ratio(graphics){return graphics.adaptive?Math.min(graphics.resolution,software?.75:ceiling):graphics.resolution;}};
}

// Cache CSS size and DPR, not rounded canvas.width: WebGLRenderer floors it.
export function createViewportSizer(renderer,camera){
  let previous='',resizes=0;
  return {get resizes(){return resizes;},update(width,height,ratio){
    const stamp=`${width}:${height}:${ratio}`;if(stamp===previous)return false;
    renderer.setDrawingBufferSize(width,height,ratio);camera.aspect=width/height;camera.updateProjectionMatrix();
    previous=stamp;resizes++;return true;
  }};
}
