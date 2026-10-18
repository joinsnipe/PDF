import {AI_PROVIDERS,AI_TEXT_LIMIT,aiError,reportNotice,reportText} from './ai-contract.js';
import {callAI,boundedJSON} from './ai-provider.js';
export function desktopAIEndpoint(location=globalThis.location){
 if(location?.protocol!=='http:'||location.hostname!=='127.0.0.1'||!/^\/[A-Za-z0-9_-]{32}\/(?:index\.html)?$/.test(location.pathname))return null;
 return new URL('./_desktop/ai',location.href).href;
}
export async function requestAI(input,{signal,fetcher=fetch,location=globalThis.location}={}){
 const endpoint=desktopAIEndpoint(location);
 const transport=endpoint?async(url,init)=>{
  let response;
  try{response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-PDF-Local':'1'},body:JSON.stringify({url,method:init.method,headers:init.headers,body:init.body}),credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'same-origin',signal:init.signal});}
  catch(e){if(init.signal?.aborted)throw e;throw aiError('AI_LOCAL_CONNECTION','No se pudo contactar con el conector de tu ordenador. Vuelve a abrir PDF y actualiza el paquete si es antiguo. No se ha recurrido a un servidor externo.');}
  if(!response.ok)throw aiError('AI_LOCAL_CONNECTION','El conector local no está disponible o ha rechazado la petición. Actualiza y vuelve a abrir el paquete de escritorio.');
  const result=await boundedJSON(response,2*1024*1024);
  if(result.code)throw aiError(result.code,result.error);
  if(!Number.isInteger(result.status)||result.status<200||result.status>599||typeof result.body!=='string')throw aiError('AI_LOCAL_RESPONSE','El conector local devolvió una respuesta no válida.');
  return new Response([204,205,304].includes(result.status)?null:result.body,{status:result.status});
 }:fetcher;
 return callAI(input,transport,{signal,browser:!endpoint});
}
export async function aiSummary(file,pages,opts,progress=()=>{}){
 try{
  if(!opts.aiConsent||!opts.reviewedPages||JSON.stringify(pages)!==JSON.stringify(opts.reviewedPages))throw aiError('AI_CONSENT','Revisa el texto que se enviará y autoriza la consulta antes de continuar.');
  if(pages.length>100||pages.reduce((n,p)=>n+p.text.length,0)>AI_TEXT_LIMIT)throw aiError('AI_SIZE','Selecciona hasta 100 páginas y 60.000 caracteres.');
  progress(.6,'Consultando '+AI_PROVIDERS[opts.provider]+'…');
  const result=await requestAI({action:'summary',provider:opts.provider,apiKey:opts.apiKey,workspace:opts.workspace,model:opts.model,mode:opts.aimode,consent:true,pages});
  const report=result.report,text=reportText(report,opts.provider,opts.model);
  return [{bytes:new TextEncoder().encode(text),name:file.name.replace(/\.pdf$/i,'')+'-informe-ia.txt',type:'text/plain;charset=utf-8',preview:text,sourcePdf:file,references:[...new Set(report.items.map(i=>i.page))],title:!report.items.length?'Respuesta sin referencias comprobables':report.omittedCount?'Informe parcial':'Tu documento explicado',reviewRequired:!report.items.length||!!report.omittedCount,note:reportNotice(report)}];
 }finally{opts.apiKey='';opts.reviewedPages=null;}
}
