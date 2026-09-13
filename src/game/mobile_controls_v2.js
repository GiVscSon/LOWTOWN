import './mobile_controls_v2.css';
import './mobile_drive_bridge.js';

export function createMobileControlsV2(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML='<div class="mobile-stick" aria-label="Управление машиной"><div class="mobile-stick-label">DRIVE</div><div class="mobile-stick-knob"></div></div><div class="mobile-actions"><button class="mobile-btn mobile-ai" data-mobile="ai">AI: OFF</button><button class="mobile-btn" data-mobile="reset">RESET</button></div><div class="mobile-pedals"><button class="mobile-btn mobile-handbrake" data-mobile="handbrake">HB</button></div>';
  const stick=root.querySelector('.mobile-stick'),knob=root.querySelector('.mobile-stick-knob'),aiButton=root.querySelector('[data-mobile="ai"]'),resetButton=root.querySelector('[data-mobile="reset"]'),hbButton=root.querySelector('[data-mobile="handbrake"]');
  const bridge=()=>window.__LOWTOWN_MOBILE_DRIVE__;
  const action=()=>window.__LOWTOWN_ACTIONS__;
  let pointerId=null,ai=false;
  const analog=(throttle=0,steer=0,brake=0,handbrake=false)=>bridge()?.setInput({throttle,steer,brake,handbrake});
  const clear=()=>{pointerId=null;knob.style.transform='translate(-50%,-50%)';analog(0,0,0,false);};
  function move(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.min(r.width,r.height)*.34;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy);if(len>max){const q=max/(len||1);dx*=q;dy*=q;}knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;const x=dx/max,y=dy/max,dead=.1,sx=Math.abs(x)<dead?0:x,sy=Math.abs(y)<dead?0:y;analog(-sy,sx,sy>0?sy:0,false);}
  stick.addEventListener('pointerdown',e=>{e.preventDefault();pointerId=e.pointerId;stick.setPointerCapture?.(pointerId);move(e);},{passive:false});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===pointerId){e.preventDefault();move(e);}}, {passive:false});
  stick.addEventListener('pointerup',e=>{e.preventDefault();clear();},{passive:false});stick.addEventListener('pointercancel',clear);stick.addEventListener('lostpointercapture',clear);
  aiButton.addEventListener('pointerdown',e=>{e.preventDefault();ai=!ai;clear();action()?.toggleAI?.();aiButton.textContent=ai?'AI: ON':'AI: OFF';aiButton.classList.toggle('pressed',ai);},{passive:false});
  resetButton.addEventListener('pointerdown',e=>{e.preventDefault();clear();action()?.reset?.();},{passive:false});
  hbButton.addEventListener('pointerdown',e=>{e.preventDefault();hbButton.setPointerCapture?.(e.pointerId);analog(0,0,1,true);hbButton.classList.add('pressed');},{passive:false});
  const releaseHB=e=>{e?.preventDefault();analog(0,0,0,false);hbButton.classList.remove('pressed');};
  hbButton.addEventListener('pointerup',releaseHB,{passive:false});hbButton.addEventListener('pointercancel',releaseHB);hbButton.addEventListener('lostpointercapture',releaseHB);
  root.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();releaseHB();}});
  return{root,destroy:()=>{clear();releaseHB();root.remove();}};
}
if(typeof window!=='undefined'){
  const install=()=>{const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<=1100;if(!mobile)return false;const wrap=document.querySelector('.game-wrap');if(!wrap)return false;if(wrap.querySelector('.lowtown-mobile-controls'))return true;const controls=createMobileControlsV2();wrap.appendChild(controls.root);document.documentElement.classList.add('mobile-controls-v2-ready');return true;};
  const boot=()=>{if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>80)clearInterval(timer);},100);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
