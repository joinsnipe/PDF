import { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFDict, PDFRawStream, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from './vendor/pdf-lib.js';
import { readPdf, pageRange, stem, LIMITS } from './core.js';
import { openRenderedPdf, pageCanvas, canvasBlob } from './render.js';
import { signWithAutoFirma } from './autofirma.js';

export const ADVANCED_TOOLS=[
 ['viewer','Visor de PDF','Lee páginas, amplía el documento y busca texto.','analyze','search'],
 ['digitalsign','Firmar con certificado','Firma con tu certificado personal o de empresa y elige dónde mostrarla.','security','pen'],
 ['ocr','OCR · reconocer texto','Convierte escaneados en PDF buscable y texto. Español e inglés.','convert','search'],
 ['protect','Proteger PDF','Cifra el documento con una contraseña de apertura.','security','lock'],
 ['unlock','Desbloquear PDF','Quita el cifrado usando la contraseña que ya conoces.','security','lock'],
 ['forms','Rellenar formularios','Completa los campos interactivos de tu documento.','edit','pen'],
 ['flatten','Aplanar formularios','Fija los campos para que dejen de ser editables.','edit','pages'],
 ['signature','Añadir firma dibujada','Coloca un dibujo o imagen. No firma con un certificado digital.','edit','pen'],
 ['addtext','Añadir texto','Coloca una nota nueva sobre las páginas que elijas.','edit','text'],
 ['crop','Recortar márgenes','Ajusta el área visible de las páginas del PDF.','organize','pages'],
 ['resize','Cambiar tamaño','Adapta tus páginas a A4, A3 o Carta.','organize','pages'],
 ['redact','Ocultar una zona','Elimina visualmente una zona y genera un PDF de imágenes.','security','shield'],
 ['metadata','Quitar metadatos','Elimina título, autor y metadatos generales del PDF.','security','shield'],
 ['repair','Reparar estructura','Intenta reconstruir un PDF con errores estructurales.','edit','spark'],
 ['compare','Comparar texto','Encuentra frases añadidas y eliminadas entre dos PDF.','analyze','arrows'],
 ['summary','Resumen rápido','Selecciona frases relevantes con su número de página.','analyze','text'],
 ['word','PDF a Word · texto','Exporta texto editable a DOCX, sin reconstruir el diseño.','convert','text'],
 ['gray','Escala de grises','Genera una copia de imágenes en blanco, negro y grises.','edit','image']
].map(([id,name,desc,category,icon])=>({id,name,desc,category,icon,color:'#fff0ef',tone:'#d63232',action:({viewer:'Descargar original',digitalsign:'Firmar PDF',ocr:'Reconocer texto',protect:'Proteger PDF',unlock:'Desbloquear PDF',forms:'Guardar formulario',flatten:'Aplanar PDF',signature:'Añadir firma',addtext:'Añadir texto',crop:'Recortar PDF',resize:'Cambiar tamaño',redact:'Generar copia ocultada',metadata:'Quitar metadatos',repair:'Intentar reparación',compare:'Comparar documentos',summary:'Crear resumen',word:'Exportar a Word',gray:'Convertir a grises'})[id],detail:desc}));

export function formFields(doc){
  return doc.getForm().getFields().map(f=>{
    const base={name:f.getName(),readOnly:f.isReadOnly()};
    if(f instanceof PDFTextField)return {...base,kind:'text',value:f.getText()||'',max:f.getMaxLength()||10000};
    if(f instanceof PDFCheckBox)return {...base,kind:'check',value:f.isChecked()};
    if(f instanceof PDFDropdown||f instanceof PDFOptionList)return {...base,kind:'select',options:f.getOptions(),value:f.getSelected(),multiple:f.isMultiselect()};
    if(f instanceof PDFRadioGroup)return {...base,kind:'radio',options:f.getOptions(),value:f.getSelected()||''};
    return {...base,kind:'unsupported'};
  });
}
const outPdf=async(d,name,note='')=>[{bytes:await d.save(),name,type:'application/pdf',note}];
const outputText=(text,name,note='')=>[{bytes:new TextEncoder().encode(text),name,type:'text/plain;charset=utf-8',note,preview:text.slice(0,22000)}];
export function displayGeometry(p){
 const c=p.getCropBox(),angle=((p.getRotation().angle%360)+360)%360;
 const width=angle%180?c.height:c.width,height=angle%180?c.width:c.height;
 const map=(x,y)=>angle===90?[c.x+c.width-y,c.y+x]:angle===180?[c.x+c.width-x,c.y+c.height-y]:angle===270?[c.x+y,c.y+c.height-x]:[c.x+x,c.y+y];
 return {width,height,angle,map};
}
export function rectPercent(opts){
 const r={x:Number(opts.x??10),y:Number(opts.y??10),w:Number(opts.w??50),h:Number(opts.h??10)};
 if(Object.values(r).some(v=>!Number.isFinite(v))||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>100.001||r.y+r.h>100.001)throw new Error('La zona debe quedar dentro de la página (porcentajes entre 0 y 100).');
 return r;
}
export async function extractPages(file,opts={},progress=()=>{},extra={}){
 const d=await openRenderedPdf(file.bytes,extra);const result=[];
 try{const selected=pageRange(opts.range,d.numPages);for(let n=0;n<selected.length;n++){
  const p=await d.getPage(selected[n]+1),c=await p.getTextContent();
  result.push({page:selected[n]+1,text:c.items.map(x=>'str'in x?x.str+(x.hasEOL?'\n':' '):'').join('').trim()});p.cleanup();progress((n+1)/selected.length,`Leyendo página ${n+1} de ${selected.length}`);
 }}finally{await d.destroy();}
 return result;
}
const stop=new Set('a al algo ante bajo cada como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa ese eso esta estaba estas este esto estos fue ha hasta hay la las le les lo los mas me mi mis muy nada ni no nos o otra otro para pero por porque que quien se ser si sin sobre son su sus tambien te tiene todo tu un una unas uno unos y ya the and this that with from was were for are not have has you your their they into can will'.split(' '));
const tokens=s=>(s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g)||[]).filter(w=>!stop.has(w));
export function summarize(pages,count=8){
 const sentences=[];for(const p of pages){const text=p.text.replace(/\s+/g,' ').trim();
  const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('es',{granularity:'sentence'}).segment(text)].map(x=>x.segment):text.split(/(?<=[.!?])\s+/);
  for(const text of parts){if(text.trim().length>=35&&text.trim().length<=1500)sentences.push({text:text.trim(),page:p.page,words:tokens(text)});}
 }
 if(!sentences.length)throw new Error('No hay frases suficientes para resumir. Si es un escaneado, aplica OCR primero.');
 if(sentences.length>20000)throw new Error('El documento contiene demasiadas frases. Selecciona un intervalo de páginas.');
 const frequency=new Map();for(const s of sentences)for(const w of new Set(s.words))frequency.set(w,(frequency.get(w)||0)+1);
 const scored=sentences.map((s,index)=>({...s,index,score:s.words.reduce((n,w)=>n+Math.log(1+frequency.get(w)),0)/Math.sqrt(Math.max(1,s.words.length))}));
 const selected=[],seen=new Set();
 for(const s of scored.sort((a,b)=>b.score-a.score)){
  const normalized=s.text.toLocaleLowerCase();if(seen.has(normalized))continue;
  const set=new Set(s.words);const similar=selected.some(t=>{const union=new Set([...set,...t.words]);return [...set].filter(w=>t.words.includes(w)).length/Math.max(1,union.size)>.7;});
  if(similar)continue;selected.push(s);seen.add(normalized);if(selected.length>=count)break;
 }
 return selected.sort((a,b)=>a.index-b.index).map(({text,page})=>({text,page}));
}
export function compareText(a,b){
 const lines=pages=>pages.flatMap(p=>p.text.split(/\n+|(?<=[.!?])\s+/).map(text=>({text:text.trim(),page:p.page})).filter(x=>x.text));
 const aa=lines(a),bb=lines(b),norm=s=>s.replace(/\s+/g,' ').trim();
 const consume=(from,to)=>{const counts=new Map();for(const v of to)counts.set(norm(v.text),(counts.get(norm(v.text))||0)+1);return from.filter(v=>{const k=norm(v.text),n=counts.get(k)||0;if(n){counts.set(k,n-1);return false;}return true;});};
 return {removed:consume(aa,bb),added:consume(bb,aa)};
}
export async function wordDocument(pages,name,Zip=globalThis.JSZip){
 const xml=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 const z=new Zip();
 z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const paragraphs=pages.map((p,i)=>(i?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':'')+p.text.split('\n').map(t=>`<w:p><w:r><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`).join('')).join('');
 z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
 return [{bytes:await z.generateAsync({type:'uint8array'}),name,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',note:'Word editable con el texto extraído. No reconstruye imágenes, tablas, fuentes ni diseño.'}];
}
export function qpdfOperation(tool,file,opts={}){
 return new Promise((resolve,reject)=>{
  let worker,timer;
  const finish=(result,error)=>{clearTimeout(timer);worker?.terminate();opts.password='';opts.confirm='';error?reject(error):resolve(result);};
  try{
   worker=new Worker(new URL('./qpdf-worker.js',import.meta.url));timer=setTimeout(()=>finish(null,new Error('El motor superó 120 segundos. Prueba un PDF más pequeño.')),120000);
   worker.onmessage=e=>{const r=e.data;if(r.error)finish(null,Object.assign(new Error(r.error),{code:r.code}));else finish([{bytes:r.bytes,name:`${stem(file.name)}-${tool==='protect'?'protegido':tool==='unlock'?'desbloqueado':'reparado'}.pdf`,type:'application/pdf',note:r.note}]);};
   worker.onerror=()=>finish(null,new Error('No se pudo iniciar el motor PDF. Vuelve a abrir la aplicación.'));
   worker.postMessage({tool,bytes:file.bytes,opts});
  }catch(e){finish(null,e);}
 });
}
export function certificateOperation(data){
 return new Promise((resolve,reject)=>{
  let worker,timer;
  const finish=(result,error)=>{clearTimeout(timer);worker?.terminate();data.cert?.fill(0);data.password='';error?reject(error):resolve(result);};
  try{
   worker=new Worker(new URL('./sign-worker.js',import.meta.url),{type:'module'});
   timer=setTimeout(()=>finish(null,new Error('La operación de firma superó el tiempo permitido. Prueba un archivo menor.')),120000);
   worker.onmessage=e=>finish(e.data,e.data.error?Object.assign(new Error(e.data.error),{code:e.data.code}):null);
   worker.onerror=()=>finish(null,new Error('No se pudo iniciar el motor de firma.'));
   worker.postMessage(data);
  }catch(e){finish(null,e);}
 });
}
export async function advancedOperation(tool,files,opts={},progress=()=>{},extra={}){
 const f=files[0],base=stem(f.name);
 if(tool==='viewer'){if(f.encrypted)return qpdfOperation('unlock',f,opts);return [{bytes:f.bytes,name:f.name,type:'application/pdf',note:'Documento original sin cambios.'}];}
 if(tool==='digitalsign'){
  if(opts.method==='autofirma'){
   const bytes=await signWithAutoFirma(f,opts,progress,extra);
   return [{bytes,name:`${base}-firmado.pdf`,type:'application/pdf',note:'PDF recibido de AutoFirma. Guarda esta copia y comprueba su firma en el panel de firmas de un lector independiente. La app no verifica confianza, revocación ni validez jurídica; no configura sello de tiempo.'}];
  }
  if(!opts.certBytes?.length)throw new Error('Selecciona tu certificado P12 o PFX.');
  if(!opts.consent)throw new Error('Confirma que quieres firmar este documento con tu certificado.');
  try{const result=await certificateOperation({pdf:f.bytes,cert:opts.certBytes,password:opts.password,reason:opts.reason??'Aprobación del documento',appearance:{visible:opts.visible,page:opts.page,x:opts.x,y:opts.y,w:opts.w,h:opts.h}});
   return [{bytes:result.bytes,name:`${base}-firmado.pdf`,type:'application/pdf',note:`Firmado con el certificado de ${result.signerName}.${result.visible?` La marca visible está en la página ${result.page}.`:''} La firma criptográfica cubre el documento completo. Compruébala en el panel de firmas de tu lector PDF. Sin sello de tiempo ni validación de revocación.`}];
  }finally{opts.password='';opts.certBytes.fill(0);}
 }
 if(['protect','unlock','repair'].includes(tool)){
  if(tool==='protect'&&opts.password!==opts.confirm)throw new Error('Las contraseñas no coinciden.');
  return qpdfOperation(tool,f,opts);
 }
 if(['summary','compare','word'].includes(tool)){
  const pages=await extractPages(f,opts,progress,extra);
  if(!pages.some(p=>p.text.trim()))throw new Error('No hay texto seleccionable. Utiliza OCR antes de esta herramienta.');
  if(tool==='summary'){
   const items=summarize(pages,Math.min(20,Math.max(3,Number(opts.count||8))));
   return outputText(`RESUMEN EXTRACTIVO · ${f.name}\n${pages.length} páginas analizadas. Selección automática de frases, sin IA generativa. Puede omitir contexto; consulta el original.\n\n`+items.map(x=>`[Página ${x.page}] ${x.text}`).join('\n\n'),`${base}-resumen.txt`,'Frases del original seleccionadas por relevancia léxica. No es una síntesis exhaustiva ni una interpretación.');
  }
  if(tool==='word')return wordDocument(pages,`${base}-texto.docx`);
  if(files.length!==2)throw new Error('Añade exactamente dos PDF para comparar.');
  const other=await extractPages(files[1],{},progress,extra);
  if(!other.some(p=>p.text.trim()))throw new Error('El segundo PDF no contiene texto seleccionable. Aplica OCR primero.');
  const diff=compareText(pages,other),fmt=list=>list.length?list.map(x=>`[Página ${x.page}] ${x.text}`).join('\n\n'):'Ninguna diferencia de este tipo.';
  return outputText(`COMPARACIÓN DE TEXTO\nA: ${f.name}\nB: ${files[1].name}\n\nELIMINADO DE A (${diff.removed.length})\n${fmt(diff.removed)}\n\nAÑADIDO EN B (${diff.added.length})\n${fmt(diff.added)}\n\nCompara frases y multiplicidad; ignora cambios de orden, espacios, diseño, firmas e imágenes. No es una auditoría de identidad de archivos.`,`${base}-comparacion.txt`,'Comparación de texto: no detecta cambios visuales ni certifica que los documentos sean iguales.');
 }
 if(['redact','gray'].includes(tool))return rasterAdvanced(tool,f,opts,progress,extra);
 if(tool==='ocr')return ocrOperation(f,opts,progress,extra);
 const doc=await readPdf(f.bytes),count=doc.getPageCount();
 if(!['forms','flatten','metadata'].includes(tool)&&doc.getForm().getFields().length)throw new Error('Aplana los campos interactivos antes de usar esta herramienta.');
 if(tool==='metadata'){
  // Unlinking Info/XMP alone leaves their indirect objects in pdf-lib's output.
  // Empty the original objects too, preserving any aliases without stale data.
  const info=doc.context.lookup(doc.context.trailerInfo.Info);
  if(info instanceof PDFDict)for(const key of info.keys())info.delete(key);
  const xmp=doc.catalog.lookup(PDFName.of('Metadata'));
  if(xmp instanceof PDFRawStream){xmp.contents=new Uint8Array();xmp.dict.delete(PDFName.of('Filter'));xmp.dict.delete(PDFName.of('DecodeParms'));}
  doc.context.trailerInfo.Info=undefined;doc.catalog.delete(PDFName.of('Metadata'));
  return outPdf(doc,`${base}-sin-metadatos.pdf`,'Elimina Info y XMP del documento. No elimina texto visible, comentarios, adjuntos ni metadatos internos de imágenes; no garantiza anonimización.');
 }
 if(tool==='forms'||tool==='flatten'){
  const form=doc.getForm();
  if(form.hasXFA())throw new Error('Los formularios XFA no están soportados. Usa un PDF AcroForm.');
  if(!form.getFields().length)throw new Error('Este PDF no tiene campos de formulario.');
  if(formFields(doc).some(x=>x.kind==='unsupported'))throw new Error('El formulario contiene campos no compatibles, botones o firmas. No se modificará.');
  if(tool==='forms')for(const change of opts.fields||[]){const field=form.getField(change.name);if(field.isReadOnly())continue;
   if(field instanceof PDFTextField)field.setText(String(change.value));
   else if(field instanceof PDFCheckBox)change.value?field.check():field.uncheck();
   else if(field instanceof PDFDropdown||field instanceof PDFOptionList){field.clear();if(change.value?.length)field.select(change.value);}
   else if(field instanceof PDFRadioGroup){field.clear();if(change.value)field.select(change.value);}
  }
  try{form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));}catch{throw new Error('Hay caracteres que la fuente del formulario no admite. Usa letras latinas y revisa los campos.');}
  if(tool==='flatten'||opts.flatten)form.flatten();
  return outPdf(doc,`${base}-${tool==='flatten'||opts.flatten?'aplanado':'rellenado'}.pdf`);
 }
 const selected=new Set(pageRange(opts.range,count));
 if(tool==='crop'){
  const margin=Number(opts.margin??10);if(!Number.isFinite(margin)||margin<0||margin>100)throw new Error('El margen debe estar entre 0 y 100 mm.');const m=margin*72/25.4;
  for(const index of selected){const p=doc.getPage(index),b=p.getCropBox();if(b.width<=2*m||b.height<=2*m)throw new Error('El margen elimina toda la página. Reduce el valor.');p.setCropBox(b.x+m,b.y+m,b.width-2*m,b.height-2*m);}
  return outPdf(doc,`${base}-recortado.pdf`,'Recorta el área visible. El contenido fuera del recorte sigue en el archivo; usa Ocultar una zona para eliminar información.');
 }
 if(tool==='resize'){
  const sizes={a4:[595.28,841.89],a3:[841.89,1190.55],letter:[612,792]};let size=sizes[opts.size||'a4'];if(!size)throw new Error('Tamaño no válido.');if(opts.orientation==='landscape')size=[size[1],size[0]];
  const out=await PDFDocument.create();
  for(let i=0;i<count;i++){
   const page=doc.getPage(i);if(!selected.has(i)){const [copy]=await out.copyPages(doc,[i]);out.addPage(copy);continue;}
   const g=displayGeometry(page),b=page.getCropBox();const embedded=await out.embedPage(page,{left:b.x,bottom:b.y,right:b.x+b.width,top:b.y+b.height});
   const p=out.addPage(size),scale=Math.min((size[0]-24)/g.width,(size[1]-24)/g.height),w=b.width*scale,h=b.height*scale;
   const ox=(size[0]-g.width*scale)/2,oy=(size[1]-g.height*scale)/2;
   const x=ox+(g.angle===180?w:g.angle===270?h:0),y=oy+(g.angle===90?w:g.angle===180?h:0);
   p.drawPage(embedded,{x,y,width:w,height:h,rotate:degrees(-g.angle)});
  }
  return outPdf(out,`${base}-${opts.size||'a4'}.pdf`,'Recompone el contenido vectorial a otro tamaño. Enlaces y anotaciones de las páginas adaptadas no se conservan.');
 }
 if(tool==='addtext'||tool==='signature'){
  const r=rectPercent(opts);let image,font;
  if(tool==='signature'){
   if(!opts.imageBytes?.length)throw new Error('Dibuja una firma o selecciona una imagen.');
   image=opts.imageBytes[0]===137?await doc.embedPng(opts.imageBytes):await doc.embedJpg(opts.imageBytes);
  }else{font=await doc.embedFont(StandardFonts.Helvetica);if(!opts.text?.trim())throw new Error('Escribe el texto que quieres añadir.');try{font.encodeText(opts.text);}catch{throw new Error('El texto admite letras latinas y puntuación, sin emojis.');}}
  for(const i of selected){const p=doc.getPage(i),g=displayGeometry(p);const w=g.width*r.w/100,h=g.height*r.h/100,left=g.width*r.x/100,top=g.height*r.y/100;
   if(image){const s=Math.min(w/image.width,h/image.height),iw=image.width*s,ih=image.height*s;const [x,y]=g.map(left,g.height-top-ih);p.drawImage(image,{x,y,width:iw,height:ih,rotate:degrees(g.angle)});}
   else{const size=Math.min(Number(opts.fontsize||14),h*.8,w/Math.max(1,font.widthOfTextAtSize(opts.text,1)));if(size<4)throw new Error('La zona es demasiado pequeña para este texto. Amplíala.');const [x,y]=g.map(left,g.height-top-size);p.drawText(opts.text,{x,y,size,font,color:rgb(.12,.12,.12),rotate:degrees(g.angle)});}
  }
  return outPdf(doc,`${base}-${tool==='signature'?'firma-dibujada':'nota'}.pdf`,tool==='signature'?'Firma o sello como imagen. No contiene certificado digital ni verificación de identidad.':'Se añade una nota; no se edita ni elimina el texto original.');
 }
 throw new Error('Herramienta no reconocida.');
}

export async function rasterAdvanced(tool,file,opts,progress,extra={}){
 if(tool==='redact'&&!opts.consent)throw new Error('Confirma que el resultado será un PDF de imágenes.');
 const d=await openRenderedPdf(file.bytes,extra);const out=await PDFDocument.create();
 try{
  if(d.numPages>LIMITS.rendered)throw new Error('Máximo 150 páginas para esta conversión.');
  const selected=new Set(pageRange(opts.range,d.numPages)),r=tool==='redact'?rectPercent(opts):null;
  for(let i=0;i<d.numPages;i++){
   const {canvas,page}=await pageCanvas(d,i,2);const view=page.getViewport({scale:1}),ctx=canvas.getContext('2d');
   try{
    if(tool==='gray'){const image=ctx.getImageData(0,0,canvas.width,canvas.height);for(let k=0;k<image.data.length;k+=4){const g=Math.round(.2126*image.data[k]+.7152*image.data[k+1]+.0722*image.data[k+2]);image.data[k]=image.data[k+1]=image.data[k+2]=g;}ctx.putImageData(image,0,0);}
    else if(selected.has(i)){ctx.fillStyle='#000000';const x=Math.floor(canvas.width*r.x/100),y=Math.floor(canvas.height*r.y/100),right=Math.ceil(canvas.width*(r.x+r.w)/100),bottom=Math.ceil(canvas.height*(r.y+r.h)/100);ctx.fillRect(x,y,right-x,bottom-y);}
    const bytes=new Uint8Array(await(await canvasBlob(canvas,'image/png')).arrayBuffer());const image=await out.embedPng(bytes);out.addPage([view.width,view.height]).drawImage(image,{x:0,y:0,width:view.width,height:view.height});
   }finally{canvas.width=canvas.height=0;page.cleanup();}
   progress((i+1)/d.numPages,`Convirtiendo página ${i+1} de ${d.numPages}`);await new Promise(r=>setTimeout(r,0));
  }
  return outPdf(out,`${stem(file.name)}-${tool==='gray'?'grises':'ocultado'}.pdf`,tool==='redact'?'Se ha creado un PDF nuevo de imágenes. No contiene texto seleccionable ni objetos originales. Revisa todas las zonas ocultadas antes de compartir.':'PDF de imágenes en escala de grises. Pierde texto seleccionable, campos y enlaces; puede aumentar el tamaño.');
 }finally{await d.destroy();}
}
let tessPromise;
function loadTesseract(){return tessPromise??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL('./vendor/ocr/tesseract.min.js',import.meta.url).href;s.onload=()=>resolve(globalThis.Tesseract);s.onerror=()=>{tessPromise=null;reject(new Error('No se pudo cargar OCR. Revisa que el ZIP esté completamente extraído.'));};document.head.append(s);});}
export async function ocrOperation(file,opts,progress,extra={},workerFactory=null){
 const d=await openRenderedPdf(file.bytes,extra);let worker;
 try{
  const selected=pageRange(opts.range,d.numPages);if(selected.length>30)throw new Error('OCR admite 30 páginas por tarea. Elige un intervalo.');
  const factory=workerFactory||(await loadTesseract()).createWorker;
  progress(.01,'Iniciando OCR local…');
  worker=await factory(opts.language||'spa',1,{workerPath:new URL('./vendor/ocr/worker.min.js',import.meta.url).href,corePath:new URL('./vendor/ocr/core/',import.meta.url).href,langPath:new URL('./vendor/ocr/lang',import.meta.url).href,cacheMethod:'none',workerBlobURL:false,gzip:true});
  await worker.setParameters({user_defined_dpi:'144',preserve_interword_spaces:'1'});
  const out=await PDFDocument.create();let text='';let anyText=false;
  for(let n=0;n<selected.length;n++){
   const {canvas,page}=await pageCanvas(d,selected[n],2);const view=page.getViewport({scale:1});
   try{
    const png=await canvasBlob(canvas,'image/png');
    const {data}=await worker.recognize(new Uint8Array(await png.arrayBuffer()),{pdfTitle:'Documento OCR',pdfTextOnly:false},{text:true,pdf:true});
    text+=`--- Página ${selected[n]+1} ---\n${data.text||''}\n`;if(data.text?.trim())anyText=true;
    const recognized=await PDFDocument.load(data.pdf);const [p]=await out.copyPages(recognized,[0]);const sx=view.width/p.getWidth(),sy=view.height/p.getHeight();p.scale(sx,sy);out.addPage(p);
   }finally{canvas.width=canvas.height=0;page.cleanup();}
   progress((n+1)/selected.length,`OCR: página ${n+1} de ${selected.length}`);
  }
  if(!anyText)throw new Error('OCR no ha reconocido texto. Prueba un escaneado más nítido y con la orientación correcta.');
  return [{bytes:await out.save(),name:`${stem(file.name)}-ocr.pdf`,type:'application/pdf',note:'PDF con imagen y texto reconocido. OCR puede cometer errores: revisa nombres, importes y cifras.'},...outputText(text,`${stem(file.name)}-ocr.txt`)];
 }finally{if(worker)await worker.terminate();await d.destroy();}
}
