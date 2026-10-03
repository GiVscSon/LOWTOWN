import './game_menu.css';

export function createGameMenu({onPause,save,getContext,getCamera,setCamera,getAudio,setVolume,setStation,openMap,openGarage,returnToStart,canTravel=()=>true}) {
  const root=document.getElementById('gameMenu'),trigger=document.getElementById('btnMenu');
  if(!root||!trigger)return null;
  let currentView='main',previousFocus=null;
  const titles={main:'Пауза',settings:'Настройки',controls:'Управление'};
  const focusView=()=>root.querySelector(currentView==='main'?'#menuResume':'#menuBack')?.focus();
  function refresh(){
    root.querySelector('#menuContext').textContent=getContext();
    const camera=getCamera();
    root.querySelector('#menuCameraSettings').hidden=!camera;
    root.querySelectorAll('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===camera)));
    const audio=getAudio(),percent=Math.round(audio.volume*100);
    root.querySelector('#menuVolume').value=percent;
    root.querySelector('#menuVolumeValue').textContent=percent+'%';
    root.querySelector('#menuRadio').value=String(audio.station);
    for(const id of ['menuMap','menuGarage','menuRestart']){
      const button=root.querySelector('#'+id);button.disabled=!canTravel();button.title=button.disabled?'Доступно после освобождения':'';
    }
  }
  function view(name){
    currentView=name;
    root.querySelectorAll('[data-menu-view]').forEach(section=>section.hidden=section.dataset.menuView!==name);
    root.querySelector('#menuTitle').textContent=titles[name];
    root.querySelector('#menuBack').hidden=name==='main';
    root.querySelector('#menuKeyHint').textContent=name==='main'?'Esc · Продолжить':'Esc · Назад';
    refresh();focusView();
  }
  function open(){
    if(!root.hidden)return;
    previousFocus=document.activeElement;
    save();onPause(true);
    root.hidden=false;document.body.classList.add('game-menu-open');
    trigger.setAttribute('aria-expanded','true');view('main');
  }
  function close(){
    if(root.hidden)return;
    root.hidden=true;document.body.classList.remove('game-menu-open');
    trigger.setAttribute('aria-expanded','false');onPause(false);
    (previousFocus?.isConnected&&previousFocus!==document.body?previousFocus:trigger).focus();
  }
  function escape(){if(root.hidden)open();else if(currentView!=='main')view('main');else close();}
  trigger.addEventListener('click',()=>root.hidden?open():close());
  root.querySelector('#menuClose').addEventListener('click',close);
  root.querySelector('#menuResume').addEventListener('click',close);
  root.querySelector('#menuBack').addEventListener('click',()=>view('main'));
  root.querySelectorAll('[data-menu-page]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.menuPage)));
  root.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{setCamera(button.dataset.camera);refresh();}));
  root.querySelector('#menuVolume').addEventListener('input',event=>{setVolume(Number(event.target.value)/100);refresh();});
  root.querySelector('#menuRadio').addEventListener('change',event=>{setStation(Number(event.target.value));refresh();});
  root.querySelector('#menuMap').addEventListener('click',()=>{close();openMap();});
  root.querySelector('#menuGarage').addEventListener('click',()=>{close();openGarage();});
  root.querySelector('#menuRestart').addEventListener('click',()=>{returnToStart();close();});
  root.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const buttons=[...root.querySelectorAll('button,input,select,[tabindex]')].filter(element=>!element.disabled&&element.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  return {open,close,escape,refresh,get isOpen(){return !root.hidden;}};
}
