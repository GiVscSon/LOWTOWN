export function createMobileControlsV2(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-arrow-pad" aria-label="Управление машиной"><button class="mobile-arrow up" data-key="ArrowUp" aria-label="Вперёд">▲</button><button class="mobile-arrow left" data-key="ArrowLeft" aria-label="Влево">◀</button><button class="mobile-arrow down" data-key="ArrowDown" aria-label="Назад">▼</button><button class="mobile-arrow right" data-key="ArrowRight" aria-label="Вправо">▶</button></div><div class="mobile-actions"><button class="mobile-btn mobile-ai" data-mobile="ai">AI: OFF</button><button class="mobile-btn" data-mobile="reset">RESET</button></div>';
  const action=()=>window.__LOWTOWN_ACTIONS__;
  const held=new Set();
  let ai=false;
  const setKey=(key,pressed)=>{const normalized=String(key);if(pressed){if(held.has(normalized))return;held.add(normalized);window.dispatchEvent(new KeyboardEvent('keydown',{key:normalized,bubbles:true,cancelable:true}));}else{if(!held.has(normalized))return;held.delete(normalized);window.dispatchEvent(new KeyboardEvent('keyup',{key:normalized,bubbles:true,cancelable:true}));}};
  const releaseDrive=()=>{for(const key of [...held])setKey(key,false);};
  const actionKey=key=>window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  for(const button of root.querySelectorAll('.mobile-arrow')){const key=button.dataset.key;const press=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);setKey(key,true);button.classList.add('pressed');};const release=e=>{e.preventDefault();setKey(key,false);button.classList.remove('pressed');};button.addEventListener('pointerdown',press,{passive:false});button.addEventListener('pointerup',release,{passive:false});button.addEventListener('pointercancel',release,{passive:false});button.addEventListener('lostpointercapture',release,{passive:false});}
  root.querySelector('[data-mobile="ai"]').addEventListener('pointerdown',e=>{e.preventDefault();releaseDrive();const result=action()?.toggleAI?.();if(typeof result!=='boolean'){actionKey('i');ai=!ai;}else ai=!!result;e.currentTarget.textContent=ai?'AI: ON':'AI: OFF';e.currentTarget.classList.toggle('pressed',ai);},{passive:false});
  root.querySelector('[data-mobile="reset"]').addEventListener('pointerdown',e=>{e.preventDefault();releaseDrive();if(typeof action()?.reset==='function')action().reset();else actionKey('r');},{passive:false});
  root.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('blur',releaseDrive);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseDrive();});
  return{root,destroy:()=>{releaseDrive();root.remove();}};
}

if(typeof window!=='undefined'){
  const install=()=>{
    const coarse=window.matchMedia?.('(pointer:coarse)').matches;
    const touch=('ontouchstart' in window)||((navigator.maxTouchPoints||0)>0)||((navigator.msMaxTouchPoints||0)>0);
    const narrow=window.innerWidth<=1100;
    const mobile=coarse||touch||narrow;
    if(!mobile)return false;
    const wrap=document.querySelector('.game-wrap');
    if(!wrap)return false;
    if(wrap.querySelector('.lowtown-mobile-controls'))return true;
    const controls=createMobileControlsV2();
    wrap.appendChild(controls.root);
    document.documentElement.classList.add('mobile-controls-v2-ready');
    return true;
  };
  const boot=()=>{if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>80)clearInterval(timer);},100);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}

const styleId='lowtown-arrow-controls-style';
if(typeof document!=='undefined'&&!document.getElementById(styleId)){
  const style=document.createElement('style');style.id=styleId;style.textContent=`
    .lowtown-mobile-controls{display:block!important;position:absolute;inset:0;z-index:30;pointer-events:none;user-select:none;padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
    .mobile-arrow-pad{position:absolute;right:18px;bottom:18px;display:grid;grid-template-columns:64px 64px 64px;grid-template-rows:64px 64px;gap:8px;pointer-events:none}
    .mobile-arrow{width:64px;height:64px;padding:0;border:2px solid rgba(224,154,62,.72);border-radius:10px;background:rgba(12,13,16,.82);color:#e8b84a;font:bold 28px/1 Arial,sans-serif;box-shadow:0 7px 18px rgba(0,0,0,.45);pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
    .mobile-arrow.up{grid-column:2;grid-row:1}.mobile-arrow.left{grid-column:1;grid-row:2}.mobile-arrow.down{grid-column:2;grid-row:2}.mobile-arrow.right{grid-column:3;grid-row:2}
    .mobile-arrow.pressed{background:rgba(224,154,62,.34);border-color:#e09a3e;transform:translateY(1px)}
    .lowtown-mobile-controls .mobile-actions{position:absolute;right:18px;bottom:162px;display:flex;gap:8px;pointer-events:auto}
    .lowtown-mobile-controls .mobile-btn{min-width:66px;height:48px;padding:0 10px;border:1px solid #55585d;border-radius:7px;background:rgba(12,13,16,.86);color:#e8b84a;font:bold 12px monospace;letter-spacing:.08em;box-shadow:0 7px 16px rgba(0,0,0,.35);touch-action:none}
    @media(max-width:600px){.mobile-arrow-pad{right:12px;bottom:12px}.mobile-arrow{width:58px;height:58px}.mobile-arrow-pad{grid-template-columns:58px 58px 58px;grid-template-rows:58px 58px}.lowtown-mobile-controls .mobile-actions{right:12px;bottom:150px}}
  `;document.head.appendChild(style);
}
