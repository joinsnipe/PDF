import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {PDFDocument,rgb} from '../dist/vendor/pdf-lib.js';
import {createPageBrowser} from '../dist/page-browser.js';
import {openRenderedPdf,pageCanvas,canvasBlob} from '../dist/render.js';
const require=createRequire(import.meta.url),deps=process.env.PDF_BUILD_DEPS,runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const {JSDOM}=require(deps?deps+'/jsdom':'jsdom');
const canvas=require(runtime?runtime+'/@napi-rs/canvas':'@napi-rs/canvas');
const dom=new JSDOM('<main></main>');
Object.assign(globalThis,{document:dom.window.document,DOMMatrix:canvas.DOMMatrix,Path2D:canvas.Path2D,ImageData:canvas.ImageData});
const create=document.createElement.bind(document);
document.createElement=(name,...args)=>{if(name!=='canvas')return create(name,...args);const c=canvas.createCanvas(1,1);c.toBlob=(cb,type='image/png')=>cb(new Blob([c.toBuffer(type)],{type}));return c;};
const container=document.querySelector('main');
const render={openRenderedPdf:bytes=>openRenderedPdf(bytes,{standardFontDataUrl:fileURLToPath(new URL('../dist/vendor/standard_fonts/',import.meta.url))}),pageCanvas,canvasBlob};
async function sample(count=3){const doc=await PDFDocument.create();for(let i=0;i<count;i++){const p=doc.addPage([300,420]);p.drawRectangle({x:0,y:0,width:300,height:420,color:rgb(.8,0,i/count)});}const bytes=await doc.save();return {name:'Documento muy largo de prueba.pdf',bytes,pages:count};}
const waitUntil=async predicate=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>setTimeout(r,5));assert.ok(predicate());};
test('miniaturas reales: selección por clic, giro elegido y liberación de imágenes',async()=>{
 let range='',angle=90;const browser=createPageBrowser({container,files:[await sample()],tool:'rotate',getOptions:()=>({range,angle}),onSelection:value=>{range=value;},render});
 await browser.ready;assert.equal(container.querySelectorAll('img').length,3);
 const tiles=[...container.querySelectorAll('.preview-tile')],image=tiles[0].querySelector('img'),url=image.src;
 const bitmap=await canvas.loadImage(Buffer.from(await(await fetch(url)).arrayBuffer()));assert.equal(bitmap.width,180);assert.equal(bitmap.height,252);
 const check=canvas.createCanvas(1,1);check.getContext('2d').drawImage(bitmap,0,0,1,1);const pixel=check.getContext('2d').getImageData(0,0,1,1).data;assert.ok(pixel[0]>150&&pixel[1]<30,'La miniatura contiene el dibujo del PDF');
 assert.match(image.style.transform,/rotate\(90deg\)/);tiles[1].click();assert.equal(range,'1, 3');assert.equal(tiles[1].getAttribute('aria-pressed'),'false');assert.equal(tiles[1].querySelector('img').style.transform,'');
 angle=270;browser.update();assert.match(image.style.transform,/rotate\(270deg\)/);
 range='2';browser.update();assert.equal(tiles[0].getAttribute('aria-pressed'),'false');assert.equal(tiles[1].getAttribute('aria-pressed'),'true');tiles[1].click();assert.equal(range,'2');assert.match(container.querySelector('.preview-status').textContent,/al menos/);
 range='99';browser.update();assert.match(container.querySelector('.preview-status').textContent,/intervalo/);
 browser.dispose();assert.equal(container.children.length,0);await assert.rejects(()=>fetch(url));
});
test('documentos largos: solo doce renders iniciales y carga del siguiente lote',async()=>{
 let rendered=0;const browser=createPageBrowser({container,files:[await sample(15)],tool:'compress',render:{...render,pageCanvas:async(...args)=>{rendered++;return pageCanvas(...args);}}});
 await browser.ready;assert.equal(rendered,12);assert.equal(container.querySelectorAll('.preview-tile').length,12);
 const more=[...container.querySelectorAll('button')].find(b=>b.textContent==='Mostrar más páginas');more.click();await waitUntil(()=>container.querySelectorAll('img').length===15);assert.equal(rendered,15);assert.equal(more.hidden,true);browser.dispose();
});
test('cerrar durante una carga no añade imágenes ni deja el documento abierto',async()=>{
 let resolve,closed=0;const pending=new Promise(r=>{resolve=r;});
 const browser=createPageBrowser({container,files:[{name:'pendiente.pdf',pages:1,bytes:new Uint8Array()}],tool:'rotate',render:{openRenderedPdf:()=>pending}});
 browser.dispose();resolve({destroy:async()=>{closed++;}});await browser.ready;assert.equal(closed,1);assert.equal(container.children.length,0);
});
test('PDF cifrado: no intenta renderizarlo antes de desbloquear; imágenes muestran el orden',async()=>{
 let attempted=false;const locked=createPageBrowser({container,files:[{pages:4,encrypted:true}],tool:'unlock',render:{openRenderedPdf:()=>{attempted=true;}}});await locked.ready;assert.equal(container.hidden,true);assert.equal(attempted,false);locked.dispose();
 const c=canvas.createCanvas(8,8),bytes=new Uint8Array(c.toBuffer('image/png'));
 const images=createPageBrowser({container,files:[{name:'B.png',bytes},{name:'A.png',bytes}],tool:'images'});await images.ready;assert.equal(container.querySelectorAll('img').length,2);assert.deepEqual([...container.querySelectorAll('.thumbnail-label')].map(x=>x.textContent),['B.png · Imagen 1','A.png · Imagen 2']);images.dispose();
});
