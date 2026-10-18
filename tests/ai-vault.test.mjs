import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sealVault,openVault,vaultStorage,validateVault} from '../dist/ai-vault.js';
import {makeHandler} from '../local/server.mjs';
const config={provider:'openai',apiKey:'sk-proj-fake-test-only',model:'gpt-4.1-mini',workspace:'',manual:false},password='Test unlock phrase 123!';
const record=await sealVault(config,password);
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),dump:()=>[...values.values()].join('')};};

test('vault cifra API y proveedor; contraseña incorrecta y manipulación no desbloquean',async()=>{
 assert.doesNotMatch(JSON.stringify(record),/sk-proj|openai|gpt-|Test unlock/);
 assert.deepEqual(await openVault(record,password),config);
 assert.notDeepEqual(await sealVault(config,password),record);
 await assert.rejects(()=>openVault(record,'Wrong unlock phrase'),{code:'AI_VAULT_UNLOCK'});
 await assert.rejects(()=>openVault({...record,data:(record.data[0]==='A'?'B':'A')+record.data.slice(1)},password),{code:'AI_VAULT_UNLOCK'});
 await assert.rejects(()=>sealVault(config,'short'),{code:'AI_VAULT_PASSWORD'});
 assert.throws(()=>validateVault({...record,apiKey:config.apiKey}),{code:'AI_STORAGE'});
});
test('web recuerda por perfil, sobrevive a recarga, borra y no contacta con la red',async()=>{
 const storage=store(),secondProfile=store(),options={storage,location:new URL('https://pdf.example/'),fetcher:()=>{throw new Error('No network');}};
 assert.equal(await vaultStorage('load',null,options),null);
 await vaultStorage('save',record,options);assert.doesNotMatch(storage.dump(),/sk-proj|Test unlock/);
 const restored=await vaultStorage('load',null,options);assert.deepEqual(await openVault(restored,password),config);
 assert.equal(await vaultStorage('load',null,{...options,storage:secondProfile}),null);
 await Promise.all([vaultStorage('save',record,options),vaultStorage('delete',null,options)]);assert.equal(await vaultStorage('load',null,options),null);
 await assert.rejects(()=>vaultStorage('save',record,{...options,storage:{setItem(){throw new Error('quota');}}}),{code:'AI_STORAGE'});
});
test('escritorio guarda solo cifrado, restaura con otro puerto y token, y protege el endpoint',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'pdf-vault-')),file=path.join(directory,'state','ai-vault-v1.json');
 let port=4567,token='x'.repeat(32);
 const request=async(url,init={})=>{
  const local=makeHandler(fileURLToPath(new URL('../dist',import.meta.url)),token,()=>port,()=>{throw new Error('No provider');},file);
  const body=init.body||'',parsed=new URL(url),req=Readable.from(body?[Buffer.from(body)]:[]);
  Object.assign(req,{url:parsed.pathname,method:init.method||'GET',headers:{host:parsed.host,origin:`http://127.0.0.1:${port}`,...Object.fromEntries(Object.entries(init.headers||{}).map(([k,v])=>[k.toLowerCase(),v])),...(body?{'content-length':String(Buffer.byteLength(body))}:{})},setTimeout(){}});
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};await local(req,res);return new Response(res.body,{status:res.statusCode,headers:res.headers});
 };
 try{
  let opts={location:new URL(`http://127.0.0.1:${port}/${token}/`),fetcher:request};
  await vaultStorage('save',record,opts);assert.doesNotMatch(await readFile(file,'utf8'),/sk-proj|Test unlock/);assert.equal((await stat(file)).mode&0o777,0o600);
  port=9876;token='z'.repeat(32);opts={...opts,location:new URL(`http://127.0.0.1:${port}/${token}/`)};
  assert.deepEqual(await openVault(await vaultStorage('load',null,opts),password),config);
  const url=opts.location.href+'_desktop/ai-vault';
  for(const headers of [{},{'X-PDF-Local':'1',Origin:'https://evil.example'},{'X-PDF-Local':'1','Sec-Fetch-Site':'cross-site'}])assert.equal((await request(url,{headers})).status,403);
  assert.equal((await request(url.replace(token,'q'.repeat(32)),{headers:{'X-PDF-Local':'1'}})).status,404);
  assert.equal((await request(url,{method:'PUT',headers:{'X-PDF-Local':'1','Content-Type':'application/json'},body:JSON.stringify({apiKey:config.apiKey})})).status,400);
  const py=spawnSync('python3',['-B','-c',"import importlib.util,json,sys,pathlib; s=importlib.util.spec_from_file_location('v','local/vault.py'); v=importlib.util.module_from_spec(s); s.loader.exec_module(v); p=pathlib.Path(sys.argv[1]); r=v.read_vault(p); v.write_vault(r,p); print(json.dumps(r))",file],{encoding:'utf8'});assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout),record);
  await vaultStorage('delete',null,opts);assert.equal(await vaultStorage('load',null,opts),null);
 }finally{await rm(directory,{recursive:true,force:true});}
});
