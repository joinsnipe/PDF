import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from '../hosting/node_modules/miniflare/dist/src/index.js';

test('workerd real: endpoint antiguo retirado y cero peticiones a proveedores',async()=>{
 const bundle=await build({stdin:{contents:`import {handleAI} from './server/ai-service.mjs';export default {fetch:request=>handleAI(request)}`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false});
 let calls=0;
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',outboundService:async()=>{calls++;throw new Error('No relay allowed');}});
 try{
  for(const method of ['GET','POST','OPTIONS']){
   const response=await mf.dispatchFetch('https://pdf.example/api/ai',{method,headers:{Origin:'https://pdf.example','Content-Type':'application/json'},...(method==='POST'?{body:'not-json-no-body-parsing'}:{})});
   assert.equal(response.status,410);assert.equal(response.headers.get('Cache-Control'),'no-store');
   assert.equal((await response.json()).code,'AI_UPDATE_REQUIRED');
  }
  assert.equal(calls,0);
 }finally{await mf.dispose();}
});
