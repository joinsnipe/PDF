import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, degrees, rgb } from '../dist/vendor/pdf-lib.js';
import { pageRange, readPdf, processPdf, imagesToPdf, LIMITS } from '../dist/core.js';
import { openRenderedPdf, renderOperation, pageCanvas } from '../dist/render.js';

const require=createRequire(import.meta.url);
const canvasModule=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/\u0040napi-rs/canvas' : '@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix:canvasModule.DOMMatrix,Path2D:canvasModule.Path2D,ImageData:canvasModule.ImageData});
globalThis.document={createElement:tag=>{
  assert.equal(tag,'canvas');
  const c=canvasModule.createCanvas(1,1);
  c.toBlob=(callback,type='image/png',quality=.85)=>callback(new Blob([c.toBuffer(type,{quality:Math.round(quality*100)})],{type}));
  return c;
}};
const base=fileURLToPath(new URL('../dist/vendor/',import.meta.url));
const rendererOptions={standardFontDataUrl:base+'standard_fonts/',cMapUrl:base+'cmaps/',wasmUrl:base+'wasm/'};
await mkdir(new URL('../test-output/',import.meta.url),{recursive:true});
async function sample(labels=['Alpha','Beta','Gamma'],rotation=0){
  const d=await PDFDocument.create();const font=await d.embedFont(StandardFonts.Helvetica);
  for(const label of labels){const p=d.addPage([400,520]);p.drawText(label,{x:45,y:440,size:25,font});p.drawRectangle({x:45,y:80,width:150,height:100,color:rgb(.8,.87,.7)});p.setRotation(degrees(rotation));}
  return {name:'ejemplo.pdf',bytes:await d.save()};
}
async function texts(bytes){const d=await openRenderedPdf(bytes,rendererOptions);try{const text=[];for(let i=1;i<=d.numPages;i++)text.push((await(await d.getPage(i)).getTextContent()).items.map(x=>x.str||'').join(' '));return text;}finally{await d.destroy();}}
test('rangos: todas, inversos, duplicados y entradas inválidas',()=>{
  assert.deepEqual(pageRange('',3),[0,1,2]);assert.deepEqual(pageRange('3, 2-1, 1',3),[2,1,0,0]);
  for(const r of ['0','4','1,,2','x','1.5','-1','1-1000000'])assert.throws(()=>pageRange(r,3));
});
test('unir conserva todas las páginas y el orden de los archivos',async()=>{
  const a=await sample(['A','B']),b=await sample(['C']);
  const [out]=await processPdf('merge',[b,a]);assert.deepEqual(await texts(out.bytes),['C','A','B']);
  await assert.rejects(()=>processPdf('merge',[a]),/dos/);
});
test('dividir extrae orden solicitado y genera nombres únicos para duplicados',async()=>{
  const f=await sample();const [out]=await processPdf('split',[f],{range:'3,1'});
  assert.deepEqual(await texts(out.bytes),['Gamma','Alpha']);
  const pieces=await processPdf('split',[f],{mode:'each',range:'1,1,2'});
  assert.equal(pieces.length,3);assert.equal(new Set(pieces.map(p=>p.name)).size,3);
  for(const piece of pieces)assert.equal((await readPdf(piece.bytes)).getPageCount(),1);
});
test('organizar elimina, reordena y gira sin perder contenido',async()=>{
  const f=await sample();const [out]=await processPdf('organize',[f],{pages:[{index:2,rotation:90},{index:0,rotation:0}]});
  assert.deepEqual(await texts(out.bytes),['Gamma','Alpha']);
  assert.equal((await readPdf(out.bytes)).getPage(0).getRotation().angle,90);
  await assert.rejects(()=>processPdf('organize',[f],{pages:[]}),/al menos/);
  await assert.rejects(()=>processPdf('organize',[f],{pages:[{index:9,rotation:0}]}),/válida/);
});
test('giro selectivo se suma a la rotación existente y deduplica',async()=>{
  const f=await sample(undefined,90);const [out]=await processPdf('rotate',[f],{range:'2,2',angle:90});
  assert.deepEqual((await readPdf(out.bytes)).getPages().map(p=>p.getRotation().angle),[90,180,90]);
});
test('optimización nunca devuelve un archivo mayor y conserva el texto',async()=>{
  const f=await sample();const [out]=await processPdf('compress',[f]);assert.ok(out.bytes.length<=f.bytes.length);assert.deepEqual(await texts(out.bytes),['Alpha','Beta','Gamma']);
});
test('marca y numeración visibles en páginas normales, giradas y recortadas',async()=>{
  const d=await PDFDocument.create();const font=await d.embedFont(StandardFonts.Helvetica);
  for(const angle of [0,90,180,270]){const p=d.addPage([450,600]);p.setCropBox(20,30,400,520);p.setRotation(degrees(angle));p.drawText('DOCUMENTO DE PRUEBA',{x:45,y:480,size:18,font});}
  const f={name:'giros.pdf',bytes:await d.save()};const [marked]=await processPdf('watermark',[f],{text:'COPIA INTERNA'});
  const [numbered]=await processPdf('numbers',[marked],{start:5});
  const extracted=await texts(numbered.bytes);for(let i=0;i<4;i++){assert.match(extracted[i],/COPIA INTERNA/);assert.ok(extracted[i].includes(`${5+i} / 8`));}
  await writeFile(new URL('../test-output/marcas-giros.pdf',import.meta.url),numbered.bytes);
  const rendered=await openRenderedPdf(numbered.bytes,rendererOptions);
  try{for(let i=0;i<4;i++){const {canvas}=await pageCanvas(rendered,i,1);await writeFile(new URL(`../test-output/marcas-${i}.png`,import.meta.url),canvas.toBuffer('image/png'));}}finally{await rendered.destroy();}
  await assert.rejects(()=>processPdf('watermark',[f],{text:'🔐'}),/emojis/);
});
test('imágenes a PDF: página por imagen, tamaño y orientación',async()=>{
  const canvas=canvasModule.createCanvas(320,180);const ctx=canvas.getContext('2d');ctx.fillStyle='#c8e49e';ctx.fillRect(0,0,320,180);
  const png={name:'a.png',bytes:new Uint8Array(canvas.toBuffer('image/png'))};
  const jpg={name:'b.jpg',bytes:new Uint8Array(canvas.toBuffer('image/jpeg'))};
  const [out]=await imagesToPdf([png,jpg],{size:'a4',orientation:'landscape'});const doc=await readPdf(out.bytes);
  assert.equal(doc.getPageCount(),2);assert.ok(doc.getPage(0).getWidth()>doc.getPage(0).getHeight());
  const [original]=await imagesToPdf([png],{size:'original'});assert.equal((await readPdf(original.bytes)).getPage(0).getWidth(),320);
});
test('PDF a JPG/PNG usa páginas seleccionadas y produce imágenes válidas',async()=>{
  const f=await sample();
  for(const format of ['jpg','png']){const out=await renderOperation('pdfimages',f,{format,range:'3,1',scale:1},()=>{},rendererOptions);assert.equal(out.length,2);const img=await canvasModule.loadImage(out[0].bytes);assert.equal(img.width,400);assert.equal(img.height,520);}
});
test('texto se extrae y un escaneado sin texto produce un error claro',async()=>{
  const out=await renderOperation('text',await sample(),{range:'2'},()=>{},rendererOptions);assert.match(new TextDecoder().decode(out[0].bytes),/Beta/);
  const canvas=canvasModule.createCanvas(100,100);const [scan]=await imagesToPdf([{name:'scan.png',bytes:new Uint8Array(canvas.toBuffer('image/png'))}],{size:'a4'});
  await assert.rejects(()=>renderOperation('text',scan,{},()=>{},rendererOptions),/OCR/);
});
test('compresión ligera reduce una imagen grande y mantiene dimensiones',async()=>{
  const canvas=canvasModule.createCanvas(1600,2000),ctx=canvas.getContext('2d');
  // A deterministic, nonuniform image exercises actual resampling and compression.
  const data=ctx.createImageData(1600,2000);let seed=42;
  for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;data.data[i]=seed&255;data.data[i+1]=(seed>>>8)&255;data.data[i+2]=(seed>>>16)&255;data.data[i+3]=255;}ctx.putImageData(data,0,0);
  const [f]=await imagesToPdf([{name:'scan.png',bytes:new Uint8Array(canvas.toBuffer('image/png'))}],{size:'a4'});
  const [out]=await renderOperation('compress',f,{},()=>{},rendererOptions);
  assert.ok(out.bytes.length<f.bytes.length);assert.equal((await readPdf(out.bytes)).getPageCount(),1);assert.ok(Math.abs((await readPdf(out.bytes)).getPage(0).getWidth()-595.28)<.1);
  assert.deepEqual(await texts(out.bytes),['']);
});
test('PDF dañados, formularios y rangos fuera de límite se rechazan',async()=>{
  await assert.rejects(()=>readPdf(new Uint8Array([1,2,3])),/válido/);
  const d=await PDFDocument.create();const p=d.addPage();d.getForm().createTextField('nombre').addToPage(p);
  await assert.rejects(async()=>processPdf('split',[{name:'form.pdf',bytes:await d.save()}]),/campos/);
  const big=await sample(Array.from({length:151},(_,i)=>String(i)));
  await assert.rejects(()=>renderOperation('pdfimages',big,{},()=>{},rendererOptions),/150/);
});
test('interfaz sin transmisión de documentos ni dependencias externas',async()=>{
  const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');assert.doesNotMatch(app,/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB)\b/);
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/src="https?:/);assert.doesNotMatch(html,/<link\b[^>]*href="https?:/);assert.match(html,/connect-src 'self'/);
});
