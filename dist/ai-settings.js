import {AI_PROVIDERS,assertAIKey,assertAIModel,keyProviderHint} from './ai-contract.js';
import {requestAI,desktopAIEndpoint} from './ai-client.js';
const $=id=>document.getElementById(id);
const links={
 gemini:{key:'https://aistudio.google.com/apikey',terms:'https://ai.google.dev/gemini-api/docs/pricing'},
 openai:{key:'https://platform.openai.com/api-keys',terms:'https://openai.com/api/pricing/'},
 anthropic:{key:'https://console.anthropic.com',terms:'https://www.anthropic.com/pricing'},
 xai:{key:'https://console.x.ai',terms:'https://docs.x.ai/docs/models'},
 deepseek:{key:'https://platform.deepseek.com',terms:'https://api-docs.deepseek.com/quick_start/pricing/'},
 mistral:{key:'https://console.mistral.ai',terms:'https://mistral.ai/pricing'}
};
let connection=null,revision=0,pending=null,requestRevision=0,draftProvider=null;
const listeners=new Set();
// Only tab memory: no key in storage, cookies, URLs or data attributes.
export const getAISettings=()=>connection?{...connection,revision}:null;
export const onAISettingsChange=callback=>{listeners.add(callback);return ()=>listeners.delete(callback);};
export const providerTerms=id=>links[id]?.terms;
export function refreshAIIndicators(){
 const name=connection?AI_PROVIDERS[connection.provider]:'';
 const label=connection?(connection.manual?'IA configurada · ':'IA conectada · ')+name:'Configurar IA';
 const status=connection?`${label}. ${connection.manual?'Modelo manual: se comprobará en la primera consulta.':'El saldo y los permisos de generación se comprueban al consultar.'} La clave se olvida al cerrar o recargar PDF.`:'IA sin conectar. Si has cerrado o recargado PDF, vuelve a introducir tu clave. El resumen sin IA no la necesita.';
 document.querySelectorAll('[data-ai-status]').forEach(el=>el.textContent=status);
 document.querySelectorAll('[data-ai-settings-label]').forEach(el=>el.textContent=label);
 document.querySelectorAll('[data-ai-settings]').forEach(el=>{el.dataset.aiConnection=connection?(connection.manual?'manual':'connected'):'off';el.setAttribute('aria-label',label+'. Abrir configuración de IA');el.title=status;});
 if($('ai-forget'))$('ai-forget').hidden=!connection;
}
function announce(){
 refreshAIIndicators();
 for(const callback of listeners)callback();
}
function resetConnectButton(){const provider=$('ai-provider').value;$('ai-connect').disabled=!Object.hasOwn(AI_PROVIDERS,provider);$('ai-connect').textContent=AI_PROVIDERS[provider]?'Conectar con '+AI_PROVIDERS[provider]:'Elige un proveedor';}
function cancelPending(){requestRevision++;pending?.abort();pending=null;if($('ai-connect'))resetConnectButton();}
function clearKeyWarning(){$('ai-key-warning').hidden=true;$('ai-key-warning').textContent='';$('ai-key-provider-fix').hidden=true;$('ai-key-provider-fix').removeAttribute('data-provider');$('ai-key').removeAttribute('aria-invalid');}
function updateKeyWarning(){
 clearKeyWarning();const provider=$('ai-provider').value,key=$('ai-key').value.trim();$('ai-key-state').textContent=key?'Clave introducida. Se comprobará al conectar.':'';if(!provider||!key)return;
 try{assertAIKey(provider,key);}catch(e){
  $('ai-key-warning').hidden=false;$('ai-key-warning').textContent=e.message;$('ai-key').setAttribute('aria-invalid','true');
  const hint=keyProviderHint(key);if(e.code==='AI_KEY_PROVIDER'&&hint){$('ai-key-provider-fix').hidden=false;$('ai-key-provider-fix').dataset.provider=hint;$('ai-key-provider-fix').textContent='Elegir '+AI_PROVIDERS[hint];}
 }
}
function cleanDraft(){cancelPending();draftProvider=null;$('ai-key').value='';$('ai-key-state').textContent='';$('ai-model-id').value='';$('ai-workspace').value='';clearKeyWarning();}
export function forgetAISettings(){connection=null;revision++;cleanDraft();announce();}
// Prefer stable text families. Selection does not establish quota or price.
export function chooseAIModel(provider,models){
 const rows=(Array.isArray(models)?models:[]).filter(m=>typeof m?.id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(m.id)&&!/(embedding|image|audio|tts|transcri|realtime|live|research|robotic|computer-use|moderation|rerank|vision-only|aqa)/i.test(m.id));
 const families={gemini:/^gemini-.*(flash|pro)/,openai:/^(gpt-([4-9]|\d{2,})|o[1-9]|chatgpt-)/,anthropic:/^claude-/,xai:/^grok-/,mistral:/mistral|ministral|magistral|mixtral/,deepseek:/^deepseek-/};
 const score=id=>{
  let n=/(preview|experimental|exp-|beta)/i.test(id)?-100:0;
  if(provider==='gemini')n+=id==='gemini-2.5-flash'?90:/flash-lite/.test(id)?70:/flash/.test(id)?60:0;
  if(provider==='openai')n+=/mini/.test(id)?60:/nano/.test(id)?40:0;
  if(provider==='anthropic')n+=/haiku/.test(id)?60:/sonnet/.test(id)?30:0;
  if(provider==='xai')n+=/fast/.test(id)?60:/mini/.test(id)?40:0;
  if(provider==='deepseek')n+=/flash/.test(id)?90:/chat/.test(id)?60:0;
  if(provider==='mistral')n+=id==='mistral-small-latest'?90:/small/.test(id)?60:/medium/.test(id)?30:0;
  return n+(/latest/.test(id)?5:0);
 };
 const usable=rows.filter(m=>families[provider]?.test(m.id));
 usable.sort((a,b)=>score(b.id)-score(a.id)||b.id.localeCompare(a.id,undefined,{numeric:true}));
 return usable[0]?.id||'';
}
function providerChanged(){
 const id=$('ai-provider').value;if(id===draftProvider)return;draftProvider=id;cancelPending();
 // A provider correction must not erase the user's draft. Validation and a
 // fresh Connect click are required before sending it to the selected host.
 clearKeyWarning();$('ai-model-id').value='';$('ai-workspace').value='';$('ai-model-choice').value='auto';
 const selected=Object.hasOwn(AI_PROVIDERS,id);$('ai-key').disabled=!selected;$('ai-advanced').hidden=!selected;$('ai-key-steps').hidden=!selected;$('ai-terms-link').hidden=!selected;
 $('ai-key-label').textContent=selected?'2. Pega tu clave de '+AI_PROVIDERS[id]:'2. Pega tu clave de API';
 $('ai-provider-help').textContent=selected?'Destino elegido: '+AI_PROVIDERS[id]+'. Usa únicamente una clave creada en ese proveedor.':'Cada proveedor tiene sus propias claves. Si la creaste en OpenAI, elige OpenAI (creador de ChatGPT).';
 $('ai-manual-model').hidden=true;$('ai-workspace-field').hidden=id!=='anthropic';
 if(selected){$('ai-key-link').href=links[id].key;$('ai-terms-link').href=links[id].terms;$('ai-key-link').textContent=`Conseguir una clave de ${AI_PROVIDERS[id]}`;}
 else{$('ai-key-link').removeAttribute('href');$('ai-terms-link').removeAttribute('href');}
 $('ai-free-help').hidden=id!=='gemini';
 $('ai-openai-help').hidden=id!=='openai';
 $('ai-connect-status').textContent=selected?($('ai-key').value.trim()?'La clave sigue introducida. Comprueba que sea de '+AI_PROVIDERS[id]+' y pulsa Conectar.':'Pega la clave de '+AI_PROVIDERS[id]+' y pulsa Conectar. El modelo se elige automáticamente.'):'Elige primero de qué proveedor es tu clave. No se ha enviado nada.';
 $('ai-current-model').textContent='Selección automática. No necesitas saber qué modelo elegir.';
 resetConnectButton();updateKeyWarning();
}
export function openAISettings(){
 const dialog=$('ai-settings-dialog');if(dialog.open)return;
 cleanDraft();$('ai-provider').value=connection?.provider||'';providerChanged();
 if(connection){$('ai-key').value=connection.apiKey;$('ai-workspace').value=connection.workspace;$('ai-current-model').textContent=`Modelo actual: ${connection.model}. La cuota y el precio dependen de tu cuenta.`;
  if(connection.manual){$('ai-model-choice').value='manual';$('ai-manual-model').hidden=false;$('ai-model-id').value=connection.model;}}
 $('ai-connection-route').textContent=desktopAIEndpoint()?'Conexión: tu navegador → conector en tu ordenador → proveedor elegido.':'Conexión: tu navegador → proveedor elegido. Sin servidor intermedio de PDF Contigo.';
 updateKeyWarning();$('ai-advanced').open=false;$('ai-get-key-help').open=!connection;
 if($('ai-forget'))$('ai-forget').hidden=!connection;
 dialog.showModal();
}
function closeSettings(){cleanDraft();$('ai-settings-dialog').close();}
async function connect(){
 cancelPending();const provider=$('ai-provider').value,apiKey=$('ai-key').value.trim(),workspace=$('ai-workspace').value.trim(),manual=$('ai-model-choice').value==='manual';
 let model=$('ai-model-id').value.trim();const status=$('ai-connect-status');
 try{assertAIKey(provider,apiKey);}catch(e){status.textContent=`[${e.code}] ${e.message}`;updateKeyWarning();$(provider?'ai-key':'ai-provider').focus();return;}
 if(workspace&&!/^wrkspc_[a-zA-Z0-9]{10,80}$/.test(workspace)){status.textContent='Revisa el identificador del workspace de Claude.';return;}
 if(manual&&!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(model)){status.textContent='Escribe un identificador de modelo válido o vuelve a Selección automática.';return;}
 if(manual)try{assertAIModel(provider,model);}catch(e){status.textContent=`[${e.code}] ${e.message}`;$('ai-model-id').focus();return;}
 const run=requestRevision,controller=new AbortController();pending=controller;
 const timeout=setTimeout(()=>controller.abort(),90000);
 $('ai-connect').disabled=true;$('ai-connect').textContent='Conectando…';status.textContent='Conectando con '+AI_PROVIDERS[provider]+' y eligiendo un modelo de texto. No se envía ningún documento.';
 try{
  if(!manual){const result=await requestAI({action:'models',provider,apiKey,workspace},{signal:controller.signal});model=chooseAIModel(provider,result.models);if(!model)throw new Error('Tu cuenta no devuelve un modelo de texto compatible. Puedes indicar uno en Opciones avanzadas.');}
  if(run!==requestRevision||controller.signal.aborted)return;
  connection={provider,apiKey,workspace,model,manual};revision++;announce();closeSettings();
 }catch(e){if(run===requestRevision)status.textContent=controller.signal.aborted?'La conexión ha tardado demasiado. Comprueba internet y vuelve a intentarlo.':(typeof e.code==='string'&&e.code.startsWith('AI_')?`[${e.code}] `:'')+e.message;}
 finally{clearTimeout(timeout);if(run===requestRevision){pending=null;resetConnectButton();}}
}
export function initAISettings(){
 $('ai-provider').innerHTML='<option value="">Selecciona el proveedor de tu clave</option>'+Object.entries(AI_PROVIDERS).map(([id,name])=>`<option value="${id}">${id==='openai'?'OpenAI (creador de ChatGPT)':name}</option>`).join('');
 document.addEventListener('click',e=>{if(e.target.closest('[data-ai-settings]'))openAISettings();});
 $('ai-provider').onchange=providerChanged;
 for(const id of ['ai-key','ai-workspace','ai-model-id'])$(id).addEventListener('input',()=>{cancelPending();updateKeyWarning();$('ai-connect-status').textContent='Pulsa Conectar para aplicar estos datos.';});
 $('ai-key-provider-fix').onclick=()=>{const provider=keyProviderHint($('ai-key').value.trim());if(!provider)return;$('ai-provider').value=provider;providerChanged();$('ai-connect-status').textContent='Has elegido '+AI_PROVIDERS[provider]+'. La clave sigue solo en esta pestaña. Pulsa Conectar para enviarla a ese proveedor.';$('ai-connect').focus();};
 $('ai-model-choice').onchange=()=>{cancelPending();const manual=$('ai-model-choice').value==='manual';$('ai-manual-model').hidden=!manual;$('ai-connect-status').textContent=manual?'El modelo indicado se comprobará al hacer la primera consulta. Puede tener coste.':'La conexión seleccionará un modelo de texto automáticamente.';};
 $('ai-connect').onclick=connect;$('ai-settings-close').onclick=closeSettings;
 $('ai-settings-dialog').addEventListener('cancel',e=>{e.preventDefault();closeSettings();});
 // Native close events are queued. An old event must not wipe a reopened form.
 $('ai-settings-dialog').addEventListener('close',()=>{if(!$('ai-settings-dialog').open)cleanDraft();});
 $('ai-forget').onclick=()=>{forgetAISettings();$('ai-connect-status').textContent='Conexión olvidada. Puedes seguir usando las herramientas locales.';};
 $('ai-use-local').onclick=()=>{closeSettings();document.querySelector('[data-ai-action="local"]').click();};
 window.addEventListener('pagehide',()=>{forgetAISettings();if($('ai-settings-dialog').open)$('ai-settings-dialog').close();});
 announce();
}
