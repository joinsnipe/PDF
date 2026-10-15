import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {writeFile,mkdir} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from '../dist/vendor/pdf-lib.js';
import {layoutWord,layoutLines,editablePage} from '../dist/word-layout.js';
import {validateOffice,convertOffice,findOffice} from '../local/office.mjs';
const require=createRequire(import.meta.url),base=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const Zip=require(base?base+'/jszip':'jszip'),canvas=require(base?base+'/@napi-rs/canvas':'@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix:canvas.DOMMatrix,Path2D:canvas.Path2D,ImageData:canvas.ImageData,self:globalThis,JSZip:Zip});
globalThis.document={createElement:()=>{const c=canvas.createCanvas(1,1);c.toBlob=(cb,type='image/png',quality=.9)=>cb(new Blob([c.toBuffer(type,{quality:Math.round(quality*100)})],{type}));return c;}};
const vendor=fileURLToPath(new URL('../dist/vendor/',import.meta.url)),extra={standardFontDataUrl:vendor+'standard_fonts/',cMapUrl:vendor+'cmaps/',wasmUrl:vendor+'wasm/'};
async function sample(){const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);for(let n=1;n<=2;n++){const p=d.addPage([595,842]);p.drawText('Factura de ejemplo '+n,{x:45,y:770,size:22,font});for(const [i,row]of [['Concepto','Importe'],['Servicio A','120 EUR'],['Servicio B','90 EUR'],['Total','210 EUR']].entries())for(const [j,value]of row.entries())p.drawText(value,{x:45+j*260,y:690-i*25,size:12,font});}return {name:'factura.pdf',bytes:await d.save()};}
const hasOffice=!!await findOffice();
test('Word editable reconstruye tabla real; LibreOffice abre el DOCX y conserva el contenido',async()=>{
 const [out]=await layoutWord(await sample(),{wordmode:'editable'},()=>{},extra);const zip=await Zip.loadAsync(out.bytes),xml=await zip.file('word/document.xml').async('string');assert.equal((xml.match(/<w:tbl>/g)||[]).length,2);assert.match(xml,/Servicio A/);assert.match(xml,/w:sz/);validateOffice(out.bytes,'docx');
 await mkdir(new URL('../test-output/',import.meta.url),{recursive:true});await writeFile(new URL('../test-output/word-editable.docx',import.meta.url),out.bytes);
 if(hasOffice){const bytes=await convertOffice(out.bytes,'docx');const doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),2);await writeFile(new URL('../test-output/word-editable.pdf',import.meta.url),bytes);}
});
test('Word visual contiene imágenes por página y se convierte sin páginas vacías extra',async()=>{
 const [out]=await layoutWord(await sample(),{wordmode:'visual'},()=>{},extra);const zip=await Zip.loadAsync(out.bytes);assert.equal(Object.keys(zip.files).filter(n=>n.endsWith('.jpg')).length,2);assert.match(out.note,/no son editables/);await writeFile(new URL('../test-output/word-visual.docx',import.meta.url),out.bytes);
 if(hasOffice){const bytes=await convertOffice(out.bytes,'docx');assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);await writeFile(new URL('../test-output/word-visual.pdf',import.meta.url),bytes);}
});
test('Word editable rechaza escaneado y visual sí permite exportarlo',async()=>{const doc=await PDFDocument.create();doc.addPage([300,400]);const file={name:'scan.pdf',bytes:await doc.save()};await assert.rejects(()=>layoutWord(file,{wordmode:'editable'},()=>{},extra),/OCR/);assert.equal((await layoutWord(file,{wordmode:'visual'},()=>{},extra)).length,1);});
test('Office rechaza archivos hostiles antes de ejecutar LibreOffice',async()=>{
 const zip=new Zip();zip.file('[Content_Types].xml','<Types/>');zip.file('word/document.xml','<document/>');const good=await zip.generateAsync({type:'uint8array'});validateOffice(good,'docx');assert.throws(()=>validateOffice(good,'exe'),{code:'OFFICE_FORMAT'});
 for(const [name,content]of [['word/vbaProject.bin','x'],['word/embeddings/object.bin','x'],['word/_rels/document.xml.rels','<Relationships><Relationship TargetMode="External" Type="image" Target="file:///etc/passwd"/></Relationships>'],['word/document.xml','<!DOCTYPE doc [<!ENTITY a SYSTEM "file:///etc/passwd">]><doc>&a;</doc>']]){const z=await Zip.loadAsync(good);z.file(name,content);const b=await z.generateAsync({type:'uint8array'});assert.throws(()=>validateOffice(b,'docx'),{code:'OFFICE_UNSUPPORTED'});}
});
