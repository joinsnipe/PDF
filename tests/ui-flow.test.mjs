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
async function sample(){const d=await PDFDocument.create();const p=d.addPage();p.drawText('Documento de prueba',{font:await d.embedFont(StandardFonts.Helvetica),x:40,y:700});return {name:'prueba.pdf',bytes:await d.save()};}
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
 const buttons=[...document.querySelectorAll('[data-tool]')];assert.equal(buttons.length,28);
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
 $('[data-tool="signature"]').click();assert.equal($('#clear-signature').textContent,'Limpiar dibujo');assert.match($('#signature-status').textContent,/sin certificado/);$('#work-close').click();
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
