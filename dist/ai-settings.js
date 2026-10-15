import {AI_PROVIDERS} from './ai-contract.js';
import {requestAI} from './ai-client.js';
const $=id=>document.getElementById(id);
const links={
 gemini:{key:'https://aistudio.google.com/apikey',terms:'https://ai.google.dev/gemini-api/docs/pricing'},
 openai:{key:'https://platform.openai.com/api-keys',terms:'https://openai.com/api/pricing/'},
 anthropic:{key:'https://console.anthropic.com',terms:'https://www.anthropic.com/pricing'},
 xai:{key:'https://console.x.ai',terms:'https://docs.x.ai/docs/models'},
 mistral:{key:'https://console.mistral.ai',terms:'https://mistral.ai/pricing'}
};
let connection=null,revision=0,pending=null,requestRevision=0;
const listeners=new Set();
// Only tab memory: no key in storage, cookies, URLs or data attributes.
export const getAISettings=()=>connection?{...connection,revision}:null;
export const onAISettingsChange=callback=>{listeners.add(callback);return ()=>listeners.delete(callback);};
export const providerTerms=id=>links[id]?.terms;
function announce(){
 const status=connection?`${AI_PROVIDERS[connection.provider]} · configurado para esta pestaña`:'IA sin configurar · conecta tu cuenta cuando quieras';
 document.querySelectorAll('[data-ai-status]').forEach(el=>el.textContent=status);
 document.querySelectorAll('[data-ai-settings-label]').forEach(el=>el.textContent=connection?'Mi conexión de IA':'Configurar IA');
 if($('ai-forget'))$('ai-forget').hidden=!connection;
 for(const callback of listeners)callback();
}
function cancelPending(){requestRevision++;pending?.abort();pending=null;if($('ai-connect')){$('ai-connect').disabled=false;$('ai-connect').textContent='Conectar';}}
function cleanDraft(){cancelPending();$('ai-key').value='';$('ai-model-id').value='';$('ai-workspace').value='';}
export function forgetAISettings(){connection=null;revision++;cleanDraft();announce();}
// Prefer stable text families. Selection does not establish quota or price.
export function chooseAIModel(provider,models){
 const rows=(Array.isArray(models)?models:[]).filter(m=>typeof m?.id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(m.id)&&!/(embedding|image|audio|tts|transcri|realtime|live|research|robotic|computer-use|moderation|rerank|vision-only|aqa)/i.test(m.id));
 const families={gemini:/^gemini-.*(flash|pro)/,openai:/^(gpt-(4|5)|o[1-9]|chatgpt-)/,anthropic:/^claude-/,xai:/^grok-/,mistral:/mistral|ministral|magistral|mixtral/};
 const score=id=>{
  let n=/(preview|experimental|exp-|beta)/i.test(id)?-100:0;
  if(provider==='gemini')n+=id==='gemini-2.5-flash'?90:/flash-lite/.test(id)?70:/flash/.test(id)?60:0;
  if(provider==='openai')n+=/mini/.test(id)?60:/nano/.test(id)?40:0;
  if(provider==='anthropic')n+=/haiku/.test(id)?60:/sonnet/.test(id)?30:0;
  if(provider==='xai')n+=/fast/.test(id)?60:/mini/.test(id)?40:0;
  if(provider==='mistral')n+=id==='mistral-small-latest'?90:/small/.test(id)?60:/medium/.test(id)?30:0;
  return n+(/latest/.test(id)?5:0);
 };
 const usable=rows.filter(m=>families[provider]?.test(m.id));
 usable.sort((a,b)=>score(b.id)-score(a.id)||b.id.localeCompare(a.id,undefined,{numeric:true}));
 return usable[0]?.id||'';
}
function providerChanged(){
 cancelPending();const id=$('ai-provider').value;
 $('ai-key').value='';$('ai-model-id').value='';$('ai-workspace').value='';$('ai-model-choice').value='auto';
 $('ai-manual-model').hidden=true;$('ai-workspace-field').hidden=id!=='anthropic';
 $('ai-key-link').href=links[id].key;$('ai-terms-link').href=links[id].terms;
 $('ai-key-link').textContent=`Conseguir una clave de ${AI_PROVIDERS[id]}`;
 $('ai-free-help').hidden=id!=='gemini';
 $('ai-connect-status').textContent='Pega tu clave y pulsa Conectar. El modelo se elige automáticamente.';
 $('ai-current-model').textContent='Selección automática. No necesitas saber qué modelo elegir.';
}
export function openAISettings(){
 const dialog=$('ai-settings-dialog');if(dialog.open)return;
 $('ai-provider').value=connection?.provider||'gemini';providerChanged();
 if(connection){$('ai-key').value=connection.apiKey;$('ai-workspace').value=connection.workspace;$('ai-current-model').textContent=`Modelo actual: ${connection.model}. La cuota y el precio dependen de tu cuenta.`;
  if(connection.manual){$('ai-model-choice').value='manual';$('ai-manual-model').hidden=false;$('ai-model-id').value=connection.model;}}
 $('ai-advanced').open=false;$('ai-get-key-help').open=!connection;
 if($('ai-forget'))$('ai-forget').hidden=!connection;
 dialog.showModal();
}
function closeSettings(){cleanDraft();$('ai-settings-dialog').close();}
async function connect(){
 cancelPending();const provider=$('ai-provider').value,apiKey=$('ai-key').value.trim(),workspace=$('ai-workspace').value.trim(),manual=$('ai-model-choice').value==='manual';
 let model=$('ai-model-id').value.trim();const status=$('ai-connect-status');
 if(apiKey.length<12||apiKey.length>512||/\s/.test(apiKey)){status.textContent='Pega una clave de API válida del proveedor elegido.';$('ai-key').focus();return;}
 if(workspace&&!/^wrkspc_[a-zA-Z0-9]{10,80}$/.test(workspace)){status.textContent='Revisa el identificador del workspace de Claude.';return;}
 if(manual&&!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(model)){status.textContent='Escribe un identificador de modelo válido o vuelve a Selección automática.';return;}
 const run=requestRevision,controller=new AbortController();pending=controller;
 const timeout=setTimeout(()=>controller.abort(),90000);
 $('ai-connect').disabled=true;$('ai-connect').textContent='Conectando…';status.textContent='Comprobando la clave y eligiendo un modelo de texto. No se envía ningún documento.';
 try{
  if(!manual){const result=await requestAI({action:'models',provider,apiKey,workspace},{signal:controller.signal});model=chooseAIModel(provider,result.models);if(!model)throw new Error('Tu cuenta no devuelve un modelo de texto compatible. Puedes indicar uno en Opciones avanzadas.');}
  if(run!==requestRevision||controller.signal.aborted)return;
  connection={provider,apiKey,workspace,model,manual};revision++;announce();closeSettings();
 }catch(e){if(run===requestRevision)status.textContent=controller.signal.aborted?'La conexión ha tardado demasiado. Comprueba internet y vuelve a intentarlo.':e.message;}
 finally{clearTimeout(timeout);if(run===requestRevision){pending=null;$('ai-connect').disabled=false;$('ai-connect').textContent='Conectar';}}
}
export function initAISettings(){
 $('ai-provider').innerHTML=Object.entries(AI_PROVIDERS).map(([id,name])=>`<option value="${id}">${name}${id==='gemini'?' · opción con cuota gratuita':''}</option>`).join('');
 document.addEventListener('click',e=>{if(e.target.closest('[data-ai-settings]'))openAISettings();});
 $('ai-provider').onchange=providerChanged;
 for(const id of ['ai-key','ai-workspace','ai-model-id'])$(id).addEventListener('input',()=>{cancelPending();$('ai-connect-status').textContent='Pulsa Conectar para aplicar estos datos.';});
 $('ai-model-choice').onchange=()=>{cancelPending();const manual=$('ai-model-choice').value==='manual';$('ai-manual-model').hidden=!manual;$('ai-connect-status').textContent=manual?'El modelo indicado se comprobará al hacer la primera consulta. Puede tener coste.':'La conexión seleccionará un modelo de texto automáticamente.';};
 $('ai-connect').onclick=connect;$('ai-settings-close').onclick=closeSettings;
 $('ai-settings-dialog').addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
 $('ai-settings-dialog').addEventListener('close',cleanDraft);
 $('ai-forget').onclick=()=>{forgetAISettings();$('ai-connect-status').textContent='Conexión olvidada. Puedes seguir usando las herramientas locales.';};
 $('ai-use-local').onclick=()=>{closeSettings();document.querySelector('[data-ai-action="local"]').click();};
 window.addEventListener('pagehide',()=>{forgetAISettings();if($('ai-settings-dialog').open)$('ai-settings-dialog').close();});
 announce();
}
