// Private desktop transport. Fixed destinations, no storage, redirects or retries.
import {readFileSync} from 'node:fs';
const policy=JSON.parse(readFileSync(new URL('./ai-policy.json',import.meta.url),'utf8'));
export const AI_MAX_INPUT=512*1024;
export function validateAIRequest(input){
 if(!input||typeof input.url!=='string'||!['GET','POST'].includes(input.method))throw new Error('request');
 const match=Object.entries(policy).find(([base,rule])=>input.method==='GET'?input.url===base+rule.get:rule.auth==='x-goog-api-key'?input.url.startsWith(base+rule.post)&&/^[A-Za-z0-9._-]+:generateContent$/.test(input.url.slice((base+rule.post).length)):input.url===base+rule.post);
 if(!match)throw new Error('destination');
 const rule=match[1],headers=input.headers;
 const allowed=['Content-Type',rule.auth,...(rule.auth==='x-api-key'?['anthropic-version','anthropic-workspace-id']:[])];
 if(!headers||Array.isArray(headers)||Object.keys(headers).some(k=>!allowed.includes(k))||headers['Content-Type']!=='application/json')throw new Error('headers');
 if(!Object.values(headers).every(v=>typeof v==='string'&&v.length<=600&&!/[\r\n\0]/.test(v)))throw new Error('headers');
 const key=headers[rule.auth];if(!key||key.length<12||(rule.auth==='Authorization'&&!/^Bearer [^\s]+$/.test(key)))throw new Error('key');
 if(rule.auth==='x-api-key'&&(headers['anthropic-version']!=='2023-06-01'||(headers['anthropic-workspace-id']&&!/^wrkspc_[A-Za-z0-9]{10,80}$/.test(headers['anthropic-workspace-id']))))throw new Error('headers');
 if(input.method==='GET'){if(input.body!==undefined)throw new Error('body');}
 else{if(typeof input.body!=='string'||Buffer.byteLength(input.body)>AI_MAX_INPUT)throw new Error('body');const body=JSON.parse(input.body);if(!body||Array.isArray(body)||typeof body!=='object'||body.stream)throw new Error('body');}
 return {url:input.url,method:input.method,headers,body:input.body};
}
export async function forwardAI(input,fetcher=fetch){
 let request;try{request=validateAIRequest(input);}catch{return {code:'AI_LOCAL_REQUEST',error:'El conector local ha rechazado una petición no válida.'};}
 try{
  const response=await fetcher(request.url,{method:request.method,headers:request.headers,body:request.body,redirect:'manual',signal:AbortSignal.timeout(75000)});
  if(response.status>=300&&response.status<400){await response.body?.cancel();return {code:'AI_REDIRECT',error:'El proveedor ha intentado redirigir la petición. No se ha seguido ni enviado la clave a otra dirección.'};}
  const limit=response.ok?1024*1024:16384,reader=response.body?.getReader(),chunks=[];let size=0;
  if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)return {code:'AI_SIZE',error:'La respuesta del proveedor supera el límite permitido.'};chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  return {status:response.status,body:Buffer.concat(chunks).toString('utf8')};
 }catch{return {code:'AI_NETWORK',error:'Tu ordenador no ha podido contactar con el proveedor. Revisa la red y el cortafuegos. No se ha reintentado; podría haber consumo si la petición llegó.'};}
}
