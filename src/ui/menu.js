
export function createGameMenu({listen=(target,...args)=>target?.addEventListener(...args),onPause,save,getContext,getCamera,setCamera,getAudio,setVolume,setStation,setEffectsVolume=()=>{},setAmbienceVolume=()=>{},getClimate=()=>null,setClimate=()=>{},openMap,openGarage,returnToStart,canTravel=()=>true,getGraphics=()=>null,setGraphics=()=>{}}) {
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
    const graphics=getGraphics();root.querySelector('#menuGraphicsSettings').hidden=!graphics;
    if(graphics)root.querySelectorAll('[data-graphics]').forEach(input=>{
      if(input.type==='checkbox')input.checked=graphics[input.dataset.graphics];
      else input.value=String(graphics[input.dataset.graphics]);
    });
    const audio=getAudio(),percent=Math.round(audio.volume*100);
    root.querySelector('#menuVolume').value=percent;
    root.querySelector('#menuVolumeValue').textContent=percent+'%';
    root.querySelector('#menuRadio').value=String(audio.station);
    for(const [id,key] of [['menuEffectsVolume','effectsVolume'],['menuAmbienceVolume','ambienceVolume']]){
      const input=root.querySelector('#'+id);if(input){input.value=Math.round((audio[key]??1)*100);root.querySelector('#'+id+'Value').textContent=input.value+'%';}
    }
    const climate=getClimate();if(climate){root.querySelector('#menuTimeMode').value=climate.timeMode;root.querySelector('#menuDayLength').value=climate.cycleMinutes;root.querySelector('#menuWeatherMode').value=climate.weatherMode;}
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
  listen(trigger,'click',()=>root.hidden?open():close());
  listen(root.querySelector('#menuClose'),'click',close);
  listen(root.querySelector('#menuResume'),'click',close);
  listen(root.querySelector('#menuBack'),'click',()=>view('main'));
  root.querySelectorAll('[data-menu-page]').forEach(button=>listen(button,'click',()=>view(button.dataset.menuPage)));
  root.querySelectorAll('[data-camera]').forEach(button=>listen(button,'click',()=>{setCamera(button.dataset.camera);refresh();}));
  root.querySelectorAll('[data-graphics]').forEach(input=>listen(input,'change',()=>{
    const key=input.dataset.graphics,value=input.type==='checkbox'?input.checked:['resolution','fps'].includes(key)?Number(input.value):input.value;
    setGraphics({[key]:value});refresh();
  }));
  listen(root.querySelector('#menuVolume'),'input',event=>{setVolume(Number(event.target.value)/100);refresh();});
  listen(root.querySelector('#menuRadio'),'change',event=>{setStation(Number(event.target.value));refresh();});
  listen(root.querySelector('#menuEffectsVolume'),'input',event=>{setEffectsVolume(Number(event.target.value)/100);refresh();});
  listen(root.querySelector('#menuAmbienceVolume'),'input',event=>{setAmbienceVolume(Number(event.target.value)/100);refresh();});
  for(const [id,key] of [['menuTimeMode','timeMode'],['menuDayLength','cycleMinutes'],['menuWeatherMode','weatherMode']])listen(root.querySelector('#'+id),'change',event=>{setClimate({[key]:key==='cycleMinutes'?Number(event.target.value):event.target.value});refresh();});
  listen(root.querySelector('#menuMap'),'click',()=>{close();openMap();});
  listen(root.querySelector('#menuGarage'),'click',()=>{close();openGarage();});
  listen(root.querySelector('#menuRestart'),'click',()=>{returnToStart();close();});
  listen(root,'keydown',event=>{
    if(event.key!=='Tab')return;
    const buttons=[...root.querySelectorAll('button,input,select,[tabindex]')].filter(element=>!element.disabled&&element.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  return {open,close,escape,refresh,get isOpen(){return !root.hidden;}};
}
