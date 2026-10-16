import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from '../hosting/node_modules/miniflare/dist/src/index.js';

test('IA en workerd real: conectar, resumir, rechazar redirecciones y explicar saldo',async()=>{
 const bundle=await build({stdin:{contents:`import {handleAI} from './server/ai-service.mjs';export default {fetch:request=>handleAI(request)}`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false});
 const quote='Se solicita aportar la factura del servicio.';
 const report={items:[{group:'Resumen',text:'Se solicita la factura.',page:1,quote}],missing:[]};
 let scenario='ok',calls=0;
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',outboundService:async request=>{
  calls++;assert.equal(new URL(request.url).hostname,'api.openai.com');assert.equal(request.headers.get('Authorization'),'Bearer fake-test-key-not-a-secret');
  if(scenario==='redirect')return new Response(null,{status:302,headers:{Location:'https://untrusted.example/collect'}});
  if(scenario==='billing')return Response.json({error:{code:'insufficient_quota',message:'private-provider-detail'}},{status:429});
  if(request.method==='GET'){assert.equal(new URL(request.url).pathname,'/v1/models');return Response.json({data:[{id:'gpt-4.1-mini'}]});}
  const body=await request.json();assert.equal(body.store,false);assert.equal(body.model,'gpt-4.1-mini');assert.match(body.input,/factura del servicio/);
  return Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});
 }});
 const input={action:'models',provider:'openai',apiKey:'fake-test-key-not-a-secret'};
 const send=body=>mf.dispatchFetch('https://pdf.example/api/ai',{method:'POST',headers:{Origin:'https://pdf.example','Content-Type':'application/json','X-PDF-AI':'1'},body:JSON.stringify(body)});
 try{
  const connected=await send(input);assert.equal(connected.status,200);assert.deepEqual((await connected.json()).models,[{id:'gpt-4.1-mini',name:'gpt-4.1-mini'}]);
  const summary=await send({...input,action:'summary',model:'gpt-4.1-mini',mode:'summary',consent:true,pages:[{page:1,text:quote}]});assert.equal(summary.status,200);assert.deepEqual((await summary.json()).report,report);
  scenario='redirect';const redirect=await send(input);assert.equal(redirect.status,400);assert.equal((await redirect.json()).code,'AI_REDIRECT');
  scenario='billing';const billing=await (await send(input)).json();assert.equal(billing.code,'AI_BILLING');assert.doesNotMatch(JSON.stringify(billing),/private-provider-detail|fake-test-key/);
  assert.equal(calls,4,'Una sola petición por acción; ninguna al destino de redirección.');
 }finally{await mf.dispose();}
});
