import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../local/server.mjs';
import {fileURLToPath} from 'node:url';
const handler=makeHandler(fileURLToPath(new URL('../dist',import.meta.url)),'session',()=>4567);
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
