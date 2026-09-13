const originalRotate=globalThis.CanvasRenderingContext2D?.prototype.rotate;

function worldToIsoScreenAngle(worldHeading){
  const x=.78*Math.cos(worldHeading)+.42*Math.sin(worldHeading);
  const y=-.78*Math.cos(worldHeading)+.42*Math.sin(worldHeading);
  return Math.atan2(y,x);
}

export function isoSpriteRotation(worldHeading){
  return worldToIsoScreenAngle(Number(worldHeading)||0);
}

if(originalRotate&&!globalThis.__LOWTOWN_ISO_ROTATION_PATCHED){
  globalThis.CanvasRenderingContext2D.prototype.rotate=function(angle){
    const worldHeading=-Number(angle||0);
    return originalRotate.call(this,worldToIsoScreenAngle(worldHeading));
  };
  globalThis.__LOWTOWN_ISO_ROTATION_PATCHED=true;
}
