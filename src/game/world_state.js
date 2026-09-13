const KEY='lowtown.world.v1';

const DEFAULT_STATE=Object.freeze({
  cash:0,
  completedJobs:0,
  wanted:0,
  heat:0,
  district:'DOWNTOWN',
  discovered:[],
  garage:{vehicle:'sedan',damage:0}
});

function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

function clean(raw={}){
  const s={...DEFAULT_STATE,...raw};
  s.cash=Math.max(0,Number(s.cash)||0);
  s.completedJobs=Math.max(0,Number(s.completedJobs)||0);
  s.wanted=Math.round(clamp(Number(s.wanted)||0,0,5));
  s.heat=clamp(Number(s.heat)||0,0,100);
  s.district=typeof s.district==='string'?s.district:'DOWNTOWN';
  s.discovered=Array.isArray(s.discovered)?[...new Set(s.discovered.filter(x=>typeof x==='string'))]:[];
  s.garage={...DEFAULT_STATE.garage,...(s.garage&&typeof s.garage==='object'?s.garage:{})};
  s.garage.damage=clamp(Number(s.garage.damage)||0,0,100);
  return s;
}

export function createWorldState(storage=globalThis.localStorage){
  let state=clean();
  try{if(storage){const raw=storage.getItem(KEY);if(raw)state=clean(JSON.parse(raw));}}catch{}

  const save=()=>{try{storage?.setItem(KEY,JSON.stringify(state));}catch{}};
  const patch=(next)=>{state=clean({...state,...next});save();return snapshot();};
  const addCash=(amount)=>patch({cash:state.cash+(Number(amount)||0)});
  const completeJob=(reward=0)=>patch({cash:state.cash+Math.max(0,Number(reward)||0),completedJobs:state.completedJobs+1,heat:Math.max(0,state.heat-8)});
  const addHeat=(amount=0)=>{const heat=clamp(state.heat+(Number(amount)||0),0,100);return patch({heat,wanted:heat<12?0:heat<30?1:heat<50?2:heat<70?3:heat<88?4:5});};
  const cool=(seconds=1)=>patch({heat:Math.max(0,state.heat-Math.max(0,Number(seconds)||0)*1.2)});
  const discover=(district)=>{if(typeof district!=='string'||state.discovered.includes(district))return snapshot();return patch({discovered:[...state.discovered,district]});};
  const reset=()=>{state=clean();save();return snapshot();};
  const snapshot=()=>JSON.parse(JSON.stringify(state));
  return Object.freeze({snapshot,patch,addCash,completeJob,addHeat,cool,discover,reset});
}

export const WORLD_STATE_STORAGE_KEY=KEY;
