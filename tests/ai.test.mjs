import test from 'node:test';
import assert from 'node:assert/strict';
import {callAI,handleAI} from '../server/ai-service.mjs';
import {validateReport} from '../dist/ai-contract.js';
const pages=[{page:3,text:'Se solicita aportar la factura del servicio. Fecha de emisión: 15 de octubre de 2026.'}];
const report={items:[{group:'Lo que piden',text:'Aportar la factura del servicio.',page:3,quote:'Se solicita aportar la factura del servicio.'}],missing:[]};
const input=provider=>({action:'summary',provider,apiKey:'test-key-not-a-real-secret',model:'test-model',mode:'explain',consent:true,pages});
const providerReply=provider=>{const text=JSON.stringify(report);return provider==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:provider==='anthropic'?{content:[{type:'text',text}]}:provider==='mistral'?{choices:[{message:{content:text}}]}:{output:[{type:'message',content:[{type:'output_text',text}]}]};};
for(const provider of ['gemini','openai','anthropic','xai','mistral'])test(provider+': solicitud autenticada, texto delimitado y citas comprobadas',async()=>{
 let calls=0;const result=await callAI(input(provider),async(url,init)=>{calls++;assert.equal(init.redirect,'error');assert.ok(url.startsWith('https://'));const body=JSON.parse(init.body);assert.doesNotMatch(init.body,/test-key-not/);assert.match(init.body,/factura del servicio/);assert.equal(body.tools,undefined);if(['openai','xai'].includes(provider)){assert.equal(body.store,false);assert.ok(url.endsWith('/responses'));}if(provider==='anthropic'){assert.equal(init.headers['anthropic-version'],'2023-06-01');assert.ok(url.endsWith('/messages'));}return Response.json(providerReply(provider));});assert.equal(calls,1);assert.deepEqual(result.report,report);
});
test('catálogos de los cinco proveedores y modelo manual no fijado a una versión',async()=>{
 for(const provider of ['gemini','openai','anthropic','xai','mistral']){const result=await callAI({...input(provider),action:'models'},async(url,init)=>{assert.match(url,/\/models/);assert.equal(init.body,undefined);return Response.json(provider==='gemini'?{models:[{name:'models/gemini-new',displayName:'Gemini',supportedGenerationMethods:['generateContent']}]}:{data:[{id:provider==='openai'?'gpt-future':'future-model'}]});});assert.equal(result.models.length,1);}
});
test('consentimiento, cuotas y límites: no reintenta ni cambia de proveedor',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({error:{message:'secret-provider-details'}},{status:429});};
 await assert.rejects(()=>callAI({...input('mistral'),consent:false},fetcher),{code:'AI_CONSENT'});assert.equal(calls,0);
 await assert.rejects(()=>callAI({...input('mistral'),pages:[{page:1,text:'a'.repeat(60001)}]},fetcher),{code:'AI_SIZE'});assert.equal(calls,0);
 await assert.rejects(()=>callAI(input('mistral'),fetcher),e=>e.code==='AI_QUOTA'&&!e.message.includes('secret'));assert.equal(calls,1);
 await assert.rejects(()=>callAI({...input('mistral'),provider:'https://evil.example'},fetcher),{code:'AI_PROVIDER'});assert.equal(calls,1);
});
test('no muestra referencias inventadas o páginas fuera de selección',()=>{
 assert.throws(()=>validateReport({...report,items:[{...report.items[0],page:4}]},pages),{code:'AI_EVIDENCE'});
 assert.throws(()=>validateReport({...report,items:[{...report.items[0],quote:'Texto que no aparece en el documento'}]},pages),{code:'AI_EVIDENCE'});
});
test('relay bloquea origen ajeno, acepta escritorio y no almacena respuestas',async()=>{
 const request=(origin,body=input('anthropic'))=>new Request('https://pdf.example/api/ai',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-PDF-AI':'1'},body:JSON.stringify(body)});
 let calls=0;const fetcher=async()=>{calls++;return Response.json(providerReply('anthropic'));};
 assert.equal((await handleAI(request('https://evil.example'),fetcher)).status,403);assert.equal(calls,0);
 const good=await handleAI(request('http://127.0.0.1:4567'),fetcher);assert.equal(good.status,200);assert.equal(good.headers.get('Access-Control-Allow-Origin'),'http://127.0.0.1:4567');assert.equal(good.headers.get('Cache-Control'),'no-store');assert.deepEqual((await good.json()).report,report);
 const large=await handleAI(request('https://pdf.example',{...input('anthropic'),pages:'x'.repeat(600000)}),fetcher);assert.equal(large.status,400);assert.equal(calls,1);
});
test('Claude permite elegir workspace y rechaza cabeceras manipuladas',async()=>{
 const key={...input('anthropic'),workspace:'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ'};await callAI(key,async(url,init)=>{assert.equal(init.headers['anthropic-workspace-id'],key.workspace);return Response.json(providerReply('anthropic'));});
 await assert.rejects(()=>callAI({...key,workspace:'wrkspc_unsafe\r\nX-Test: bad'},()=>{throw new Error('No debe enviarse');}),{code:'AI_WORKSPACE'});
});
