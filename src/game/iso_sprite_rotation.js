export function isoSpriteRotation(worldHeading=0){
  const a=Number(worldHeading)||0;
  const x=.78*Math.cos(a)+.42*Math.sin(a);
  const y=-.78*Math.cos(a)+.42*Math.sin(a);
  return Math.atan2(y,x);
}
