import { rectPercent } from './advanced.js';
import { openRenderedPdf, pageCanvas, canvasBlob } from './render.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(id,label,value,min,max)=>`<label class="field">${label}<input id="opt-${id}" type="number" value="${value}" min="${min}" max="${max}" step="any"></label>`;
const range=()=>'<label class="field">Páginas<input id="opt-range" placeholder="Todas · ej.: 1, 3-5"><small>Vacío = todas las páginas.</small></label>';
const zone=()=>`<div class="options-row">${field('x','Izquierda (%)',10,0,100)}${field('y','Arriba (%)',10,0,100)}${field('w','Ancho (%)',50,1,100)}${field('h','Alto (%)',10,1,100)}</div><div class="position-preview"><div class="preview-controls">Vista previa de la zona <input id="preview-page" type="number" value="1" min="1" aria-label="Página de vista previa"><button type="button" id="refresh-preview" class="text-button">Ver página</button></div><div id="position-stage"><canvas id="position-canvas"></canvas><div id="position-box"></div></div><small>Arrastra sobre la vista previa para seleccionar la zona. Se aplicará en las páginas indicadas arriba. La firma conserva su proporción dentro de esta zona.</small></div>`;
let ink=false,signatureBytes=null,previewSerial=0,viewerDoc=null;
export function clearAdvanced(){previewSerial++;ink=false;signatureBytes=null;if(viewerDoc){viewerDoc.destroy().catch(()=>{});viewerDoc=null;}}
export function advancedOptions(tool,files){
 const hint=s=>`<p class="hint">${s}</p>`;
 if(tool==='viewer'&&files[0]?.encrypted)return '<div class="options-row"><label class="field">Contraseña del PDF<input id="opt-password" type="password" autocomplete="off" maxlength="127"></label></div>'+hint('Introduce la contraseña una vez para abrirlo. Podrás descargar una copia sin contraseña. La contraseña no se guarda.');
 switch(tool){
 case 'viewer':return '<div class="viewer-controls"><button id="view-prev">← Anterior</button><input type="number" id="view-page" value="1" min="1" aria-label="Número de página"><span id="view-total"></span><button id="view-next">Siguiente →</button><select id="view-zoom" aria-label="Zoom"><option value=".7">70 %</option><option value="1" selected>100 %</option><option value="1.5">150 %</option><option value="2">200 %</option></select></div><div class="viewer-search"><input id="view-search" type="search" placeholder="Buscar texto en el documento" aria-label="Buscar texto"><button id="view-find" class="text-button">Buscar</button><button id="view-match" class="text-button">Siguiente coincidencia</button></div><div id="view-status" class="viewer-status" role="status">Selecciona un PDF para leerlo.</div><div class="viewer-scroll"><canvas id="view-canvas" aria-label="Vista de la página"></canvas></div><details><summary class="text-button">Texto de esta página</summary><pre id="view-text" class="viewer-text"></pre></details>';
 case 'digitalsign':return '<label class="field">Certificado personal RSA (.p12 / .pfx)<input id="certificate-input" type="file" accept=".p12,.pfx"></label><div class="options-row"><label class="field">Contraseña del certificado<input id="opt-password" type="password" autocomplete="off"></label><label class="field">Motivo<input id="opt-reason" maxlength="120" value="Aprobación del documento"></label></div><p class="certificate-note">El certificado y su contraseña se usan solo en este navegador. Firma criptográfica sin sello de tiempo ni comprobación de revocación. No admite DNIe, tarjetas, claves ECDSA ni cofirmas. Los campos de formulario se aplanarán. Para añadir una firma visible, usa antes «Firma dibujada».</p><label class="check-row"><input type="checkbox" id="opt-consent">Quiero firmar este PDF con el certificado seleccionado y entiendo que modificarlo después invalidará esta firma.</label>';
 case 'ocr':return `<div class="options-row">${range()}<label class="field">Idioma<select id="opt-language"><option value="spa">Español</option><option value="eng">Inglés</option><option value="spa+eng">Español e inglés</option></select></label></div>${hint('Hasta 30 páginas por tarea. Incluye un PDF buscable y un TXT. Trabaja localmente; puede tardar varios minutos. Revisa siempre cifras y nombres.')}`;
 case 'protect':return '<div class="options-row"><label class="field">Contraseña nueva<input id="opt-password" type="password" autocomplete="new-password" minlength="8" maxlength="100"></label><label class="field">Repetir contraseña<input id="opt-confirm" type="password" autocomplete="new-password" maxlength="100"></label></div>'+hint('Cifrado AES-256. Entre 8 y 100 caracteres. Guarda la contraseña: no se almacena ni se puede recuperar en la aplicación.');
 case 'unlock':return '<div class="options-row"><label class="field">Contraseña del PDF<input id="opt-password" type="password" autocomplete="off" maxlength="127"></label></div>'+hint('Introduce la contraseña una vez para abrir el documento y descargar una copia sin contraseña. No se guarda la contraseña.');
 case 'repair':return hint('Intenta reescribir la estructura del archivo. No puede recuperar datos que ya no estén presentes. Si se genera una copia, revisa todas sus páginas.');
 case 'metadata':return hint('Elimina autor, título, fechas, productor y XMP generales. No elimina comentarios, texto, adjuntos o metadatos dentro de imágenes. No equivale a anonimizar.');
 case 'flatten':return hint('Fija la apariencia de los campos AcroForm y elimina su interactividad. No admite formularios XFA, botones ni campos de firma digital.');
 case 'forms':return formOptions(files[0]?.fields||[]);
 case 'crop':return `<div class="options-row">${range()}${field('margin','Quitar de cada borde (mm)',10,0,100)}</div>${hint('Recorte visual de los cuatro márgenes. Lo que quede fuera sigue dentro del archivo. Para eliminar información utiliza «Ocultar una zona».')}`;
 case 'resize':return `<div class="options-row">${range()}<label class="field">Tamaño<select id="opt-size"><option value="a4">A4</option><option value="a3">A3</option><option value="letter">Carta</option></select></label><label class="field">Orientación<select id="opt-orientation"><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></label></div>${hint('Escala sin deformar el contenido y lo centra con un margen mínimo. No conserva enlaces ni anotaciones de las páginas adaptadas.')}`;
 case 'addtext':return `<div class="options-row">${range()}<label class="field">Texto nuevo<input id="opt-text" maxlength="150" placeholder="Escribe tu nota"></label>${field('fontsize','Tamaño máximo (pt)',14,4,100)}</div>${zone()}${hint('Añade texto sobre el PDF; no modifica el texto original. El tamaño se ajusta para caber en la zona.')}`;
 case 'signature':return `<div class="options-row">${range()}</div><label class="field">Dibuja aquí tu firma<canvas id="signature-canvas" width="640" height="180" aria-label="Panel para dibujar la firma"></canvas></label><div class="signature-actions"><button id="clear-signature" type="button" class="text-button">Borrar firma</button><label class="text-button">O elegir PNG / JPG <input id="signature-input" type="file" accept=".png,.jpg,.jpeg"></label></div><small id="signature-status">Firma como imagen, sin certificado digital.</small>${zone()}`;
 case 'redact':return `<div class="options-row">${range()}</div>${zone()}<label class="check-row"><input type="checkbox" id="opt-consent">Acepto crear un PDF nuevo de imágenes, sin texto seleccionable, enlaces, campos ni objetos originales.</label>${hint('La zona se cubre de negro antes de generar las nuevas páginas. Revisa cada página antes de compartir. Se aplica el mismo rectángulo a las páginas seleccionadas. Máximo 150 páginas.')}`;
 case 'gray':return hint('Todas las páginas se convierten a imágenes en escala de grises. Pierde texto seleccionable y enlaces; el tamaño puede aumentar. Máximo 150 páginas.');
 case 'summary':return `<div class="options-row">${range()}<label class="field">Extensión<select id="opt-count"><option value="5">Breve · hasta 5 frases</option><option value="8" selected>Normal · hasta 8 frases</option><option value="15">Amplio · hasta 15 frases</option></select></label></div>${hint('Resumen extractivo, sin IA generativa: selecciona frases existentes por relevancia léxica y muestra sus páginas. Puede omitir matices o contexto. Si es un escaneado, aplica OCR primero.')}`;
 case 'compare':return hint('Añade exactamente dos PDF: A es el primero y B el segundo. Compara frases de texto, incluidos duplicados. Ignora cambios de orden, imágenes, firmas y diseño.');
 case 'word':return `<div class="options-row">${range()}</div>${hint('Genera un DOCX editable con el texto. No reconstruye el diseño original, las tablas ni las imágenes. Puedes abrirlo en Word o LibreOffice. Para escaneados, aplica OCR primero.')}`;
 default:return '';
 }
}
function formOptions(fields){
 if(!fields.length)return '<p class="hint">Selecciona un PDF con campos interactivos. Los campos compatibles aparecerán aquí.</p>';
 return fields.map((f,i)=>{
  const key=`data-form-index="${i}"`,disabled=f.readOnly?'disabled':'';
  if(f.kind==='unsupported')return `<p class="hint warning">${esc(f.name)}: campo no compatible (el documento no se procesará).</p>`;
  if(f.kind==='check')return `<label class="check-row"><input type="checkbox" ${key} ${f.value?'checked':''} ${disabled}>${esc(f.name)}</label>`;
  if(f.kind==='text')return `<label class="field form-field">${esc(f.name)}<textarea ${key} maxlength="${f.max}" ${disabled}>${esc(f.value)}</textarea></label>`;
  return `<label class="field form-field">${esc(f.name)}<select ${key} ${f.multiple?'multiple':''} ${disabled}>${!f.multiple?'<option value="">Sin selección</option>':''}${f.options.map(x=>`<option value="${esc(x)}" ${(Array.isArray(f.value)?f.value.includes(x):f.value===x)?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`;
 }).join('')+'<label class="check-row"><input id="opt-flatten" type="checkbox">Aplanar el formulario después de rellenarlo</label>';
}
export function bindAdvanced(tool,files){
 previewSerial++;const serial=previewSerial;
 if(tool==='viewer'){if(!files[0]?.encrypted)bindViewer(files,serial);return;}
 if(tool==='signature'){
  ink=false;signatureBytes=null;const canvas=$('#signature-canvas'),ctx=canvas.getContext('2d');let down=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
  canvas.onpointerdown=e=>{down=true;ink=true;signatureBytes=null;canvas.setPointerCapture(e.pointerId);const [x,y]=point(e);ctx.beginPath();ctx.moveTo(x,y);ctx.lineWidth=2.5;ctx.lineCap='round';ctx.strokeStyle='#161616';};
  canvas.onpointermove=e=>{if(down){ctx.lineTo(...point(e));ctx.stroke();}};
  canvas.onpointerup=canvas.onpointercancel=()=>{down=false;};
  $('#clear-signature').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ink=false;signatureBytes=null;$('#signature-status').textContent='Firma borrada.';};
  $('#signature-input').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>10*1024*1024){$('#signature-status').textContent='Máximo 10 MB para la firma.';return;}try{const bytes=new Uint8Array(await f.arrayBuffer());if(!(bytes[0]===137&&bytes[1]===80)&&!(bytes[0]===255&&bytes[1]===216))throw new Error('Formato no válido.');const image=await createImageBitmap(f);if(image.width*image.height>16000000){image.close();throw new Error('Máximo 16 megapíxeles.');}ctx.clearRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/image.width,canvas.height/image.height);ctx.drawImage(image,0,0,image.width*scale,image.height*scale);image.close();signatureBytes=bytes;ink=false;$('#signature-status').textContent=`Imagen seleccionada: ${f.name}`;}catch{$('#signature-status').textContent='No se pudo leer la firma. Usa PNG o JPG.';}};
 }
 if(!['signature','redact','addtext'].includes(tool))return;
 const box=$('#position-box'),stage=$('#position-stage'),canvas=$('#position-canvas');
 const update=()=>{try{const r=rectPercent(Object.fromEntries(['x','y','w','h'].map(k=>[k,$('#opt-'+k).value])));Object.assign(box.style,{left:r.x+'%',top:r.y+'%',width:r.w+'%',height:r.h+'%'});box.textContent=tool==='redact'?'Ocultar':tool==='signature'?'Firma':'Texto';}catch{box.textContent='Revisa la zona';}};
 for(const key of ['x','y','w','h'])$('#opt-'+key).addEventListener('input',update);update();
 let start=null;
 const point=e=>{const r=stage.getBoundingClientRect();return [Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100)),Math.min(100,Math.max(0,(e.clientY-r.top)/r.height*100))];};
 stage.onpointerdown=e=>{start=point(e);stage.setPointerCapture(e.pointerId);};stage.onpointermove=e=>{if(!start)return;const p=point(e),values={x:Math.min(start[0],p[0]),y:Math.min(start[1],p[1]),w:Math.max(.1,Math.abs(p[0]-start[0])),h:Math.max(.1,Math.abs(p[1]-start[1]))};for(const[k,v]of Object.entries(values))$('#opt-'+k).value=v.toFixed(2);update();};stage.onpointerup=stage.onpointercancel=()=>{start=null;};
 const refresh=async()=>{
  if(!files.length)return;let d;const pageNumber=Number($('#preview-page').value);if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>files[0].pages)return;
  $('#refresh-preview').disabled=true;
  try{d=await openRenderedPdf(files[0].bytes);const p=await d.getPage(pageNumber),view=p.getViewport({scale:1}),render=await pageCanvas(d,pageNumber-1,Math.min(1,550/view.width));if(serial!==previewSerial)return;canvas.width=render.canvas.width;canvas.height=render.canvas.height;canvas.getContext('2d').drawImage(render.canvas,0,0);stage.style.aspectRatio=`${canvas.width}/${canvas.height}`;render.canvas.width=render.canvas.height=0;update();}catch{if(serial===previewSerial)box.textContent='Vista previa no disponible';}finally{if(d)await d.destroy();if(serial===previewSerial)$('#refresh-preview').disabled=false;}
 };
 $('#refresh-preview').onclick=refresh;
 if(files.length){$('#preview-page').max=files[0].pages;refresh();}
}
export async function collectAdvanced(tool,files){
 const opts={};for(const k of ['range','language','password','confirm','margin','size','orientation','text','fontsize','x','y','w','h','count','reason']){const el=$('#opt-'+k);if(el)opts[k]=el.value;}
 opts.consent=!!$('#opt-consent')?.checked;opts.flatten=!!$('#opt-flatten')?.checked;
 if(tool==='forms')opts.fields=[...document.querySelectorAll('[data-form-index]')].map(el=>{const f=files[0].fields[Number(el.dataset.formIndex)];return {name:f.name,value:f.kind==='check'?el.checked:f.kind==='select'?[...el.selectedOptions].map(o=>o.value).filter(Boolean):el.value};});
 if(tool==='signature'){
  if(signatureBytes)opts.imageBytes=signatureBytes;
  else if(ink)opts.imageBytes=new Uint8Array(await(await canvasBlob($('#signature-canvas'),'image/png')).arrayBuffer());
 }
 if(tool==='digitalsign'){const file=$('#certificate-input')?.files[0];if(file){if(file.size>5*1024*1024)throw new Error('El certificado supera 5 MB. Selecciona un archivo P12/PFX válido.');opts.certBytes=new Uint8Array(await file.arrayBuffer());}}
 return opts;
}

async function bindViewer(files,serial){
 if(viewerDoc){await viewerDoc.destroy();viewerDoc=null;}
 if(!files.length)return;let doc,rendering=false,matches=[],currentMatch=0;
 const live=()=>serial===previewSerial;
 const status=message=>{if(live())$('#view-status').textContent=message;};
 const textCache=new Map();
 const getText=async page=>{if(textCache.has(page))return textCache.get(page);const p=await doc.getPage(page),content=await p.getTextContent(),text=content.items.map(t=>t.str+(t.hasEOL?'\n':' ')).join('');textCache.set(page,text);return text;};
 const show=async()=>{
  if(!doc||rendering||!live())return;let page=Number($('#view-page').value);page=Math.min(doc.numPages,Math.max(1,Math.floor(page)||1));$('#view-page').value=page;rendering=true;
  try{const r=await pageCanvas(doc,page-1,Number($('#view-zoom').value));if(!live()){r.canvas.width=r.canvas.height=0;return;}const c=$('#view-canvas');c.width=r.canvas.width;c.height=r.canvas.height;c.getContext('2d').drawImage(r.canvas,0,0);r.canvas.width=r.canvas.height=0;const text=await getText(page);if(live()){$('#view-text').textContent=text||'Esta página no tiene texto seleccionable. Puedes utilizar OCR.';$('#view-prev').disabled=page===1;$('#view-next').disabled=page===doc.numPages;status(`Página ${page} de ${doc.numPages}. El visor no verifica firmas digitales.`);}}catch{status('No se pudo mostrar esta página.');}finally{rendering=false;}
 };
 try{status('Abriendo documento…');doc=await openRenderedPdf(files[0].bytes);if(!live()){await doc.destroy();return;}viewerDoc=doc;$('#view-total').textContent=`/ ${doc.numPages}`;$('#view-page').max=doc.numPages;
  $('#view-prev').onclick=()=>{if(rendering)return;$('#view-page').value=Number($('#view-page').value)-1;show();};$('#view-next').onclick=()=>{if(rendering)return;$('#view-page').value=Number($('#view-page').value)+1;show();};$('#view-page').onchange=show;$('#view-zoom').onchange=show;
  $('#view-find').onclick=async()=>{const q=$('#view-search').value.toLocaleLowerCase().trim();if(!q)return;$('#view-find').disabled=true;matches=[];currentMatch=0;
   try{for(let i=1;i<=doc.numPages;i++){if(!live())return;status(`Buscando: página ${i} de ${doc.numPages}…`);const text=(await getText(i)).toLocaleLowerCase();if(text.includes(q))matches.push(i);}if(!live())return;if(matches.length){$('#view-page').value=matches[0];await show();status(`Texto encontrado en ${matches.length} páginas. Página ${matches[0]}.`);}else status('No se ha encontrado el texto. Los escaneados necesitan OCR.');}catch{status('No se pudo completar la búsqueda.');}finally{if(live())$('#view-find').disabled=false;}
  };
  $('#view-search').onkeydown=e=>{if(e.key==='Enter')$('#view-find').click();};
  $('#view-match').onclick=async()=>{if(!matches.length||rendering)return;currentMatch=(currentMatch+1)%matches.length;$('#view-page').value=matches[currentMatch];await show();status(`Página con coincidencias ${currentMatch+1} de ${matches.length}.`);};await show();
 }catch{status('No se pudo abrir el documento en el visor.');}
}
