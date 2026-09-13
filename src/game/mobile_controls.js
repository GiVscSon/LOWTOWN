export function createMobileControls({onInput=()=>{}}={}){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-stick" aria-label="Руль"><div class="mobile-stick-knob"></div></div><div class="mobile-pedals"><button data-mobile="gas" aria-label="Газ">GAS</button><button data-mobile="brake" aria-label="Тормоз">BRAKE</button><button data-mobile="handbrake" aria-label="Ручник">HB</button></div><div class="mobile-actions"><button data-mobile="ai">AI</button><button data-mobile="reset">R</button></div>';
  const active={throttle:0,brake:0,steer:0,handbrake:false};
  const emit=()=>onInput({...active});
  const button=(el,type,value)=>{
    const down=e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);active[type]=value;el.classList.add('pressed');emit()};
    const up=e=>{e.preventDefault();active[type]=type==='handbrake'?false:0;el.classList.remove('pressed');emit()};
    el.addEventListener('pointerdown',down,{passive:false});el.addEventListener('pointerup',up,{passive:false});el.addEventListener('pointercancel',up,{passive:false});el.addEventListener('lostpointercapture',up,{passive:false});
  };
  button(root.querySelector('[data-mobile="gas"]'),'throttle',1);
  button(root.querySelector('[data-mobile="brake"]'),'brake',1);
  button(root.querySelector('[data-mobile="handbrake"]'),'handbrake',true);
  const emitKey=(key)=>{window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));setTimeout(()=>window.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true,cancelable:true})),45)};
  root.querySelector('[data-mobile="ai"]').addEventListener('pointerdown',e=>{e.preventDefault();emitKey('i')});
  root.querySelector('[data-mobile="reset"]').addEventListener('pointerdown',e=>{e.preventDefault();emitKey('r')});
  const stick=root.querySelector('.mobile-stick'),knob=root.querySelector('.mobile-stick-knob');
  let pointer=null;
  const update=(e)=>{
    const r=stick.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),limit=r.width*.36;
    const x=Math.max(-1,Math.min(1,dx/limit)),y=Math.max(-1,Math.min(1,dy/limit));
    knob.style.transform=`translate(${x*limit*.72}px,${y*limit*.72}px)`;
    active.steer=Math.abs(x)<.16?0:x;
    if(y<-.28)active.throttle=Math.max(active.throttle,-y);else if(!root.querySelector('[data-mobile="gas"].pressed'))active.throttle=0;
    if(y>.28)active.brake=Math.max(active.brake,y);else if(!root.querySelector('[data-mobile="brake"].pressed'))active.brake=0;
    emit();
  };
  const clear=()=>{pointer=null;knob.style.transform='translate(0,0)';active.steer=0;if(!root.querySelector('[data-mobile="gas"].pressed))active.throttle=0;if(!root.querySelector('[data-mobile="brake"].pressed'))active.brake=0;emit()};
  stick.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;stick.setPointerCapture?.(e.pointerId);update(e)},{passive:false});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)update(e)},{passive:false});
  stick.addEventListener('pointerup',clear,{passive:false});stick.addEventListener('pointercancel',clear,{passive:false});stick.addEventListener('lostpointercapture',clear,{passive:false});
  return {root,state:()=>({...active}),destroy:()=>root.remove()};
}

// Auto-install for the current LOWTOWN canvas. Keyboard events keep this compatible with the existing game input path.
if(typeof window!=='undefined'){
  const install=()=>{
    if(!document.querySelector('.game-wrap')||document.querySelector('.lowtown-mobile-controls'))return;
    const gameWrap=document.querySelector('.game-wrap');
    const controls=createMobileControls({onInput:()=>{}});
    gameWrap.appendChild(controls.root);
    document.documentElement.classList.add('mobile-controls-ready');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
