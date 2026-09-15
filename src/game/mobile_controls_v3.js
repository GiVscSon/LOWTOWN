export function createMobileControlsV3(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-drive-controls"><button class="mobile-arrow left">◀</button><button class="mobile-gas">GAS</button><button class="mobile-arrow right">▶</button><button class="mobile-brake">BRAKE</button><button class="mobile-arrow back">▼</button></div><div class="mobile-actions"><button class="mobile-btn mobile-ai">AI: OFF</button><button class="mobile-btn mobile-reset">RESET</button></div>';
  const input={throttle:0,steer:0,brake:0,handbrake:false};let timer=0,cruise=false;
  const step=()=>{const p=window.__LOWTOWN_TRANSPORT?.player;if(p?.step)p.step(1/60,input);};
  const start=()=>{if(!timer)timer=setInterval(step,16);step();};
  const stop=()=>{if(timer){clearInterval(timer);timer=0;}if(!cruise)input.throttle=0;input.steer=0;input.brake=0;};
  const gas=root.querySelector('.mobile-gas');gas.addEventListener('click',()=>{cruise=!cruise;input.throttle=cruise?1:0;gas.textContent=cruise?'GAS ON':'GAS';gas.classList.toggle('pressed',cruise);if(cruise)start();else stop();});
  const brake=root.querySelector('.mobile-brake');const bp=e=>{e.preventDefault();input.throttle=0;input.brake=1;brake.classList.add('pressed');start();};const br=e=>{e.preventDefault();brake.classList.remove('pressed');input.brake=0;if(!cruise)stop();};brake.addEventListener('pointerdown',bp);brake.addEventListener('pointerup',br);brake.addEventListener('pointercancel',br);brake.addEventListener('lostpointercapture',br);
  for(const b of root.querySelectorAll('.mobile-arrow')){const press=e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);b.classList.add('pressed');input.steer=b.classList.contains('left')?-1:b.classList.contains('right')?1:0; if(b.classList.contains('back')){input.throttle=-1;input.brake=1;}start();};const release=e=>{e.preventDefault();b.classList.remove('pressed');input.steer=0;if(b.classList.contains('back')){input.throttle=cruise?1:0;input.brake=0;}if(!cruise&&!input.brake)stop();};b.addEventListener('pointerdown',press);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);}
  root.querySelector('.mobile-reset').addEventListener('click',()=>{cruise=false;gas.textContent='GAS';gas.classList.remove('pressed');stop();window.__LOWTOWN_TRANSPORT?.player?.resetActuators?.();});
  root.querySelector('.mobile-ai').addEventListener('click',()=>{const ai=window.__LOWTOWN_AI;if(!ai)return;ai.state.enabled=!ai.state.enabled;root.querySelector('.mobile-ai').textContent=ai.state.enabled?'AI: ON':'AI: OFF';if(ai.state.enabled)ai.start?.(window.__LOWTOWN_TRANSPORT?.player?.state);});
  root.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('blur',()=>{cruise=false;gas.textContent='GAS';stop();});
  return{root,destroy:()=>{stop();root.remove();}};
}
if(typeof window!=='undefined'){
  const install=()=>{const coarse=window.matchMedia?.('(pointer:coarse)').matches,touch=('ontouchstart' in window)||navigator.maxTouchPoints>0,narrow=innerWidth<=1100;if(!(coarse||touch||narrow))return false;const wrap=document.querySelector('.game-wrap');if(!wrap||wrap.querySelector('.lowtown-mobile-controls'))return false;const c=createMobileControlsV3();wrap.appendChild(c.root);return true;};
  const boot=()=>{if(install())return;let n=0;const t=setInterval(()=>{if(install()||++n>80)clearInterval(t);},100);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
