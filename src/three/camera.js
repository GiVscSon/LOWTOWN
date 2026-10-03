export const CAMERA_PRESETS=['near','normal','overview'];
export const CAMERA_LABELS={near:'Ближе',normal:'Обычный',overview:'Обзор'};
export const CAMERA_STORAGE_KEY='lowtown_camera_preset';

export function cameraFraming(preset,foot,mobile){
  const index=CAMERA_PRESETS.indexOf(preset),mode=index<0?1:index;
  const distance=(foot?[225,340,680]:[240,480,680])[mode]*(mobile?.82:1);
  const height=(foot?[235,360,820]:[265,540,820])[mode]*(mobile?.82:1);
  return {distance,height,sideOffset:foot?0:[100,170,260][mode]*(mobile?.82:1)};
}
