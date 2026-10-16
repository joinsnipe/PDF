import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {requestAI,desktopAIEndpoint} from '../dist/ai-client.js';
import {callAI} from '../dist/ai-provider.js';
import {AI_PROVIDERS} from '../dist/ai-contract.js';
import {validateAIRequest,forwardAI} from '../local/ai.mjs';
const key='test-only-never-a-real-key';
const location=new URL('http://127.0.0.1:4567/'+'x'.repeat(32)+'/');
const pages=[{page:1,text:'Se solicita la factura del servicio.'}];
const report={items:[{group:'Resumen',text:'Se solicita una factura.',page:1,quote:pages[0].text}],missing:[]};
const input={action:'models',provider:'openai',apiKey:key};

test('web llama directamente al proveedor, sin claves en URL ni intermediarios',async()=>{
 const calls=[];
 const result=await requestAI(input,{location:new URL('https://pdf.example/'),fetcher:async(url,init)=>{
  calls.push(url);assert.equal(url,'https://api.openai.com/v1/models');assert.equal(init.headers.Authorization,'Bearer '+key);assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');assert.equal(init.redirect,'manual');
  return Response.json({data:[{id:'gpt-4.1-mini'}]});
 }});
 assert.equal(result.models[0].id,'gpt-4.1-mini');assert.equal(calls.length,1);
});
test('paquete local usa solo su sesión loopback y nunca cae al servicio público',async()=>{
 let calls=0;
 const result=await requestAI({...input,provider:'deepseek'},{location,fetcher:async(url,init)=>{
  calls++;assert.equal(url,location.href+'_desktop/ai');assert.equal(init.headers['X-PDF-Local'],'1');
  const request=JSON.parse(init.body);validateAIRequest(request);assert.equal(request.url,'https://api.deepseek.com/models');
  return Response.json({status:200,body:JSON.stringify({data:[{id:'deepseek-flash'}]})});
 }});
 assert.equal(result.models[0].id,'deepseek-flash');assert.equal(calls,1);
 await assert.rejects(()=>requestAI(input,{location,fetcher:async()=>{calls++;return new Response('',{status:404});}}),{code:'AI_LOCAL_CONNECTION'});assert.equal(calls,2);
 for(const url of ['https://pdf.example/','http://127.0.0.1:4567/','http://localhost:4567/foo/','https://127.0.0.1:4567/'+ 'x'.repeat(32)+'/'])assert.equal(desktopAIEndpoint(new URL(url)),null);
});
test('los seis adaptadores generan peticiones aceptadas por ambos conectores locales',async()=>{
 const requests=[];
 for(const provider of Object.keys(AI_PROVIDERS))for(const action of ['models','summary']){
  await callAI({provider,action,apiKey:key,model:'test-model',mode:'summary',consent:true,pages},async(url,init)=>{
   const request={url,method:init.method,headers:init.headers,...(init.body?{body:init.body}:{})};validateAIRequest(request);requests.push(request);
   if(action==='models')return Response.json(provider==='gemini'?{models:[]}:{data:[]});
   const text=JSON.stringify(report);return Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:provider==='anthropic'?{content:[{type:'text',text}]}:['mistral','deepseek'].includes(provider)?{choices:[{message:{content:text}}]}:{output:[{type:'message',content:[{type:'output_text',text}]}]});
  });
 }
 const py=spawnSync('python3',['-B','-c',"import importlib.util,json,sys; s=importlib.util.spec_from_file_location('ai','local/ai.py'); a=importlib.util.module_from_spec(s); s.loader.exec_module(a); [a.validate_request(r) for r in json.load(sys.stdin)]"],{input:JSON.stringify(requests),encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);assert.equal(requests.length,12);
});
test('conector local rechaza destinos manipulados, redirecciones y respuestas enormes',async()=>{
 const valid={url:'https://api.openai.com/v1/models',method:'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key}};
 for(const url of ['http://api.openai.com/v1/models','https://api.openai.com.evil.example/v1/models','https://api.openai.com/v1/models?key=secret','https://api.openai.com:443/v1/models','https://api.openai.com/v1/../models','https://api.openai.com/v1/models#x','https://127.0.0.1/v1/models'])assert.throws(()=>validateAIRequest({...valid,url}));
 for(const headers of [{...valid.headers,Host:'evil.example'},{...valid.headers,Authorization:'Bearer key\r\nBad: x'}])assert.throws(()=>validateAIRequest({...valid,headers}));
 let calls=0;const redirect=await forwardAI(valid,async(_url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status:307,headers:{Location:'https://evil.example/'}});});
 assert.equal(redirect.code,'AI_REDIRECT');assert.equal(calls,1);
 const large=await forwardAI(valid,async()=>new Response('x'.repeat(1024*1024+1)));assert.equal(large.code,'AI_SIZE');
});
test('Claude directo usa la cabecera de navegador y un bloqueo CORS no genera reintento',async()=>{
 let calls=0;await assert.rejects(()=>requestAI({...input,provider:'anthropic'},{fetcher:async(_url,init)=>{calls++;assert.equal(init.headers['anthropic-dangerous-direct-browser-access'],'true');throw new TypeError('Failed to fetch');}}),e=>e.code==='AI_NETWORK'&&/CORS/.test(e.message));assert.equal(calls,1);
 const signal=new AbortController();signal.abort();await assert.rejects(()=>requestAI(input,{signal:signal.signal,fetcher:async(_url,init)=>{assert.equal(init.signal,signal.signal);throw new DOMException('abort','AbortError');}}),{code:'AI_CANCELLED'});
});
test('la CSP admite los seis proveedores y no incluye el relay compartido',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 const csp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
 for(const host of ['api.openai.com','generativelanguage.googleapis.com','api.anthropic.com','api.x.ai','api.mistral.ai','api.deepseek.com'])assert.ok(csp.includes('https://'+host));
 assert.ok(!csp.includes('snipe-pdf.snipex.chatgpt.site'));
});
