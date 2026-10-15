// Boot before AutoScript so asset/CSP errors have their own diagnostic.
// Readiness is explicit: never wait for the frame's full load event to sign.
(() => {
 let nativeFailure=null;
 const clientURL=new URL('./vendor/autofirma/autoscript.js',window.location.href);
 const isClient=value=>{try{const url=new URL(value,window.location.href);return url.origin===clientURL.origin&&url.pathname===clientURL.pathname;}catch{return false;}};
 const isLocalSocket=value=>{try{const url=new URL(value);return url.protocol==='wss:'&&url.hostname==='127.0.0.1';}catch{return false;}};
 const notify=error=>window.parent.postMessage({type:'pdf-autofirma-bridge',version:3,...(error?{error}:{ready:true})},window.location.origin);
 const fail=code=>{if(!bridge.ready&&!bridge.error){bridge.error=code;notify(code);}};
 const bridge=window.PDFNativeBridge={version:3,ready:false,error:null,
  sign({data,properties,keystore},success,failure){
   if(!bridge.ready||!['WINDOWS','APPLE'].includes(keystore)||typeof window.WebSocket!=='function')throw new Error('Desktop client not ready');
   const api=window.AutoScript;nativeFailure=failure;
   const done=callback=>(...args)=>{nativeFailure=null;callback(...args);};
   window.SupportDialog?.enableSupportDialog(false);
   api.setForceWSMode(false);api.setStickySignatory(false);
   api.setAppName('PDF');api.setMinimumClientVersion('1.9');
   api.cargarAppAfirma(undefined,keystore);
   api.sign(data,'SHA256withRSA','PAdES',properties,done(signature=>success(signature)),done(failure));
  }
 };
 window.addEventListener('error',event=>{
  if((event.target?.tagName==='SCRIPT'&&isClient(event.target.src))||isClient(event.filename))fail('AF_COMPONENT_ASSET');
 },true);
 window.addEventListener('securitypolicyviolation',event=>{
  const directive=event.effectiveDirective||event.violatedDirective||'';
  if(event.disposition==='report')return;
  // A CSP violation is not necessarily ours: injected inline scripts and
  // extensions can be blocked while the official client loads successfully.
  // Only a blocked required resource may fail this connector's preparation.
  if(directive.startsWith('script-src')&&isClient(event.blockedURI))fail('AF_COMPONENT_SCRIPT');
  else if(directive==='connect-src'&&isLocalSocket(event.blockedURI)&&nativeFailure){const callback=nativeFailure;nativeFailure=null;callback('PDF_LOCAL_BLOCKED','');}
 });
 const ready=()=>{
  if(bridge.error)return;
  if(!['sign','cargarAppAfirma','setForceWSMode','setMinimumClientVersion'].every(key=>typeof window.AutoScript?.[key]==='function')){fail('AF_COMPONENT_ASSET');return;}
  bridge.ready=true;notify();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
