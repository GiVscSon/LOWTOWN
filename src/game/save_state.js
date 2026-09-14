const KEY='lowtown:prototype02';
const VERSION=1;

function safeNumber(value,fallback=0){return Number.isFinite(Number(value))?Number(value):fallback;}

export function loadSave(storage=globalThis.localStorage){
  try {
    const raw=storage?.getItem(KEY);
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(data?.version!==VERSION)return null;
    return {version:VERSION,completedJobs:Math.max(0,Math.floor(safeNumber(data.completedJobs))),money:Math.max(0,safeNumber(data.money))};
  } catch { return null; }
}

export function saveState(state,storage=globalThis.localStorage){
  const data={version:VERSION,completedJobs:Math.max(0,Math.floor(safeNumber(state?.completedJobs))),money:Math.max(0,safeNumber(state?.money)),timestamp:Date.now()};
  try { storage?.setItem(KEY,JSON.stringify(data)); } catch {}
  return data;
}

export function clearSave(storage=globalThis.localStorage){try{storage?.removeItem(KEY);}catch{}}
export const SAVE_KEY=KEY;
