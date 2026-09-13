export function createAIWorldModel({ cellSize = 160 } = {}) {
  const cells = new Map();
  let observations = 0;
  function key(x,y){ return `${Math.floor(x/cellSize)}:${Math.floor(y/cellSize)}`; }
  function observe(o={}) {
    if (!Number.isFinite(o.x)||!Number.isFinite(o.y)) return null;
    const k=key(o.x,o.y), c=cells.get(k)||{visits:0,risk:0,speed:0};
    c.visits++;
    c.speed=c.speed*.8+(Number.isFinite(o.speed)?o.speed:0)*.2;
    c.risk=c.risk*.8+(Number.isFinite(o.risk)?o.risk:0)*.2;
    cells.set(k,c); observations++;
    return c;
  }
  function score(x,y,{distance=0,riskPenalty=1}={}) {
    const c=cells.get(key(x,y));
    return 1/(1+(c?.visits||0)*.35)+distance*.001-(c?.risk||0)*riskPenalty;
  }
  function best(candidates=[],opts={}) {
    let out=null,bestScore=-Infinity;
    for(const c of candidates){const s=score(c.x,c.y,opts);if(s>bestScore){bestScore=s;out={...c,score:s};}}
    return out;
  }
  function status(){return {observations,cells:cells.size};}
  return {observe,score,best,status};
}
