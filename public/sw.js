const ROOT=new URL('./',self.location.href);
const CACHE_PREFIX='lowtown-pwa-'+ROOT.pathname.replace(/\W/g,'_')+'-';
const CACHE=CACHE_PREFIX+'__LOWTOWN_BUILD__';
const BUILD_ASSETS=/* BUILD_ASSETS */[];
const PRECACHE=[...new Set(['','index.html','manifest.webmanifest','pwa-icon.svg',...BUILD_ASSETS].map(path=>new URL(path,ROOT).href))];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(ROOT.pathname))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      if(!response.ok)throw new Error('Game document unavailable');
      // Keep the index belonging to this cache's complete, installed bundle.
      // A new document is cached atomically by the next worker installation.
      return response;
    }).catch(async()=>await caches.match(new URL('index.html',ROOT).href)||await caches.match(ROOT.href)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreVary:true})).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
