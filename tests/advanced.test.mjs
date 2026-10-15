import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import {tmpdir} from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PDFDocument, StandardFonts, rgb, degrees, PDFName } from '../dist/vendor/pdf-lib.js';
import { advancedOperation, formFields, summarize, compareText, wordDocument, ocrOperation } from '../dist/advanced.js';
import { readPdf,imagesToPdf } from '../dist/core.js';
import { openRenderedPdf, pageCanvas } from '../dist/render.js';
const require=createRequire(import.meta.url),runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const build=process.env.PDF_BUILD_DEPS;
const scratch=await mkdtemp(path.join(tmpdir(),'pdf-tests-'));
await mkdir(new URL('../test-output/',import.meta.url),{recursive:true});
const canvasMod=require(runtime?runtime+'/@napi-rs/canvas':'@napi-rs/canvas'),Zip=require(runtime?runtime+'/jszip':'jszip');
Object.assign(globalThis,{DOMMatrix:canvasMod.DOMMatrix,Path2D:canvasMod.Path2D,ImageData:canvasMod.ImageData,self:globalThis,JSZip:Zip});
globalThis.document={createElement:()=>{const c=canvasMod.createCanvas(1,1);c.toBlob=(cb,type='image/png',quality=.9)=>cb(new Blob([c.toBuffer(type,{quality:Math.round(quality*100)})],{type}));return c;}};
const base=fileURLToPath(new URL('../dist/vendor/',import.meta.url));
const extra={standardFontDataUrl:base+'standard_fonts/',cMapUrl:base+'cmaps/',wasmUrl:base+'wasm/'};
async function sample(){const d=await PDFDocument.create();const font=await d.embedFont(StandardFonts.Helvetica);for(let i=0;i<2;i++){const p=d.addPage([400,500]);p.drawText('PRIVATE SECRET 123',{x:40,y:430,size:20,font});p.drawText('Visible content',{x:40,y:70,size:15,font});}d.setTitle('Private title');d.setAuthor('Private author');return {name:'example.pdf',bytes:await d.save()};}
async function text(bytes){const d=await openRenderedPdf(bytes,extra);try{const arr=[];for(let i=1;i<=d.numPages;i++)arr.push((await(await d.getPage(i)).getTextContent()).items.map(x=>x.str).join(' '));return arr;}finally{await d.destroy();}}
test('metadatos, recorte, tamaño y texto añadido',async()=>{
 const f=await sample();const[m]=await advancedOperation('metadata',[f]);const md=await readPdf(m.bytes);assert.equal(md.getTitle(),undefined);assert.equal(md.getAuthor(),undefined);assert.equal(md.catalog.has(PDFName.of('Metadata')),false);
 const[c]=await advancedOperation('crop',[f],{margin:10,range:'1'});const cd=await readPdf(c.bytes);assert.ok(cd.getPage(0).getCropBox().width<400);assert.equal(cd.getPage(1).getCropBox().width,400);
 const[r]=await advancedOperation('resize',[f],{size:'a4'});assert.equal((await readPdf(r.bytes)).getPage(0).getWidth(),595.28);assert.match((await text(r.bytes))[0],/PRIVATE SECRET/);
 const[t]=await advancedOperation('addtext',[f],{range:'2',text:'NOTA NUEVA',x:10,y:30,w:70,h:10,fontsize:18});const tt=await text(t.bytes);assert.doesNotMatch(tt[0],/NOTA/);assert.match(tt[1],/NOTA NUEVA/);
});
test('formularios guardan valores canónicos y aplanado elimina campos',async()=>{
 const d=await PDFDocument.create(),p=d.addPage(),form=d.getForm();form.createTextField('nombre').addToPage(p,{x:20,y:600,width:200,height:30});form.createCheckBox('acepta').addToPage(p,{x:20,y:550});form.createDropdown('zona').addOptions(['Norte','Sur']);form.getDropdown('zona').addToPage(p,{x:20,y:500,width:200,height:30});
 const f={name:'form.pdf',bytes:await d.save()};assert.equal(formFields(await readPdf(f.bytes)).length,3);
 const[o]=await advancedOperation('forms',[f],{fields:[{name:'nombre',value:'Rubén'},{name:'acepta',value:true},{name:'zona',value:['Sur']}]});const fields=(await readPdf(o.bytes)).getForm();assert.equal(fields.getTextField('nombre').getText(),'Rubén');assert.equal(fields.getCheckBox('acepta').isChecked(),true);assert.deepEqual(fields.getDropdown('zona').getSelected(),['Sur']);
 const[flat]=await advancedOperation('flatten',[o]);assert.equal((await readPdf(flat.bytes)).getForm().getFields().length,0);assert.match((await text(flat.bytes))[0],/Rubén/);
 await writeFile(new URL('../test-output/form-aplanado.pdf',import.meta.url),flat.bytes);
});
test('firma dibujada preserva páginas y añade imagen',async()=>{
 const canvas=canvasMod.createCanvas(300,80),ctx=canvas.getContext('2d');ctx.font='35px sans-serif';ctx.fillText('Firma',10,50);
 const[o]=await advancedOperation('signature',[await sample()],{imageBytes:new Uint8Array(canvas.toBuffer('image/png')),range:'2',x:10,y:70,w:40,h:15});assert.equal((await readPdf(o.bytes)).getPageCount(),2);assert.match((await text(o.bytes))[1],/Visible content/);
});
test('ocultación elimina objetos y texto originales y cubre el área negra',async()=>{
 const[o]=await advancedOperation('redact',[await sample()],{x:0,y:0,w:100,h:30,range:'1',consent:true},()=>{},extra);assert.deepEqual(await text(o.bytes),['','']);
 const d=await openRenderedPdf(o.bytes,extra);try{const{canvas}=await pageCanvas(d,0,1);assert.deepEqual([...canvas.getContext('2d').getImageData(50,50,1,1).data],[0,0,0,255]);await writeFile(new URL('../test-output/ocultado.png',import.meta.url),canvas.toBuffer('image/png'));}finally{await d.destroy();}
 assert.equal(Buffer.from(o.bytes).includes(Buffer.from('PRIVATE SECRET')),false);
});
test('grises produce canales iguales y conserva dimensiones',async()=>{
 const[o]=await advancedOperation('gray',[await sample()],{},()=>{},extra);const d=await openRenderedPdf(o.bytes,extra);try{const{canvas}=await pageCanvas(d,0,1);const pixel=canvas.getContext('2d').getImageData(50,50,1,1).data;assert.equal(pixel[0],pixel[1]);assert.equal(pixel[1],pixel[2]);assert.equal(canvas.width,400);}finally{await d.destroy();}
});
test('resumen usa frases literales con referencia y comparación respeta duplicados',()=>{
 const pages=[{page:1,text:'La empresa revisa las facturas cada semana. El presupuesto requiere aprobación antes de comenzar el trabajo. El equipo comprueba todas las facturas.'},{page:2,text:'Las facturas pendientes se revisan el viernes. El seguimiento permite detectar pagos pendientes.'}];
 const result=summarize(pages,3);assert.equal(result.length,3);for(const r of result)assert.ok(pages.find(p=>p.page===r.page).text.includes(r.text));
 const diff=compareText([{page:1,text:'A.\nA.\nB.'}],[{page:1,text:'A.\nC.'}]);assert.equal(diff.removed.length,2);assert.equal(diff.added.length,1);
});
test('Word genera un paquete OOXML válido con texto escapado',async()=>{
 const[o]=await wordDocument([{page:1,text:'Texto <privado> & editable'},{page:2,text:'Segundo bloque'}],'texto.docx',Zip);const z=await Zip.loadAsync(o.bytes);assert.ok(z.file('[Content_Types].xml'));const xml=await z.file('word/document.xml').async('string');assert.match(xml,/&lt;privado&gt; &amp;/);assert.match(xml,/w:type="page"/);await writeFile(new URL('../test-output/texto.docx',import.meta.url),o.bytes);
});
async function qpdfWorker(tool,bytes,opts={}){
 const src=await readFile(new URL('../dist/vendor/qpdf/qpdf.js',import.meta.url),'utf8');const cjs=scratch+'/qpdf-test.cjs';await writeFile(cjs,src);const create=require(cjs);
 let result;const sandbox={URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,Module:create,importScripts(){},self:{location:{href:new URL('../dist/qpdf-worker.js',import.meta.url).href},postMessage(value){result=value;}}};
 vm.runInNewContext(await readFile(new URL('../dist/qpdf-worker.js',import.meta.url),'utf8'),sandbox);await sandbox.self.onmessage({data:{tool,bytes,opts}});return result;
}
test('qpdf worker: AES256, contraseña incorrecta, descifrado y reparación',async()=>{
 const f=await sample();const encrypted=await qpdfWorker('protect',f.bytes,{password:'correct-password'});assert.ok(encrypted.bytes,encrypted.error);await writeFile(new URL('../test-output/encrypted.pdf',import.meta.url),encrypted.bytes);await assert.rejects(()=>readPdf(encrypted.bytes),/protegido/);
 const bad=await qpdfWorker('unlock',encrypted.bytes,{password:'wrong'});assert.match(bad.error,/contraseña/);
 const unlocked=await qpdfWorker('unlock',encrypted.bytes,{password:'correct-password'});assert.ok(unlocked.bytes,unlocked.error);assert.deepEqual(await text(unlocked.bytes),await text(f.bytes));
 const repaired=await qpdfWorker('repair',f.bytes);assert.ok(repaired.bytes,repaired.error);assert.equal((await readPdf(repaired.bytes)).getPageCount(),2);
});
test('OCR español e inglés genera texto y PDF buscable con modelos locales',{timeout:120000},async()=>{
 const canvas=canvasMod.createCanvas(1200,500),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1200,500);ctx.fillStyle='black';ctx.font='bold 52px sans-serif';ctx.fillText('FACTURA DE PRUEBA',50,100);ctx.font='44px sans-serif';ctx.fillText('Importe total 125 euros',50,210);ctx.fillText('Payment received',50,300);
 const[f]=await imagesToPdf([{name:'scan.png',bytes:new Uint8Array(canvas.toBuffer('image/png'))}],{size:'original'});
 const savedDocument=globalThis.document;delete globalThis.document;const {createWorker}=require(build?build+'/tesseract.js':'tesseract.js');globalThis.document=savedDocument;
 const factory=(lang,oem)=>createWorker(lang,oem,{langPath:base+'ocr/lang',cacheMethod:'none',gzip:true});
 const outputs=await ocrOperation(f,{language:'spa+eng'},()=>{},extra,factory);assert.equal(outputs.length,2);assert.match(new TextDecoder().decode(outputs[1].bytes),/125/);assert.match((await text(outputs[0].bytes))[0],/125/);assert.equal((await readPdf(outputs[0].bytes)).getPage(0).getWidth(),1200);
 await writeFile(new URL('../test-output/ocr.pdf',import.meta.url),outputs[0].bytes);
});
test('firma RSA: CMS verificado, alteración rechazada y certificado incorrecto rechazado',async()=>{
 const {signDocument}=await import('../dist/vendor/signing.js');const key=scratch+'/key.pem',cert=scratch+'/cert.pem',pfx=scratch+'/fixture.p12';
 assert.equal(spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=PDF TEST ONLY']).status,0);
 assert.equal(spawnSync('openssl',['pkcs12','-export','-out',pfx,'-inkey',key,'-in',cert,'-passout','pass:fixture-only']).status,0);
 const p12=await readFile(pfx);const f=await sample();
 await assert.rejects(()=>signDocument(f.bytes,p12,'wrong'),/contraseña/);
 const result=await signDocument(f.bytes,p12,'fixture-only');const bytes=Buffer.from(result.bytes),ranges=bytes.toString('latin1').match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/).slice(1).map(Number);assert.equal(ranges[2]+ranges[3],bytes.length);
 const cms=Buffer.from(bytes.subarray(ranges[1]+1,ranges[2]-1).toString(),'hex'),n=cms[1],len=n&128?cms.readUIntBE(2,n&127):n,header=n&128?2+(n&127):2;const prefix=scratch;
 await writeFile(prefix+'/verify.der',cms.subarray(0,header+len));const content=Buffer.concat([bytes.subarray(0,ranges[1]),bytes.subarray(ranges[2])]);await writeFile(prefix+'/verify.bin',content);
 const args=['cms','-verify','-binary','-inform','DER','-in',prefix+'/verify.der','-content',prefix+'/verify.bin','-noverify','-out','/dev/null'];assert.equal(spawnSync('openssl',args).status,0);
 content[20]^=1;await writeFile(prefix+'/verify.bin',content);assert.notEqual(spawnSync('openssl',args).status,0);
 await assert.rejects(()=>signDocument(result.bytes,p12,'fixture-only'),/firma/);
 await writeFile(new URL('../test-output/firmado-test.pdf',import.meta.url),result.bytes);
});
