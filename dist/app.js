import { ADVANCED_TOOLS, advancedOperation, formFields } from './advanced.js';
import { advancedOptions, bindAdvanced, collectAdvanced, clearAdvanced } from './advanced-ui.js';
import { LIMITS, niceSize, readPdf, processPdf, imagesToPdf, pageRange } from './core.js';
import { openRenderedPdf, pageCanvas, canvasBlob, renderOperation } from './render.js';
import {signatureInfo,assertCanEdit,readsOriginal,signatureNotice} from './signature-policy.js';
import {createPageBrowser} from './page-browser.js';

const paths={
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  pages:'M8 3h10l3 3v14H8z M8 7H3v14h5 M17 3v5h4',
  arrows:'M4 7h15l-4-4 M20 17H5l4 4 M19 7l-4 4 M5 17l4-4',
  pen:'M14 5l5 5 M4 20l4-1L20 7a2 2 0 0 0-5-5L3 14z',
  shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 17h.01',
  lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  spark:'M12 2l2 7 8 3-8 2-2 8-3-8-7-2 7-3z',
  search:'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15 M16 16l5 5',
  upload:'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6',
  merge:'M4 3h5v8H4z M15 3h5v8h-5z M6 14v3h12v-3 M12 17v5 M9 19l3 3 3-3',
  split:'M8 2h8v8H8z M12 10v4 M5 22v-5h14v5 M2 19l3 3 3-3 M16 19l3 3 3-3',
  compress:'M4 4l6 6 M4 9V4h5 M20 20l-6-6 M15 20h5v-5 M14 10l6-6 M15 4h5v5 M10 14l-6 6 M4 15v5h5',
  image:'M3 4h18v16H3z M3 16l5-5 4 4 4-6 5 7 M7 8h.01',
  imagepdf:'M5 2h10l4 4v16H5z M14 2v5h5 M8 18l3-5 5 5z M8 10h.01',
  rotate:'M20 8a9 9 0 1 0 1 8 M20 3v5h-5 M9 7h5v10H9z',
  stamp:'M8 13h8l3 4v4H5v-4z M9 13V6a3 3 0 0 1 6 0v7 M3 21h18',
  numbers:'M9 3L7 21 M17 3l-2 18 M3 9h18 M2 15h18',
  text:'M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5',
  info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 11v6 M12 7h.01'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.pages}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
const tools=[
  {id:'merge',name:'Unir PDF',desc:'Varios documentos, un solo archivo. En el orden que tú elijas.',category:'organize',icon:'merge',color:'#edf3e4',tone:'#7a905b',tag:'POPULAR',action:'Unir PDF',detail:'Añade dos o más PDF y ordénalos con las flechas. Se unirán de arriba abajo.'},
  {id:'split',name:'Dividir PDF',desc:'Extrae las páginas que necesitas o sepáralas en archivos.',category:'organize',icon:'split',color:'#f9ece4',tone:'#be8c70',action:'Dividir PDF',detail:'Extrae un intervalo o descarga cada página como un PDF independiente.'},
  {id:'compress',name:'Comprimir PDF',desc:'Reduce el peso y elige cómo conservar el contenido.',category:'edit',icon:'compress',color:'#edf0fb',tone:'#7c8cbd',action:'Comprimir PDF',detail:'Optimiza la estructura sin pérdida o crea una copia ligera con las páginas convertidas en imágenes.'},
  {id:'organize',name:'Organizar páginas',desc:'Reordena, gira o elimina páginas de un documento.',category:'organize',icon:'pages',color:'#fbf2de',tone:'#baa366',action:'Guardar PDF',detail:'Usa las flechas para cambiar el orden, gira páginas o exclúyelas del resultado.'},
  {id:'images',name:'Imágenes a PDF',desc:'Convierte tus JPG y PNG en un documento listo para enviar.',category:'convert',icon:'imagepdf',color:'#f5eaf3',tone:'#b17da8',action:'Crear PDF',detail:'Añade imágenes JPG o PNG. Cada imagen ocupará una página, en el orden de la lista.'},
  {id:'pdfimages',name:'PDF a imágenes',desc:'Guarda cada página como una imagen JPG o PNG.',category:'convert',icon:'image',color:'#e8f2f3',tone:'#76a2a7',action:'Convertir a imágenes',detail:'Convierte las páginas seleccionadas y descarga todas las imágenes en un ZIP.'},
  {id:'rotate',name:'Girar PDF',desc:'Pon tus páginas en la orientación correcta.',category:'organize',icon:'rotate',color:'#e9f0ea',tone:'#75947b',action:'Girar PDF',detail:'Gira todo el documento o solo las páginas que indiques.'},
  {id:'watermark',name:'Marca de agua',desc:'Añade un texto discreto a todas las páginas.',category:'edit',icon:'stamp',color:'#f8eae7',tone:'#bd8c81',action:'Añadir marca',detail:'Coloca una marca de agua centrada y semitransparente en cada página.'},
  {id:'numbers',name:'Numerar páginas',desc:'Mantén tus documentos en orden con números de página.',category:'edit',icon:'numbers',color:'#edeafa',tone:'#9a8cb6',action:'Numerar PDF',detail:'Añade numeración en el centro del margen inferior de cada página. Revisa que no tape contenido.'},
  {id:'text',name:'Extraer texto',desc:'Recupera el texto seleccionable de un PDF en formato TXT.',category:'convert',icon:'text',color:'#f0efe8',tone:'#9b987a',action:'Extraer texto',detail:'Extrae el texto ya presente en el PDF. No reconoce texto de fotografías o escaneados (OCR).'}
];
tools.push(...ADVANCED_TOOLS);
const $=s=>document.querySelector(s);
const dialog=$('#work-dialog');let filter='all',active=null,files=[],busy=false,loading=false,outputUrls=[],previewUrls=[],pageState=[],previewDoc=null,generation=0,lastDownload=null,pageBrowser=null;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderTools(){
  const search=$('#search').value.toLocaleLowerCase('es');
  const displayed=tools.filter(t=>(filter==='all'||t.category===filter)&&`${t.name} ${t.desc}`.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(search.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));
  $('#tool-grid').innerHTML=displayed.map(t=>`<button class="tool-card" data-tool="${t.id}" style="--tint:${t.color};--tone:${t.tone}"><span class="tool-icon">${icon(t.icon)}</span>${t.tag?`<span class="card-tag">${t.tag}</span>`:''}<span class="card-arrow" aria-hidden="true">↗</span><h3>${t.name}</h3><p>${t.desc}</p></button>`).join('');
  $('#empty-search').hidden=!!displayed.length;
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderTools();}));
$('#search').addEventListener('input',renderTools);
$('#tool-grid').addEventListener('click',e=>{const b=e.target.closest('[data-tool]');if(b)openTool(b.dataset.tool);});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!dialog.open&&!$('#help-dialog').open&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}});
for(const id of ['help-open','privacy-open'])$('#'+id).onclick=()=>$('#help-dialog').showModal();
for(const id of ['help-close','help-done'])$('#'+id).onclick=()=>$('#help-dialog').close();

function error(message){$('#error').textContent=message;$('#error').hidden=false;}
function clearError(){$('#error').hidden=true;$('#error').textContent='';}
function freeOutputs(){lastDownload=null;$('#share-result').hidden=true;$('#open-result').removeAttribute('href');outputUrls.forEach(URL.revokeObjectURL);outputUrls=[];$('#individual-downloads').replaceChildren();$('#download').removeAttribute('href');}
function releasePreview(){generation++;pageBrowser?.dispose();pageBrowser=null;previewUrls.forEach(URL.revokeObjectURL);previewUrls=[];if(previewDoc){previewDoc.destroy().catch(()=>{});previewDoc=null;}}
function reset(){clearAdvanced();freeOutputs();releasePreview();files=[];pageState=[];$('#result').hidden=true;$('#result-viewer').replaceChildren();$('#editor-area').hidden=false;$('#process').hidden=false;$('#status').hidden=true;clearError();renderFiles();renderOptions();}
function openTool(id){active=tools.find(t=>t.id===id);$('#work-title').textContent=active.name;$('#work-description').textContent=active.detail;$('#work-icon').innerHTML=icon(active.icon);$('#work-icon').style.setProperty('--tint',active.color);$('#work-icon').style.setProperty('--tone',active.tone);$('#process').innerHTML=`${active.action} <span>→</span>`;$('#file-input').accept=id==='images'?'.jpg,.jpeg,.png':'.pdf';$('#file-input').multiple=['merge','images','compare'].includes(id);$('#drop-title').textContent=id==='images'?'Arrastra tus imágenes aquí':'Arrastra tus PDF aquí';$('#file-limits').textContent=id==='images'?'JPG o PNG · Hasta 100 MB · 16 MP por imagen':'Hasta 100 MB en total · 500 páginas';$('#document-note').hidden=['images','text','pdfimages','summary','compare','word','viewer'].includes(id);reset();dialog.showModal();}
function closeTool(){if(busy||loading)return;dialog.close();reset();}
$('#work-close').onclick=closeTool;
dialog.addEventListener('cancel',e=>{e.preventDefault();closeTool();});
$('#start-again').onclick=reset;
$('#clear-files').onclick=reset;
$('#choose-files').onclick=$('#add-files').onclick=()=>$('#file-input').click();
$('#file-input').addEventListener('change',async e=>{const chosen=[...e.target.files];e.target.value='';await addFiles(chosen);});
window.addEventListener('pdf-desktop-open',async e=>{
  if(busy||loading||!e.detail?.file)return;
  openTool('viewer');
  await addFiles([e.detail.file]);
});
const zone=$('#dropzone');
zone.addEventListener('dragover',e=>{e.preventDefault();if(!busy&&!loading)zone.classList.add('dragover');});
zone.addEventListener('dragleave',()=>zone.classList.remove('dragover'));
zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragover');addFiles([...e.dataTransfer.files]);});
dialog.addEventListener('dragover',e=>e.preventDefault());
dialog.addEventListener('drop',e=>e.preventDefault());

function setBusy(value,isLoading=false){busy=value&&!isLoading;loading=value&&isLoading;$('#editor-area').inert=value;$('#work-close').disabled=value;$('#process').disabled=value||!canProcess();$('#status').hidden=!value;}
function canProcess(){return files.length>0&&(active.id!=='merge'||files.length>1)&&(active.id!=='compare'||files.length===2);}
function progress(fraction,label){$('#progress').value=fraction*100;$('#status-text').textContent=label;}
async function addFiles(chosen){
  if(busy||loading||!chosen.length)return;clearError();
  const multi=['merge','images','compare'].includes(active.id);
  if(active.id==='compare'&&files.length+chosen.length>2){error('Añade exactamente dos PDF. Vacía la selección para empezar de nuevo.');return;}
  if(!multi&&chosen.length>1){error('Esta herramienta admite un archivo cada vez.');return;}
  const total=chosen.reduce((n,f)=>n+f.size,0)+(multi?files.reduce((n,f)=>n+f.size,0):0);
  if(total>LIMITS.bytes){error('El total supera 100 MB. Trabaja con menos archivos.');return;}
  if(chosen.length+(multi?files.length:0)>100){error('Admitimos hasta 100 archivos por tarea.');return;}
  setBusy(true,true);progress(0,'Comprobando archivos…');const incoming=[];
  try{
    for(let i=0;i<chosen.length;i++){
      const f=chosen[i],bytes=new Uint8Array(await f.arrayBuffer());let pages=1,fields=[],encrypted=false,signatures=null;
      if(active.id==='images'){
        const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpg=bytes[0]===255&&bytes[1]===216;
        if(!png&&!jpg)throw new Error(`${f.name}: selecciona una imagen JPG o PNG.`);
        const bmp=await createImageBitmap(f);
        try{if(bmp.width*bmp.height>LIMITS.pixels)throw new Error(`${f.name}: supera 16 megapíxeles. Reduce su tamaño antes de añadirla.`);}finally{bmp.close();}
      }else{
        if(!new TextDecoder('latin1').decode(bytes.slice(0,1024)).includes('%PDF-'))throw new Error(`${f.name}: no parece un PDF válido.`);
        try{const doc=await readPdf(bytes);pages=doc.getPageCount();signatures=signatureInfo(doc);if(active.id==='forms')fields=formFields(doc);}catch(e){if((active.id==='viewer'||active.id==='unlock')&&e.code==='PDF_PASSWORD'){pages=null;encrypted=true;}else if(active.id==='repair'){pages=null;}else throw e;}
      }
      incoming.push({name:f.name,size:f.size,bytes,pages,fields,encrypted,signatures});progress((i+1)/chosen.length,`Leyendo ${i+1} de ${chosen.length}`);
    }
    if(active.id==='merge'&&[...files,...incoming].reduce((n,f)=>n+f.pages,0)>LIMITS.pages)throw new Error('La unión supera el límite de 500 páginas.');
    files=multi?[...files,...incoming]:incoming;freeOutputs();$('#result').hidden=true;renderFiles();renderOptions();
    if(active.id==='organize')await buildPages();
  }catch(e){error(e.message||'No se ha podido abrir el archivo.');}finally{setBusy(false);}
}
function renderFiles(){
  $('#file-area').hidden=!files.length;$('#dropzone').hidden=!!files.length;$('#files-count').textContent=files.length;$('#add-files').textContent=['merge','images','compare'].includes(active.id)?'Añadir archivos ＋':'Cambiar archivo';
  $('#file-list').innerHTML=files.map((f,i)=>`<li class="file-item"><span class="file-type">${active.id==='images'?'IMG':'PDF'}</span><span class="file-info"><strong title="${escape(f.name)}">${escape(f.name)}</strong><small>${niceSize(f.size)}${active.id==='images'||f.pages===null?'':` · ${f.pages} ${f.pages===1?'página':'páginas'}`}</small></span><span class="file-controls">${files.length>1?`<button data-file-action="up" data-index="${i}" ${i===0?'disabled':''} aria-label="Subir ${escape(f.name)}">↑</button><button data-file-action="down" data-index="${i}" ${i===files.length-1?'disabled':''} aria-label="Bajar ${escape(f.name)}">↓</button>`:''}<button data-file-action="remove" data-index="${i}" aria-label="Quitar ${escape(f.name)}">✕</button></span></li>`).join('');
  $('#total-size').textContent=niceSize(files.reduce((n,f)=>n+f.size,0));$('#process').disabled=busy||loading||!canProcess();
}
$('#file-list').addEventListener('click',e=>{const b=e.target.closest('[data-file-action]');if(!b||busy||loading)return;const i=Number(b.dataset.index);if(b.dataset.fileAction==='remove')files.splice(i,1);else{const j=i+(b.dataset.fileAction==='up'?-1:1);[files[i],files[j]]=[files[j],files[i]];}renderFiles();if(active.id==='organize'){releasePreview();pageState=[];renderOptions();}else{clearAdvanced();renderOptions();}});
const rangeField=()=>`<label class="field">Páginas<input id="opt-range" placeholder="Todas · ej.: 1, 3-5, 8" autocomplete="off"><small>Vacío = todas.${files.length?` El documento tiene ${files[0].pages} páginas.`:''}</small></label>`;
function renderOptions(){
  let html='';
  switch(active.id){
    case 'merge':html='<p class="hint">El orden de la lista será el orden del documento final. Puedes mover cada archivo con las flechas.</p>';break;
    case 'split':html=`<div class="options-row">${rangeField()}<label class="field">Resultado<select id="opt-mode"><option value="extract">Un PDF con las páginas elegidas</option><option value="each">Un PDF por página (ZIP)</option></select></label></div>`;break;
    case 'rotate':html=`<div class="options-row">${rangeField()}<label class="field">Giro horario<select id="opt-angle"><option value="90">90° · Un cuarto de vuelta</option><option value="180">180° · Media vuelta</option><option value="270">270° · Tres cuartos de vuelta</option></select></label></div>`;break;
    case 'compress':html='<div class="options-row"><label class="field">Tipo de compresión<select id="opt-mode"><option value="lossless">Sin pérdida · conserva el contenido</option><option value="raster">Ligero · convierte páginas a imágenes</option></select></label></div><p class="hint" id="compression-hint">Optimiza la estructura del PDF. La reducción depende del archivo; si no mejora, recibirás el original.</p><label class="check-row" id="raster-consent" hidden><input type="checkbox" id="opt-consent">Entiendo que se perderán texto seleccionable, enlaces y campos. Revisaré la legibilidad del resultado.</label>';break;
    case 'images':html='<div class="options-row"><label class="field">Tamaño de página<select id="opt-size"><option value="a4">A4 · con margen</option><option value="original">Ajustado a la imagen · sin margen</option></select></label><label class="field">Orientación A4<select id="opt-orientation"><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label></div><p class="hint">Una imagen por página. Se respeta la proporción, sin recortar. Las fotos JPG se normalizan para conservar su orientación.</p>';break;
    case 'pdfimages':html=`<div class="options-row">${rangeField()}<label class="field">Formato<select id="opt-format"><option value="jpg">JPG · menor tamaño</option><option value="png">PNG · sin pérdida de imagen</option></select></label><label class="field">Resolución<select id="opt-scale"><option value="1.5">108 ppp · equilibrada</option><option value="2">144 ppp · alta</option><option value="3">216 ppp · muy alta</option></select></label></div><p class="hint">Máximo 150 páginas por conversión. Las páginas grandes se limitan a 16 megapíxeles por imagen.</p>`;break;
    case 'watermark':html='<div class="options-row"><label class="field">Texto de la marca de agua<input id="opt-text" maxlength="80" placeholder="Ej.: COPIA INTERNA" value="COPIA INTERNA"><small>Hasta 80 caracteres. Letras latinas, números y signos; sin emojis.</small></label></div><p class="hint">Texto gris, centrado y con un 25 % de opacidad. Se superpone al contenido; no es una firma digital.</p>';break;
    case 'numbers':html='<div class="options-row"><label class="field">Empezar en<input id="opt-start" type="number" min="1" max="99999" value="1"><small>Formato: número / último número. En el margen inferior, centrado.</small></label></div>';break;
    case 'text':html=`<div class="options-row">${rangeField()}</div><p class="hint">Solo texto seleccionable. La disposición de tablas y columnas puede cambiar en el TXT.</p>`;break;
    default:html=advancedOptions(active.id,files);break;
    case 'organize':html='<p class="hint">↑ ↓ cambian el orden · ↻ gira 90° · × excluye una página (pulsa de nuevo para recuperarla). Se conservan las páginas que no excluyas.</p><div class="page-grid" id="page-grid"></div>';break;
  }
  $('#tool-options').innerHTML=html;if(active.id==='viewer')$('#process').textContent=files[0]?.encrypted?'Abrir PDF':'Descargar original';
  if(ADVANCED_TOOLS.some(t=>t.id===active.id))bindAdvanced(active.id,files);
  if(active.id==='compress')$('#opt-mode').onchange=()=>{const raster=$('#opt-mode').value==='raster';$('#compression-hint').textContent=raster?'Crea una copia a unos 90 ppp con compresión JPG. Adecuada para lectura en pantalla; pierde calidad y contenido interactivo. Máximo 150 páginas.':'Optimiza la estructura del PDF. La reducción depende del archivo; si no mejora, recibirás el original.';$('#compression-hint').classList.toggle('warning',raster);$('#raster-consent').hidden=!raster;};
  if(active.id==='images')$('#opt-size').onchange=()=>{$('#opt-orientation').disabled=$('#opt-size').value==='original';};
  const signed=files.filter(f=>f.signatures?.signed),notice=$('#signature-notice');
  notice.hidden=!signed.length;notice.textContent=signed.map(f=>f.name+': '+signatureNotice(f.signatures)).join(' ');
  pageBrowser?.dispose();pageBrowser=null;
  const preview=$('#document-preview');preview.hidden=true;
  if(files.length&&!['viewer','organize'].includes(active.id)){
   pageBrowser=createPageBrowser({container:preview,files,tool:active.id,getOptions:()=>Object.fromEntries(['range','angle','text','start'].map(k=>[k,$('#opt-'+k)?.value])),onSelection:value=>{const input=$('#opt-range');if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}}});
  }
}
$('#tool-options').addEventListener('input',()=>pageBrowser?.update());
$('#tool-options').addEventListener('change',()=>pageBrowser?.update());
async function buildPages(){
  releasePreview();const run=generation;
  pageState=Array.from({length:files[0].pages},(_,index)=>({index,rotation:0,removed:false,url:null}));drawPages();
  try{
    previewDoc=await openRenderedPdf(files[0].bytes);const doc=previewDoc;
    let next=0;
    const renderBatch=async()=>{const end=Math.min(next+12,pageState.length);
    for(let i=next;i<end;i++){
      if(run!==generation)return;
      const item=pageState.find(item=>item.index===i);
      const p=await doc.getPage(i+1),v=p.getViewport({scale:1});const {canvas,page}=await pageCanvas(doc,i,Math.min(.4,160/v.width));
      const blob=await canvasBlob(canvas,'image/jpeg',.7);canvas.width=canvas.height=0;page.cleanup();
      if(run!==generation)return;
      const url=URL.createObjectURL(blob);previewUrls.push(url);item.url=url;drawPages();
    }
    next=end;};
    await renderBatch();
    if(next<pageState.length&&run===generation){const more=document.createElement('button');more.type='button';more.className='text-button';more.textContent='Cargar más miniaturas';$('#page-grid').after(more);more.onclick=async()=>{more.disabled=true;try{await renderBatch();more.hidden=next>=pageState.length;}catch{if(run===generation)error('No se pudieron cargar más miniaturas. Puedes seguir usando los números de página.');}finally{more.disabled=false;}};}
  }catch(e){if(run===generation)error('No se pudo dibujar la vista previa. Puedes organizar las páginas usando sus números.');}
}
function drawPages(){const grid=$('#page-grid');if(!grid)return;grid.innerHTML=pageState.map((p,i)=>`<div class="page-tile ${p.removed?'removed':''}"><div class="page-preview">${p.url?`<img src="${p.url}" alt="Página ${p.index+1}" style="transform:rotate(${p.rotation}deg)">`:`${p.index+1}`}</div><small>Página ${p.index+1}${p.rotation?` · +${p.rotation}°`:''}${p.removed?' · excluida':''}</small><div class="page-actions"><button data-page="${i}" data-action="up" ${i===0?'disabled':''} aria-label="Adelantar página ${p.index+1}">↑</button><button data-page="${i}" data-action="down" ${i===pageState.length-1?'disabled':''} aria-label="Retrasar página ${p.index+1}">↓</button><button data-page="${i}" data-action="rotate" aria-label="Girar página ${p.index+1}">↻</button><button data-page="${i}" data-action="remove" aria-label="${p.removed?'Recuperar':'Excluir'} página ${p.index+1}" aria-pressed="${p.removed}">${p.removed?'+':'×'}</button></div></div>`).join('');}
$('#tool-options').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b||busy||loading)return;const i=Number(b.dataset.page),p=pageState[i],a=b.dataset.action;if(a==='remove')p.removed=!p.removed;else if(a==='rotate')p.rotation=(p.rotation+90)%360;else{const j=i+(a==='up'?-1:1);[pageState[i],pageState[j]]=[pageState[j],pageState[i]];}drawPages();});

async function normalizedImages(){
  const output=[];
  for(let i=0;i<files.length;i++){
    const f=files[i];
    if(f.bytes[0]===137){output.push(f);continue;}
    const bitmap=await createImageBitmap(new Blob([f.bytes],{type:'image/jpeg'}));
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
    const blob=await canvasBlob(canvas,'image/jpeg',.95);canvas.width=canvas.height=0;
    output.push({...f,bytes:new Uint8Array(await blob.arrayBuffer())});
  }
  return output;
}
$('#process').onclick=async()=>{
  if(busy||loading||!canProcess())return;clearError();
  try{if(active.id!=='digitalsign'&&active.id!=='images'&&!readsOriginal(active.id))for(const f of files)if(f.signatures)assertCanEdit(f.signatures);}catch(e){error('['+e.code+'] '+e.message);return;}
  const opts={};for(const key of ['range','mode','angle','size','orientation','format','scale','text','start']){const el=$('#opt-'+key);if(el)opts[key]=el.value;}
  if(active.id==='compress'&&opts.mode==='raster'&&!$('#opt-consent').checked){error('Confirma que aceptas la conversión a imágenes antes de usar el modo ligero.');return;}
  if(active.id==='organize')opts.pages=pageState.filter(p=>!p.removed).map(p=>({index:p.index,rotation:p.rotation}));
  setBusy(true);progress(0,'Preparando tu documento…');await new Promise(r=>setTimeout(r,30));
  try{
    let outputs;
    if(ADVANCED_TOOLS.some(t=>t.id===active.id))outputs=await advancedOperation(active.id,files,await collectAdvanced(active.id,files),progress);
    else if(active.id==='images')outputs=await imagesToPdf(await normalizedImages(),opts,progress);
    else if(['pdfimages','text'].includes(active.id)||(active.id==='compress'&&opts.mode==='raster'))outputs=await renderOperation(active.id,files[0],opts,progress);
    else outputs=await processPdf(active.id,files,opts,progress);
    progress(1,'Preparando descarga…');await showResults(outputs);
  }catch(e){error(((/^(CERT_|PDF_|AF_)/.test(e.code||''))?'['+e.code+'] ':'')+(e.message||'No se pudo procesar el documento. Prueba con un archivo más pequeño.'));}finally{for(const id of ['opt-password','opt-confirm','certificate-input']){const el=$('#'+id);if(el)el.value='';}setBusy(false);}
};
async function showResults(outputs){
  freeOutputs();$('#download').replaceWith($('#download').cloneNode(true));$('#open-result').replaceWith($('#open-result').cloneNode(true));const total=outputs.reduce((n,o)=>n+o.bytes.length,0);
  let download;
  if(outputs.length>1){const zip=new JSZip();outputs.forEach(o=>zip.file(o.name,o.bytes));download={bytes:await zip.generateAsync({type:'uint8array',compression:'STORE'}),name:`PDF-${active.id}.zip`,type:'application/zip'};}
  else download=outputs[0];
  const url=o=>{const u=URL.createObjectURL(new Blob([o.bytes],{type:o.type}));outputUrls.push(u);return u;};
  lastDownload=download;try{$('#share-result').hidden=!(typeof window.navigator.share==='function'&&window.navigator.canShare?.({files:[new File([download.bytes],download.name,{type:download.type})]}));}catch{$('#share-result').hidden=true;}const downloadUrl=url(download);$('#download').href=downloadUrl;$('#open-result').href=downloadUrl;$('#open-result').hidden=outputs.length>1;$('#download').download=download.name;$('#download').target='_blank';$('#download').rel='noopener';$('#download').innerHTML=`Descargar ${outputs.length>1?'ZIP':download.name.split('.').pop().toUpperCase()} <span>↓</span>`;
  const textOutput=outputs.find(o=>o.type.startsWith('text/plain'));$('#result-preview').textContent=outputs.find(o=>o.preview)?.preview||(textOutput?new TextDecoder().decode(textOutput.bytes).slice(0,22000):'');$('#result-preview').hidden=!$('#result-preview').textContent;
  $('#result-summary').textContent=`${outputs.length} ${outputs.length===1?'archivo preparado':'archivos preparados'} · ${niceSize(total)}${outputs.length>1?' antes de empaquetar':''}`;
  $('#result-note').textContent=outputs[0].note||'Tu nueva copia está lista. Los originales permanecen intactos.';
  if(outputs.length>1&&outputs.length<=30)outputs.forEach(o=>{const a=document.createElement('a');a.href=url(o);a.download=o.name;a.target='_blank';a.rel='noopener';a.textContent=o.name;$('#individual-downloads').append(a);});
  $('#editor-area').hidden=true;$('#result').hidden=false;$('#process').hidden=true;$('#download').focus();
  $('#result-viewer').replaceChildren();
  pageBrowser?.dispose();pageBrowser=null;
  const pdfOutputs=outputs.filter(output=>output.type==='application/pdf');
  if(pdfOutputs.length&&active.id!=='protect'){
   clearAdvanced();$('#tool-options').replaceChildren();
   const heading=document.createElement('h4');heading.textContent='Revisa el resultado';$('#result-viewer').append(heading);
   const viewer=document.createElement('div');
   const showOutput=index=>{clearAdvanced();const opened={...pdfOutputs[index],size:pdfOutputs[index].bytes.length,encrypted:false};viewer.innerHTML=advancedOptions('viewer',[opened]);bindAdvanced('viewer',[opened]);};
   if(pdfOutputs.length>1){const label=document.createElement('label');label.className='field';label.textContent='Documento que quieres revisar';const select=document.createElement('select');for(const [index,item]of pdfOutputs.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=item.name;select.append(option);}select.onchange=()=>showOutput(Number(select.value));label.append(select);$('#result-viewer').append(label);}
   $('#result-viewer').append(viewer);showOutput(0);
   if(active.id==='unlock'||(active.id==='viewer'&&files[0]?.encrypted))$('#result-note').textContent='Documento abierto. Puedes leerlo aquí y descargar la copia sin contraseña. '+(outputs[0].note||'');
  }else if(outputs.every(o=>o.type.startsWith('image/'))){
   const grid=document.createElement('div');grid.className='page-browser-grid';for(const item of outputs.slice(0,12)){const img=document.createElement('img');img.src=url(item);img.alt=item.name;img.className='result-image';grid.append(img);}const caption=document.createElement('p');caption.textContent=`Vista de ${Math.min(12,outputs.length)} de ${outputs.length} imágenes. La descarga incluye todas las seleccionadas.`;$('#result-viewer').append(caption,grid);
  }
}
$('#save-as').onclick=async()=>{if(!lastDownload)return;try{if(typeof window.showSaveFilePicker==='function'){const handle=await window.showSaveFilePicker({suggestedName:lastDownload.name});const stream=await handle.createWritable();await stream.write(new Blob([lastDownload.bytes],{type:lastDownload.type}));await stream.close();$('#result-note').textContent='Archivo guardado en la ubicación elegida.';}else{$('#download').click();}}catch(e){if(e.name!=='AbortError'){error('El navegador no permite elegir carpeta aquí. Usa Descargar o Abrir resultado.');}}};
// Do not revoke a result during pagehide: a browser may still be opening or saving it.
// Closing the tab releases its memory; explicit reset/close releases URLs immediately.
window.addEventListener('pageshow',e=>{if(e.persisted&&active)reset();});
renderTools();

$('#share-result').onclick=async()=>{if(!lastDownload)return;const download=lastDownload;try{await window.navigator.share({files:[new File([download.bytes],download.name,{type:download.type})]});}catch(e){if(e.name!=='AbortError')error('No se pudo compartir. Prueba Descargar o Abrir resultado y guarda desde el lector.');}};
