import { PDFDocument, StandardFonts, degrees, rgb } from './vendor/pdf-lib.js';
import {signatureInfo,assertCanEdit} from './signature-policy.js';

export const LIMITS = { bytes: 100 * 1024 * 1024, pages: 500, rendered: 150, pixels: 16000000 };
export const niceSize = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
export const stem = name => name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0,100) || 'documento';
export function pageRange(input, count) {
  const value = String(input || '').trim();
  if (!value) return Array.from({ length: count }, (_, i) => i);
  const result = [];
  for (const piece of value.split(',')) {
    const m = piece.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error('Escribe páginas como 1, 3-5, 8.');
    const a = Number(m[1]), b = Number(m[2] || m[1]);
    if (a < 1 || b < 1 || a > count || b > count) throw new Error(`Las páginas deben estar entre 1 y ${count}.`);
    if (result.length + Math.abs(b - a) + 1 > LIMITS.pages) throw new Error(`Máximo ${LIMITS.pages} páginas por resultado.`);
    const step = a <= b ? 1 : -1;
    for (let i = a; ; i += step) { result.push(i - 1); if (i === b) break; }
  }
  return result;
}
export async function readPdf(bytes) {
  let doc;
  try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch (e) {
    if (/encrypt/i.test(e.message)) {const error=new Error('Este PDF está protegido. Ábrelo en el Visor o en Desbloquear PDF e introduce su contraseña.');error.code='PDF_PASSWORD';throw error;}
    throw new Error('No se ha podido leer el PDF. Puede estar dañado o no ser un PDF válido.');
  }
  if (!doc.getPageCount()) throw new Error('El PDF no contiene páginas.');
  if (doc.getPageCount() > LIMITS.pages) throw new Error(`Admitimos hasta ${LIMITS.pages} páginas por PDF en esta versión.`);
  return doc;
}
function ensureFlat(doc) {
  if (doc.getForm().getFields().length) throw new Error('Este PDF tiene formularios o campos de firma. Usa una copia aplanada: esta versión no conserva campos interactivos al editar.');
}
const pdfResult = async (doc, name, note = '') => ({ bytes: await doc.save(), name, type: 'application/pdf', note });

export async function processPdf(tool, files, opts = {}, progress = () => {}) {
  if (!files.length) throw new Error('Selecciona un archivo.');
  const docs = [];
  for (const file of files) { const d = await readPdf(file.bytes); assertCanEdit(signatureInfo(d)); ensureFlat(d); docs.push(d); }
  const doc = docs[0], count = doc.getPageCount(), base = stem(files[0].name);
  if (tool === 'merge') {
    if (docs.length < 2) throw new Error('Añade al menos dos PDF para unirlos.');
    if (docs.reduce((n,d) => n + d.getPageCount(),0) > LIMITS.pages) throw new Error(`El resultado supera ${LIMITS.pages} páginas.`);
    const out = await PDFDocument.create();
    for (let i = 0; i < docs.length; i++) {
      (await out.copyPages(docs[i], docs[i].getPageIndices())).forEach(p => out.addPage(p));
      progress((i + 1) / docs.length, `Uniendo archivo ${i + 1} de ${docs.length}`);
    }
    return [await pdfResult(out, 'documentos-unidos.pdf')];
  }
  if (tool === 'split') {
    const indices = pageRange(opts.range, count);
    if (opts.mode === 'each') {
      const outputs = [];
      for (let n = 0; n < indices.length; n++) {
        const out = await PDFDocument.create();
        const [p] = await out.copyPages(doc, [indices[n]]); out.addPage(p);
        outputs.push(await pdfResult(out, `${base}-${String(n+1).padStart(3,'0')}-pagina-${indices[n]+1}.pdf`));
        progress((n + 1) / indices.length, `Separando página ${n + 1} de ${indices.length}`);
      }
      return outputs;
    }
    const out = await PDFDocument.create();
    (await out.copyPages(doc, indices)).forEach(p => out.addPage(p));
    return [await pdfResult(out, `${base}-extracto.pdf`)];
  }
  if (tool === 'organize') {
    const pages = opts.pages || pageRange(opts.range, count).map(index => ({index, rotation: 0}));
    if (!pages.length) throw new Error('Conserva al menos una página.');
    if (pages.length > LIMITS.pages || pages.some(p => !Number.isInteger(p.index) || p.index < 0 || p.index >= count || !Number.isInteger(p.rotation) || p.rotation % 90 !== 0)) throw new Error('La selección de páginas no es válida.');
    const out = await PDFDocument.create();
    const copied = await out.copyPages(doc, pages.map(p => p.index));
    copied.forEach((p,i) => {p.setRotation(degrees((p.getRotation().angle + pages[i].rotation) % 360));out.addPage(p);});
    return [await pdfResult(out, `${base}-organizado.pdf`)];
  }
  if (tool === 'rotate') {
    const angle = Number(opts.angle || 90);
    if (![90,180,270].includes(angle)) throw new Error('El giro debe ser 90, 180 o 270 grados.');
    for (const index of new Set(pageRange(opts.range, count))) {
      const p = doc.getPage(index);p.setRotation(degrees((p.getRotation().angle + angle) % 360));
    }
    return [await pdfResult(doc, `${base}-girado.pdf`)];
  }
  if (tool === 'compress') {
    const result = await pdfResult(doc, `${base}-optimizado.pdf`);
    if (result.bytes.length >= files[0].bytes.length) return [{...result,bytes:files[0].bytes,name:`${base}-sin-cambios.pdf`,note:'El original ya ocupa menos: te devolvemos el original sin cambios.'}];
    result.note = `Reducción del ${((1 - result.bytes.length/files[0].bytes.length)*100).toFixed(1)} %. Texto e imágenes conservados.`;
    return [result];
  }
  if (tool === 'watermark' || tool === 'numbers') {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const text = String(opts.text || '').trim();
    if (tool === 'watermark' && (!text || text.length > 80)) throw new Error('Escribe una marca de agua de 1 a 80 caracteres.');
    try { if (tool === 'watermark') font.encodeText(text); }
    catch { throw new Error('La marca admite letras latinas, números y puntuación. No admite emojis ni otros alfabetos.'); }
    const start = Number(opts.start ?? 1);
    if (!Number.isInteger(start) || start < 1 || start > 99999) throw new Error('El número inicial debe estar entre 1 y 99999.');
    for (let i = 0; i < count; i++) {
      const p = doc.getPage(i);
      const {x:bx,y:by,width:w,height:h}=p.getCropBox();
      // Place stamps in displayed coordinates, including cropped and rotated pages.
      const angle = ((p.getRotation().angle%360)+360)%360;
      const vw = angle % 180 ? h : w, vh = angle % 180 ? w : h;
      const map = (x,y) => angle === 90 ? [bx+w-y,by+x] : angle === 180 ? [bx+w-x,by+h-y] : angle === 270 ? [bx+y,by+h-x] : [bx+x,by+y];
      const label = tool === 'watermark' ? text : `${i + start} / ${count + start - 1}`;
      let size = tool === 'watermark' ? Math.min(48, vw / Math.max(4,text.length)*1.4) : 10;
      size = Math.min(size, (vw-12) / Math.max(1,font.widthOfTextAtSize(label,1)));
      const tw = font.widthOfTextAtSize(label,size);
      const [x,y] = map((vw-tw)/2, tool === 'watermark' ? vh/2-size/2 : Math.min(22,vh/10));
      p.drawText(label,{x,y,size,font,rotate:degrees(angle),color:rgb(.27,.3,.34),opacity:tool === 'watermark' ? .25 : 1});
    }
    return [await pdfResult(doc,`${base}-${tool === 'watermark' ? 'marca' : 'numerado'}.pdf`)];
  }
  throw new Error('Herramienta no disponible.');
}

export async function imagesToPdf(files, opts = {}, progress = () => {}) {
  if (!files.length) throw new Error('Selecciona imágenes.');
  const doc = await PDFDocument.create();
  for (let i=0;i<files.length;i++) {
    const f=files[i]; const png = f.bytes[0]===137 && f.bytes[1]===80;
    const image = png ? await doc.embedPng(f.bytes) : await doc.embedJpg(f.bytes);
    if (image.width*image.height>LIMITS.pixels) throw new Error(`La imagen ${f.name} supera 16 megapíxeles. Redúcela antes de continuar.`);
    const landscape = opts.orientation === 'landscape';
    const pw = opts.size === 'original' ? image.width : landscape ? 841.89 : 595.28;
    const ph = opts.size === 'original' ? image.height : landscape ? 595.28 : 841.89;
    const margin = opts.size === 'original' ? 0 : 24;
    const scale = Math.min((pw-margin*2)/image.width,(ph-margin*2)/image.height);
    const w=image.width*scale,h=image.height*scale;
    const page = doc.addPage([pw,ph]); page.drawRectangle({x:0,y:0,width:pw,height:ph,color:rgb(1,1,1)});
    page.drawImage(image,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
    progress((i+1)/files.length,`Añadiendo imagen ${i+1} de ${files.length}`);
  }
  return [await pdfResult(doc,'imagenes.pdf')];
}
