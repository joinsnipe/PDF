export const AI_PROVIDERS=Object.freeze({gemini:'Gemini · Google',openai:'OpenAI',anthropic:'Claude · Anthropic',xai:'Grok · xAI',mistral:'Mistral',deepseek:'DeepSeek'});
export const AI_TEXT_LIMIT=60000;
export function aiError(code,message){return Object.assign(new Error(message),{code});}
// These hints identify familiar formats, not key validity. Unknown formats stay
// usable with an explicit provider; generic sk- is shared by several providers.
export function keyProviderHint(key){
 if(typeof key!=='string')return '';
 if(/^sk-(proj|svcacct)-/.test(key))return 'openai';
 if(/^sk-ant-/.test(key))return 'anthropic';
 if(/^xai-/.test(key))return 'xai';
 if(/^AIza/.test(key))return 'gemini';
 return '';
}
export function assertAIKey(provider,key){
 if(!Object.hasOwn(AI_PROVIDERS,provider))throw aiError('AI_PROVIDER','Elige primero de qué proveedor es tu clave. Si la creaste en OpenAI, selecciona OpenAI (creador de ChatGPT).');
 if(typeof key!=='string'||!key)throw aiError('AI_KEY','El campo de clave está vacío. Pega tu clave de API antes de conectar.');
 if(/\s/.test(key))throw aiError('AI_KEY_FORMAT','La clave contiene espacios o saltos de línea. Copia solo la clave completa del proveedor, sin texto adicional.');
 if(/[^\x21-\x7e]/.test(key))throw aiError('AI_KEY_FORMAT','La clave contiene caracteres ocultos o una versión enmascarada. Copia la clave original completa desde el proveedor.');
 if(key.length<12)throw aiError('AI_KEY_FORMAT','La clave introducida parece incompleta. Copia la clave completa, no su nombre ni la versión oculta con puntos.');
 if(key.length>512)throw aiError('AI_KEY_FORMAT','La clave supera el tamaño admitido. Comprueba que has copiado solo la clave, sin instrucciones ni texto adicional.');
 const hint=keyProviderHint(key);
 if(hint&&hint!==provider)throw aiError('AI_KEY_PROVIDER',`Por su formato, esta clave parece de ${AI_PROVIDERS[hint]}, pero has elegido ${AI_PROVIDERS[provider]}. Cambia el proveedor antes de conectar. La clave no se ha enviado.`);
 if(provider==='gemini'&&/^sk-/.test(key))throw aiError('AI_KEY_PROVIDER','Esta clave no parece de Gemini. El formato sk- lo utilizan varios proveedores, como OpenAI y DeepSeek; elige aquel donde la creaste. La clave no se ha enviado.');
}
export function assertAIModel(provider,model){
 const families={gemini:/^(?:models\/)?gemini-/,openai:/^(?:gpt-|chatgpt-|o[1-9](?:-|$))/,anthropic:/^claude-/,xai:/^grok-/,mistral:/^(?:mistral|ministral|magistral|mixtral)-/,deepseek:/^deepseek-/};
 const inferred=Object.entries(families).find(([,pattern])=>pattern.test(model))?.[0];
 if(inferred&&inferred!==provider)throw aiError('AI_MODEL_PROVIDER',`El modelo indicado parece de ${AI_PROVIDERS[inferred]}, pero has elegido ${AI_PROVIDERS[provider]}. Cambia el modelo o el proveedor. No se ha enviado ninguna consulta.`);
}
const normalized=s=>s.normalize('NFKC').replace(/\s+/gu,' ').trim();
export function validateReport(value,pages){
 if(!value||!Array.isArray(value.items)||!value.items.length||value.items.length>30)throw aiError('AI_EVIDENCE','La IA no devolvió un informe con referencias comprobables. Prueba con menos páginas.');
 const source=new Map(pages.map(p=>[p.page,normalized(p.text)])),groups=new Set(['Resumen','Lo que piden','Documentación','Fechas mencionadas','Otros']);
 const items=value.items.map(item=>{
  if(!item||!groups.has(item.group)||typeof item.text!=='string'||!item.text.trim()||item.text.length>1500||!Number.isInteger(item.page)||typeof item.quote!=='string'||item.quote.length>600||normalized(item.quote).length<10||!source.get(item.page)?.includes(normalized(item.quote)))throw aiError('AI_EVIDENCE','Una referencia de la IA no coincide con el documento. No se muestra como verificada; prueba otra vez o selecciona menos páginas.');
  return {group:item.group,text:item.text.trim(),page:item.page,quote:item.quote.trim()};
 });
 const missing=Array.isArray(value.missing)?value.missing.filter(x=>typeof x==='string'&&x.length<=500).slice(0,6):[];
 return {items,missing};
}
export function reportText(report,provider,model){
 const parts=[`PDF Contigo · Informe con IA\nProveedor: ${AI_PROVIDERS[provider]}\nModelo: ${model}\n\nLas citas se han localizado en el texto extraído. Revisa su interpretación en el original.`];
 let group='';for(const item of report.items){if(item.group!==group){group=item.group;parts.push('\n'+group.toUpperCase());}parts.push(`${item.text} [p. ${item.page}]\nCita: «${item.quote}»`);}
 if(report.missing.length)parts.push('\nLA IA INDICA QUE NO ENCUENTRA\n'+report.missing.map(x=>'• '+x).join('\n'));
 return parts.join('\n\n');
}
