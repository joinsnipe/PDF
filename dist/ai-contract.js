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
export const REPORT_GROUPS=['Resumen','Alcance y trabajos','Materiales y procedimiento','Importes y condiciones','Plazos y fechas','Decisiones y próximos pasos','Documentación','Puntos a revisar','Lo que piden','Fechas mencionadas','Otros'];
const documentTypes=new Set(['Propuesta o presupuesto','Factura','Contrato','Comunicación administrativa','Informe','Documento informativo','Otro documento']);
// Conservative check: preserves signs, decimals and units, never guesses a conversion.
export function unsupportedNumbers(claim,quotes){
 const numbers=s=>(normalized(s).match(/[+−-]?\d+(?:[.,]\d+)*(?:\s*(?:%|€|EUR|USD|euros?|dólares?))?/gu)||[]).map(n=>n.replace(/\s/g,'').replace(/EUR|euros?/g,'€').replace(/USD|dólares?/g,'$'));
 const found=new Set(numbers(quotes.join(' ')));
 return numbers(claim).some(n=>!found.has(n));
}
export const itemCitations=item=>item.citations||[{page:item.page,quote:item.quote}];
export function validateReport(value,pages){
 if(!value||!Array.isArray(value.items)||value.items.length>30)throw aiError('AI_FORMAT','La IA no devolvió un informe legible. No se ha repetido la consulta ni se ha cambiado de proveedor.');
 const source=new Map(pages.map(p=>[p.page,normalized(p.text)])),groups=new Set(REPORT_GROUPS);
 const excerpts=new Map(evidenceSources(pages).map(s=>[s.id,s]));
 const items=[],seen=new Set();let omittedCount=0;
 for(const item of value.items){
  if(!item||!groups.has(item.group)||typeof item.text!=='string'||!item.text.trim()||item.text.length>1500){omittedCount++;continue;}
  let citations=[];
  if(Object.hasOwn(item,'evidence')){
   if(!Array.isArray(item.evidence)||!item.evidence.length||item.evidence.length>3){omittedCount++;continue;}
   for(const ref of item.evidence){
    const excerpt=excerpts.get(ref?.source_id),quote=typeof ref?.quote==='string'?normalized(ref.quote):'';
    if(!excerpt||quote.length<10||quote.length>500||!normalized(excerpt.text).includes(quote)){citations=[];break;}
    citations.push({page:excerpt.page,quote});
   }
   if(!citations.length){omittedCount++;continue;}
  }else if(Object.hasOwn(item,'source_id')){
   // Backward-compatible source-ID responses still undergo the number check.
   const excerpt=typeof item.source_id==='string'?excerpts.get(item.source_id):null;
   if(!excerpt){omittedCount++;continue;}citations=[{page:excerpt.page,quote:excerpt.text}];
  }else{
   if(!Number.isInteger(item.page)||typeof item.quote!=='string'||item.quote.length>600||normalized(item.quote).length<10||!source.get(item.page)?.includes(normalized(item.quote))){omittedCount++;continue;}
   citations=[{page:item.page,quote:item.quote.trim()}];
  }
  const text=item.text.trim();
  if(unsupportedNumbers(text,citations.map(c=>c.quote))){omittedCount++;continue;}
  const duplicate=normalized(text).toLocaleLowerCase('es');if(seen.has(duplicate))continue;seen.add(duplicate);
  items.push({group:item.group,text,...citations[0],...(citations.length>1?{citations}:{})});
 }
 items.sort((a,b)=>REPORT_GROUPS.indexOf(a.group)-REPORT_GROUPS.indexOf(b.group));
 const missing=Array.isArray(value.missing)?[...new Set(value.missing.filter(x=>typeof x==='string'&&x.length<=500).map(x=>x.trim()).filter(Boolean))].slice(0,6):[];
 return {items,missing,...(omittedCount?{omittedCount}:{}),...(documentTypes.has(value.document_type)?{documentType:value.document_type}:{})};
}
export function reportNotice(report){
 if(!report.items.length)return 'La IA respondió, pero no se pudo localizar ninguna referencia suficiente para mostrar sus afirmaciones. Puedes consultar el PDF original aquí o usar el resumen sin IA. La consulta no se ha repetido; el proveedor puede haberla cobrado.';
 const partial=report.omittedCount?`Informe parcial: se han omitido ${report.omittedCount} puntos por referencias o cifras sin respaldo suficiente. `:'';
 return partial+'Las citas están en el texto extraído y se han contrastado las cifras escritas con dígitos. Esto no verifica toda la interpretación de la IA. Revisa condiciones, fechas e importes en el original. No se ha repetido la consulta.';
}
export function coverageText(coverage){
 if(!coverage)return '';
 const numbers=coverage.pages.join(', '),empty=coverage.emptyPages;
 return `Texto enviado: ${coverage.pages.length} páginas (p. ${numbers}). ${coverage.characters.toLocaleString('es-ES')} caracteres. Solo texto extraído; las imágenes y tablas sin texto seleccionable no se interpretan.${empty.length?' Páginas sin texto legible: '+empty.join(', ')+'. Utiliza OCR para incluir su contenido.':''}`;
}
export function reportText(report,provider,model){
 const parts=[`PDF Contigo · Entender mi PDF\nProveedor: ${AI_PROVIDERS[provider]}\nModelo: ${model}${report.documentType?'\nTipo de documento según la IA: '+report.documentType:''}\n\n${coverageText(report.coverage)}\n\n${reportNotice(report)}`];
 let group='';for(const item of report.items){if(item.group!==group){group=item.group;parts.push('\n'+group.toUpperCase());}parts.push(`${item.text}\n`+itemCitations(item).map(c=>`[p. ${c.page}] Cita: «${c.quote}»`).join('\n'));}
 if(report.items.length&&report.missing.length)parts.push('\nLA IA NO HA IDENTIFICADO ESTOS DATOS (COMPRUÉBALO EN EL ORIGINAL)\n'+report.missing.map(x=>'• '+x).join('\n'));
 return parts.join('\n\n');
}
