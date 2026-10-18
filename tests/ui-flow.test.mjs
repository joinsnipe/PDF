import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import { createRequire } from 'node:module';
import { PDFDocument, StandardFonts } from '../dist/vendor/pdf-lib.js';
const require=createRequire(import.meta.url);
const deps=process.env.PDF_BUILD_DEPS;
const {JSDOM,VirtualConsole}=require(deps?deps+'/jsdom':'jsdom');
const Zip=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/jszip':'jszip');
const canvasModule=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas':'@napi-rs/canvas');
const dom=new JSDOM(await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),{url:'https://pdf.example/',virtualConsole:new VirtualConsole()});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,JSZip:Zip,createImageBitmap:async()=>({width:100,height:100,close(){}})});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
await import('../dist/app.js');
const $=s=>document.querySelector(s);
async function sample(text='Documento de prueba'){const d=await PDFDocument.create();const p=d.addPage();p.drawText(text,{font:await d.embedFont(StandardFonts.Helvetica),x:40,y:700});return {name:'prueba.pdf',bytes:await d.save()};}
const file=f=>({name:f.name,size:f.bytes.length,arrayBuffer:async()=>f.bytes.slice().buffer});
let nativeFixture;
async function add(files){Object.defineProperty($('#file-input'),'files',{configurable:true,value:files.map(file)});$('#file-input').dispatchEvent(new dom.window.Event('change'));for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,10));if($('#status').hidden)break;}assert.equal($('#error').hidden,true,$('#error').textContent);}
async function output(){await $('#process').onclick();assert.equal($('#error').hidden,true,$('#error').textContent);assert.equal($('#result').hidden,false);assert.ok($('#download').href.startsWith('blob:'));assert.ok($('#download').download);return new Uint8Array(await(await fetch($('#download').href)).arrayBuffer());}
test('marca de agua: selección -> procesamiento -> enlace de descarga con PDF válido',async()=>{
 $('[data-tool="watermark"]').click();await add([await sample()]);$('#opt-text').value='CONFIDENCIAL';const bytes=await output();assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);assert.match($('#download').download,/-marca.pdf$/);assert.equal($('#open-result').href,$('#download').href);$('#work-close').click();
});
test('imágenes a PDF: genera enlace descargable con nombre y contenido correctos',async()=>{
 const c=canvasModule.createCanvas(100,100);c.getContext('2d').fillRect(0,0,100,100);
 $('[data-tool="images"]').click();await add([{name:'foto.png',bytes:new Uint8Array(c.toBuffer('image/png'))}]);const bytes=await output();assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);assert.equal($('#download').download,'imagenes.pdf');$('#work-close').click();
});
test('descargas ZIP y renovación de la selección',async()=>{
 $('[data-tool="split"]').click();await add([await sample()]);$('#opt-mode').value='each';$('#opt-range').value='1,1';const bytes=await output();const zip=await Zip.loadAsync(bytes);assert.equal(Object.keys(zip.files).length,2);assert.equal($('#download').download,'PDF-split.zip');$('#start-again').click();assert.equal($('#download').hasAttribute('href'),false);assert.equal($('#process').disabled,true);$('#work-close').click();
});
test('todas las herramientas tienen opciones y acción definida',()=>{
 const buttons=[...document.querySelectorAll('[data-tool]')];assert.equal(buttons.length,29);
 for(const button of buttons){button.click();assert.doesNotMatch($('#process').textContent,/undefined/);$('#work-close').click();}
});
test('Abrir con muestra el visor directamente y conserva los bytes del original',async()=>{
 const source=await sample();
 window.dispatchEvent(new dom.window.CustomEvent('pdf-desktop-open',{detail:{file:file(source)}}));
 for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,10));if($('#status').hidden)break;}
 assert.match($('#work-title').textContent,/Visor/);assert.equal($('#editor-area').hidden,false);assert.equal($('#error').hidden,true,$('#error').textContent);assert.ok($('#tool-options #view-canvas'));
 const result=await output();
 assert.deepEqual(result,source.bytes);assert.ok($('#result-viewer #view-canvas'));$('#work-close').click();
});
test('Abrir con un PDF protegido solicita su contraseña antes de mostrarlo',async()=>{
 const bytes=new Uint8Array(await readFile(new URL('./fixtures/security/aes256-unicode.pdf',import.meta.url)));
 window.dispatchEvent(new dom.window.CustomEvent('pdf-desktop-open',{detail:{file:file({name:'protegido.pdf',bytes})}}));
 for(let i=0;i<200;i++){await new Promise(r=>setTimeout(r,10));if($('#status').hidden)break;}
 assert.equal($('#result').hidden,true);assert.equal($('#error').hidden,true,$('#error').textContent);assert.ok($('#opt-password'));assert.equal($('#opt-password').value,'');$('#work-close').click();
});
test('Guardar como recibe los mismos bytes y pagehide no revoca la descarga',async()=>{
 $('[data-tool="watermark"]').click();await add([await sample()]);const bytes=await output();let saved;
 window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async b=>{saved=new Uint8Array(await b.arrayBuffer());},close:async()=>{}})});
 await $('#save-as').onclick();assert.deepEqual(saved,bytes);window.dispatchEvent(new dom.window.Event('pagehide'));
 assert.deepEqual(new Uint8Array(await(await fetch($('#download').href)).arrayBuffer()),bytes);delete window.showSaveFilePicker;$('#work-close').click();
});
test('visor pide contraseña una vez, muestra el resultado y limpia la entrada',async()=>{
 const original=await sample(),locked=await PDFDocument.load(original.bytes);
 // Synthetic encrypted marker for the UI contract; real AES decryption is tested separately.
 locked.context.trailerInfo.Encrypt=locked.context.register(locked.context.obj({Filter:'Standard'}));
 const bytes=await locked.save();
 globalThis.Worker=class{postMessage(message){assert.equal(message.tool,'unlock');queueMicrotask(()=>this.onmessage({data:message.opts.password==='known'?{bytes:original.bytes}:{error:'Comprueba la contraseña.'}}));}terminate(){}};
 $('[data-tool="viewer"]').click();await add([{name:'protegido.pdf',bytes}]);assert.equal($('#process').textContent,'Abrir PDF');
 $('#opt-password').value='wrong';await $('#process').onclick();assert.match($('#error').textContent,/contraseña/);assert.equal($('#opt-password').value,'');
 $('#opt-password').value='known';const result=await output();assert.equal((await PDFDocument.load(result)).getPageCount(),1);assert.ok($('#result-viewer #view-canvas'));assert.equal($('#opt-password'),null);assert.match($('#download').download,/desbloqueado/);$('#work-close').click();delete globalThis.Worker;
});
test('compartir conserva nombre y bytes, y cancelar no muestra error',async()=>{
 let shared;window.navigator.canShare=({files})=>files.length===1;window.navigator.share=async data=>{shared=data.files[0];};
 $('[data-tool="watermark"]').click();await add([await sample()]);const bytes=await output();
 assert.equal($('#share-result').hidden,false);await $('#share-result').onclick();assert.equal(shared.name,$('#download').download);assert.deepEqual(new Uint8Array(await shared.arrayBuffer()),bytes);
 window.navigator.share=async()=>{throw Object.assign(new Error('Cancelado'),{name:'AbortError'});};await $('#share-result').onclick();assert.equal($('#error').hidden,true);
 $('#work-close').click();assert.equal($('#share-result').hidden,true);delete window.navigator.share;delete window.navigator.canShare;
});
test('compartir se oculta cuando el navegador no admite archivos',async()=>{
 window.navigator.canShare=()=>false;window.navigator.share=async()=>{};
 $('[data-tool="watermark"]').click();await add([await sample()]);await output();assert.equal($('#share-result').hidden,true);
 $('#work-close').click();delete window.navigator.share;delete window.navigator.canShare;
});
test('firma con certificado: comprueba empresa y envía página y posición elegidas',async()=>{
 const source=await sample(),doc=await PDFDocument.load(source.bytes);doc.addPage();source.bytes=await doc.save();
 const messages=[];globalThis.Worker=class{postMessage(data){messages.push({...data});queueMicrotask(()=>this.onmessage({data:data.action==='inspect'?{signerName:'Ana Muñoz',organization:'Empresa Ficticia',issuer:'CA de prueba',validUntil:'2099-01-01T00:00:00Z'}:{bytes:source.bytes,signerName:'Ana Muñoz',visible:true,page:2}}));}terminate(){}};
 $('[data-tool="digitalsign"]').click();await add([source]);assert.equal($('#opt-visible').checked,true);assert.equal($('#opt-y').value,'72');
 Object.defineProperty($('#certificate-input'),'files',{configurable:true,value:[file({name:'empresa.pfx',bytes:new Uint8Array([1,2,3])})]});$('#opt-password').value='prueba';
 await $('#check-certificate').onclick();assert.match($('#certificate-status').textContent,/Empresa Ficticia/);assert.match($('#position-box').textContent,/Ana Muñoz/);
 $('#opt-password').dispatchEvent(new dom.window.Event('input'));assert.doesNotMatch($('#position-box').textContent,/Ana Muñoz/);
 const stage=$('#position-stage');stage.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});stage.setPointerCapture=()=>{};
 stage.onpointerdown({clientX:110,clientY:730,target:$('#position-box'),pointerId:1});stage.onpointermove({clientX:130,clientY:740});stage.onpointerup();
 assert.equal($('#opt-x').value,'12.00');assert.equal($('#opt-y').value,'73.00');
 assert.equal($('#opt-reason').tagName,'SELECT');assert.match($('#reason-help').textContent,/antes de firmar/);
 $('#opt-reason').value='Aceptación del presupuesto';$('#preview-page').value='2';$('#opt-consent').checked=true;await output();
 assert.deepEqual(messages[1].appearance,{policy:'approval',visible:true,page:2,x:'12.00',y:'73.00',w:'65.00',h:'20.00'});
 assert.equal(messages[1].reason,'Aceptación del presupuesto');
 assert.equal($('#opt-password'),null);assert.match($('#result-note').textContent,/página 2/);$('#work-close').click();delete globalThis.Worker;
});
test('motivo personalizado y sin motivo llegan a la firma sin recuperar el texto por defecto',async()=>{
 const source=await sample(),messages=[];
 globalThis.Worker=class{postMessage(data){messages.push({...data});queueMicrotask(()=>this.onmessage({data:{bytes:source.bytes,signerName:'Prueba ficticia'}}));}terminate(){}};
 try{for(const reason of ['Aceptación del contrato','']){
  $('[data-tool="digitalsign"]').click();await add([source]);
  Object.defineProperty($('#certificate-input'),'files',{configurable:true,value:[file({name:'prueba.p12',bytes:new Uint8Array([1,2,3])})]});
  assert.equal($('#custom-reason-field').hidden,true);
  $('#opt-reason').value='custom';$('#opt-reason').onchange();assert.equal($('#custom-reason-field').hidden,false);
  if(reason){$('#opt-custom-reason').value=reason;}else{$('#opt-reason').value='';$('#opt-reason').onchange();assert.equal($('#custom-reason-field').hidden,true);}
  $('#opt-password').value='prueba';$('#opt-visible').checked=false;$('#opt-consent').checked=true;await output();
  assert.equal(messages.at(-1).reason,reason);$('#work-close').click();
 }}finally{delete globalThis.Worker;}
});
test('P12 antiguo: interfaz -> lectura real -> firma -> descarga con CMS verificado',async()=>{
 const dir=await mkdtemp(tmpdir()+'/pdf-ui-certificate-'),password=' Contraseña-á€2026 ';
 const savedSelf=globalThis.self;globalThis.self=globalThis;
 const {inspectCertificate,signDocument}=await import('../dist/vendor/signing.js');
 try{
  let result=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',dir+'/key.pem','-out',dir+'/cert.pem','-days','1','-subj','/CN=PDF FICTITIOUS UI TEST']);assert.equal(result.status,0);
  result=spawnSync('openssl',['pkcs12','-export','-legacy','-inkey',dir+'/key.pem','-in',dir+'/cert.pem','-out',dir+'/test.p12','-passout','stdin'],{input:Buffer.from(password,'utf8').toString('latin1')+'\n'});assert.equal(result.status,0);
  result=spawnSync('openssl',['pkcs12','-legacy','-in',dir+'/test.p12','-noout','-passin','stdin'],{input:password+'\n'});assert.equal(result.status,0);
  const bundle=new Uint8Array(await readFile(dir+'/test.p12'));
  globalThis.Worker=class{
   postMessage(message){const data=structuredClone(message);queueMicrotask(async()=>{
    try{const result=data.action==='inspect'?inspectCertificate(data.cert,data.password):await signDocument(data.pdf,data.cert,data.password,data.reason,data.appearance);if(!this.closed)this.onmessage({data:result});}
    catch(e){if(!this.closed)this.onmessage({data:{error:e.message,code:e.code}});}
    finally{data.cert?.fill(0);data.password='';}
   });}
   terminate(){this.closed=true;}
  };
  const nativeSource=await sample();$('[data-tool="digitalsign"]').click();await add([nativeSource]);
  Object.defineProperty($('#certificate-input'),'files',{configurable:true,value:[file({name:'ficticio.p12',bytes:bundle})]});
  $('#opt-password').value='incorrecta';await $('#check-certificate').onclick();assert.match($('#certificate-status').textContent,/CERT_INTEGRITY/);
  $('#opt-password').value=password;$('#opt-password').dispatchEvent(new dom.window.Event('input'));await $('#check-certificate').onclick();assert.match($('#certificate-status').textContent,/PDF FICTITIOUS UI TEST/);
  $('#opt-visible').checked=true;$('#opt-consent').checked=true;
  const bytes=Buffer.from(await output());assert.equal($('#download').download,'prueba-firmado.pdf');assert.equal($('#opt-password'),null);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
  const [a,b,c,d]=bytes.toString('latin1').match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/).slice(1).map(Number);assert.equal(a,0);assert.equal(c+d,bytes.length);
  const cms=Buffer.from(bytes.subarray(b+1,c-1).toString(),'hex'),n=cms[1],size=n&128?cms.readUIntBE(2,n&127):n,header=n&128?2+(n&127):2;
  await writeFile(dir+'/signature.der',cms.subarray(0,header+size));await writeFile(dir+'/content',Buffer.concat([bytes.subarray(0,b),bytes.subarray(c)]));
  result=spawnSync('openssl',['cms','-verify','-binary','-inform','DER','-in',dir+'/signature.der','-content',dir+'/content','-noverify','-out',dir+'/verified']);assert.equal(result.status,0,result.stderr.toString());
  nativeFixture={source:nativeSource,signed:new Uint8Array(bytes)};
 }finally{$('#work-close').click();delete globalThis.Worker;globalThis.self=savedSelf;await rm(dir,{recursive:true,force:true});}
});
test('AutoFirma principal en Windows: certificado nativo, colocación nativa, cancelación y descarga sin leer P12',async()=>{
 assert.ok(nativeFixture);const append=document.body.append;let request,mode='cancel';
 Object.defineProperty(window.navigator,'userAgent',{configurable:true,value:'Mozilla/5.0 Windows NT 10.0 Chrome/155.0.0.0'});
 document.body.append=function(node){append.call(this,node);if(node.tagName==='IFRAME'){
  node.contentWindow.PDFNativeBridge={version:3,ready:true,sign:(data,ok,fail)=>{request=data;mode==='cancel'?fail('AOCancelledOperationException','Cancelado'):ok(Buffer.from(nativeFixture.signed).toString('base64'));}};
  queueMicrotask(()=>node.onload?.());
 }};
 try{
  $('[data-tool="digitalsign"]').click();await add([nativeFixture.source]);
  assert.equal($('#opt-sign-method').value,'autofirma');assert.equal($('#p12-fields').hidden,true);assert.equal($('#digital-position').hidden,true);assert.equal($('#autofirma-position').hidden,false);assert.match($('#process').textContent,/AutoFirma/);
  assert.match($('#autofirma-status').textContent,/Conector preparado/);assert.equal(request,undefined);
  Object.defineProperty($('#certificate-input'),'files',{get(){throw new Error('AutoFirma must not read a P12');}});
  $('#opt-consent').checked=true;await $('#process').onclick();assert.match($('#error').textContent,/AF_CANCELLED/);assert.equal($('#result').hidden,true);assert.equal(document.querySelectorAll('iframe').length,0);
  mode='success';const result=await output();assert.deepEqual(result,nativeFixture.signed);assert.equal($('#download').download,'prueba-firmado.pdf');
  assert.deepEqual(Buffer.from(request.data,'base64'),Buffer.from(nativeFixture.source.bytes));assert.match(request.properties,/visibleSignature=want/);assert.equal(request.keystore,'WINDOWS');assert.equal(document.querySelectorAll('iframe').length,0);
 }finally{document.body.append=append;delete window.navigator.userAgent;$('#work-close').click();}
});
test('limpiar dibujo no se presenta como borrar una firma criptográfica',()=>{
 $('[data-tool="signature"]').click();assert.equal($('#clear-signature').textContent,'Limpiar dibujo');assert.match($('#signature-status').textContent,/No equivale a una firma con certificado digital ni verifica la identidad/);$('#work-close').click();
 $('[data-tool="digitalsign"]').click();assert.equal($('#clear-signature'),null);$('#opt-visible').checked=false;$('#opt-visible').onchange();assert.equal($('#digital-position').hidden,true);$('#work-close').click();
});
test('seguridad: interfaz -> motor real -> descarga -> desbloquear -> visor',async()=>{
 const dir=await mkdtemp(tmpdir()+'/pdf-ui-security-');
 await writeFile(dir+'/qpdf.cjs',await readFile(new URL('../dist/vendor/qpdf/qpdf.js',import.meta.url)));
 const create=require(dir+'/qpdf.cjs'),script=await readFile(new URL('../dist/qpdf-worker.js',import.meta.url),'utf8');
 globalThis.Worker=class{
  postMessage(message){const data=structuredClone(message);const sandbox={URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,Module:create,importScripts(){},self:{location:{href:new URL('../dist/qpdf-worker.js',import.meta.url).href},postMessage:result=>{if(!this.closed)this.onmessage({data:result});}}};vm.runInNewContext(script,sandbox);sandbox.self.onmessage({data}).catch(()=>this.onerror?.());}
  terminate(){this.closed=true;}
 };
 try{
  const password='@Señal--2026';$('[data-tool="protect"]').click();await add([await sample()]);$('#opt-password').value=password;$('#opt-confirm').value=password;
  const encrypted=await output();assert.match($('#download').download,/-protegido.pdf$/);await assert.rejects(()=>PDFDocument.load(encrypted),/encrypted/i);assert.equal($('#opt-password').value,'');$('#work-close').click();
  $('[data-tool="unlock"]').click();await add([{name:'protegido.pdf',bytes:encrypted}]);$('#opt-password').value='incorrecta';await $('#process').onclick();assert.match($('#error').textContent,/PDF_PASSWORD/);assert.equal($('#opt-password').value,'');
  $('#opt-password').value=password;const opened=await output();assert.equal((await PDFDocument.load(opened)).getPageCount(),1);assert.ok($('#result-viewer #view-canvas'));$('#work-close').click();
  $('[data-tool="viewer"]').click();await add([{name:'sin-password.pdf',bytes:new Uint8Array(await readFile(new URL('./fixtures/security/aes256-empty.pdf',import.meta.url)))}]);
  assert.equal($('#opt-password').value,'');const noPassword=await output();assert.equal((await PDFDocument.load(noPassword)).getPageCount(),1);assert.ok($('#result-viewer #view-canvas'));$('#work-close').click();
 }finally{delete globalThis.Worker;await rm(dir,{recursive:true,force:true});}
});
test('girar: miniaturas seleccionan páginas y el resultado mantiene ese giro',async()=>{
 const doc=await PDFDocument.create();for(let i=0;i<3;i++)doc.addPage([300,400]);
 $('[data-tool="rotate"]').click();await add([{name:'tres.pdf',bytes:await doc.save()}]);
 assert.equal(document.querySelectorAll('#document-preview .preview-tile').length,3);
 document.querySelectorAll('#document-preview .preview-tile')[1].click();assert.equal($('#opt-range').value,'1, 3');$('#opt-angle').value='270';
 const bytes=await output(),result=await PDFDocument.load(bytes);assert.deepEqual(result.getPages().map(p=>p.getRotation().angle),[270,0,270]);assert.ok($('#result-viewer #view-canvas'));assert.equal($('#view-zoom').value,'fit');$('#work-close').click();
});
test('cambiar orden y quitar archivos actualiza también las miniaturas',async()=>{
 const c=canvasModule.createCanvas(10,10),bytes=new Uint8Array(c.toBuffer('image/png'));
 $('[data-tool="images"]').click();await add([{name:'A.png',bytes},{name:'B.png',bytes}]);
 $('[data-file-action="down"][data-index="0"]').click();assert.match($('#document-preview .thumbnail-label').textContent,/B.png/);
 $('[data-file-action="remove"][data-index="0"]').click();assert.equal(document.querySelectorAll('#document-preview .preview-tile').length,1);
 $('[data-file-action="remove"][data-index="0"]').click();assert.equal($('#document-preview').hidden,true);assert.equal($('#process').disabled,true);$('#work-close').click();
});
test('PDF firmado: aviso, edición bloqueada, certificación deshabilitada y lectura intacta',async()=>{
 assert.ok(nativeFixture);const signed={name:'firmado.pdf',bytes:nativeFixture.signed};
 for(const tool of ['rotate','watermark','protect','unlock','repair','metadata']){
  $('[data-tool="'+tool+'"]').click();await add([signed]);assert.equal($('#signature-notice').hidden,false);await $('#process').onclick();assert.match($('#error').textContent,/PDF_SIGNED_DOCUMENT/);assert.equal($('#result').hidden,true);assert.equal($('#download').hasAttribute('href'),false);$('#work-close').click();
 }
 $('[data-tool="digitalsign"]').click();await add([signed]);assert.equal($('#opt-policy option[value="final"]').disabled,true);$('#work-close').click();
 $('[data-tool="viewer"]').click();await add([signed]);assert.deepEqual(await output(),nativeFixture.signed);$('#work-close').click();
});
test('cambiar protección requiere confirmar de nuevo la firma',async()=>{
 $('[data-tool="digitalsign"]').click();await add([await sample()]);$('#opt-consent').checked=true;$('#opt-policy').value='final';$('#opt-policy').onchange();assert.equal($('#opt-consent').checked,false);assert.match($('#sign-policy-help').textContent,/ni nuevas firmas/);$('#work-close').click();
});
test('firma dibujada se encuentra en Firma y seguridad',()=>{
 document.querySelector('.filter[data-filter="security"]').click();assert.ok($('[data-tool="signature"]'));assert.ok($('[data-tool="digitalsign"]'));
 document.querySelector('.filter[data-filter="edit"]').click();assert.equal($('[data-tool="signature"]'),null);document.querySelector('.filter[data-filter="all"]').click();
});
test('IA: configurar sin PDF, modelo automático, revisar, autorizar, reutilizar y olvidar',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const calls=[];
 const {getAISettings}=await import('../dist/ai-settings.js');
 globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://api.mistral.ai/v1/')){const body=init.body?JSON.parse(init.body):null;calls.push({url,body});assert.equal(init.headers.Authorization,'Bearer test-api-key-example');
  if(init.method==='GET'){assert.equal(init.body,undefined);return Response.json({data:[{id:'mistral-large-latest'},{id:'mistral-small-latest'},{id:'mistral-embed'}]});}
  assert.equal(body.model,'mistral-small-latest');return Response.json({choices:[{message:{content:JSON.stringify({items:[{group:'Resumen',text:'Documento de prueba.',page:1,quote:'Documento de prueba'}],missing:[]})}}]});
 }assert.ok(!String(url).includes('/api/ai'),'Nunca usa el relay de PDF');return previousFetch(url,init);};
 try{
  $('.topbar [data-ai-settings]').click();assert.equal($('#work-dialog').open,false);assert.equal($('#ai-settings-dialog').open,true);
  $('#ai-provider').value='mistral';$('#ai-provider').onchange();$('#ai-key').value='test-api-key-example';await $('#ai-connect').onclick();
  assert.equal($('#ai-settings-dialog').open,false);assert.equal($('#ai-key').value,'');assert.equal(calls.length,1);assert.equal(getAISettings().model,'mistral-small-latest');
  $('[data-ai-action="understand"]').click();await add([await sample()]);assert.equal($('#opt-summarymode').value,'ai');assert.equal($('#opt-aimode'),null);assert.equal($('#work-title').textContent,'Entender mi PDF');assert.equal($('#ai-options').hidden,false);
  assert.match($('.topbar [data-ai-settings-label]').textContent,/IA configurada.*Mistral/);assert.equal($('.topbar [data-ai-settings]').dataset.aiConnection,'connected');
  assert.match($('#process').textContent,/Revisar texto/);await $('#process').onclick();assert.equal(calls.length,1);assert.equal($('#error').hidden,true);assert.equal($('#ai-review-box').hidden,false);
  assert.match($('#ai-review-text').textContent,/Documento de prueba/);assert.equal($('#ai-consent'),null);assert.match($('#process').textContent,/Enviar a Mistral y analizar/);assert.equal($('#ai-send-notice').hidden,false);
  await $('#process').onclick();assert.equal($('#error').hidden,true,$('#error').textContent);assert.equal(calls.length,2);assert.match(calls[1].body.messages[1].content,/Resume y explica/);assert.ok($('#download').download.endsWith('-informe-ia.txt'));assert.match($('#result-viewer').textContent,/Documento original para contrastar/);assert.match($('#result-preview').textContent,/Cita/);assert.equal(getAISettings().apiKey,'test-api-key-example');
  $('#start-again').click();await add([await sample()]);await $('#process').onclick();assert.equal($('#ai-send-notice').hidden,false);
  $('#tool-options [data-ai-settings]').click();$('#ai-forget').click();$('#ai-settings-close').click();assert.equal(getAISettings(),null);assert.equal($('#ai-send-notice').hidden,true);assert.equal($('.topbar [data-ai-settings]').dataset.aiConnection,'off');
  await $('#process').onclick();assert.equal($('#error').hidden,true);assert.equal($('#ai-settings-dialog').open,true);assert.equal(calls.length,2);
  $('#tool-options [data-ai-settings]').click();$('#ai-use-local').click();assert.equal($('#opt-summarymode').value,'local');assert.equal($('#files-count').textContent,'1');assert.equal($('#ai-options').hidden,true);assert.equal($('#opt-count').closest('label').hidden,false);
  assert.equal(window.localStorage.length,0);assert.equal(window.sessionStorage.length,0);assert.equal(document.cookie,'');$('#work-close').click();
 }finally{globalThis.fetch=previousFetch;delete globalThis.location;}
});
test('IA: cancelar o cambiar proveedor descarta conexiones tardías y permite reintentar',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const {getAISettings}=await import('../dist/ai-settings.js');let finish;
 globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});
 try{
  $('[data-ai-settings]').click();$('#ai-provider').value='gemini';$('#ai-provider').onchange();$('#ai-key').value='test-api-key-example';const pending=$('#ai-connect').onclick();assert.equal($('#ai-connect').disabled,true);
  $('#ai-provider').value='openai';$('#ai-provider').onchange();finish(Response.json({models:[{id:'gemini-2.5-flash'}]}));await pending;assert.equal(getAISettings(),null);assert.equal($('#ai-key').value,'test-api-key-example');assert.equal($('#ai-connect').disabled,false);assert.equal($('#ai-settings-dialog').open,true);
  $('#ai-key').value='test-api-key-example';globalThis.fetch=async()=>Response.json({error:'Clave no válida.'},{status:401});await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/no acepta esta clave/);assert.equal(getAISettings(),null);assert.equal($('#ai-connect').disabled,false);
  globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});const cancelled=$('#ai-connect').onclick();$('#ai-settings-close').click();finish(Response.json({models:[{id:'gpt-4.1-mini'}]}));await cancelled;assert.equal(getAISettings(),null);assert.equal($('#ai-key').value,'');
  $('[data-ai-settings]').click();$('#ai-provider').value='gemini';$('#ai-provider').onchange();$('#ai-key').value='test-api-key-example';$('#ai-model-choice').value='manual';$('#ai-model-choice').onchange();$('#ai-model-id').value='gemini-custom-text';await $('#ai-connect').onclick();assert.equal(getAISettings().manual,true);assert.equal(getAISettings().model,'gemini-custom-text');window.dispatchEvent(new window.Event('pagehide'));assert.equal(getAISettings(),null);
 }finally{globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA: proveedor explícito, clave OpenAI en Gemini bloqueada y corrección sin envío automático',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const calls=[];
 const {getAISettings}=await import('../dist/ai-settings.js');
 const fakeKey='sk-proj-only-a-test-not-a-real-key';
 globalThis.fetch=async(url,init)=>{
  calls.push(url);assert.equal(new URL(url).hostname,'api.openai.com');assert.equal(init.headers.Authorization,'Bearer '+fakeKey);
  if(init.method==='GET')return Response.json({data:[{id:'gpt-4.1-mini'}]});
  assert.equal(new URL(url).pathname,'/v1/responses');assert.equal(JSON.parse(init.body).model,'gpt-4.1-mini');
  return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({items:[{group:'Resumen',text:'Documento de prueba.',page:1,quote:'Documento de prueba'}],missing:[]})}]}]});
 };
 try{
  $('[data-ai-settings]').click();assert.equal($('#ai-provider').value,'');assert.equal($('#ai-key').disabled,true);assert.equal($('#ai-connect').disabled,true);
  await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/Elige primero/);assert.equal(calls.length,0);
  $('#ai-provider').value='gemini';$('#ai-provider').onchange();$('#ai-key').value=fakeKey;$('#ai-key').dispatchEvent(new window.Event('input'));
  assert.equal($('#ai-key-warning').hidden,false);assert.match($('#ai-key-warning').textContent,/OpenAI/);assert.equal($('#ai-key-provider-fix').hidden,false);
  assert.equal($('#ai-provider').value,'gemini');await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/AI_KEY_PROVIDER/);assert.equal(calls.length,0);assert.equal(getAISettings(),null);
  $('#ai-key-provider-fix').click();assert.equal($('#ai-provider').value,'openai');assert.equal($('#ai-key').value,fakeKey);assert.equal($('#ai-key-warning').hidden,true);assert.equal($('#ai-openai-help').hidden,false);assert.match($('#ai-connect').textContent,/OpenAI/);assert.equal(calls.length,0);
  await $('#ai-connect').onclick();assert.equal(calls.length,1);assert.equal(getAISettings().provider,'openai');assert.equal($('#ai-key').value,'');
  $('[data-ai-action="understand"]').click();await add([await sample()]);await $('#process').onclick();
  await $('#process').onclick();assert.equal($('#error').hidden,true,$('#error').textContent);assert.equal(calls.length,2);assert.match($('#result-preview').textContent,/Proveedor: OpenAI/);
  $('#work-close').click();$('[data-ai-settings]').click();$('#ai-forget').click();$('#ai-settings-close').click();assert.equal(getAISettings(),null);
 }finally{globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA manual también bloquea clave o modelo de otro proveedor sin red',async()=>{
 const previousFetch=globalThis.fetch;const {getAISettings}=await import('../dist/ai-settings.js');let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('No debe salir ninguna petición');};
 try{
  $('[data-ai-settings]').click();$('#ai-provider').value='gemini';$('#ai-provider').onchange();$('#ai-key').value='sk-proj-fake-only-testing';$('#ai-model-choice').value='manual';$('#ai-model-choice').onchange();$('#ai-model-id').value='gemini-test';
  await $('#ai-connect').onclick();assert.equal(getAISettings(),null);assert.match($('#ai-connect-status').textContent,/AI_KEY_PROVIDER/);
  $('#ai-provider').value='openai';$('#ai-provider').onchange();$('#ai-key').value='sk-proj-fake-only-testing';$('#ai-model-choice').value='manual';$('#ai-model-choice').onchange();$('#ai-model-id').value='gemini-test';
  await $('#ai-connect').onclick();assert.equal(getAISettings(),null);assert.match($('#ai-connect-status').textContent,/AI_MODEL_PROVIDER/);assert.equal(calls,0);$('#ai-settings-close').click();
 }finally{globalThis.fetch=previousFetch;}
});

test('IA: corregir proveedor o repetir su evento no borra la clave ya pegada',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const {getAISettings,forgetAISettings}=await import('../dist/ai-settings.js');
 const key='sk-proj-fake-provider-correction-test';let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(new URL(url).hostname,'api.openai.com');assert.equal(init.headers.Authorization,'Bearer '+key);return Response.json({data:[{id:'gpt-4.1-mini'}]});};
 try{
  $('[data-ai-settings]').click();$('#ai-provider').value='gemini';$('#ai-provider').dispatchEvent(new window.Event('change'));
  $('#ai-key').value=key;$('#ai-key').dispatchEvent(new window.Event('input'));await $('#ai-connect').onclick();assert.equal(calls,0);
  $('#ai-provider').value='openai';$('#ai-provider').dispatchEvent(new window.Event('change'));assert.equal($('#ai-key').value,key);
  $('#ai-model-choice').value='manual';$('#ai-model-choice').onchange();$('#ai-model-id').value='gpt-4.1-mini';
  $('#ai-provider').dispatchEvent(new window.Event('change'));assert.equal($('#ai-key').value,key);assert.equal($('#ai-model-choice').value,'manual');assert.equal($('#ai-model-id').value,'gpt-4.1-mini');assert.equal(calls,0);
  $('#ai-model-choice').value='auto';$('#ai-model-choice').onchange();
  await $('#ai-connect').onclick();assert.equal(calls,1);assert.equal(getAISettings().apiKey,key);
  $('[data-ai-settings]').click();$('#ai-settings-dialog').dispatchEvent(new window.Event('close'));assert.equal($('#ai-key').value,key);
 }finally{forgetAISettings();$('#ai-settings-close').click();globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA: distingue campo vacío, clave incompleta y rechazo, conservando el borrador para reintentar',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const {getAISettings,forgetAISettings}=await import('../dist/ai-settings.js');let calls=0;
 const key='sk-proj-fake-pasted-with-whitespace';
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(new URL(url).hostname,'api.openai.com');assert.equal(init.headers.Authorization,'Bearer '+key);return calls===1?Response.json({error:{code:'invalid_api_key'}},{status:401}):Response.json({data:[{id:'gpt-4.1-mini'}]});};
 try{
  $('[data-ai-settings]').click();$('#ai-provider').value='openai';$('#ai-provider').onchange();
  await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/campo de clave está vacío/);assert.equal(calls,0);
  $('#ai-key').value='sk-...';await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/AI_KEY_FORMAT.*incompleta/);assert.equal($('#ai-key').value,'sk-...');assert.equal(calls,0);
  $('#ai-key').value='sk-proj-fake spaces';await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/AI_KEY_FORMAT.*espacios/);assert.equal(calls,0);
  // Reading the DOM on Connect also supports paste/autofill without an input event.
  $('#ai-key').value='  '+key+'  ';await $('#ai-connect').onclick();assert.match($('#ai-connect-status').textContent,/AI_AUTH/);assert.equal($('#ai-key').value.trim(),key);assert.equal(calls,1);assert.equal(getAISettings(),null);
  await $('#ai-connect').onclick();assert.equal(calls,2);assert.equal(getAISettings().apiKey,key);assert.equal($('#ai-key').value,'');
 }finally{forgetAISettings();$('#ai-settings-close').click();globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA: un cierre pendiente de la apertura anterior no borra una clave nueva',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const {getAISettings,forgetAISettings}=await import('../dist/ai-settings.js');
 const key='sk-proj-fake-dialog-close-event-test';let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(new URL(url).hostname,'api.openai.com');assert.equal(init.headers.Authorization,'Bearer '+key);return Response.json({data:[{id:'gpt-4.1-mini'}]});};
 try{
  $('[data-ai-settings]').click();$('#ai-settings-close').click();$('[data-ai-settings]').click();
  $('#ai-provider').value='openai';$('#ai-provider').onchange();$('#ai-key').value=key;
  // Native dialog.close() queues a close event; our DOM stub does not.
  $('#ai-settings-dialog').dispatchEvent(new window.Event('close'));
  assert.equal($('#ai-key').value,key);assert.equal($('#ai-settings-dialog').open,true);
  await $('#ai-connect').onclick();assert.equal(calls,1);assert.equal(getAISettings().apiKey,key);
 }finally{forgetAISettings();$('#ai-settings-close').click();globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA: revisar es local; cambiar páginas o método exige revisar de nuevo y un clic explícito de envío',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const {forgetAISettings}=await import('../dist/ai-settings.js');const {collectAI}=await import('../dist/ai-ui.js');let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(new URL(url).hostname,'api.openai.com');if(init.method==='GET')return Response.json({data:[{id:'gpt-4.1-mini'}]});return Response.json({error:{code:'rate_limit_exceeded'}},{status:429});};
 try{
  $('[data-ai-settings]').click();$('#ai-provider').value='openai';$('#ai-provider').onchange();$('#ai-key').value='sk-proj-fake-flow-test';await $('#ai-connect').onclick();
  $('[data-ai-action="understand"]').click();await add([await sample('Este documento solicita aportar la factura del servicio realizado. Revisa los datos antes de enviarlos.')]);
  assert.match($('#ai-task-help').textContent,/un único informe/);await $('#process').onclick();assert.equal(calls,1);assert.equal($('#ai-send-notice').hidden,false);assert.match($('#ai-review-status').textContent,/Todavía no se ha enviado/);
  assert.throws(()=>collectAI(),/pulsa el botón «Enviar»/);assert.equal(calls,1);
  await $('#process').onclick({detail:2});assert.equal(calls,1);assert.equal($('#ai-send-notice').hidden,false);
  $('#opt-range').value='1';$('#opt-range').dispatchEvent(new window.Event('input'));assert.equal($('#ai-send-notice').hidden,true);assert.match($('#process').textContent,/Revisar/);
  await $('#process').onclick();assert.equal(calls,1);assert.equal($('#ai-send-notice').hidden,false);
  $('#opt-summarymode').value='local';$('#opt-summarymode').onchange();$('#opt-summarymode').value='ai';$('#opt-summarymode').onchange();assert.equal($('#ai-send-notice').hidden,true);assert.match($('#ai-task-help').textContent,/peticiones/);
  await $('#process').onclick();assert.equal(calls,1);assert.match($('#process').textContent,/Enviar a OpenAI y analizar/);
  await $('#process').onclick();assert.equal(calls,2);assert.match($('#error').textContent,/AI_RATE_LIMIT/);assert.equal($('#ai-send-notice').hidden,true);assert.match($('#process').textContent,/Revisar texto/);
  await $('#process').onclick();assert.equal(calls,2);assert.equal($('#error').hidden,true);assert.equal($('#ai-send-notice').hidden,false);
  $('#opt-summarymode').value='local';$('#opt-summarymode').onchange();assert.match($('#ai-method-help').textContent,/sin enviar datos/);assert.equal($('#ai-options').hidden,true);await $('#process').onclick();assert.equal(calls,2);assert.equal($('#error').hidden,true,$('#error').textContent);assert.equal($('#result').hidden,false);
 }finally{$('#work-close').click();forgetAISettings();globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA: configuración manual se distingue de conexión comprobada y revisar un PDF vacío permite corregir',async()=>{
 const previousFetch=globalThis.fetch;const {forgetAISettings}=await import('../dist/ai-settings.js');let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('No debe salir ninguna petición');};
 try{
  $('[data-ai-settings]').click();$('#ai-provider').value='openai';$('#ai-provider').onchange();$('#ai-key').value='sk-proj-fake-manual-test';$('#ai-model-choice').value='manual';$('#ai-model-choice').onchange();$('#ai-model-id').value='gpt-4.1-mini';await $('#ai-connect').onclick();
  assert.equal($('.topbar [data-ai-settings]').dataset.aiConnection,'manual');assert.match($('.topbar [data-ai-settings-label]').textContent,/IA configurada/);assert.equal(calls,0);
  const empty=await PDFDocument.create();empty.addPage();$('[data-ai-action="understand"]').click();await add([{name:'vacio.pdf',bytes:await empty.save()}]);
  await $('#process').onclick();assert.equal($('#ai-review-box').hidden,true);assert.match($('#ai-review-status').textContent,/OCR/);assert.equal($('#process').disabled,false);assert.equal(calls,0);
  await add([await sample()]);await $('#process').onclick();assert.equal($('#ai-send-notice').hidden,false);assert.equal(calls,0);
 }finally{$('#work-close').click();forgetAISettings();globalThis.fetch=previousFetch;}
});

test('IA: una sola entrada y un informe parcial de OpenAI se pueden leer y descargar sin reintentos',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=new URL('http://127.0.0.1:4567/'+'a'.repeat(32)+'/');
 const {getAISettings,forgetAISettings}=await import('../dist/ai-settings.js');let generations=0,allInvalid=false;
 const key='sk-proj-fake-partial-desktop-test';
 globalThis.fetch=async(url,init)=>{
  if(String(url).startsWith('blob:'))return previousFetch(url,init);
  if(String(url).endsWith('/_desktop/ai-vault'))return new Response(null,{status:204});
  assert.equal(String(url),globalThis.location.href+'_desktop/ai');
  const envelope=JSON.parse(init.body);assert.equal(envelope.headers.Authorization,'Bearer '+key);
  let body;
  if(envelope.method==='GET')body={data:[{id:'gpt-4.1-mini'}]};
  else{
   generations++;const request=JSON.parse(envelope.body),data=JSON.parse(request.input);
   assert.match(data.tarea,/Resume y explica/);
   const items=[{group:'Resumen',text:'Solicita una factura.',source_id:allInvalid?'inventado':data.fragmentos[0].id},{group:'Otros',text:'AFIRMACION_INVENTADA',source_id:'p999s1'}];
   body={output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({items,missing:[]})}]}]};
  }
  return Response.json({status:200,body:JSON.stringify(body)});
 };
 try{
  assert.equal(document.querySelectorAll('[data-ai-action="understand"]').length,1);assert.equal($('[data-ai-action="explain"]'),null);assert.equal($('[data-ai-action="summary"]'),null);
  $('[data-ai-settings]').click();$('#ai-provider').value='openai';$('#ai-provider').onchange();$('#ai-key').value=key;await $('#ai-connect').onclick();
  assert.match($('[data-ai-status]').textContent,/cerrar o recargar/);assert.match($('#ai-key-help').textContent,/escritorio/);
  $('[data-ai-action="understand"]').click();await add([await sample('Se solicita aportar la factura del servicio realizado.')]);
  assert.equal($('#opt-aimode'),null);await $('#process').onclick();assert.equal(generations,0);await $('#process').onclick();
  assert.equal($('#error').hidden,true,$('#error').textContent);assert.equal($('#result-title').textContent,'Informe parcial');assert.match($('#result-note').textContent,/omitido 1 punto/);
  assert.match($('#result-preview').textContent,/Solicita una factura/);assert.doesNotMatch($('#result-preview').textContent,/AFIRMACION_INVENTADA/);
  assert.equal(generations,1);assert.equal(getAISettings().apiKey,key);
  const text=await(await previousFetch($('#download').href)).text();assert.match(text,/Informe parcial/);assert.ok($('#result-viewer #view-canvas'));
  $('#work-close').click();assert.equal(getAISettings().apiKey,key);
  allInvalid=true;$('[data-ai-action="understand"]').click();await add([await sample('Se solicita aportar la factura del servicio realizado.')]);await $('#process').onclick();await $('#process').onclick();
  assert.equal($('#error').hidden,true);assert.equal($('#result-title').textContent,'Respuesta sin referencias comprobables');assert.equal($('#result .success-mark').textContent,'!');assert.match($('#result-note').textContent,/no se pudo localizar ninguna/);assert.doesNotMatch($('#result-preview').textContent,/AFIRMACION_INVENTADA|Solicita una factura/);assert.equal(generations,2);
  window.dispatchEvent(new window.Event('pagehide'));assert.equal(getAISettings(),null);assert.equal(window.localStorage.length,0);assert.equal(window.sessionStorage.length,0);
 }finally{$('#work-close').click();forgetAISettings();globalThis.fetch=previousFetch;delete globalThis.location;}
});

test('IA: recordar, bloquear, recargar y desbloquear sin enviar claves o documentos a la red',async()=>{
 const previousFetch=globalThis.fetch;globalThis.location=window.location;const {getAISettings,forgetAISettings,restoreAISettings}=await import('../dist/ai-settings.js');let calls=0;
 globalThis.fetch=async()=>{calls++;throw new Error('No debe consultar al proveedor en modo manual ni al desbloquear');};
 try{
  await forgetAISettings();$('[data-ai-settings]').click();$('#ai-provider').value='openai';$('#ai-provider').onchange();$('#ai-key').value='sk-proj-fake-vault-ui-only';$('#ai-model-choice').value='manual';$('#ai-model-choice').onchange();$('#ai-model-id').value='gpt-4.1-mini';
  $('#ai-remember').checked=true;$('#ai-remember').onchange();$('#ai-save-password').value='Local passphrase 123!';$('#ai-save-confirm').value='Not the same';
  await $('#ai-connect').onclick();assert.equal(calls,0);assert.equal(getAISettings(),null);assert.match($('#ai-connect-status').textContent,/no coinciden/);
  $('#ai-save-confirm').value='Local passphrase 123!';await $('#ai-connect').onclick();assert.equal($('#ai-settings-dialog').open,false);assert.equal($('#ai-save-password').value,'');assert.equal(getAISettings().apiKey,'sk-proj-fake-vault-ui-only');
  const saved=window.localStorage.getItem('pdf-contigo-ai-vault-v1');assert.ok(saved);assert.doesNotMatch(saved,/sk-proj|Local passphrase/);assert.match($('[data-ai-status]').textContent,/guardada cifrada/);
  window.dispatchEvent(new window.Event('pagehide'));assert.equal(getAISettings(),null);assert.equal(window.localStorage.getItem('pdf-contigo-ai-vault-v1'),saved);
  await restoreAISettings();$('[data-ai-settings]').click();assert.equal($('#ai-unlock-panel').hidden,false);assert.equal($('#ai-settings-fields').hidden,true);assert.match($('[data-ai-settings-label]').textContent,/Desbloquear/);
  $('#ai-unlock-password').value='Wrong passphrase 123!';await $('#ai-unlock').onclick();assert.equal(getAISettings(),null);assert.match($('#ai-unlock-status').textContent,/No se pudo desbloquear/);assert.equal($('#ai-unlock-password').value,'');
  $('#ai-unlock-password').value='Local passphrase 123!';await $('#ai-unlock').onclick();assert.equal($('#ai-settings-dialog').open,false);assert.equal(getAISettings().model,'gpt-4.1-mini');assert.equal(getAISettings().apiKey,'sk-proj-fake-vault-ui-only');assert.equal(calls,0);
  await forgetAISettings();assert.equal(window.localStorage.getItem('pdf-contigo-ai-vault-v1'),null);assert.equal(getAISettings(),null);
 }finally{await forgetAISettings();$('#ai-settings-close').click();globalThis.fetch=previousFetch;delete globalThis.location;}
});
test('IA: informe legible con citas plegadas, cobertura y datos como texto, nunca HTML',async()=>{
 const {renderAIReport}=await import('../dist/ai-report.js');const panel=document.createElement('div');let page;
 renderAIReport(panel,{items:[{group:'Resumen',text:'<img src=x onerror=alert(1)>',page:9,quote:'Un texto literal del PDF.'}],missing:[],coverage:{pages:[1,9],emptyPages:[1],characters:25}},n=>{page=n;});
 assert.equal(panel.querySelector('img'),null);assert.match(panel.textContent,/<img/);assert.equal(panel.querySelector('details').open,false);assert.match(panel.textContent,/Páginas sin texto legible: 1/);panel.querySelector('button').click();assert.equal(page,9);assert.equal(panel.querySelectorAll('section').length,1);
});
