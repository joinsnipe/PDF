import {PDFDocument,PDFDict,PDFName,PDFArray,PDFNumber} from './vendor/pdf-lib.js';

const MAX_INPUT=100*1024*1024,MAX_OUTPUT=110*1024*1024;
const fault=(code,message)=>Object.assign(new Error(message),{code});

export function autofirmaPlatform(nav=globalThis.navigator){
 const ua=nav?.userAgent||'',platform=nav?.userAgentData?.platform||nav?.platform||'';
 if(/Android|iPhone|iPad|iPod/i.test(ua)||(/Mac/i.test(platform)&&nav?.maxTouchPoints>1))return null;
 if(/Win/i.test(platform)||/Windows/i.test(ua))return 'WINDOWS';
 if(/Mac/i.test(platform)||/Macintosh/i.test(ua))return 'APPLE';
 return null;
}

// Java Properties are ASCII escaped: a custom reason cannot inject extra options.
export function autofirmaProperties({reason='',visible=true}={}){
 reason=String(reason);
 if(reason.length>120||/[\r\n\0]/.test(reason))throw fault('AF_REASON','Escribe un motivo de una sola línea, de hasta 120 caracteres.');
 const escaped=reason.replace(/[^a-zA-Z0-9 .,:;()_-]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 return ['mode=implicit','signatureSubFilter=ETSI.CAdES.detached',
  'visibleSignature='+(visible?'want':'none'),...(reason?['signReason='+escaped]:[])].join('\n');
}

export function autofirmaError(type='',message=''){
 const detail=String(type)+' '+String(message),code=detail.match(/\bSAF_\d+\b/)?.[0];
 if(/cancel/i.test(detail))return fault('AF_CANCELLED','Firma cancelada. Puedes volver a intentarlo cuando quieras.');
 if(/ApplicationNotFound|IOException|WebSocket|Timeout|InterruptedException|Network/i.test(detail))return fault('AF_CONNECTION','No se ha podido comunicar con AutoFirma. Acepta «Abrir AutoFirma» y el permiso de acceso a la red local si el navegador los pregunta. Si ya está instalada, cierra la operación pendiente y vuelve a intentarlo; consulta la ayuda de firma si continúa.');
 if(/NoCertificates|CertificateNotFound|NoValidCertificate/i.test(detail))return fault('AF_CERTIFICATE','AutoFirma no ha encontrado un certificado utilizable. Comprueba que puedes firmar este PDF directamente desde AutoFirma.');
 if(/UnsupportedProtocol|NeedsUpdatedVersion/i.test(detail))return fault('AF_VERSION','Actualiza AutoFirma desde su página oficial y vuelve a abrir el navegador.');
 return fault('AF_NATIVE','AutoFirma no ha completado la firma'+(code?' ('+code+')':'')+'. Revisa el aviso de AutoFirma. Este error no identifica un problema con la contraseña del P12.');
}

function toBase64(bytes){
 const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return btoa(chunks.join(''));
}

export async function decodeSignedPDF(encoded,original){
 if(typeof encoded!=='string'||!encoded.length||encoded.length>Math.ceil(MAX_OUTPUT/3)*4+4||!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded))throw fault('AF_RESPONSE','AutoFirma ha devuelto una respuesta que no es un PDF reconocible.');
 let bytes;
 try{bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
 catch{throw fault('AF_RESPONSE','No se ha podido leer la respuesta de AutoFirma.');}
 if(bytes.length>MAX_OUTPUT||!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw fault('AF_RESPONSE','AutoFirma no ha devuelto un archivo PDF.');
 if(original&&bytes.length===original.length&&bytes.every((b,i)=>b===original[i]))throw fault('AF_RESPONSE','AutoFirma ha devuelto el documento sin cambios. No se ofrece como firmado.');
 // Structural sanity check, NOT cryptographic verification or certificate trust.
 let hasSignature=false;
 try{
  const doc=await PDFDocument.load(bytes,{updateMetadata:false});
  for(const [,obj] of doc.context.enumerateIndirectObjects()){
   if(!(obj instanceof PDFDict))continue;
   const range=obj.lookup(PDFName.of('ByteRange'));
   if(!(range instanceof PDFArray)||range.size()!==4||!obj.has(PDFName.of('Contents')))continue;
   const n=range.asArray().map(v=>v instanceof PDFNumber?v.asNumber():NaN);
   if(n.every(Number.isSafeInteger)&&n[0]===0&&n[1]>0&&n[2]>n[1]&&n[3]>0&&n[2]+n[3]===bytes.length)hasSignature=true;
  }
 }catch{throw fault('AF_RESPONSE','El PDF devuelto por AutoFirma no se ha podido abrir.');}
 if(!hasSignature)throw fault('AF_RESPONSE','No se ha encontrado una estructura de firma que cubra el PDF recibido. No se ofrece como firmado.');
 return bytes; // Never reserialize a signed document.
}

let pending=false;
const sessions=new WeakMap(),BRIDGE_VERSION=2;
const componentError=code=>fault(code,{
 AF_COMPONENT_TIMEOUT:'El conector de PDF no ha terminado de cargar. Comprueba la conexión y vuelve a pulsar Firmar. AutoFirma todavía no se ha abierto.',
 AF_COMPONENT_ASSET:'No se ha cargado un archivo del conector de PDF. Recarga esta página y vuelve a intentarlo. Este error ocurre antes de acceder al certificado.',
 AF_COMPONENT_BLOCKED:'El navegador ha bloqueado la carga del conector de PDF. Abre esta página directamente en Chrome, Edge, Firefox o Safari y vuelve a intentarlo.',
 AF_COMPONENT_VERSION:'Se han mezclado archivos de dos versiones de PDF. Cierra esta pestaña y vuelve a abrir la aplicación.',
}[code]||'No se ha podido preparar el conector de PDF. Recarga esta página.');

function getSession(env={}){
 const win=env.window||globalThis.window,doc=env.document||globalThis.document;
 let session=sessions.get(doc);if(session)return session;
 const frame=doc.createElement('iframe');frame.hidden=true;frame.title='Conexión local con AutoFirma';
 const url=new URL('./autofirma-bridge.html',import.meta.url);url.searchParams.set('v',String(BRIDGE_VERSION));
 let resolve,reject,timer,settled=false,disposed=false;
 const ready=new Promise((ok,fail)=>{resolve=ok;reject=fail;});
 // Preloading can finish after the user closes the tool. Its rejection is still
 // delivered to callers, but never becomes an unhandled background rejection.
 ready.catch(()=>{});
 const removeListeners=()=>{clearTimeout(timer);frame.onload=frame.onerror=null;win.removeEventListener('message',message);doc.removeEventListener('securitypolicyviolation',blocked);};
 const dispose=()=>{
  if(disposed)return;disposed=true;removeListeners();frame.remove();
  if(sessions.get(doc)===session)sessions.delete(doc);
  if(!settled){settled=true;reject(fault('AF_CANCELLED','Preparación de AutoFirma cancelada.'));}
 };
 const fail=code=>{if(settled||disposed)return;settled=true;reject(componentError(code));dispose();};
 const check=()=>{
  if(settled||disposed)return;
  try{
   const bridge=frame.contentWindow?.PDFNativeBridge;
   if(bridge?.ready&&bridge.version===BRIDGE_VERSION&&typeof bridge.sign==='function'){
    settled=true;removeListeners();session.bridge=bridge;resolve(session);
   }else if(bridge?.error)fail(bridge.error);
   else if(bridge?.ready)fail('AF_COMPONENT_VERSION');
  }catch{fail('AF_COMPONENT_BLOCKED');}
 };
 const message=event=>{
  if(event.source!==frame.contentWindow||event.origin!==url.origin||event.data?.type!=='pdf-autofirma-bridge')return;
  if(event.data.version!==BRIDGE_VERSION){fail('AF_COMPONENT_VERSION');return;}
  if(event.data.error)fail(['AF_COMPONENT_ASSET','AF_COMPONENT_BLOCKED'].includes(event.data.error)?event.data.error:'AF_COMPONENT_ASSET');else check();
 };
 const blocked=event=>{if(event.violatedDirective?.startsWith('frame-src')&&event.blockedURI?.startsWith(url.origin+url.pathname))fail('AF_COMPONENT_BLOCKED');};
 session={frame,ready,dispose,bridge:null};sessions.set(doc,session);
 win.addEventListener('message',message);doc.addEventListener('securitypolicyviolation',blocked);
 timer=setTimeout(()=>fail('AF_COMPONENT_TIMEOUT'),env.loadTimeoutMs||30000);
 frame.onerror=()=>fail('AF_COMPONENT_ASSET');
 frame.onload=check; // Fallback; readiness does not depend on this event.
 frame.src=url.href;doc.body.append(frame);
 return session;
}

// Prepare the frame while the user chooses the PDF and its signature options.
// No document bytes, certificate request or native invocation is sent here.
export function prepareAutoFirma(env={}){return getSession(env).ready;}
export function disposeAutoFirma(env={}){
 if(!pending)sessions.get(env.document||globalThis.document)?.dispose();
}

export async function signWithAutoFirma(file,opts={},progress=()=>{},env={}){
 const win=env.window||globalThis.window,doc=env.document||globalThis.document;
 const keystore=autofirmaPlatform(win?.navigator);
 if(!keystore||typeof win.WebSocket!=='function')throw fault('AF_UNSUPPORTED','Esta integración de AutoFirma requiere Windows o Mac y un navegador actualizado. En móvil puedes usar las otras herramientas de PDF.');
 if(!opts.consent)throw fault('AF_CONSENT','Confirma que quieres firmar este documento con tu certificado.');
 if(!file.bytes?.length||file.bytes.length>MAX_INPUT)throw fault('AF_SIZE','Selecciona un PDF de hasta 100 MB.');
 const properties=autofirmaProperties(opts);
 if(pending)throw fault('AF_BUSY','Ya hay una firma en curso. Termínala o cancélala en AutoFirma.');
 pending=true;
 let session;
 try{
  progress(.08,'Preparando la conexión con AutoFirma…');
  session=await prepareAutoFirma(env);
  const encoded=toBase64(file.bytes);
  const response=await new Promise((resolve,reject)=>{
   let finished=false,started=false,timer,prompt;
   const closePrompt=()=>{if(prompt){prompt.close();prompt.remove();prompt=null;}};
   const finish=(value,error)=>{if(finished)return;finished=true;clearTimeout(timer);closePrompt();session.dispose();error?reject(error):resolve(value);};
   const start=()=>{
    if(started||finished)return;started=true;closePrompt();
    progress(.15,'Acepta abrir AutoFirma y el permiso de red local si aparecen. Elige allí tu certificado y la posición de la firma.');
    timer=setTimeout(()=>finish(null,fault('AF_TIMEOUT','La firma ha superado cinco minutos. Cierra la operación pendiente en AutoFirma antes de volver a intentarlo.')),env.timeoutMs||300000);
    try{
     session.bridge.sign({data:encoded,properties,keystore},value=>finish(value), (type,message)=>finish(null,type==='PDF_LOCAL_BLOCKED'?fault('AF_LOCAL_BLOCKED','El navegador ha bloqueado la conexión local con AutoFirma. Revisa el permiso de acceso a la red local para esta página. No desactives la validación de certificados.'):autofirmaError(type,message)));
    }catch{finish(null,fault('AF_START','El conector se ha cargado, pero no ha podido iniciar AutoFirma. Revisa el permiso de apertura del navegador e inténtalo de nuevo.'));}
   };
   // A frame created after a click does not inherit that click's activation.
   // If loading/encoding consumed the activation, obtain a fresh, explicit click
   // while the ready frame already exists. Invoke sign synchronously in it.
   const activation=session.frame.contentWindow?.navigator?.userActivation;
   if(activation&&activation.isActive===false){
    prompt=doc.createElement('dialog');prompt.className='help-dialog';prompt.setAttribute('aria-labelledby','autofirma-open-title');
    prompt.innerHTML='<h2 id="autofirma-open-title">Abrir AutoFirma</h2><p>El documento está preparado. Pulsa para abrir AutoFirma y elegir tu certificado.</p><p class="hint">Acepta la apertura y el acceso a la red local si el navegador los solicita.</p><button type="button" class="primary" data-af-open>Abrir AutoFirma</button> <button type="button" class="text-button" data-af-cancel>Cancelar</button>';
    const cancel=event=>{event?.preventDefault();finish(null,autofirmaError('AOCancelledOperationException'));};
    prompt.querySelector('[data-af-open]').onclick=start;prompt.querySelector('[data-af-cancel]').onclick=cancel;prompt.addEventListener('cancel',cancel);
    doc.body.append(prompt);prompt.showModal();prompt.querySelector('[data-af-open]').focus();
   }else start();
  });
  progress(.9,'Recibiendo el PDF de AutoFirma…');
  return await decodeSignedPDF(response,file.bytes);
 }finally{session?.dispose();pending=false;}
}
