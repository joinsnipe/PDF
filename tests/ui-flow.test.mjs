import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
