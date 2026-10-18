import {AI_PROVIDERS,AI_TEXT_LIMIT} from './ai-contract.js';
import {getAISettings,onAISettingsChange,providerTerms,openAISettings,refreshAIIndicators} from './ai-settings.js';
const $=id=>document.getElementById(id);
let active=null,intent={mode:'local'};
export function setAIIntent(mode){intent={mode};}
export function aiOptions(){return `<label class="field">Cómo quieres leer el documento<select id="opt-summarymode" aria-describedby="ai-method-help"><option value="local" ${intent.mode==='local'?'selected':''}>Sin IA · extraer frases del PDF</option><option value="ai" ${intent.mode==='ai'?'selected':''}>Con IA · entender el documento</option></select></label><p id="ai-method-help" class="hint"></p>
<div id="ai-options" ${intent.mode==='ai'?'':'hidden'}><div class="ai-connection"><p id="ai-tool-connection" role="status"></p><button type="button" class="text-button" data-ai-settings><span data-ai-settings-label>Configurar IA</span></button></div>
<p id="ai-task-help" class="hint">Recibirás un único informe adaptado al documento: resumen, trabajos o peticiones, importes, condiciones, fechas y próximos pasos cuando consten. Las citas estarán desplegables para contrastarlo con el PDF.</p>
<ol class="ai-steps" role="list" aria-label="Dos pasos para consultar la IA"><li id="ai-step-review"><strong>1. Revisa el texto</strong><span>Se prepara en tu dispositivo. Todavía no se envía nada.</span></li><li id="ai-step-send"><strong>2. Envía y obtén el informe</strong><span>El proveedor de IA recibirá el texto cuando pulses el botón de envío.</span></li></ol>
<p id="ai-next-step" class="ai-next-step" role="status"></p>
<p id="ai-review-status" role="status" class="hint"></p><details id="ai-review-box" hidden><summary>Texto que recibirá la IA, por páginas</summary><pre id="ai-review-text" class="viewer-text" tabindex="0" aria-label="Texto que se enviará al proveedor de IA"></pre></details>
<button id="ai-review" type="button" class="text-button" hidden>Volver a preparar el texto</button>
<div id="ai-send-notice" class="ai-send-notice" hidden><strong id="ai-send-title"></strong><p>Al pulsar el botón de envío, este texto se enviará con tu clave de API. El archivo PDF y sus imágenes permanecen en tu dispositivo. El proveedor puede cobrar el uso según tu cuenta. <a id="ai-provider-link" target="_blank" rel="noopener noreferrer">Ver precios y condiciones</a>.</p><p>Puedes cambiar las páginas o cerrar esta ventana sin enviar nada.</p></div></div>`;}
export function clearAI(){if(active){active.disposed=true;active.unsubscribe?.();active.pages=null;active.approved=false;active=null;}$('process')?.removeAttribute('aria-describedby');}
export function refreshAIAction(){active?.refresh?.();}
// A separate click after local review explicitly authorizes this one request.
export async function prepareAI(){
 if($('opt-summarymode')?.value!=='ai')return true;
 const state=active,config=getAISettings();if(!config){openAISettings();return false;}
 if(!state||state.disposed||state.reviewing)return false;
 if(!state.pages||state.connectionRevision!==config.revision){await state.review();return false;}
 state.approved=true;return true;
}
export function collectAI(){
 const mode=$('opt-summarymode')?.value||'local';if(mode==='local')return {summarymode:mode};
 const config=getAISettings();if(!config)throw new Error('Conecta tu cuenta desde Configurar IA antes de continuar.');
 if(!active?.pages||active.connectionRevision!==config.revision)throw new Error('Pulsa «Revisar texto» para ver qué recibirá la IA. Todavía no se ha enviado nada.');
 if(!active.approved)throw new Error('Después de revisar el texto, pulsa el botón «Enviar» para confirmar esta consulta.');
 const result={summarymode:mode,...config,aimode:'understand',aiConsent:true,reviewedPages:active.pages};
 active.approved=false;active.pages=null;return result;
}
export function bindAI(files,extract){
 clearAI();const state={disposed:false,pages:null,approved:false,reviewing:false,revision:0,connectionRevision:null};active=state;
 const refresh=()=>{
  if(state.disposed)return;
  const ai=$('opt-summarymode').value==='ai',config=getAISettings(),ready=!!state.pages&&state.connectionRevision===config?.revision;
  $('ai-method-help').textContent=ai?'La IA resume y explica el documento en un único informe. Envía el texto al proveedor que elijas y puede tener coste.':'Selecciona frases literales del documento, sin reescribirlas. Funciona en tu dispositivo, gratis y sin enviar datos.';
  $('work-title').textContent=ai?'Entender mi PDF':'Resumen sin IA';
  $('work-description').textContent=ai?'Entiende las ideas principales y lo que pide el documento en un solo informe. Primero revisas el texto; después decides si lo envías a tu IA.':'Extrae frases del documento en tu dispositivo, sin una cuenta de IA ni envío de datos.';
  $('ai-review').hidden=!ready;$('ai-review').disabled=state.reviewing;
  $('ai-send-notice').hidden=!ready;$('ai-review-box').hidden=!ready;
  $('ai-step-review').toggleAttribute('data-complete',ready);$('ai-step-review').setAttribute('aria-current',ready?'false':'step');$('ai-step-send').setAttribute('aria-current',ready?'step':'false');
  if(config){$('ai-provider-link').href=providerTerms(config.provider);$('ai-send-title').textContent='Destino del texto: '+AI_PROVIDERS[config.provider];}
  const next=!config?'Conecta tu cuenta de IA para continuar.':!files.length?'Añade un PDF para preparar el texto.':state.reviewing?'Preparando el texto en tu dispositivo…':ready?'Texto preparado. Léelo y pulsa «Enviar» si quieres generar el informe.':'Pulsa «Revisar texto». Podrás verlo antes de decidir si lo envías.';
  $('ai-next-step').textContent=next;
  if(ai){$('process').textContent=!config?'Conectar IA':state.reviewing?'Preparando texto…':!ready?'1. Revisar texto':'Enviar a '+AI_PROVIDERS[config.provider]+' y analizar';$('process').setAttribute('aria-describedby','ai-next-step'+(ready?' ai-send-title':''));}
  else{$('process').textContent='Extraer frases del PDF';$('process').removeAttribute('aria-describedby');}
  $('process').disabled=state.reviewing||!files.length;
 };
 state.refresh=refresh;
 const invalidate=()=>{state.revision++;state.pages=null;state.approved=false;state.connectionRevision=null;state.reviewing=false;$('ai-review-text').textContent='';$('ai-review-status').textContent='Hasta 100 páginas y 60.000 caracteres. Si el PDF es un escaneado, utiliza OCR primero.';refresh();};
 const connectionChanged=()=>{invalidate();const config=getAISettings();$('ai-tool-connection').textContent=config?'Proveedor elegido: '+AI_PROVIDERS[config.provider]+'. El texto se envía solo cuando tú lo confirmas.':'Conecta tu cuenta para usar IA o elige «Sin IA» para trabajar solo en tu dispositivo.';refreshAIIndicators();};
 const modeChanged=()=>{intent.mode=$('opt-summarymode').value;const ai=intent.mode==='ai';$('ai-options').hidden=!ai;document.querySelector('#opt-count').closest('label').hidden=ai;invalidate();$('processing-location').textContent=ai?'Revisión local · envío posterior a tu proveedor de IA':'Procesado en tu navegador';};
 $('opt-summarymode').onchange=modeChanged;
 $('opt-range')?.addEventListener('input',invalidate);
 state.unsubscribe=onAISettingsChange(connectionChanged);connectionChanged();modeChanged();
 state.review=$('ai-review').onclick=async()=>{
  if(state.reviewing)return;invalidate();const revision=state.revision,config=getAISettings(),status=$('ai-review-status');
  if(!config){openAISettings();return;}if(!files[0]){status.textContent='Selecciona primero un PDF.';return;}
  state.reviewing=true;refresh();status.textContent='Leyendo el texto en tu dispositivo. No se está consultando la IA.';
  try{
   const pages=await extract(files[0],{range:$('opt-range').value});if(state.disposed||revision!==state.revision)return;
   const count=pages.reduce((n,p)=>n+p.text.length,0);if(!count)throw new Error('No hay texto seleccionable. Aplica OCR primero.');if(pages.length>100||count>AI_TEXT_LIMIT)throw new Error('Selecciona menos páginas: hasta 100 páginas y 60.000 caracteres.');
   state.pages=pages;state.connectionRevision=config.revision;$('ai-review-text').textContent=pages.map(p=>`Página ${p.page}\n${p.text}`).join('\n\n');$('ai-review-box').open=true;
   status.textContent=`Texto preparado: ${pages.length} ${pages.length===1?'página':'páginas'} · ${count.toLocaleString('es-ES')} caracteres. Todavía no se ha enviado a ${AI_PROVIDERS[config.provider]}.`;
  }catch(e){if(!state.disposed&&revision===state.revision)status.textContent=e.message;}
  finally{if(!state.disposed&&revision===state.revision){state.reviewing=false;refresh();if(state.pages)$('ai-review-text').focus();}}
 };
}
