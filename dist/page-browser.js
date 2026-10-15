import {openRenderedPdf,pageCanvas,canvasBlob} from './render.js';
import {pageRange} from './core.js';

const selectable=new Set(['rotate','split','text','pdfimages','crop','resize','addtext','signature','redact','ocr','summary','word']);
const captions={rotate:'Toca las páginas que quieras girar. Ves el giro antes de guardar.',split:'Toca las páginas que quieras extraer. Las resaltadas se incluirán en el resultado.',watermark:'Vista orientativa de la marca. Revisa el PDF generado antes de compartir.',numbers:'Vista orientativa de la numeración. Revisa el PDF generado antes de compartir.',gray:'Vista orientativa en gris. El resultado final puede cambiar de peso y calidad.',images:'Estas imágenes formarán el PDF en el orden de la lista.',merge:'Comprueba los documentos y su orden antes de unirlos.',compare:'Compara visualmente los originales. El análisis compara el texto.',protect:'Vista del original. La contraseña protege su apertura; no cambia su aspecto.',unlock:'Introduce la contraseña para abrir el documento y ver sus páginas.',repair:'Se mostrará el documento recuperado al terminar.'};

// Shared visual input for the toolbox. It renders only the displayed batch,
// cancels stale work on reset, and revokes every thumbnail URL it creates.
export function createPageBrowser({container,files,tool,getOptions=()=>({}),onSelection=()=>{},render={openRenderedPdf,pageCanvas,canvasBlob}}){
 let disposed=false,limit=12,rendering=false;const urls=[],docs=new Map(),items=[];
 for(let fileIndex=0;fileIndex<files.length;fileIndex++){
  const file=files[fileIndex],count=tool==='images'?1:file.pages;
  if(!count||file.encrypted)continue;
  for(let page=1;page<=count;page++)items.push({file,fileIndex,page});
 }
 const canSelect=files.length===1&&selectable.has(tool);
 const heading=document.createElement('h3');heading.textContent=tool==='images'?'Tus imágenes':'Tus páginas';
 const hint=document.createElement('p');hint.className='preview-help';hint.textContent=captions[tool]||(canSelect?'Toca las páginas para elegir cuáles utilizar.':'Vista del documento original. Al terminar podrás revisar el resultado.');
 const toolbar=document.createElement('div');toolbar.className='page-browser-toolbar';
 const status=document.createElement('span');status.className='preview-status';status.setAttribute('role','status');
 const grid=document.createElement('div');grid.className='page-browser-grid';
 const more=document.createElement('button');more.type='button';more.className='text-button';more.textContent='Mostrar más páginas';
 const makeButton=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent=label;b.onclick=action;return b;};
 if(canSelect)toolbar.append(makeButton('Seleccionar todas',()=>{onSelection('');update();}),makeButton('Solo la primera',()=>{onSelection('1');update();}));
 toolbar.append(status);container.replaceChildren(heading,hint,toolbar,grid,more);
 container.hidden=!items.length;
 const selection=()=>{try{return new Set(pageRange(getOptions().range,files[0]?.pages||0).map(i=>i+1));}catch{return null;}};
 const choose=item=>{
  if(!canSelect)return;const selected=selection()||new Set();
  if(selected.has(item.page)){if(selected.size===1){status.textContent='Conserva al menos una página seleccionada.';return;}selected.delete(item.page);}else selected.add(item.page);
  onSelection(selected.size===files[0].pages?'':[...selected].sort((a,b)=>a-b).join(', '));update();
 };
 const addTiles=()=>{
  for(let index=grid.children.length;index<Math.min(limit,items.length);index++){
   const item=items[index],tile=document.createElement(canSelect?'button':'div');item.tile=tile;tile.className='preview-tile';
   if(canSelect){tile.type='button';tile.onclick=()=>choose(item);}
   const paper=document.createElement('span');paper.className='thumbnail-paper';item.paper=paper;
   const placeholder=document.createElement('span');placeholder.className='thumbnail-placeholder';placeholder.textContent=String(item.page);paper.append(placeholder);
   const overlay=document.createElement('span');overlay.className='thumbnail-overlay';paper.append(overlay);item.overlay=overlay;
   const label=document.createElement('span');label.className='thumbnail-label';label.textContent=(files.length>1?item.file.name+' · ':'')+(tool==='images'?'Imagen '+(index+1):'Página '+item.page);tile.title=label.textContent;item.label=label;
   tile.append(paper,label);grid.append(tile);
  }
  more.hidden=limit>=items.length;
 };
 const update=()=>{
  if(disposed)return;const opts=getOptions(),selected=selection();
  for(const item of items){if(!item.tile)continue;const chosen=!canSelect||!!selected?.has(item.page);
   item.tile.classList.toggle('selected',chosen&&canSelect);if(canSelect)item.tile.setAttribute('aria-pressed',String(chosen));
   const angle=tool==='rotate'&&chosen?Number(opts.angle||90):0;
   if(item.image){item.image.style.transform=angle?`rotate(${angle}deg) scale(${angle%180 ? .72 : 1})`:'';item.image.style.filter=tool==='gray'?'grayscale(1)':'';}
   item.tile.setAttribute('aria-label',`${item.file.name}, página ${item.page}${canSelect?chosen?', seleccionada':', no seleccionada':''}${angle?', giro '+angle+' grados':''}`);
   item.overlay.className='thumbnail-overlay';item.overlay.textContent='';
   if(tool==='watermark'){item.overlay.classList.add('watermark-overlay');item.overlay.textContent=opts.text||'';}
   if(tool==='numbers'){item.overlay.classList.add('number-overlay');item.overlay.textContent=`${(Number(opts.start)||1)+item.page-1} / ${(Number(opts.start)||1)+item.file.pages-1}`;}
  }
  status.textContent=canSelect?(selected?`${selected.size} de ${files[0].pages} páginas seleccionadas`:'Revisa el intervalo de páginas'):`${Math.min(limit,items.length)} de ${items.length} ${tool==='images'?'imágenes':'páginas'}`;
 };
 const draw=async()=>{
  if(rendering||disposed)return;rendering=true;
  try{for(let index=0;index<Math.min(limit,items.length)&&!disposed;index++){
   const item=items[index];if(item.image||item.failed)continue;
   try{
    let blob;
    if(tool==='images')blob=new Blob([item.file.bytes],{type:item.file.bytes[0]===137?'image/png':'image/jpeg'});
    else{
     if(!docs.has(item.fileIndex))docs.set(item.fileIndex,await render.openRenderedPdf(item.file.bytes));
     if(disposed)break;
     const doc=docs.get(item.fileIndex),p=await doc.getPage(item.page),view=p.getViewport({scale:1});
     const result=await render.pageCanvas(doc,item.page-1,Math.min(.6,220/view.width));
     try{blob=await render.canvasBlob(result.canvas,'image/jpeg',.8);}finally{result.canvas.width=result.canvas.height=0;result.page?.cleanup();}
    }
    if(disposed)break;
    const url=URL.createObjectURL(blob);urls.push(url);const img=document.createElement('img');img.src=url;img.alt=`Vista de la página ${item.page}`;img.decoding='async';item.image=img;
    item.paper.querySelector('.thumbnail-placeholder')?.remove();item.paper.prepend(img);update();
   }catch{item.failed=true;const placeholder=item.paper?.querySelector('.thumbnail-placeholder');if(placeholder)placeholder.textContent='Vista no disponible';}
  }}finally{rendering=false;if(disposed)for(const doc of docs.values())doc.destroy().catch(()=>{});}
 };
 more.onclick=()=>{limit+=12;addTiles();update();void draw();};addTiles();update();const ready=draw();
 return {ready,update,dispose(){disposed=true;urls.forEach(URL.revokeObjectURL);for(const doc of docs.values())doc.destroy().catch(()=>{});container.replaceChildren();}};
}
