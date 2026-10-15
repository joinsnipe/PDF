import {AI_PROVIDERS,AI_TEXT_LIMIT} from './ai-contract.js';
import {requestAI} from './ai-client.js';
const $=id=>document.getElementById(id);
let active=null;
export function aiOptions(){return `<label class="field">Cómo quieres resumir<select id="opt-summarymode"><option value="local">Frases del documento · local y sin cuenta</option><option value="ai">Resumen o explicación con IA · tu propia API</option></select></label>
<div id="ai-options" hidden><div class="options-row"><label class="field">Proveedor<select id="opt-provider">${Object.entries(AI_PROVIDERS).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label><label class="field">Qué necesitas<select id="opt-aimode"><option value="summary">Resumen en lenguaje sencillo</option><option value="explain">Qué pide y qué fechas menciona</option></select></label></div>
<label class="field">Tu clave de API<input id="opt-apiKey" type="password" autocomplete="off" spellcheck="false" maxlength="512" placeholder="Pega la clave del proveedor elegido"><small>No se guarda. Se borra del campo al procesar o cerrar. La cuenta de API es independiente de las suscripciones de chat.</small></label>
<label id="ai-workspace-field" class="field" hidden>Workspace de Claude (si tu clave lo necesita)<input id="opt-workspace" autocomplete="off" maxlength="90" placeholder="wrkspc_…"><small>Déjalo vacío para claves vinculadas a un solo workspace. Lo encontrarás en la consola de Claude.</small></label>
<div class="options-row"><label class="field">Modelo<input id="opt-model" list="ai-models" maxlength="150" autocomplete="off" spellcheck="false" placeholder="Carga los modelos o escribe su ID"><datalist id="ai-models"></datalist></label><button id="ai-load-models" class="text-button" type="button">Cargar mis modelos</button></div><p id="ai-model-status" class="hint" role="status">Usa un modelo de texto compatible. Cargar modelos envía solo tu clave al servidor y al proveedor, sin el documento.</p>
<p class="hint">La IA es opcional y necesita internet. El servidor de PDF Contigo recibe tu clave y el texto seleccionado y los envía al proveedor elegido; la aplicación no los almacena ni los registra. El proveedor aplica sus condiciones de datos y puede cobrar consumo. Tener clave no garantiza cuota gratuita. <a id="ai-provider-link" target="_blank" rel="noopener noreferrer">Cuenta, precios y condiciones del proveedor</a>.</p>
<button id="ai-review" type="button" class="text-button">Revisar el texto que se enviará</button><p id="ai-review-status" role="status" class="hint">Hasta 100 páginas y 60.000 caracteres. Si es un escaneado, aplica OCR antes.</p><details id="ai-review-box" hidden><summary>Texto seleccionado, por páginas</summary><pre id="ai-review-text" class="viewer-text"></pre></details>
<label class="check-row"><input id="ai-consent" type="checkbox" disabled>Autorizo enviar este texto y mi clave a través de PDF Contigo al proveedor elegido. He revisado sus condiciones y posibles costes.</label></div>`;}
export function clearAI(){if(active){active.disposed=true;active.controller.abort();active.pages=null;active=null;}const key=$('opt-apiKey');if(key)key.value='';}
export function collectAI(){
 const mode=$('opt-summarymode')?.value||'local';if(mode==='local')return {summarymode:mode};
 if(!active?.pages||!$('ai-consent')?.checked)throw new Error('Revisa el texto y autoriza su envío antes de consultar la IA.');
 const apiKey=$('opt-apiKey').value.trim(),model=$('opt-model').value.trim();if(apiKey.length<12)throw new Error('Introduce tu clave de API.');if(!model)throw new Error('Carga los modelos o escribe el identificador del que quieres usar.');
 const result={summarymode:mode,provider:$('opt-provider').value,workspace:$('opt-workspace').value.trim(),apiKey,model,aimode:$('opt-aimode').value,aiConsent:true,reviewedPages:active.pages};
 $('ai-consent').checked=false;active.pages=null;return result;
}
export function bindAI(files,extract){
 clearAI();const state={disposed:false,pages:null,revision:0,controller:new AbortController()};active=state;
 const invalidate=()=>{state.revision++;state.pages=null;$('ai-consent').checked=false;$('ai-consent').disabled=true;$('ai-review-box').hidden=true;$('ai-review-text').textContent='';};
 const providerLinks={gemini:'https://ai.google.dev/gemini-api/docs/pricing',openai:'https://platform.openai.com',anthropic:'https://console.anthropic.com',xai:'https://console.x.ai',mistral:'https://console.mistral.ai'};
 const link=()=>{$('ai-workspace-field').hidden=$('opt-provider').value!=='anthropic';$('ai-provider-link').href=providerLinks[$('opt-provider').value];};link();
 $('opt-summarymode').onchange=()=>{const ai=$('opt-summarymode').value==='ai';$('ai-options').hidden=!ai;document.querySelector('#opt-count').closest('label').hidden=ai;invalidate();if(!ai)$('opt-apiKey').value='';};
 $('opt-provider').onchange=()=>{invalidate();$('opt-apiKey').value='';$('opt-model').value='';$('opt-workspace').value='';$('ai-models').replaceChildren();$('ai-model-status').textContent='Introduce la clave de este proveedor para cargar modelos.';link();};
 for(const id of ['opt-range','opt-apiKey','opt-model','opt-aimode','opt-workspace'])$(id)?.addEventListener('input',invalidate);
 $('ai-load-models').onclick=async()=>{const button=$('ai-load-models'),status=$('ai-model-status'),provider=$('opt-provider').value,key=$('opt-apiKey').value.trim(),revision=state.revision;
  if(key.length<12){status.textContent='Introduce primero una clave de API válida.';return;}button.disabled=true;status.textContent='Consultando los modelos disponibles…';
  try{const result=await requestAI({action:'models',provider,apiKey:key,workspace:$('opt-workspace').value.trim()},{signal:state.controller.signal});if(state.disposed||revision!==state.revision)return;const list=$('ai-models');list.replaceChildren();for(const m of result.models||[]){const option=document.createElement('option');option.value=m.id;option.label=m.name;list.append(option);}status.textContent=`${list.children.length} modelos cargados. Elige uno en el campo Modelo o escribe su ID. No todos los modelos admiten este tipo de consulta.`;}
  catch(e){if(!state.disposed)status.textContent=e.message;}finally{if(!state.disposed)button.disabled=false;}
 };
 $('ai-review').onclick=async()=>{const button=$('ai-review'),status=$('ai-review-status');invalidate();const revision=state.revision;if(!files[0]){status.textContent='Selecciona primero un PDF.';return;}button.disabled=true;status.textContent='Leyendo el texto en tu dispositivo…';
  try{const pages=await extract(files[0],{range:$('opt-range').value});if(state.disposed||revision!==state.revision)return;const count=pages.reduce((n,p)=>n+p.text.length,0);if(!count)throw new Error('No hay texto seleccionable. Aplica OCR primero.');if(pages.length>100||count>AI_TEXT_LIMIT)throw new Error('Selecciona menos páginas: hasta 100 páginas y 60.000 caracteres.');state.pages=pages;$('ai-review-text').textContent=pages.map(p=>`Página ${p.page}\n${p.text}`).join('\n\n');$('ai-review-box').hidden=false;$('ai-review-box').open=true;$('ai-consent').disabled=false;status.textContent=`Se enviarán ${pages.length} páginas y ${count.toLocaleString('es-ES')} caracteres a ${AI_PROVIDERS[$('opt-provider').value]}. No se enviará el archivo PDF ni sus imágenes.`;}
  catch(e){if(!state.disposed)status.textContent=e.message;}finally{if(!state.disposed)button.disabled=false;}
 };
}
