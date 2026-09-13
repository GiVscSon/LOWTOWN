import './mobile_controls_v2.css';
import './mobile_drive_bridge.js';

export function createMobileControlsV2(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML=`<div class="mobile-stick" aria-label="Виртуальный стик"><div class="mobile-stick-label">DRIVE</div><div class="mobile-stick-knob"></div></div><div class="mobile-actions"><button class="mobile-btn mobile-ai" data-mobile="ai" aria-label="Включить или выключить ИИ">AI: OFF</button><button class="mobile-btn" data-mobile="reset" aria-label="Сбросить машину">RESET</button></div><div class="mobile-pedals"><button class="mobile-btn mobile-handbrake" data-mobile="handbrake">HB</button></div>`;
  const stick=root.querySelector('.mobile-stick'),knob=root.querySelector('.mobile-stick-knob');
  const aiButton=root.querySelector('[data-mobile="ai"]'),resetButton=root.querySelector('[data-mobile="reset"]'),handbrakeButton=root.querySelector('[data-mobile="handbrake"]');
  const bridge=()=>window.__LOWTOWN_MOBILE_DRIVE__;
  const pressed=new Set();let pointerId=null,ai=false;
  const keyEvent=(type,key)=>window.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true,cancelable:true}));
  const setKey=(key,on)=>{if(on&&!pressed.has(key)){pressed.add(key);keyEvent('keydown',key)}else if(!on&&pressed.has(key)){pressed.delete(key);keyEvent('keyup',key)}};
  const setAnalog=(throttle=0,steer=0,brake=0,handbrake=false)=>bridge()?.setInput({throttle,steer,brake,handbrake});
  const releaseDrive=()=>{['w','s','a','d'].forEach(k=>setKey(k,false));setAnalog(0,0,0,false)};
  function updateStick(e){
    const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.min(r.width,r.height)*.38;
    let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy);if(len>max){const q=max/(len||1);dx*=q;dy*=q}
    knob.style.transform=`translate(${dx}px,${dy}px)`;
    const x=dx/max,y=dy/max,dead=.08;
    const sx=Math.abs(x)<dead?0:x,sy=Math.abs(y)<dead?0:y;
    setAnalog(-sy,sx,sy>0?Math.min(1,sy):0,false);
    setKey('a',x<-.45);setKey('d',x>.45);setKey('w',y<-.45);setKey('s',y>.45);
  }
  const clearStick=()=>{pointerId=null;knob.style.transform='translate(0,0)';releaseDrive()};
  stick.addEventListener('pointerdown',e=>{e.preventDefault();pointerId=e.pointerId;stick.setPointerCapture?.(e.pointerId);updateStick(e)},{passive:false});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===pointerId){e.preventDefault();updateStick(e)}},{passive:false});
  stick.addEventListener('pointerup',e=>{e.preventDefault();clearStick()},{passive:false});
  stick.addEventListener('pointercancel',clearStick);stick.addEventListener('lostpointercapture',clearStick);
  aiButton.addEventListener('pointerdown',e=>{e.preventDefault();ai=!ai;releaseDrive();bridge()?.toggleAI();keyEvent('keydown','i');keyEvent('keyup','i');aiButton.textContent=ai?'AI: ON':'AI: OFF';aiButton.classList.toggle('pressed',ai)},{passive:false});
  resetButton.addEventListener('pointerdown',e=>{e.preventDefault();releaseDrive();bridge()?.reset();keyEvent('keydown','r');keyEvent('keyup','r')},{passive:false});
  handbrakeButton.addEventListener('pointerdown',e=>{e.preventDefault();handbrakeButton.setPointerCapture?.(e.pointerId);setAnalog(0,0,1,true);setKey(' ',true);handbrakeButton.classList.add('pressed')},{passive:false});
  const releaseHB=e=>{e?.preventDefault();setAnalog(0,0,0,false);setKey(' ',false);handbrakeButton.classList.remove('pressed')};
  handbrakeButton.addEventListener('pointerup',releaseHB,{passive:false});handbrakeButton.addEventListener('pointercancel',releaseHB);handbrakeButton.addEventListener('lostpointercapture',releaseHB);
  root.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('blur',clearStick);document.addEventListener('visibilitychange',()=>{if(document.hidden){clearStick();releaseHB()}});
  return{root,destroy:()=>{clearStick();releaseHB();root.remove()}};
}

if(typeof window!=='undefined'){
  const install=()=>{
    if(!(matchMedia('(pointer:coarse)').matches||innerWidth<=900))return false;
    const wrap=document.querySelector('.game-wrap');if(!wrap)return false;
    document.querySelector('.lowtown-mobile-controls')?.remove();
    const controls=createMobileControlsV2();wrap.appendChild(controls.root);document.documentElement.classList.add('mobile-controls-v2-ready');return true;
  };
  if(!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('load',install,{once:true});
  }
}
