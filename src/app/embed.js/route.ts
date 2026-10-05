export const dynamic = "force-static";

/** Script d'intégration : <script src="https://hakili.mandendigital.com/embed.js" data-key="wk_xxx"></script> */
export async function GET() {
  const js = `(function(){
  var s=document.currentScript||(function(){var a=document.getElementsByTagName('script');return a[a.length-1];})();
  var key=s.getAttribute('data-key'); if(!key) return;
  var base=(s.getAttribute('data-host')||s.src.replace(/\\/embed\\.js.*$/,''));
  var color=s.getAttribute('data-color')||'#1E6FE8';
  var pos=s.getAttribute('data-position')||'right';
  var open=false;
  var btn=document.createElement('button');
  btn.setAttribute('aria-label','Ouvrir l\\'assistant');
  btn.style.cssText='position:fixed;bottom:20px;'+pos+':20px;z-index:2147483000;width:56px;height:56px;border-radius:9999px;border:0;cursor:pointer;background:'+color+';box-shadow:0 8px 24px rgba(11,27,58,.28);display:flex;align-items:center;justify-content:center;transition:transform .15s';
  btn.innerHTML='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>';
  var frame=document.createElement('iframe');
  frame.title='Assistant HAKILI';
  frame.src=base+'/widget/'+encodeURIComponent(key);
  frame.style.cssText='position:fixed;bottom:88px;'+pos+':20px;z-index:2147483000;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 110px);border:0;border-radius:16px;box-shadow:0 16px 48px rgba(11,27,58,.32);display:none;background:#fff';
  frame.setAttribute('allow','clipboard-write');
  btn.onclick=function(){open=!open;frame.style.display=open?'block':'none';btn.style.transform=open?'rotate(90deg)':'none';};
  document.body.appendChild(btn);document.body.appendChild(frame);
})();`;
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
}
