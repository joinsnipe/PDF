import {AI_PROVIDERS,AI_TEXT_LIMIT} from './ai-contract.js';
import {getAISettings,onAISettingsChange,providerTerms} from './ai-settings.js';
const $=id=>document.getElementById(id);
let active=null,intent={mode:'local',task:'summary'};
export function setAIIntent(mode,task='summary'){intent={mode,task};}
export function aiOptions(){return `<label class="field">Cómo quieres trabajar<select id="opt-summarymode"><option value="local" ${intent.mode==='local'?'selected':''}>Resumen gratuito sin API · selecciona frases, sin IA</option><option value="ai" ${intent.mode==='ai'?'selected':''}>Resumir o explicar con IA</option></select></label>
<div id="ai-options" ${intent.mode==='ai'?'':'hidden'}><div class="ai-connection"><p id="ai-tool-connection" role="status"></p><button type="button" class="text-button" data-ai-settings>Configurar IA</button></div>
<label class="field">Qué necesitas<select id="opt-aimode"><option value="summary" ${intent.task==='summary'?'selected':''}>Resumen en lenguaje sencillo</option><option value="explain" ${intent.task==='explain'?'selected':''}>Explicar qué pide y qué fechas menciona</option></select></label>
<p class="hint">Revisa el texto antes de enviarlo. Tu dispositivo lo envía al proveedor elegido con tu clave. En escritorio se utiliza el conector de tu propio ordenador. No pasa por un servidor compartido de PDF Contigo. El proveedor aplica sus condiciones y puede cobrar consumo. <a id="ai-provider-link" target="_blank" rel="noopener noreferrer">Precios y condiciones</a>.</p>
<button id="ai-review" type="button" class="text-button">Revisar el texto que se enviará</button><p id="ai-review-status" role="status" class="hint">Hasta 100 páginas y 60.000 caracteres. Si es un escaneado, aplica OCR antes.</p><details id="ai-review-box" hidden><summary>Texto seleccionado, por páginas</summary><pre id="ai-review-text" class="viewer-text"></pre></details>
<label class="check-row"><input id="ai-consent" type="checkbox" disabled>Autorizo que mi dispositivo envíe este texto y mi clave al proveedor elegido. He revisado sus condiciones y posibles costes.</label></div>`;}
export function clearAI(){if(active){active.disposed=true;active.unsubscribe?.();active.pages=null;active=null;}}
export function collectAI(){
 const mode=$('opt-summarymode')?.value||'local';if(mode==='local')return {summarymode:mode};
 const config=getAISettings();if(!config)throw new Error('Conecta tu cuenta desde Configurar IA antes de continuar.');
 if(!active?.pages||active.connectionRevision!==config.revision||!$('ai-consent')?.checked)throw new Error('Revisa el texto y autoriza su envío antes de consultar la IA.');
 const result={summarymode:mode,...config,aimode:$('opt-aimode').value,aiConsent:true,reviewedPages:active.pages};
 $('ai-consent').checked=false;$('ai-consent').disabled=true;active.pages=null;return result;
}
export function bindAI(files,extract){
 clearAI();const state={disposed:false,pages:null,revision:0,connectionRevision:null};active=state;
 const invalidate=()=>{state.revision++;state.pages=null;$('ai-consent').checked=false;$('ai-consent').disabled=true;$('ai-review-box').hidden=true;$('ai-review-text').textContent='';};
 const connectionChanged=()=>{invalidate();const config=getAISettings();$('ai-tool-connection').textContent=config?`${AI_PROVIDERS[config.provider]} · ${config.model}${config.manual?' · modelo indicado manualmente':''}`:'Conecta tu cuenta para usar IA. Puedes hacerlo sin salir de esta herramienta.';$('ai-review').disabled=!config;$('ai-provider-link').hidden=!config;if(config)$('ai-provider-link').href=providerTerms(config.provider);$('ai-review-status').textContent='La clave se conserva solo en esta pestaña. Revisa y autoriza el texto de cada consulta.';};
 const modeChanged=()=>{intent.mode=$('opt-summarymode').value;const ai=intent.mode==='ai';$('ai-options').hidden=!ai;document.querySelector('#opt-count').closest('label').hidden=ai;invalidate();$('process').textContent=ai?(intent.task==='explain'?'Explicar con IA':'Resumir con IA'):'Crear resumen local';$('processing-location').textContent=ai?'IA externa · envío con tu autorización':'Procesado en tu navegador';};
 $('opt-summarymode').onchange=modeChanged;
 $('opt-aimode').onchange=()=>{intent.task=$('opt-aimode').value;modeChanged();};
 $('opt-range')?.addEventListener('input',invalidate);
 state.unsubscribe=onAISettingsChange(connectionChanged);connectionChanged();modeChanged();
 $('ai-review').onclick=async()=>{const button=$('ai-review'),status=$('ai-review-status');invalidate();const revision=state.revision,config=getAISettings();if(!config){status.textContent='Conecta primero tu cuenta de IA.';return;}if(!files[0]){status.textContent='Selecciona primero un PDF.';return;}button.disabled=true;status.textContent='Leyendo el texto en tu dispositivo…';
  try{const pages=await extract(files[0],{range:$('opt-range').value});if(state.disposed||revision!==state.revision)return;const count=pages.reduce((n,p)=>n+p.text.length,0);if(!count)throw new Error('No hay texto seleccionable. Aplica OCR primero.');if(pages.length>100||count>AI_TEXT_LIMIT)throw new Error('Selecciona menos páginas: hasta 100 páginas y 60.000 caracteres.');state.pages=pages;state.connectionRevision=config.revision;$('ai-review-text').textContent=pages.map(p=>`Página ${p.page}\n${p.text}`).join('\n\n');$('ai-review-box').hidden=false;$('ai-review-box').open=true;$('ai-consent').disabled=false;status.textContent=`Se enviarán ${pages.length} páginas y ${count.toLocaleString('es-ES')} caracteres a ${AI_PROVIDERS[config.provider]}. No se enviará el archivo PDF ni sus imágenes.`;}
  catch(e){if(!state.disposed)status.textContent=e.message;}finally{if(!state.disposed)button.disabled=!getAISettings();}
 };
}
