export function createMobileControls({onInput=()=>{}}={}){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-steer"><button data-steer="-1">◀</button><button data-steer="1">▶</button></div><div class="mobile-pedals"><button data-gas="1">GAS</button><button data-brake="1">BRAKE</button><button data-handbrake="1">HB</button></div>';
  const active={throttle:0,brake:0,steer:0,handbrake:false};
  const emit=()=>onInput({...active});
  const bind=(el,type,value)=>{
    const down=e=>{e.preventDefault();active[type]=value;emit()};
    const up=e=>{e.preventDefault();active[type]=type==='handbrake'?false:0;emit()};
    el.addEventListener('pointerdown',down,{passive:false});
    el.addEventListener('pointerup',up,{passive:false});
    el.addEventListener('pointercancel',up,{passive:false});
    el.addEventListener('pointerleave',up,{passive:false});
  };
  root.querySelectorAll('[data-steer]').forEach(e=>bind(e,'steer',Number(e.dataset.steer)));
  root.querySelectorAll('[data-gas]').forEach(e=>bind(e,'throttle',1));
  root.querySelectorAll('[data-brake]').forEach(e=>bind(e,'brake',1));
  root.querySelectorAll('[data-handbrake]').forEach(e=>bind(e,'handbrake',true));
  return {root,state:()=>({...active}),destroy:()=>root.remove()};
}
