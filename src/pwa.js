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
  if(!('serviceWorker' in navigator))return null;
  try{
    const registration=await navigator.serviceWorker.register(base+'sw.js',{scope:base});
    window.__lowtownPwa={registered:true,scope:registration.scope,standalone:matchMedia('(display-mode: standalone)').matches};
    return registration;
  }catch(error){
    window.__lowtownPwa={registered:false,error:String(error?.message||error)};
    console.warn('LOWTOWN PWA registration failed',error);return null;
  }
}
if(document.readyState==='complete')register();
else window.addEventListener('load',register,{once:true});
