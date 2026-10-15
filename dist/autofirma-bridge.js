// Boot before AutoScript so asset/CSP errors have their own diagnostic.
// Readiness is explicit: never wait for the frame's full load event to sign.
(() => {
 let nativeFailure=null;
 const notify=error=>window.parent.postMessage({type:'pdf-autofirma-bridge',version:2,...(error?{error}:{ready:true})},window.location.origin);
 const fail=code=>{if(!bridge.ready){bridge.error=code;notify(code);}};
 const bridge=window.PDFNativeBridge={version:2,ready:false,error:null,
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
  if(event.target?.tagName==='SCRIPT'||/autofirma-bridge|autoscript/.test(event.filename||''))fail('AF_COMPONENT_ASSET');
 },true);
 window.addEventListener('securitypolicyviolation',event=>{
  const directive=event.effectiveDirective||event.violatedDirective||'';
  if(directive.startsWith('script-src'))fail('AF_COMPONENT_BLOCKED');
  else if(directive==='connect-src'&&nativeFailure){const callback=nativeFailure;nativeFailure=null;callback('PDF_LOCAL_BLOCKED','');}
 });
 const ready=()=>{
  if(bridge.error)return;
  if(!['sign','cargarAppAfirma','setForceWSMode','setMinimumClientVersion'].every(key=>typeof window.AutoScript?.[key]==='function')){fail('AF_COMPONENT_ASSET');return;}
  bridge.ready=true;notify();
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
