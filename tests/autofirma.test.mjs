import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {createHash,webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {PDFDocument} from '../dist/vendor/pdf-lib.js';
import {autofirmaPlatform,autofirmaProperties,autofirmaError,decodeSignedPDF,signWithAutoFirma,prepareAutoFirma,disposeAutoFirma} from '../dist/autofirma.js';
const require=createRequire(import.meta.url),deps=process.env.PDF_BUILD_DEPS;
const forge=require(deps?deps+'/node-forge':'node-forge');
globalThis.self=globalThis;
const {signDocument}=await import('../dist/vendor/signing.js');
const nav={platform:'Win32',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155.0.0.0 Safari/537.36',appVersion:'5.0',appName:'Netscape'};
const doc=await PDFDocument.create();doc.addPage([595,842]);const original=await doc.save();
// A fictitious certificate supplies a real CMS fixture; it is NOT an AutoFirma run.
const keys=forge.pki.rsa.generateKeyPair(2048),cert=forge.pki.createCertificate();
cert.publicKey=keys.publicKey;cert.serialNumber='01';cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date(Date.now()+86400000);
cert.setSubject([{name:'commonName',value:'PDF FICTITIOUS AUTOFIRMA TEST'}]);cert.setIssuer(cert.subject.attributes);cert.setExtensions([{name:'keyUsage',digitalSignature:true}]);cert.sign(keys.privateKey,forge.md.sha256.create());
const p12=new Uint8Array(Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],'test',{algorithm:'3des'})).getBytes(),'binary'));
const signed=(await signDocument(original,p12,'test','Prueba',{visible:true,page:1,x:10,y:72,w:65,h:20})).bytes;
const encoded=Buffer.from(signed).toString('base64'),file={name:'Prueba.pdf',bytes:original};

function environment(action,{autoReady=true,activation}={}){
 let removed=0,appended=0;
 const win=Object.assign(new EventTarget(),{navigator:nav,WebSocket:function(){}}),document=new EventTarget();
 const frame={contentWindow:{navigator:{userActivation:activation},PDFNativeBridge:{version:3,ready:true,sign:action}},remove(){removed++;}};
 const signal=(data={type:'pdf-autofirma-bridge',version:3,ready:true},overrides={})=>{const event=new Event('message');Object.assign(event,{data,source:frame.contentWindow,origin:new URL(frame.src).origin,...overrides});win.dispatchEvent(event);};
 document.createElement=()=>frame;document.body={append(){appended++;if(autoReady)queueMicrotask(()=>signal());}};
 return {window:win,document,timeoutMs:25,loadTimeoutMs:25,stats:()=>({removed,appended}),frame,signal};
}

test('plataformas: Windows y Mac; excluye Android, iOS e iPad en modo escritorio',()=>{
 assert.equal(autofirmaPlatform(nav),'WINDOWS');assert.equal(autofirmaPlatform({platform:'MacIntel',userAgent:'Macintosh'}),'APPLE');
 for(const n of [{userAgent:'Android'},{userAgent:'iPhone'},{platform:'MacIntel',maxTouchPoints:5},{platform:'Linux x86_64'}])assert.equal(autofirmaPlatform(n),null);
});
test('motivo Unicode escapado no permite inyectar servidores y visible solicita colocación nativa',()=>{
 const props=autofirmaProperties({reason:'Aprobación: C:\\prueba = sí',visible:true});
 assert.match(props,/visibleSignature=want/);assert.match(props,/Aprob\\u00f3n|Aprobaci\\u00f3n/);assert.match(props,/\\u005c/);
 assert.doesNotMatch(props,/signaturePosition|signaturePage|tsaURL|serverUrl/);
 assert.match(autofirmaProperties({reason:'',visible:false}),/visibleSignature=none/);
 assert.doesNotMatch(autofirmaProperties({reason:''}),/signReason/);
 assert.throws(()=>autofirmaProperties({reason:'ok\ntsaURL=https://example.invalid'}),{code:'AF_REASON'});
 assert.match(props,/certificationLevel=0/);assert.match(props,/layer2FontSize=0/);assert.match(props,/visibleAppearance=default/);
 assert.match(autofirmaProperties({policy:'final'}),/certificationLevel=1/);
 assert.throws(()=>autofirmaProperties({policy:'unknown'}),{code:'PDF_SIGN_POLICY'});
});
test('una marca invisible no se presenta como la firma visible solicitada',async()=>{
 const invisible=(await signDocument(original,p12,'test','',{visible:false})).bytes;
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(invisible).toString('base64'),original,{visible:true}),{code:'AF_APPEARANCE'});
 assert.deepEqual(await decodeSignedPDF(encoded,original,{visible:true}),signed);
});
test('cancelación, comunicación y aviso nativo se distinguen sin culpar a la contraseña',()=>{
 assert.equal(autofirmaError('AOCancelledOperationException').code,'AF_CANCELLED');
 assert.equal(autofirmaError('ApplicationNotFoundException').code,'AF_CONNECTION');
 assert.match(autofirmaError('java.lang.Exception','SAF_03: ruta privada no se muestra').message,/SAF_03/);
 assert.doesNotMatch(autofirmaError('java.lang.Exception','ruta privada').message,/ruta privada/);
});
test('respuesta PDF conserva todos los bytes y su CMS sigue verificando con OpenSSL',async()=>{
 const result=await decodeSignedPDF(encoded,original);assert.deepEqual(result,signed);
 const bytes=Buffer.from(result),[a,b,c,d]=bytes.toString('latin1').match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/).slice(1).map(Number);
 const cms=Buffer.from(bytes.toString('latin1').match(/\/Contents\s*<([\da-fA-F]+)>/)[1],'hex');
 const temp=await mkdtemp(tmpdir()+'/pdf-af-');
 try{
  await writeFile(temp+'/cms.der',cms);await writeFile(temp+'/content',Buffer.concat([bytes.subarray(a,a+b),bytes.subarray(c,c+d)]));
  const check=spawnSync('openssl',['cms','-verify','-binary','-inform','DER','-in',temp+'/cms.der','-content',temp+'/content','-noverify','-out',temp+'/verified']);
  assert.equal(check.status,0,check.stderr.toString());
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('no ofrece como firmado un PDF original, una respuesta malformada o un PDF sin firma',async()=>{
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(original).toString('base64'),original),{code:'AF_RESPONSE'});
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(original).toString('base64'),new Uint8Array()),{code:'AF_RESPONSE'});
 for(const value of ['%%%','Y29udGVuaWRv',null])await assert.rejects(()=>decodeSignedPDF(value,original),{code:'AF_RESPONSE'});
});
test('adaptador entrega solo PDF/opciones a AutoFirma y limpia el marco al recibir el resultado',async()=>{
 let request;
 const env=environment((data,ok)=>{request=data;ok(encoded);});
 const result=await signWithAutoFirma(file,{consent:true,visible:true,reason:'Aprobar'},()=>{},env);
 assert.deepEqual(result,signed);assert.equal(request.data,Buffer.from(original).toString('base64'));
 assert.deepEqual(Object.keys(request).sort(),['data','keystore','properties']);assert.equal(request.keystore,'WINDOWS');
 assert.deepEqual(env.stats(),{removed:1,appended:1});
});
test('consentimiento, cancelación, timeout y segundo intento no dejan operaciones mezcladas',async()=>{
 const rejected=environment(()=>{throw new Error('should not call');});
 await assert.rejects(()=>signWithAutoFirma(file,{consent:false},()=>{},rejected),{code:'AF_CONSENT'});assert.equal(rejected.stats().appended,0);
 const cancelled=environment((_data,_ok,fail)=>fail('AOCancelledOperationException','Cancelado'));
 await assert.rejects(()=>signWithAutoFirma(file,{consent:true},()=>{},cancelled),{code:'AF_CANCELLED'});assert.equal(cancelled.stats().removed,1);
 const hanging=environment(()=>{});
 const wait=signWithAutoFirma(file,{consent:true},()=>{},hanging);
 await assert.rejects(()=>signWithAutoFirma(file,{consent:true},()=>{},environment(()=>{})),{code:'AF_BUSY'});
 await assert.rejects(()=>wait,{code:'AF_TIMEOUT'});assert.equal(hanging.stats().removed,1);
 const retry=environment((_data,ok)=>ok(encoded));assert.deepEqual(await signWithAutoFirma(file,{consent:true},()=>{},retry),signed);
});
test('precarga sin PDF ni apertura nativa; señal ready autenticada funciona sin iframe.onload',async()=>{
 let calls=0,ready=false;
 const env=environment((_data,ok)=>{calls++;ok(encoded);},{autoReady:false});env.loadTimeoutMs=1000;
 const preparation=prepareAutoFirma(env).then(value=>{ready=true;return value;});
 assert.equal(env.stats().appended,1);assert.equal(calls,0);
 env.signal(undefined,{origin:'https://unrelated.invalid'});env.signal(undefined,{source:{}});
 await Promise.resolve();assert.equal(ready,false);
 env.signal();await preparation;assert.equal(calls,0);
 await prepareAutoFirma(env);assert.equal(env.stats().appended,1);
 assert.deepEqual(await signWithAutoFirma(file,{consent:true},()=>{},env),signed);
 assert.equal(calls,1);assert.equal(env.stats().removed,1);
});
test('carga lenta, archivo ausente, bloqueo y versión mezclada tienen errores propios y permiten reintentar',async()=>{
 for(const code of ['AF_COMPONENT_TIMEOUT','AF_COMPONENT_ASSET','AF_COMPONENT_SCRIPT','AF_COMPONENT_VERSION']){
  const env=environment(()=>assert.fail('must not launch'),{autoReady:false});env.loadTimeoutMs=5;
  const operation=signWithAutoFirma(file,{consent:true},()=>{},env);
  await new Promise(resolve=>setTimeout(resolve,0));
  if(code==='AF_COMPONENT_VERSION')env.signal({type:'pdf-autofirma-bridge',version:1,ready:true});
  else if(code!=='AF_COMPONENT_TIMEOUT')env.signal({type:'pdf-autofirma-bridge',version:3,error:code});
  await assert.rejects(()=>operation,{code});assert.equal(env.stats().removed,1);
 }
 const retry=environment((_data,ok)=>ok(encoded));assert.deepEqual(await signWithAutoFirma(file,{consent:true},()=>{},retry),signed);
});
test('cerrar la herramienta durante la precarga elimina el marco y sus listeners',async()=>{
 const env=environment(()=>assert.fail('must not launch'),{autoReady:false});
 const ready=prepareAutoFirma(env);disposeAutoFirma(env);
 await assert.rejects(()=>ready,{code:'AF_CANCELLED'});assert.equal(env.stats().removed,1);
 env.signal();assert.equal(env.stats().removed,1);
});
test('si la activación caduca pide un clic nuevo; cancelar no abre AutoFirma y confirmar firma una sola vez',async()=>{
 const {JSDOM}=require(deps?deps+'/jsdom':'jsdom');
 for(const cancel of [true,false]){
  const dom=new JSDOM('<body></body>',{url:'https://pdf.example/'}),win=dom.window,document=win.document;
  Object.defineProperty(win.navigator,'userAgent',{value:nav.userAgent});
  win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};win.HTMLDialogElement.prototype.close=function(){this.open=false;};
  let calls=0,inClick=false;const append=document.body.append.bind(document.body);
  document.body.append=node=>{append(node);if(node.tagName==='IFRAME'){
   Object.defineProperty(node.contentWindow.navigator,'userActivation',{value:{isActive:false}});
   node.contentWindow.PDFNativeBridge={version:3,ready:true,sign:(_data,ok)=>{assert.equal(inClick,true);calls++;ok(encoded);}};
   queueMicrotask(()=>node.onload?.());
  }};
  try{
   const result=signWithAutoFirma(file,{consent:true},()=>{},{window:win,document,loadTimeoutMs:1000});
   for(let i=0;i<10&&!document.querySelector('dialog');i++)await Promise.resolve();
   const prompt=document.querySelector('dialog');assert.ok(prompt?.open);assert.equal(calls,0);
   inClick=true;prompt.querySelector(cancel?'[data-af-cancel]':'[data-af-open]').click();inClick=false;
   if(cancel)await assert.rejects(()=>result,{code:'AF_CANCELLED'});else assert.deepEqual(await result,signed);
   assert.equal(calls,cancel?0:1);assert.equal(document.querySelectorAll('dialog, iframe').length,0);
  }finally{dom.window.close();}
 }
});
async function loadActualBridge({missingAsset=false,violation,scriptError}={}){
 const {JSDOM,requestInterceptor,VirtualConsole}=require(deps?deps+'/jsdom':'jsdom');
 const html=await readFile(new URL('../dist/autofirma-bridge.html',import.meta.url),'utf8');
 const paths=[];let ready,bridgeWindow;const signal=new Promise(resolve=>{ready=resolve;});
 const intercept=requestInterceptor(async request=>{
  const path=new URL(request.url).pathname;paths.push(path);
  if(path.endsWith('/autoscript.js')){
   for(let i=0;i<100&&!bridgeWindow.PDFNativeBridge;i++)await new Promise(resolve=>setTimeout(resolve,1));
   assert.ok(bridgeWindow.PDFNativeBridge,'bootstrap must run before the synthetic browser event');
   if(violation){const event=new bridgeWindow.Event('securitypolicyviolation');Object.assign(event,violation);bridgeWindow.dispatchEvent(event);}
   if(scriptError){const script=bridgeWindow.document.createElement('script');script.type='application/x-pdf-test';script.src=scriptError;bridgeWindow.document.head.append(script);script.dispatchEvent(new bridgeWindow.Event('error'));script.remove();}
  }
  if(missingAsset&&path.endsWith('/autoscript.js'))return new Response('Synthetic missing asset',{status:404});
  if(!['/autofirma-bridge.js','/vendor/autofirma/autoscript.js'].includes(path))throw new Error('Unexpected resource '+path);
  return new Response(await readFile(new URL('../dist'+path,import.meta.url)),{headers:{'Content-Type':'text/javascript'}});
 });
 const dom=new JSDOM(html,{url:'https://pdf.example/autofirma-bridge?v=3',runScripts:'dangerously',resources:{interceptors:[intercept]},virtualConsole:new VirtualConsole(),beforeParse(win){bridgeWindow=win;win.addEventListener('message',e=>{if(e.data?.type==='pdf-autofirma-bridge')ready(e.data);});}});
 let timer;
 try{const result=await Promise.race([signal,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Bridge did not announce readiness')),2000);})]);return {dom,paths,result};}
 catch(error){dom.window.close();throw error;}finally{clearTimeout(timer);}
}
test('HTML real servido sin extensión carga el bootstrap y AutoScript oficial y anuncia disponibilidad',async()=>{
 const {dom,paths,result}=await loadActualBridge();
 try{assert.equal(result.ready,true);assert.equal(result.version,3);assert.equal(dom.window.PDFNativeBridge.ready,true);assert.equal(dom.window.AutoScript.VERSION,'1.9.0');assert.deepEqual(paths,['/autofirma-bridge.js','/vendor/autofirma/autoscript.js']);}
 finally{dom.window.close();}
});
test('HTML real con AutoScript ausente comunica el fallo de archivo antes de firmar',async()=>{
 const {dom,result}=await loadActualBridge({missingAsset:true});
 try{assert.equal(result.error,'AF_COMPONENT_ASSET');assert.equal(dom.window.PDFNativeBridge.ready,false);}
 finally{dom.window.close();}
});
test('un script ajeno bloqueado por CSP no invalida el cliente oficial durante su carga',async()=>{
 for(const blockedURI of ['inline','eval','https://extension.invalid/injected.js']){
  const {dom,result}=await loadActualBridge({violation:{effectiveDirective:'script-src-elem',blockedURI,disposition:'enforce'}});
  try{assert.equal(result.ready,true);assert.equal(dom.window.PDFNativeBridge.ready,true);assert.equal(dom.window.AutoScript.VERSION,'1.9.0');}
  finally{dom.window.close();}
 }
});
test('solo el bloqueo efectivo del cliente requerido falla; una política informativa no lo bloquea',async()=>{
 for(const disposition of ['enforce','report']){
  const {dom,result}=await loadActualBridge({violation:{effectiveDirective:'script-src-elem',blockedURI:'https://pdf.example/vendor/autofirma/autoscript.js',disposition}});
  try{if(disposition==='enforce')assert.equal(result.error,'AF_COMPONENT_SCRIPT');else assert.equal(result.ready,true);}
  finally{dom.window.close();}
 }
});
test('un error de otro script no aborta el conector, pero el del cliente oficial sí',async()=>{
 for(const [scriptError,expected] of [['https://extension.invalid/injected.js',undefined],['https://pdf.example/vendor/autofirma/autoscript.js','AF_COMPONENT_ASSET']]){
  const {dom,result}=await loadActualBridge({scriptError});
  try{assert.equal(result.error,expected);if(!expected)assert.equal(result.ready,true);}
  finally{dom.window.close();}
 }
});
test('distingue restricciones del marco, origen inaccesible y fallo de inicialización',async()=>{
 for(const name of ['SecurityError','TypeError']){
  const env=environment(()=>assert.fail('must not sign'),{autoReady:false});
  Object.defineProperty(env.frame.contentWindow,'PDFNativeBridge',{get(){throw Object.assign(new Error('private browser detail'),{name});}});
  const operation=prepareAutoFirma(env);env.frame.onload();
  await assert.rejects(()=>operation,error=>{assert.equal(error.code,name==='SecurityError'?'AF_COMPONENT_ORIGIN':'AF_COMPONENT_INIT');assert.doesNotMatch(error.message,/private browser detail/);return true;});
  assert.equal(env.stats().removed,1);
 }
 const env=environment(()=>assert.fail('must not sign'),{autoReady:false});env.loadTimeoutMs=1000;
 const operation=prepareAutoFirma(env);
 const emit=(blockedURI,disposition)=>{const e=new Event('securitypolicyviolation');Object.assign(e,{effectiveDirective:'frame-src',blockedURI,disposition});env.document.dispatchEvent(e);};
 emit(env.frame.src,'report');emit('https://unrelated.invalid/frame','enforce');assert.equal(env.stats().removed,0);
 emit(env.frame.src.replace('.html',''),'enforce');
 await assert.rejects(()=>operation,{code:'AF_COMPONENT_FRAME'});assert.equal(env.stats().removed,1);
});
test('solo una restricción efectiva del WebSocket local interrumpe la firma',async()=>{
 const listeners={},failures=[];
 const api={sign(){},cargarAppAfirma(){},setForceWSMode(){},setStickySignatory(){},setAppName(){},setMinimumClientVersion(){}};
 const context={URL,document:{readyState:'complete'},location:{href:'https://pdf.example/autofirma-bridge',origin:'https://pdf.example'},AutoScript:api,WebSocket:function(){},parent:{postMessage(){}},addEventListener:(name,callback)=>{listeners[name]=callback;}};context.window=context;
 vm.createContext(context);vm.runInContext(await readFile(new URL('../dist/autofirma-bridge.js',import.meta.url),'utf8'),context);
 context.PDFNativeBridge.sign({data:'test',properties:'',keystore:'WINDOWS'},()=>{},type=>failures.push(type));
 for(const [blockedURI,disposition] of [['https://unrelated.invalid/','enforce'],['wss://127.0.0.1:54321','report']])listeners.securitypolicyviolation({effectiveDirective:'connect-src',blockedURI,disposition});
 assert.equal(failures.length,0);
 listeners.securitypolicyviolation({effectiveDirective:'connect-src',blockedURI:'wss://127.0.0.1:54321',disposition:'enforce'});
 assert.deepEqual(failures,['PDF_LOCAL_BLOCKED']);
});
test('cliente oficial sin modificar: invocación, WebSocket local, solicitud PAdES y retorno',async()=>{
 const source=await readFile(new URL('../dist/vendor/autofirma/autoscript.js',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(source).digest('hex'),'567998128f1cd8017c304a8c187f6912a0c56b0feebb02fffa2aa33732e40439');
 const timers=[],sockets=[],launches=[];
 class Socket{constructor(url){assert.match(url,/^wss:\/\/127\.0\.0\.1:\d+$/);this.sent=[];this.readyState=1;sockets.push(this);}send(data){this.sent.push(data);}}
 const document={all:false,readyState:'complete'};Object.defineProperty(document,'location',{set:url=>launches.push(url)});
 const context={document,navigator:nav,URL,location:{origin:'http://127.0.0.1:12345',hostname:'127.0.0.1',href:'http://127.0.0.1:12345/autofirma-bridge.html'},WebSocket:Socket,
  setTimeout:(fn,_delay,...args)=>{timers.push(()=>fn(...args));return timers.length;},clearTimeout(){},addEventListener(){},parent:{postMessage(){}},crypto:webcrypto,console:{log(){},warn(){},error(){}},Uint8Array,Uint32Array,atob,btoa};context.window=context;
 vm.createContext(context);vm.runInContext(source,context);vm.runInContext(await readFile(new URL('../dist/autofirma-bridge.js',import.meta.url),'utf8'),context);
 let received,error;
 context.PDFNativeBridge.sign({data:Buffer.from(original).toString('base64'),properties:autofirmaProperties({visible:true}),keystore:'WINDOWS'},data=>{received=data;},(...args)=>{error=args;});
 assert.equal(launches.length,1);assert.match(launches[0],/^afirma:\/\/websocket\?/);assert.doesNotMatch(launches[0],/dat=|JVBER/);
 timers.shift()();assert.ok(sockets.length>0);sockets[0].onopen();timers.shift()();
 const socket=sockets[0];assert.match(socket.sent[0],/^echo=/);socket.onmessage({data:'OK'});
 const request=new URL(socket.sent[1]);assert.equal(request.hostname,'sign');assert.equal(request.searchParams.get('format'),'PAdES');assert.equal(request.searchParams.get('algorithm'),'SHA256withRSA');
 const supplied=request.searchParams.get('dat').replace(/-/g,'+').replace(/_/g,'/');assert.deepEqual(Buffer.from(supplied,'base64'),Buffer.from(original));
 assert.equal(Buffer.from(request.searchParams.get('ksb64'),'base64').toString(),'WINDOWS');
 assert.match(Buffer.from(request.searchParams.get('properties'),'base64').toString(),/visibleSignature=want/);
 socket.onmessage({data:'Y2VydA==|'+encoded});assert.equal(error,undefined);assert.equal(received,encoded);
});
test('el marco impide servicios remotos por CSP y el build conserva fuente y licencias',async()=>{
 const html=await readFile(new URL('../dist/autofirma-bridge.html',import.meta.url),'utf8');
 assert.match(html,/connect-src wss:\/\/127\.0\.0\.1:\*/);assert.doesNotMatch(html,/https:\/\//);
 const original=await readFile(new URL('../third_party/autofirma/autoscript.js',import.meta.url));
 assert.deepEqual(await readFile(new URL('../dist/vendor/autofirma/autoscript.js',import.meta.url)),original);
 assert.match(await readFile(new URL('../third_party/autofirma/GPL-2.0.txt',import.meta.url),'utf8'),/GNU GENERAL PUBLIC LICENSE/);
});
