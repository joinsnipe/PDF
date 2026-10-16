export const AI_PROVIDERS=Object.freeze({gemini:'Gemini · Google',openai:'OpenAI',anthropic:'Claude · Anthropic',xai:'Grok · xAI',mistral:'Mistral',deepseek:'DeepSeek'});
export const AI_TEXT_LIMIT=60000;
export function aiError(code,message){return Object.assign(new Error(message),{code});}
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
