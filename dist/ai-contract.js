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
// Compare typography, never remove negations, signs, digits or accents.
const normalized=s=>s.normalize('NFKC').replace(/\u00ad/gu,'').replace(/(\p{L})-\r?\n(?=\p{Ll})/gu,'$1').replace(/[“”]/gu,'"').replace(/[‘’]/gu,"'").replace(/\s+/gu,' ').trim();
// The app owns the page numbers and literal excerpts. The model only cites IDs.
// Slices preserve the original text, including spaces and line breaks.
export function evidenceSources(pages){
 const sources=[];
 for(const page of pages){
  let start=0,index=0;
  while(start<page.text.length){
   let end=Math.min(start+500,page.text.length);
   if(end<page.text.length){const split=page.text.slice(start,end).search(/\s+\S*$/u);if(split>250)end=start+split;}
   const quote=page.text.slice(start,end).trim();
   if(quote)sources.push({id:`p${page.page}s${++index}`,page:page.page,text:quote});
   start=end;
  }
 }
 return sources;
}
export function validateReport(value,pages){
 if(!value||!Array.isArray(value.items)||value.items.length>30)throw aiError('AI_FORMAT','La IA no devolvió un informe legible. No se ha repetido la consulta ni se ha cambiado de proveedor.');
 const source=new Map(pages.map(p=>[p.page,normalized(p.text)])),groups=new Set(['Resumen','Lo que piden','Documentación','Fechas mencionadas','Otros']);
 const excerpts=new Map(evidenceSources(pages).map(s=>[s.id,s]));
 const items=[];let omittedCount=0;
 for(const item of value.items){
  if(!item||!groups.has(item.group)||typeof item.text!=='string'||!item.text.trim()||item.text.length>1500){omittedCount++;continue;}
  let page,quote;
  if(Object.hasOwn(item,'source_id')){
   const excerpt=typeof item.source_id==='string'?excerpts.get(item.source_id):null;
   if(!excerpt){omittedCount++;continue;}
   page=excerpt.page;quote=excerpt.text;
  }else{
   // Compatibility for models returning the previous literal-quote format.
   if(!Number.isInteger(item.page)||typeof item.quote!=='string'||item.quote.length>600||normalized(item.quote).length<10||!source.get(item.page)?.includes(normalized(item.quote))){omittedCount++;continue;}
   page=item.page;quote=item.quote.trim();
  }
  items.push({group:item.group,text:item.text.trim(),page,quote});
 }
 const missing=Array.isArray(value.missing)?value.missing.filter(x=>typeof x==='string'&&x.length<=500).slice(0,6):[];
 return {items,missing,...(omittedCount?{omittedCount}:{})};
}
export function reportNotice(report){
 if(!report.items.length)return 'La IA respondió, pero no se pudo localizar ninguna referencia válida. No se muestran sus afirmaciones. Puedes consultar el PDF original aquí o usar el resumen sin IA. La consulta no se ha repetido; el proveedor puede haberla cobrado.';
 const partial=report.omittedCount?`Informe parcial: ${report.omittedCount===1?'se ha omitido 1 punto cuya referencia no se pudo comprobar.':`se han omitido ${report.omittedCount} puntos cuyas referencias no se pudieron comprobar.`} `:'';
 return partial+'Las citas se han localizado en el texto extraído; eso no verifica la interpretación de la IA. Contrasta fechas, cifras y obligaciones con el original. No se ha repetido la consulta.';
}
export function reportText(report,provider,model){
 const parts=[`PDF Contigo · Entender mi PDF\nProveedor: ${AI_PROVIDERS[provider]}\nModelo: ${model}\n\n${reportNotice(report)}`];
 let group='';for(const item of report.items){if(item.group!==group){group=item.group;parts.push('\n'+group.toUpperCase());}parts.push(`${item.text} [p. ${item.page}]\nCita: «${item.quote}»`);}
 if(report.items.length&&report.missing.length)parts.push('\nLA IA INDICA QUE NO ENCUENTRA (COMPRUÉBALO EN EL ORIGINAL)\n'+report.missing.map(x=>'• '+x).join('\n'));
 return parts.join('\n\n');
}
