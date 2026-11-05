'use strict';
const VERSION="1.3.0-c8b86e744e31",FILES=["index.html", "pwa.js", "pwa.css", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"],PREFIX='moonlit-web-',CACHE=PREFIX+VERSION;
const base=new URL('./',self.location.href),urls=FILES.map(p=>new URL(p,base).href),allowed=new Set(urls);
async function tell(message){for(const client of await self.clients.matchAll({includeUncontrolled:true}))client.postMessage(message);}
let caching;
function fillCache(){
  return caching ||= (async()=>{
    const cache=await caches.open(CACHE);let done=0;
    try{
      for(let i=0;i<urls.length;i+=6){
        await Promise.all(urls.slice(i,i+6).map(async url=>{
          if(!await cache.match(url)){const response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok)throw Error('Download failed');await cache.put(url,response);}
          done++;
        }));
        await tell({type:'CACHE_PROGRESS',done,total:urls.length});
      }
      await tell({type:'CACHE_DONE'});
    }catch(error){await tell({type:'CACHE_FAILED'});throw error;}
  })().finally(()=>{caching=null;});
}
async function complete(){const cache=await caches.open(CACHE),keys=new Set((await cache.keys()).map(r=>r.url));return urls.every(url=>keys.has(url));}
self.addEventListener('install',event=>event.waitUntil(fillCache()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
  await tell({type:'CACHE_DONE'});
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
  if(event.data?.type==='CHECK_CACHE')event.waitUntil(complete().then(ready=>event.ports[0]?.postMessage({type:'CACHE_STATUS',ready})));
  if(event.data?.type==='REPAIR_CACHE')event.waitUntil(fillCache().catch(()=>{}));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==base.origin)return;
  if(event.request.mode==='navigate'&&(url.pathname===base.pathname||url.pathname===base.pathname+'index.html'))url.href=new URL('index.html',base).href;
  if(!allowed.has(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),response=await cache.match(url.href);
    if(!response)return fetch(event.request);
    return response;
  })());
});
