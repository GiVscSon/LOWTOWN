export function createMobileControlsV2(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-arrow-pad" aria-label="Управление машиной"><button class="mobile-arrow up" data-key="ArrowUp" aria-label="Вперёд">▲</button><button class="mobile-arrow left" data-key="ArrowLeft" aria-label="Влево">◀</button><button class="mobile-arrow down" data-key="ArrowDown" aria-label="Назад">▼</button><button class="mobile-arrow right" data-key="ArrowRight" aria-label="Вправо">▶</button></div><div class="mobile-actions"><button class="mobile-btn mobile-ai" data-mobile="ai">AI: OFF</button><button class="mobile-btn" data-mobile="reset">RESET</button></div>';
  const action=()=>window.__LOWTOWN_ACTIONS__;
  const held=new Set();
  let ai=false;

  const setKey=(key,pressed)=>{
    const normalized=String(key);
    if(pressed){
      if(held.has(normalized))return;
      held.add(normalized);
      window.dispatchEvent(new KeyboardEvent('keydown',{key:normalized,bubbles:true,cancelable:true}));
    }else{
      if(!held.has(normalized))return;
      held.delete(normalized);
      window.dispatchEvent(new KeyboardEvent('keyup',{key:normalized,bubbles:true,cancelable:true}));
    }
  };

  const releaseDrive=()=>{
    for(const key of [...held])setKey(key,false);
  };

  for(const button of root.querySelectorAll('.mobile-arrow')){
    const key=button.dataset.key;
    const press=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);setKey(key,true);button.classList.add('pressed');};
    const release=e=>{e.preventDefault();setKey(key,false);button.classList.remove('pressed');};
    button.addEventListener('pointerdown',press,{passive:false});
    button.addEventListener('pointerup',release,{passive:false});
    button.addEventListener('pointercancel',release,{passive:false});
    button.addEventListener('lostpointercapture',release,{passive:false});
  }

  root.querySelector('[data-mobile="ai"]').addEventListener('pointerdown',e=>{
    e.preventDefault();
    releaseDrive();
    ai=!ai;
    action()?.toggleAI?.();
    e.currentTarget.textContent=ai?'AI: ON':'AI: OFF';
    e.currentTarget.classList.toggle('pressed',ai);
  },{passive:false});

  root.querySelector('[data-mobile="reset"]').addEventListener('pointerdown',e=>{
    e.preventDefault();
    releaseDrive();
    action()?.reset?.();
  },{passive:false});

  root.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('blur',releaseDrive);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseDrive();});

  return{root,destroy:()=>{releaseDrive();root.remove();}};
}

if(typeof window!=='undefined'){
  const install=()=>{
    const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<=1100;
    if(!mobile)return false;
    const wrap=document.querySelector('.game-wrap');
    if(!wrap)return false;
    if(wrap.querySelector('.lowtown-mobile-controls'))return true;
    const controls=createMobileControlsV2();
    wrap.appendChild(controls.root);
    document.documentElement.classList.add('mobile-controls-v2-ready');
    return true;
  };
  const boot=()=>{
    if(install())return;
    let tries=0;
    const timer=setInterval(()=>{if(install()||++tries>80)clearInterval(timer);},100);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
