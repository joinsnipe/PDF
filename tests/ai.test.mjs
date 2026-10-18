import test from 'node:test';
import assert from 'node:assert/strict';
import {callAI} from '../dist/ai-provider.js';
import {handleAI} from '../server/ai-service.mjs';
import {validateReport,AI_PROVIDERS,assertAIKey,keyProviderHint,evidenceSources,reportText} from '../dist/ai-contract.js';
const pages=[{page:3,text:'Se solicita aportar la factura del servicio. Fecha de emisión: 15 de octubre de 2026.'}];
const report={items:[{group:'Lo que piden',text:'Aportar la factura del servicio.',page:3,quote:'Se solicita aportar la factura del servicio.'}],missing:[]};
const input=provider=>({action:'summary',provider,apiKey:'test-key-not-a-real-secret',model:'test-model',mode:'explain',consent:true,pages});
const providerReply=provider=>{const text=JSON.stringify(report);return provider==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:provider==='anthropic'?{content:[{type:'text',text}]}:['mistral','deepseek'].includes(provider)?{choices:[{message:{content:text}}]}:{output:[{type:'message',content:[{type:'output_text',text}]}]};};
for(const provider of ['gemini','openai','anthropic','xai','mistral','deepseek'])test(provider+': solicitud autenticada, texto delimitado y citas comprobadas',async()=>{
 let calls=0;const result=await callAI(input(provider),async(url,init)=>{calls++;assert.equal(init.redirect,'manual');assert.ok(url.startsWith('https://'));const body=JSON.parse(init.body);assert.doesNotMatch(init.body,/test-key-not/);assert.match(init.body,/factura del servicio/);assert.equal(body.tools,undefined);if(provider==='deepseek'){assert.equal(url,'https://api.deepseek.com/chat/completions');assert.deepEqual(body.thinking,{type:'disabled'});assert.deepEqual(body.response_format,{type:'json_object'});}if(['openai','xai'].includes(provider)){assert.equal(body.store,false);assert.ok(url.endsWith('/responses'));}if(provider==='anthropic'){assert.equal(init.headers['anthropic-version'],'2023-06-01');assert.ok(url.endsWith('/messages'));}return Response.json(providerReply(provider));});assert.equal(calls,1);assert.deepEqual(result.report,report);
});
test('catálogos de los seis proveedores y modelo manual no fijado a una versión',async()=>{
 for(const provider of ['gemini','openai','anthropic','xai','mistral','deepseek']){const result=await callAI({...input(provider),action:'models'},async(url,init)=>{assert.match(url,/\/models/);assert.equal(init.body,undefined);return Response.json(provider==='gemini'?{models:[{name:'models/gemini-new',displayName:'Gemini',supportedGenerationMethods:['generateContent']}]}:{data:[{id:provider==='openai'?'gpt-future':'future-model'}]});});assert.equal(result.models.length,1);}
});
test('consentimiento, cuotas y límites: no reintenta ni cambia de proveedor',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({error:{message:'secret-provider-details'}},{status:429});};
 await assert.rejects(()=>callAI({...input('mistral'),consent:false},fetcher),{code:'AI_CONSENT'});assert.equal(calls,0);
 await assert.rejects(()=>callAI({...input('mistral'),pages:[{page:1,text:'a'.repeat(60001)}]},fetcher),{code:'AI_SIZE'});assert.equal(calls,0);
 await assert.rejects(()=>callAI(input('mistral'),fetcher),e=>e.code==='AI_QUOTA'&&!e.message.includes('secret'));assert.equal(calls,1);
 await assert.rejects(()=>callAI({...input('mistral'),provider:'https://evil.example'},fetcher),{code:'AI_PROVIDER'});assert.equal(calls,1);
});
test('no muestra referencias inventadas o páginas fuera de selección',()=>{
 assert.deepEqual(validateReport({...report,items:[{...report.items[0],page:4}]},pages),{items:[],missing:[],omittedCount:1});
 assert.deepEqual(validateReport({...report,items:[{...report.items[0],quote:'Texto que no aparece en el documento'}]},pages),{items:[],missing:[],omittedCount:1});
});
test('una cita incorrecta no descarta el resto ni se presenta como localizada',()=>{
 const result=validateReport({items:[report.items[0],{...report.items[0],text:'INVENTADO',quote:'Cita inexistente'}],missing:[]},pages);
 assert.deepEqual(result.items,report.items);assert.equal(result.omittedCount,1);
 const text=reportText(result,'openai','test-model');assert.match(text,/Informe parcial/);assert.doesNotMatch(text,/INVENTADO|Cita inexistente/);
});
test('solo tolera diferencias tipográficas; mantiene negaciones, cifras y página',()=>{
 const originals=[{page:9,text:'No se exige docu-\nmentación adicional. Importe: 1.000 €. “Plazo voluntario”.'}];
 const valid={group:'Resumen',text:'Prueba.',page:9,quote:'No se exige documentación adicional.'};
 assert.equal(validateReport({items:[valid]},originals).items.length,1);
 for(const quote of ['Se exige documentación adicional.','Importe: 10.000 €.', 'No se exige documentación adicional. Importe: 1000 €.'])assert.equal(validateReport({items:[{...valid,quote}]},originals).items.length,0);
 assert.equal(validateReport({items:[{...valid,page:1}]},originals).items.length,0);
});
test('referencias por id recuperan las citas y páginas del original, sin confiar en la IA',()=>{
 const sources=evidenceSources(pages);assert.equal(sources[0].id,'p3s1');
 const result=validateReport({items:[{group:'Resumen',text:'Solicita aportar una factura.',source_id:sources[0].id,page:999,quote:'INVENTADO'}]},pages);
 assert.equal(result.items[0].quote,pages[0].text);assert.equal(result.items[0].page,3);
 assert.equal(validateReport({items:[{...report.items[0],source_id:'p1s1'}]},pages).items.length,0);
 const long=[{page:7,text:('Texto largo con acentos y obligaciones. ').repeat(80)},{page:12,text:'Segundo documento: se solicita una factura.'}];
 const chunks=evidenceSources(long);assert.ok(chunks.length>2);assert.ok(chunks.every(c=>c.text.length<=500&&long.find(p=>p.page===c.page).text.includes(c.text)));
 assert.equal(new Set(chunks.map(c=>c.id)).size,chunks.length);
 assert.equal(chunks.filter(c=>c.page===7).map(c=>c.text).join('').replace(/\s/g,''),long[0].text.replace(/\s/g,''));
});
test('sin referencias válidas no fabrica un resumen ni muestra ausencias sin respaldo',()=>{
 const result=validateReport({items:[{...report.items[0],source_id:'desconocido'}],missing:['INVENTADO']},pages);
 const text=reportText(result,'openai','test-model');assert.match(text,/no se pudo localizar ninguna referencia/);assert.doesNotMatch(text,/INVENTADO/);assert.match(text,/no se ha repetido/);
});
for(const provider of Object.keys(AI_PROVIDERS))test(provider+': IDs de fragmentos y tarea unificada en una sola consulta',async()=>{
 let calls=0;
 const result=await callAI({...input(provider),mode:'understand'},async(_url,init)=>{
  calls++;const body=JSON.parse(init.body);
  const user=JSON.parse(provider==='gemini'?body.contents[0].parts[0].text:provider==='anthropic'?body.messages[0].content:['mistral','deepseek'].includes(provider)?body.messages[1].content:body.input);
  assert.match(user.tarea,/Resume y explica/);assert.equal(user.fragmentos[0].page,3);assert.equal(user.fragmentos[0].text,pages[0].text);
  const text=JSON.stringify({items:[{group:'Resumen',text:'Se solicita una factura.',source_id:user.fragmentos[0].id}]});
  return Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:provider==='anthropic'?{content:[{type:'text',text}]}:['mistral','deepseek'].includes(provider)?{choices:[{message:{content:text}}]}:{output:[{type:'message',content:[{type:'output_text',text}]}]});
 });
 assert.equal(calls,1);assert.equal(result.report.items[0].page,3);assert.equal(result.report.items[0].quote,pages[0].text);
});
test('el antiguo servidor público rechaza sin leer el cuerpo ni contactar con proveedores',async()=>{
 let reads=0;const request={get body(){reads++;throw new Error('No debe leer claves');}};
 const response=await handleAI(request,()=>{throw new Error('No debe haber red');});
 assert.equal(response.status,410);assert.equal((await response.json()).code,'AI_UPDATE_REQUIRED');assert.equal(reads,0);
});
test('Claude permite elegir workspace y rechaza cabeceras manipuladas',async()=>{
 const key={...input('anthropic'),workspace:'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ'};await callAI(key,async(url,init)=>{assert.equal(init.headers['anthropic-workspace-id'],key.workspace);return Response.json(providerReply('anthropic'));});
 await assert.rejects(()=>callAI({...key,workspace:'wrkspc_unsafe\r\nX-Test: bad'},()=>{throw new Error('No debe enviarse');}),{code:'AI_WORKSPACE'});
});

test('selección automática usa texto estable y no elige audio, imagen o embeddings',async()=>{
 const {chooseAIModel}=await import('../dist/ai-settings.js');
 const cases={gemini:['gemini-3-flash-preview','gemini-2.5-flash-image','gemini-2.5-flash'],openai:['gpt-4o-audio','gpt-4.1','gpt-4.1-mini'],anthropic:['claude-sonnet-4','claude-haiku-4'],xai:['grok-imagine-image','grok-4','grok-4-fast'],deepseek:['deepseek-v4-pro','deepseek-flash'],mistral:['mistral-embed','mistral-large-latest','mistral-small-latest']};
 for(const [provider,ids] of Object.entries(cases))assert.equal(chooseAIModel(provider,ids.map(id=>({id}))),ids.at(-1));
 assert.equal(chooseAIModel('gemini',[{id:'gemini-2.5-flash-tts'},{id:'<script>'}]),'');
 assert.equal(chooseAIModel('openai',null),'');
 assert.equal(chooseAIModel('openai',[{id:'gpt-6-mini'}]),'gpt-6-mini');
});

test('errores de proveedor distinguen autenticación, permisos, saldo, ritmo y modelo sin filtrar secretos',async()=>{
 for(const [status,code,expected] of [[401,'invalid_api_key','AI_AUTH'],[403,'permission_denied','AI_PERMISSION'],[429,'insufficient_quota','AI_BILLING'],[429,'rate_limit_exceeded','AI_RATE_LIMIT'],[404,'model_not_found','AI_MODEL'],[503,'server_error','AI_PROVIDER_ERROR']]){
  let calls=0;await assert.rejects(()=>callAI(input('openai'),async()=>{calls++;return Response.json({error:{code,message:'sensitive-secret-and-document'}},{status});}),error=>error.code===expected&&!error.message.includes('sensitive'));
  assert.equal(calls,1);
 }
});
test('errores HTML, cuerpos grandes y fallos de red no se atribuyen a una clave incorrecta',async()=>{
 for(const response of [new Response('<html>upstream problem</html>',{status:503}),new Response('x'.repeat(20000),{status:401})])await assert.rejects(()=>callAI(input('openai'),async()=>response),e=>['AI_AUTH','AI_PROVIDER_ERROR'].includes(e.code));
 await assert.rejects(()=>callAI(input('openai'),async()=>{throw new TypeError('private connection details');}),e=>e.code==='AI_NETWORK'&&e.message.includes('no confirma')&&!e.message.includes('private'));
});

test('claves reconocibles de otro proveedor se bloquean antes de toda petición',async()=>{
 const cases={openai:'sk-proj-not-a-real-key',anthropic:'sk-ant-not-a-real-key',xai:'xai-not-a-real-key',gemini:'AIza-not-a-real-key'};
 let calls=0;
 for(const [owner,key] of Object.entries(cases)){
  assert.equal(keyProviderHint(key),owner);assert.doesNotThrow(()=>assertAIKey(owner,key));
  for(const provider of Object.keys(AI_PROVIDERS))if(provider!==owner)for(const action of ['models','summary'])await assert.rejects(()=>callAI({...input(provider),action,apiKey:key},async()=>{calls++;throw new Error('Never transmit mismatched keys');}),e=>e.code==='AI_KEY_PROVIDER'&&!e.message.includes(key));
 }
 assert.equal(calls,0);
});
test('prefijos desconocidos y sk- genéricos no se atribuyen automáticamente a OpenAI',()=>{
 for(const key of ['sk-shared-prefix-test','test-new-unknown-format']){
  assert.equal(keyProviderHint(key),'');assert.doesNotThrow(()=>assertAIKey('openai',key));assert.doesNotThrow(()=>assertAIKey('deepseek',key));
 }
 assert.throws(()=>assertAIKey('gemini','sk-shared-prefix-test'),{code:'AI_KEY_PROVIDER'});
 assert.throws(()=>assertAIKey('','sk-proj-not-a-real-key'),{code:'AI_PROVIDER'});
});
test('clave vacía y formato incompleto o enmascarado dan errores distintos, sin red',async()=>{
 let calls=0;
 for(const [key,code] of [['','AI_KEY'],['sk-...','AI_KEY_FORMAT'],['sk-proj-abc defghi','AI_KEY_FORMAT'],['sk-proj-••••••••••••','AI_KEY_FORMAT'],['sk-proj-'+ 'x'.repeat(513),'AI_KEY_FORMAT']])await assert.rejects(()=>callAI({...input('openai'),action:'models',apiKey:key},async()=>{calls++;}),e=>e.code===code&&(!key||!e.message.includes(key)));
 assert.equal(calls,0);
});
test('modelo de otro proveedor se rechaza antes de generar o enviar texto',async()=>{
 let calls=0;
 for(const [provider,model] of [['gemini','gpt-4.1-mini'],['openai','gemini-2.5-flash'],['mistral','claude-haiku-4'],['deepseek','grok-4']])await assert.rejects(()=>callAI({...input(provider),model},async()=>{calls++;throw new Error('Never send');}),{code:'AI_MODEL_PROVIDER'});
 assert.equal(calls,0);
});
test('Gemini API_KEY_INVALID en HTTP 400 se explica como clave rechazada, sin mostrar cuerpo privado',async()=>{
 const reply={error:{code:400,status:'INVALID_ARGUMENT',message:'private-key-and-document',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'API_KEY_INVALID',metadata:{secret:'private-key-and-document'}}]}};
 await assert.rejects(()=>callAI({...input('gemini'),action:'models'},async()=>Response.json(reply,{status:400})),e=>e.code==='AI_AUTH'&&e.message.includes('OpenAI')&&!e.message.includes('private-key'));
 await assert.rejects(()=>callAI(input('gemini'),async()=>Response.json({error:{code:400,status:'INVALID_ARGUMENT',details:{reason:'API_KEY_INVALID'}}},{status:400})),{code:'AI_PROVIDER_ERROR'});
});
