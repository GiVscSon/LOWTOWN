export function createMobileControlsV2(){
  const root=document.createElement('div');
  root.className='lowtown-mobile-controls';
  root.innerHTML=`<div class="mobile-stick" aria-label="Виртуальный стик"><div class="mobile-stick-label">DRIVE</div><div class="mobile-stick-knob"></div></div><div class="mobile-actions"><button class="mobile-btn mobile-ai" data-mobile="ai" aria-label="Включить или выключить ИИ">AI: OFF</button><button class="mobile-btn" data-mobile="reset" aria-label="Сбросить машину">RESET</button></div><div class="mobile-pedals"><button class="mobile-btn mobile-handbrake" data-mobile="handbrake">HB</button></div>`;
  const stick=root.querySelector('.mobile-stick');
  const knob=root.querySelector('.mobile-stick-knob');
  const aiButton=root.querySelector('[data-mobile="ai"]');
  const resetButton=root.querySelector('[data-mobile="reset"]');
  const handbrakeButton=root.querySelector('[data-mobile="handbrake"]');
  const pressed=new Set();
  let pointerId=null;
  let ai=false;

  const keyEvent=(type,key)=>window.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true,cancelable:true}));
  const setKey=(key,on)=>{if(on&&!pressed.has(key)){pressed.add(key);keyEvent('keydown',key)}else if(!on&&pressed.has(key)){pressed.delete(key);keyEvent('keyup',key)}};
  const releaseDrive=()=>['w','s','a','d'].forEach(k=>setKey(k,false));

  function updateStick(e){
    const r=stick.getBoundingClientRect();
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const max=r.width*.38;
    let dx=e.clientX-cx,dy=e.clientY-cy;
    const len=Math.hypot(dx,dy);
    if(len>max){const q=max/(len||1);dx*=q;dy*=q}
    knob.style.transform=`translate(${dx}px,${dy}px)`;
    const x=dx/max,y=dy/max;
    const dead=.16;
    setKey('a',x<-dead);setKey('d',x>dead);
    setKey('w',y<-dead);setKey('s',y>dead);
  }

  const clearStick=()=>{pointerId=null;knob.style.transform='translate(0,0)';releaseDrive()};
  stick.addEventListener('pointerdown',e=>{e.preventDefault();pointerId=e.pointerId;stick.setPointerCapture?.(e.pointerId);updateStick(e)},{passive:false});
  stick.addEventListener('pointermove',e=>{if(e.pointerId===pointerId){e.preventDefault();updateStick(e)}},{passive:false});
  stick.addEventListener('pointerup',clearStick,{passive:false});
  stick.addEventListener('pointercancel',clearStick,{passive:false});
  stick.addEventListener('lostpointercapture',clearStick,{passive:false});

  aiButton.addEventListener('pointerdown',e=>{
    e.preventDefault();
    ai=!ai;
    releaseDrive();
    keyEvent('keydown','i');
    keyEvent('keyup','i');
    aiButton.textContent=ai?'AI: ON':'AI: OFF';
    aiButton.classList.toggle('pressed',ai);
  },{passive:false});

  resetButton.addEventListener('pointerdown',e=>{
    e.preventDefault();
    releaseDrive();
    keyEvent('keydown','r');
    keyEvent('keyup','r');
  },{passive:false});

  handbrakeButton.addEventListener('pointerdown',e=>{
    e.preventDefault();
    handbrakeButton.setPointerCapture?.(e.pointerId);
    setKey(' ',true);
    handbrakeButton.classList.add('pressed');
  },{passive:false});
  const releaseHB=e=>{e.preventDefault();setKey(' ',false);handbrakeButton.classList.remove('pressed')};
  handbrakeButton.addEventListener('pointerup',releaseHB,{passive:false});
  handbrakeButton.addEventListener('pointercancel',releaseHB,{passive:false});
  handbrakeButton.addEventListener('lostpointercapture',releaseHB,{passive:false});

  root.addEventListener('contextmenu',e=>e.preventDefault());
  return {root,destroy:()=>{releaseDrive();setKey(' ',false);root.remove()}};
}

if(typeof window!=='undefined'){
  const install=()=>{
    const old=document.querySelector('.lowtown-mobile-controls');
    if(old)old.remove();
    const wrap=document.querySelector('.game-wrap');
    if(!wrap)return;
    const controls=createMobileControlsV2();
    wrap.appendChild(controls.root);
    document.documentElement.classList.add('mobile-controls-v2-ready');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
