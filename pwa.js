'use strict';
(() => {
  const box=document.createElement('details');box.className='offline-guide';
  box.innerHTML='<summary>手机体验 · <span id="offlineStatus" role="status">正在准备离线内容…</span></summary><div><p>iPhone：用 Safari 打开此网址，点“分享”→“添加到主屏幕”。以后从桌面图标进入。</p><p>等状态显示“可离线使用”后，题库、图片、280 个单词及 8 份听力录音已保存在此浏览器。首次下载约 14 MB，请保持页面打开。</p><p>微信内请先选择“在 Safari 中打开”。进度各自保存；清理网站数据会清除进度和下载内容，学习背包可以导出备份。</p><button id="retryOffline" hidden>重新保存离线内容</button><button id="updateOffline" hidden>结束本轮并更新</button></div>';
  document.querySelector('footer').before(box);
  const status=box.querySelector('#offlineStatus'),retry=box.querySelector('#retryOffline'),update=box.querySelector('#updateOffline');
  let registration,reloading=false;
  const failed=()=>{status.textContent='离线内容未保存完整，请联网重试';retry.hidden=false;};
  async function check(){
    if(!registration?.active)return;
    const channel=new MessageChannel();
    channel.port1.onmessage=({data})=>{if(data?.type!=='CACHE_STATUS')return;status.textContent=data.ready?'可离线使用':'内容不完整，请联网重新保存';retry.hidden=data.ready;channel.port1.close();};
    registration.active.postMessage({type:'CHECK_CACHE'},[channel.port2]);
  }
  function watch(worker){
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='redundant')failed();
      if(worker.state==='installed'&&navigator.serviceWorker.controller){status.textContent='新版已下载，完成本轮后可更新';update.hidden=false;}
      if(worker.state==='activated')check();
    });
  }
  async function register(){
    retry.hidden=true;
    try{
      registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
      registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);
      if(registration.waiting){status.textContent='新版已下载，完成本轮后可更新';update.hidden=false;}
      else if(registration.active)await check();
    }catch(_){failed();}
  }
  if(!('serviceWorker' in navigator)||!window.isSecureContext){status.textContent='请通过 HTTPS 网址在 Safari 打开';return;}
  navigator.serviceWorker.addEventListener('message',({data})=>{
    if(data?.type==='CACHE_PROGRESS')status.textContent=`正在保存离线内容 ${data.done} / ${data.total}`;
    if(data?.type==='CACHE_FAILED')failed();
    if(data?.type==='CACHE_DONE')check();
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();else check();});
  retry.onclick=async()=>{
    status.textContent='正在重新保存离线内容…';retry.hidden=true;
    if(registration?.active)registration.active.postMessage({type:'REPAIR_CACHE'});
    else register();
  };
  update.onclick=()=>{if(registration?.waiting){reloading=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}};
  window.addEventListener('online',check);
  register();
})();
