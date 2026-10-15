import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {PDFDocument,PDFName,StandardFonts} from '../dist/vendor/pdf-lib.js';
import {advancedOperation,qpdfOperation} from '../dist/advanced.js';
import {openRenderedPdf,pageCanvas} from '../dist/render.js';
const require=createRequire(import.meta.url),runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const canvas=require(runtime?runtime+'/@napi-rs/canvas':'@napi-rs/canvas');
Object.assign(globalThis,{self:globalThis,DOMMatrix:canvas.DOMMatrix,Path2D:canvas.Path2D,ImageData:canvas.ImageData});
globalThis.document={createElement:()=>{const c=canvas.createCanvas(1,1);c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
const extra={standardFontDataUrl:fileURLToPath(new URL('../dist/vendor/standard_fonts/',import.meta.url))};
const tmp=await mkdtemp(tmpdir()+'/pdf-security-');after(()=>rm(tmp,{recursive:true,force:true}));
await writeFile(tmp+'/qpdf.cjs',await readFile(new URL('../dist/vendor/qpdf/qpdf.js',import.meta.url)));
const create=require(tmp+'/qpdf.cjs'),workerSource=await readFile(new URL('../dist/qpdf-worker.js',import.meta.url),'utf8');
async function worker(tool,bytes,password='',module=create){
 let result;const opts={password};
 const sandbox={URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,Module:module,importScripts(){},self:{location:{href:new URL('../dist/qpdf-worker.js',import.meta.url).href},postMessage(value){result=value;}}};
 vm.runInNewContext(workerSource,sandbox);await sandbox.self.onmessage({data:{tool,bytes,opts}});
 assert.equal(opts.password,'');return result;
}
async function sample(){const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);for(let i=0;i<2;i++)d.addPage([320,240]).drawText('PRUEBA SEGURIDAD PDF',{x:20,y:180,size:14,font});return d.save();}
async function text(bytes,password){const d=await openRenderedPdf(bytes,{...extra,password});try{return (await(await d.getPage(1)).getTextContent()).items.map(x=>x.str).join(' ');}finally{await d.destroy();}}
for(const [label,password]of [['ASCII','Clave-2026'],['Unicode','Contraseña-á€2026'],['arroba','@MiClave2026'],['guiones','--MiClave2026'],['espacios',' Mi clave 2026 '],['límite UTF-8','á'.repeat(63)+'a'],['emoji','Clave-🔑2026']])test(`proteger y desbloquear: ${label}, comprobado también con PDF.js`,async()=>{
 const source=await sample(),encrypted=await worker('protect',source,password);assert.ok(encrypted.bytes,encrypted.error);
 assert.match(await text(encrypted.bytes,password),/PRUEBA SEGURIDAD PDF/);
 const wrong=await worker('unlock',encrypted.bytes,'incorrecta');assert.equal(wrong.code,'PDF_PASSWORD');assert.equal(wrong.bytes,undefined);
 const unlocked=await worker('unlock',encrypted.bytes,password);assert.ok(unlocked.bytes,unlocked.error);assert.match(await text(unlocked.bytes),/PRUEBA SEGURIDAD PDF/);assert.equal((await PDFDocument.load(unlocked.bytes)).getPageCount(),2);
});
test('contraseña demasiado larga o NUL: rechaza antes de generar un PDF inaccesible',async()=>{
 for(const password of ['á'.repeat(80),'Clave\0-2026','abc']){const result=await worker('protect',await sample(),password);assert.match(result.code,/^PDF_PASSWORD_(LENGTH|FORMAT)$/);assert.equal(result.bytes,undefined);}
});
for(const [name,password]of [['aes256-unicode','Contraseña-á€2026'],['aes128-latin1','Señal-2026'],['rc4-128','Clave-2026'],['rc4-40','Clave-2026'],['aes256-empty','']])test(`desbloquea PDF externo pypdf: ${name}`,async()=>{
 const bytes=new Uint8Array(await readFile(new URL(`./fixtures/security/${name}.pdf`,import.meta.url)));
 for(const pass of [password,'Propietario-2026']){const r=await worker('unlock',bytes,pass);assert.ok(r.bytes,r.error);assert.match(await text(r.bytes),/PRUEBA SEGURIDAD PDF/);assert.equal((await PDFDocument.load(r.bytes)).getTitle(),'Documento ficticio de seguridad');}
});
test('separa archivo dañado y motor no disponible de contraseña incorrecta',async()=>{
 const bad=await worker('unlock',new TextEncoder().encode('%PDF-1.7\nroto'),'correcta');assert.equal(bad.code,'PDF_STRUCTURE');
 const engine=await worker('unlock',await sample(),'correcta',async()=>{throw new Error('offline');});assert.equal(engine.code,'PDF_ENGINE');
 const alreadyOpen=await worker('unlock',await sample(),'');assert.ok(alreadyOpen.bytes,alreadyOpen.error);
});
test('limpieza de contraseñas también si no se puede crear un trabajador',async()=>{
 globalThis.Worker=class{constructor(){throw new Error('no worker');}};
 const opts={password:'prueba',confirm:'prueba'};
 try{await assert.rejects(()=>qpdfOperation('protect',{name:'x.pdf',bytes:new Uint8Array()},opts),/no worker/);assert.equal(opts.password,'');assert.equal(opts.confirm,'');}finally{delete globalThis.Worker;}
});
test('metadatos: autor y XMP desaparecen también de los objetos no referenciados',async()=>{
 const d=await PDFDocument.load(await sample());d.setTitle('TITULO_PRIVADO');d.setAuthor('AUTOR_PRIVADO');
 const info=d.context.lookup(d.context.trailerInfo.Info),author=info.get(PDFName.of('Author')).toString(),title=info.get(PDFName.of('Title')).toString();
 const xmp=d.context.register(d.context.stream('<x:xmpmeta>DATOS_XMP_PRIVADOS</x:xmpmeta>',{Type:'Metadata',Subtype:'XML'}));d.catalog.set(PDFName.of('Metadata'),xmp);
 const[o]=await advancedOperation('metadata',[{name:'privado.pdf',bytes:await d.save()}]);const cleaned=await PDFDocument.load(o.bytes,{updateMetadata:false});
 assert.equal(cleaned.getAuthor(),undefined);assert.equal(cleaned.getTitle(),undefined);assert.equal(cleaned.catalog.has(PDFName.of('Metadata')),false);
 const objects=cleaned.context.enumerateIndirectObjects().map(([,obj])=>obj.toString()).join('\n');
 for(const secret of [author,title,'DATOS_XMP_PRIVADOS'])assert.equal(objects.includes(secret),false,'No conserva '+secret);
 assert.match(await text(o.bytes),/PRUEBA SEGURIDAD PDF/);
});
test('ocultar zona elimina objetos, formularios y adjuntos de todas las páginas',async()=>{
 const d=await PDFDocument.load(await sample());d.getForm().createTextField('dato_secreto').setText('VALOR_OCULTO');
 await d.attach(new TextEncoder().encode('ADJUNTO_SECRETO'),'privado.txt');
 const source={name:'privado.pdf',bytes:await d.save()};
 await assert.rejects(()=>advancedOperation('redact',[source],{x:0,y:0,w:100,h:40,range:'1'}),/Acepta|Confirma/);
 const[o]=await advancedOperation('redact',[source],{x:0,y:0,w:100,h:40,range:'1',consent:true},()=>{},extra);const cleaned=await PDFDocument.load(o.bytes);
 assert.equal(cleaned.getForm().getFields().length,0);assert.equal(cleaned.catalog.has(PDFName.of('Names')),false);assert.equal(await text(o.bytes),'');
 const doc=await openRenderedPdf(o.bytes,extra);try{const a=await pageCanvas(doc,0,1),b=await pageCanvas(doc,1,1);assert.deepEqual([...a.canvas.getContext('2d').getImageData(10,10,1,1).data],[0,0,0,255]);assert.deepEqual([...b.canvas.getContext('2d').getImageData(10,10,1,1).data],[255,255,255,255]);}finally{await doc.destroy();}
});
