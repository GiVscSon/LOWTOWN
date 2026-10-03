const button=document.getElementById('btnInstallPwa');
let deferredPrompt=null;
const base=import.meta.env.BASE_URL||'./';

function setInstallVisible(visible){if(button)button.style.display=visible?'flex':'none';}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;setInstallVisible(true);});
button?.addEventListener('click',async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  try{await deferredPrompt.userChoice;}finally{deferredPrompt=null;setInstallVisible(false);}
});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;setInstallVisible(false);});

async function register(){
  if(import.meta.env.DEV)return null;
  if(!('serviceWorker' in navigator))return null;
  try{
    const registration=await navigator.serviceWorker.register(base+'sw.js',{scope:base});
    let requestedUpdate=false;
    const offerUpdate=()=>{
      if(!registration.waiting||!navigator.serviceWorker.controller)return;
      const update=document.createElement('button');update.className='btn-top';update.textContent='Обновить';update.title='Установить обновление LOWTOWN';update.id='btnUpdatePwa';
      if(document.getElementById(update.id))return;
      update.addEventListener('click',()=>{requestedUpdate=true;window.dispatchEvent(new Event('lowtown-before-update'));registration.waiting?.postMessage({type:'SKIP_WAITING'});});
      button?.parentElement?.appendChild(update);
    };
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requestedUpdate)location.reload();});
    offerUpdate();registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();});
    });
    window.__lowtownPwa={registered:true,scope:registration.scope,standalone:matchMedia('(display-mode: standalone)').matches};
    return registration;
  }catch(error){
    window.__lowtownPwa={registered:false,error:String(error?.message||error)};
    console.warn('LOWTOWN PWA registration failed',error);return null;
  }
}
if(document.readyState==='complete')register();
else window.addEventListener('load',register,{once:true});
