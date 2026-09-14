const KEY='lowtown:prototype02';
const VERSION=1;
export function loadSave(storage=globalThis.localStorage){
  try { const raw=storage?.getItem(KEY); if(!raw)return null; const data=JSON.parse(raw); return data?.version===VERSION?data:null; } catch { return null; }
}
export function saveState(state,storage=globalThis.localStorage){
  const data={version:VERSION,completedJobs:Math.max(0,Number(state?.completedJobs)||0),money:Math.max(0,Number(state?.money)||0),timestamp:Date.now()};
  try { storage?.setItem(KEY,JSON.stringify(data)); } catch {}
  return data;
}
export function clearSave(storage=globalThis.localStorage){try{storage?.removeItem(KEY);}catch{}}
export const SAVE_KEY=KEY;
