import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../local/server.mjs';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
const handler=makeHandler(fileURLToPath(new URL('../dist',import.meta.url)),'session',()=>4567);
test('conector IA Node exige sesión/origen y entrega únicamente la respuesta del proveedor fijo',async()=>{
 let calls=0;
 const local=makeHandler(fileURLToPath(new URL('../dist',import.meta.url)),'session',()=>4567,async(url)=>{calls++;assert.equal(url,'https://api.deepseek.com/models');return Response.json({data:[]});});
 const body=JSON.stringify({url:'https://api.deepseek.com/models',method:'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer fake-only-for-testing'}});
 const send=async(extra={},url='/session/_desktop/ai')=>{
  const req=Readable.from([Buffer.from(body)]);Object.assign(req,{url,method:'POST',headers:{host:'127.0.0.1:4567',origin:'http://127.0.0.1:4567','x-pdf-local':'1','content-type':'application/json','content-length':String(Buffer.byteLength(body)),...extra},setTimeout(){}});
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.value=value;}};await local(req,res);return res;
 };
 for(const headers of [{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'},{'x-pdf-local':'0'}])assert.equal((await send(headers)).statusCode,403);
 assert.equal((await send({},'/wrong/_desktop/ai')).statusCode,404);assert.equal((await send({'content-length':'9999999'})).statusCode,400);assert.equal(calls,0);
 const result=await send();assert.equal(result.statusCode,200);assert.deepEqual(JSON.parse(result.value),{status:200,body:'{"data":[]}'});assert.equal(result.headers['Cache-Control'],'no-store');assert.equal(calls,1);
});
async function request(url,method='GET',host='127.0.0.1:4567'){
  const result={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(bytes){this.bytes=bytes;}};
  await handler({url,method,headers:{host}},result);return result;
}
test('servidor Mac entrega recursos y HEAD sin cuerpo',async()=>{
  const index=await request('/session/');assert.equal(index.statusCode,200);assert.match(index.bytes.toString(),/<title>PDF/);
  const head=await request('/session/vendor/qpdf/qpdf.wasm','HEAD');assert.equal(head.headers['Content-Type'],'application/wasm');assert.equal(head.bytes,undefined);
});
test('servidor Mac rechaza otras máquinas, subidas, traversal y listados',async()=>{
  for(const url of ['/','/wrong/','/session/%2e%2e/package.json','/session/..%2fpackage.json','/session/%5cetc','/session/vendor/','/session/%xx'])assert.equal((await request(url)).statusCode,404,url);
  assert.equal((await request('/session/','POST')).statusCode,405);
  assert.equal((await request('/session/','GET','other.example')).statusCode,403);
});
test('Office local exige token, origen y cabecera; status no expone rutas',async()=>{
 const run=async(headers,method='POST',url='/session/_desktop/office/convert')=>{const r={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(bytes){this.bytes=bytes;}};await handler({url,method,headers:{host:'127.0.0.1:4567',...headers}},r);return r;};
 assert.equal((await run({})).statusCode,403);
 assert.equal((await run({origin:'https://evil.example','x-pdf-local':'1'})).statusCode,403);
 assert.equal((await run({origin:'http://127.0.0.1:4567','x-pdf-local':'1','content-length':'999999999'})).statusCode,400);
 const status=await run({'x-pdf-local':'1'},'GET','/session/_desktop/office/status');assert.equal(status.statusCode,200);assert.deepEqual(Object.keys(JSON.parse(status.bytes)),['available']);
 assert.equal((await run({'x-pdf-local':'1','sec-fetch-site':'cross-site'},'GET','/session/_desktop/office/status')).statusCode,403);
});
