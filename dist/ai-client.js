import {AI_PROVIDERS,AI_TEXT_LIMIT,aiError,validateReport,reportText} from './ai-contract.js';
export const AI_SERVICE='https://snipe-pdf.snipex.chatgpt.site/api/ai';
export function aiEndpoint(location=globalThis.location){return location?.hostname==='127.0.0.1'?AI_SERVICE:new URL('./api/ai',location.href).href;}
export async function requestAI(input,{signal,fetcher=fetch,endpoint=aiEndpoint()}={}){
 let response;
 try{response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-PDF-AI':'1'},body:JSON.stringify(input),credentials:'omit',cache:'no-store',redirect:'error',signal:signal||AbortSignal.timeout(90000)});}
 catch(e){throw aiError('AI_CONNECTION',e.name==='AbortError'?'Consulta cancelada. Puede haber consumo si ya llegó al proveedor.':'No se pudo conectar con el servicio de IA. Comprueba tu conexión; la consulta no se repite automáticamente.');}
 let result;try{result=await response.json();}catch{throw aiError('AI_SERVICE','El servicio de IA no está disponible en esta instalación. Usa la web oficial o configura su servidor.');}
 if(!response.ok||result.error)throw aiError(result.code||'AI_SERVICE',result.error||'No se pudo completar la consulta.');return result;
}
export async function aiSummary(file,pages,opts,progress=()=>{}){
 try{
  if(!opts.aiConsent||!opts.reviewedPages||JSON.stringify(pages)!==JSON.stringify(opts.reviewedPages))throw aiError('AI_CONSENT','Revisa el texto que se enviará y autoriza la consulta antes de continuar.');
  if(pages.length>100||pages.reduce((n,p)=>n+p.text.length,0)>AI_TEXT_LIMIT)throw aiError('AI_SIZE','Selecciona hasta 100 páginas y 60.000 caracteres.');
  progress(.6,'Consultando '+AI_PROVIDERS[opts.provider]+'…');
  const result=await requestAI({action:'summary',provider:opts.provider,apiKey:opts.apiKey,workspace:opts.workspace,model:opts.model,mode:opts.aimode,consent:true,pages});
  const report=validateReport(result.report,pages),text=reportText(report,opts.provider,opts.model);
  return [{bytes:new TextEncoder().encode(text),name:file.name.replace(/\.pdf$/i,'')+'-informe-ia.txt',type:'text/plain;charset=utf-8',preview:text,sourcePdf:file,references:[...new Set(report.items.map(i=>i.page))],note:'Informe generado por IA. Las citas coinciden con el texto extraído; esto no verifica que la interpretación sea correcta. Contrasta fechas, cifras y obligaciones con el documento original.'}];
 }finally{opts.apiKey='';opts.reviewedPages=null;}
}
