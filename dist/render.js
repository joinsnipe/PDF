import { PDFDocument, LIMITS, pageRange, stem, readPdf } from './runtime-exports.js';

let renderer;
export async function loadRenderer() {
  renderer ??= await import('./vendor/pdf.mjs');
  renderer.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  return renderer;
}
export async function openRenderedPdf(bytes, extra = {}) {
  const lib = await loadRenderer();
  return lib.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false,
    cMapUrl: new URL('./vendor/cmaps/',import.meta.url).href, cMapPacked:true,
    standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,
    wasmUrl:new URL('./vendor/wasm/',import.meta.url).href, ...extra }).promise;
}
export async function pageCanvas(doc, index, scale = 1.5) {
  const page = await doc.getPage(index+1);
  let viewport = page.getViewport({ scale });
  if (viewport.width*viewport.height > LIMITS.pixels) {
    scale *= Math.sqrt(LIMITS.pixels/(viewport.width*viewport.height));
    viewport = page.getViewport({scale});
  }
  const canvas = document.createElement('canvas');
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  try {
    await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
    return {canvas,page,viewport};
  } catch(e) {canvas.width=canvas.height=0;page.cleanup();throw e;}
}
export function canvasBlob(canvas, type='image/jpeg', quality=.85) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se ha podido convertir la imagen.')),type,quality));
}
export async function renderOperation(tool, file, opts, progress=()=>{}, extra={}) {
  const doc = await openRenderedPdf(file.bytes,extra);
  try {
    const selected = pageRange(opts.range,doc.numPages);
    if (tool !== 'text' && selected.length > LIMITS.rendered) throw new Error(`Selecciona hasta ${LIMITS.rendered} páginas por conversión a imagen.`);
    if (tool === 'text') {
      let text='';let found=false;
      for (let i=0;i<selected.length;i++) {
        const page=await doc.getPage(selected[i]+1);const content=await page.getTextContent();
        const lines=content.items.map(t=>('str' in t ? t.str+(t.hasEOL?'\n':' ') : '')).join('');
        if(lines.trim())found=true;
        text+=`--- Página ${selected[i]+1} ---\n${lines}\n\n`;page.cleanup();
        progress((i+1)/selected.length,`Extrayendo página ${i+1} de ${selected.length}`);
      }
      if(!found)throw new Error('No hay texto seleccionable en estas páginas. Utiliza la herramienta OCR para reconocer el texto de un escaneado.');
      return [{bytes:new TextEncoder().encode(text),name:`${stem(file.name)}-texto.txt`,type:'text/plain;charset=utf-8',note:'El orden de lectura puede variar en tablas o documentos con varias columnas. No incluye OCR.'}];
    }
    if (tool==='compress') {
      const original = await readPdf(file.bytes);
      if (original.getForm().getFields().length) throw new Error('Este PDF tiene campos interactivos. Usa una copia aplanada antes de comprimir.');
    }
    const out=tool==='compress'?await PDFDocument.create():null;const results=[];
    const scale=tool==='compress' ? Number(opts.scale || 1.25):Number(opts.scale || 1.5);
    for(let n=0;n<selected.length;n++) {
      const {canvas,page,viewport}=await pageCanvas(doc,selected[n],scale);
      try {
        const type=tool==='compress' || opts.format!=='png'?'image/jpeg':'image/png';
        const blob=await canvasBlob(canvas,type,tool==='compress' ? .62 : .9);
        const bytes=new Uint8Array(await blob.arrayBuffer());
        if(out) {
          const image=await out.embedJpg(bytes),view=page.getViewport({scale:1});
          const p=out.addPage([view.width,view.height]);p.drawImage(image,{x:0,y:0,width:view.width,height:view.height});
        } else results.push({bytes,name:`${stem(file.name)}-${String(n+1).padStart(3,'0')}-pagina-${selected[n]+1}.${type==='image/png'?'png':'jpg'}`,type});
      } finally {canvas.width=canvas.height=0;page.cleanup();}
      progress((n+1)/selected.length,`Procesando página ${n+1} de ${selected.length}`);
      await new Promise(r=>setTimeout(r,0));
    }
    if(out) {
      const bytes=await out.save();
      if(bytes.length>=file.bytes.length)return [{bytes:file.bytes,name:`${stem(file.name)}-sin-cambios.pdf`,type:'application/pdf',note:'La conversión no redujo el tamaño. Te devolvemos el original sin cambios.'}];
      return [{bytes,name:`${stem(file.name)}-ligero.pdf`,type:'application/pdf',note:`Reducción del ${((1-bytes.length/file.bytes.length)*100).toFixed(1)} %. Páginas convertidas a imágenes: revisa la legibilidad. El texto deja de ser seleccionable.`}];
    }
    return results;
  } finally {await doc.destroy();}
}
