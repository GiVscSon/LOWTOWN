const modes=['cycle','day','night'];
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function daylightAt(hour){
  const solar=Math.sin((hour-6)*Math.PI/12);
  const daylight=smooth((solar+.12)/.45);
  return {hour,solar,daylight,lamps:1-daylight*.94,twilight:(1-Math.abs(daylight*2-1))*(solar<.35?1:0)};
}
export function createDayCycle(storage){
  let saved={};try{saved=JSON.parse(storage?.getItem('lowtown_world_cycle'))||{};}catch{}
  const clock={mode:modes.includes(saved.timeMode)?saved.timeMode:'cycle',hour:Number.isFinite(saved.hour)?((saved.hour%24)+24)%24:22,minutes:[10,20,30].includes(saved.cycleMinutes)?saved.cycleMinutes:20};
  clock.setMode=mode=>{if(!modes.includes(mode))return;clock.mode=mode;if(mode==='day')clock.hour=12;if(mode==='night')clock.hour=22;};
  clock.setMinutes=minutes=>{if([10,20,30].includes(minutes))clock.minutes=minutes;};
  clock.step=dt=>{if(clock.mode==='cycle')clock.hour=(clock.hour+dt*24/(clock.minutes*60))%24;return daylightAt(clock.hour);};
  clock.setMode(clock.mode);
  return clock;
}
