export const GRAPHICS_STORAGE_KEY='lowtown_graphics_settings_v1';
export const GRAPHICS_PRESETS={
  performance:{distance:'near',reflections:false,shadows:true,rain:false,lighting:'simple',effects:'medium'},
  balanced:{distance:'normal',reflections:true,shadows:true,rain:true,lighting:'simple',effects:'medium'},
  high:{distance:'far',reflections:true,shadows:true,rain:true,lighting:'detailed',effects:'high'}
};
export const DEFAULT_GRAPHICS={preset:'high',resolution:1.5,fps:60,...GRAPHICS_PRESETS.high};
export function normalizeGraphics(value={},base=DEFAULT_GRAPHICS){
  const next={...base};
  if(['performance','balanced','high','custom'].includes(value.preset))next.preset=value.preset;
  if([.75,1,1.25,1.5,2].includes(Number(value.resolution)))next.resolution=Number(value.resolution);
  if([30,60,0].includes(Number(value.fps)))next.fps=Number(value.fps);
  if(['near','normal','far'].includes(value.distance))next.distance=value.distance;
  if(['simple','detailed'].includes(value.lighting))next.lighting=value.lighting;
  if(['off','medium','high'].includes(value.effects))next.effects=value.effects;
  for(const key of ['reflections','shadows','rain'])if(typeof value[key]==='boolean')next[key]=value[key];
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

// Cache CSS size and DPR, not rounded canvas.width: WebGLRenderer floors it.
export function createViewportSizer(renderer,camera){
  let previous='',resizes=0;
  return {get resizes(){return resizes;},update(width,height,ratio){
    const stamp=`${width}:${height}:${ratio}`;if(stamp===previous)return false;
    renderer.setDrawingBufferSize(width,height,ratio);camera.aspect=width/height;camera.updateProjectionMatrix();
    previous=stamp;resizes++;return true;
  }};
}
