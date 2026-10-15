import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {createHash,webcrypto} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {PDFDocument} from '../dist/vendor/pdf-lib.js';
import {autofirmaPlatform,autofirmaProperties,autofirmaError,decodeSignedPDF,signWithAutoFirma} from '../dist/autofirma.js';
const require=createRequire(import.meta.url),deps=process.env.PDF_BUILD_DEPS;
const forge=require(deps?deps+'/node-forge':'node-forge');
globalThis.self=globalThis;
const {signDocument}=await import('../dist/vendor/signing.js');
const nav={platform:'Win32',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155.0.0.0 Safari/537.36',appVersion:'5.0',appName:'Netscape'};
const doc=await PDFDocument.create();doc.addPage([595,842]);const original=await doc.save();
// A fictitious certificate supplies a real CMS fixture; it is NOT an AutoFirma run.
const keys=forge.pki.rsa.generateKeyPair(2048),cert=forge.pki.createCertificate();
cert.publicKey=keys.publicKey;cert.serialNumber='01';cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date(Date.now()+86400000);
cert.setSubject([{name:'commonName',value:'PDF FICTITIOUS AUTOFIRMA TEST'}]);cert.setIssuer(cert.subject.attributes);cert.setExtensions([{name:'keyUsage',digitalSignature:true}]);cert.sign(keys.privateKey,forge.md.sha256.create());
const p12=new Uint8Array(Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],'test',{algorithm:'3des'})).getBytes(),'binary'));
const signed=(await signDocument(original,p12,'test','Prueba',{visible:false})).bytes;
const encoded=Buffer.from(signed).toString('base64'),file={name:'Prueba.pdf',bytes:original};

function environment(action){
 let removed=0,appended=0;
 const frame={contentWindow:{PDFNativeBridge:{sign:action}},remove(){removed++;}};
 return {window:{navigator:nav,WebSocket:function(){}},document:{createElement:()=>frame,body:{append(){appended++;queueMicrotask(()=>frame.onload?.());}}},timeoutMs:25,stats:()=>({removed,appended}),frame};
}

test('plataformas: Windows y Mac; excluye Android, iOS e iPad en modo escritorio',()=>{
 assert.equal(autofirmaPlatform(nav),'WINDOWS');assert.equal(autofirmaPlatform({platform:'MacIntel',userAgent:'Macintosh'}),'APPLE');
 for(const n of [{userAgent:'Android'},{userAgent:'iPhone'},{platform:'MacIntel',maxTouchPoints:5},{platform:'Linux x86_64'}])assert.equal(autofirmaPlatform(n),null);
});
test('motivo Unicode escapado no permite inyectar servidores y visible solicita colocación nativa',()=>{
 const props=autofirmaProperties({reason:'Aprobación: C:\\prueba = sí',visible:true});
 assert.match(props,/visibleSignature=want/);assert.match(props,/Aprob\\u00f3n|Aprobaci\\u00f3n/);assert.match(props,/\\u005c/);
 assert.doesNotMatch(props,/signaturePosition|signaturePage|tsaURL|serverUrl/);
 assert.match(autofirmaProperties({reason:'',visible:false}),/visibleSignature=none/);
 assert.doesNotMatch(autofirmaProperties({reason:''}),/signReason/);
 assert.throws(()=>autofirmaProperties({reason:'ok\ntsaURL=https://example.invalid'}),{code:'AF_REASON'});
});
test('cancelación, comunicación y aviso nativo se distinguen sin culpar a la contraseña',()=>{
 assert.equal(autofirmaError('AOCancelledOperationException').code,'AF_CANCELLED');
 assert.equal(autofirmaError('ApplicationNotFoundException').code,'AF_CONNECTION');
 assert.match(autofirmaError('java.lang.Exception','SAF_03: ruta privada no se muestra').message,/SAF_03/);
 assert.doesNotMatch(autofirmaError('java.lang.Exception','ruta privada').message,/ruta privada/);
});
test('respuesta PDF conserva todos los bytes y su CMS sigue verificando con OpenSSL',async()=>{
 const result=await decodeSignedPDF(encoded,original);assert.deepEqual(result,signed);
 const bytes=Buffer.from(result),[a,b,c,d]=bytes.toString('latin1').match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/).slice(1).map(Number);
 const cms=Buffer.from(bytes.toString('latin1').match(/\/Contents\s*<([\da-fA-F]+)>/)[1],'hex');
 const temp=await mkdtemp(tmpdir()+'/pdf-af-');
 try{
  await writeFile(temp+'/cms.der',cms);await writeFile(temp+'/content',Buffer.concat([bytes.subarray(a,a+b),bytes.subarray(c,c+d)]));
  const check=spawnSync('openssl',['cms','-verify','-binary','-inform','DER','-in',temp+'/cms.der','-content',temp+'/content','-noverify','-out',temp+'/verified']);
  assert.equal(check.status,0,check.stderr.toString());
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('no ofrece como firmado un PDF original, una respuesta malformada o un PDF sin firma',async()=>{
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(original).toString('base64'),original),{code:'AF_RESPONSE'});
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(original).toString('base64'),new Uint8Array()),{code:'AF_RESPONSE'});
 for(const value of ['%%%','Y29udGVuaWRv',null])await assert.rejects(()=>decodeSignedPDF(value,original),{code:'AF_RESPONSE'});
});
test('adaptador entrega solo PDF/opciones a AutoFirma y limpia el marco al recibir el resultado',async()=>{
 let request;
 const env=environment((data,ok)=>{request=data;ok(encoded);});
 const result=await signWithAutoFirma(file,{consent:true,visible:true,reason:'Aprobar'},()=>{},env);
 assert.deepEqual(result,signed);assert.equal(request.data,Buffer.from(original).toString('base64'));
 assert.deepEqual(Object.keys(request).sort(),['data','keystore','properties']);assert.equal(request.keystore,'WINDOWS');
 assert.deepEqual(env.stats(),{removed:1,appended:1});
});
test('consentimiento, cancelación, timeout y segundo intento no dejan operaciones mezcladas',async()=>{
 const rejected=environment(()=>{throw new Error('should not call');});
 await assert.rejects(()=>signWithAutoFirma(file,{consent:false},()=>{},rejected),{code:'AF_CONSENT'});assert.equal(rejected.stats().appended,0);
 const cancelled=environment((_data,_ok,fail)=>fail('AOCancelledOperationException','Cancelado'));
 await assert.rejects(()=>signWithAutoFirma(file,{consent:true},()=>{},cancelled),{code:'AF_CANCELLED'});assert.equal(cancelled.stats().removed,1);
 const hanging=environment(()=>{});
 const wait=signWithAutoFirma(file,{consent:true},()=>{},hanging);
 await assert.rejects(()=>signWithAutoFirma(file,{consent:true},()=>{},environment(()=>{})),{code:'AF_BUSY'});
 await assert.rejects(()=>wait,{code:'AF_TIMEOUT'});assert.equal(hanging.stats().removed,1);
 const retry=environment((_data,ok)=>ok(encoded));assert.deepEqual(await signWithAutoFirma(file,{consent:true},()=>{},retry),signed);
});
test('cliente oficial sin modificar: invocación, WebSocket local, solicitud PAdES y retorno',async()=>{
 const source=await readFile(new URL('../dist/vendor/autofirma/autoscript.js',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(source).digest('hex'),'567998128f1cd8017c304a8c187f6912a0c56b0feebb02fffa2aa33732e40439');
 const timers=[],sockets=[],launches=[];
 class Socket{constructor(url){assert.match(url,/^wss:\/\/127\.0\.0\.1:\d+$/);this.sent=[];this.readyState=1;sockets.push(this);}send(data){this.sent.push(data);}}
 const document={all:false};Object.defineProperty(document,'location',{set:url=>launches.push(url)});
 const context={document,navigator:nav,location:{origin:'http://127.0.0.1:12345',hostname:'127.0.0.1'},WebSocket:Socket,
  setTimeout:(fn,_delay,...args)=>{timers.push(()=>fn(...args));return timers.length;},clearTimeout(){},crypto:webcrypto,console:{log(){},warn(){},error(){}},Uint8Array,Uint32Array,atob,btoa};context.window=context;
 vm.createContext(context);vm.runInContext(source,context);vm.runInContext(await readFile(new URL('../dist/autofirma-bridge.js',import.meta.url),'utf8'),context);
 let received,error;
 context.PDFNativeBridge.sign({data:Buffer.from(original).toString('base64'),properties:autofirmaProperties({visible:true}),keystore:'WINDOWS'},data=>{received=data;},(...args)=>{error=args;});
 assert.equal(launches.length,1);assert.match(launches[0],/^afirma:\/\/websocket\?/);assert.doesNotMatch(launches[0],/dat=|JVBER/);
 timers.shift()();assert.ok(sockets.length>0);sockets[0].onopen();timers.shift()();
 const socket=sockets[0];assert.match(socket.sent[0],/^echo=/);socket.onmessage({data:'OK'});
 const request=new URL(socket.sent[1]);assert.equal(request.hostname,'sign');assert.equal(request.searchParams.get('format'),'PAdES');assert.equal(request.searchParams.get('algorithm'),'SHA256withRSA');
 const supplied=request.searchParams.get('dat').replace(/-/g,'+').replace(/_/g,'/');assert.deepEqual(Buffer.from(supplied,'base64'),Buffer.from(original));
 assert.equal(Buffer.from(request.searchParams.get('ksb64'),'base64').toString(),'WINDOWS');
 assert.match(Buffer.from(request.searchParams.get('properties'),'base64').toString(),/visibleSignature=want/);
 socket.onmessage({data:'Y2VydA==|'+encoded});assert.equal(error,undefined);assert.equal(received,encoded);
});
test('el marco impide servicios remotos por CSP y el build conserva fuente y licencias',async()=>{
 const html=await readFile(new URL('../dist/autofirma-bridge.html',import.meta.url),'utf8');
 assert.match(html,/connect-src wss:\/\/127\.0\.0\.1:\*/);assert.doesNotMatch(html,/https:\/\//);
 const original=await readFile(new URL('../third_party/autofirma/autoscript.js',import.meta.url));
 assert.deepEqual(await readFile(new URL('../dist/vendor/autofirma/autoscript.js',import.meta.url)),original);
 assert.match(await readFile(new URL('../third_party/autofirma/GPL-2.0.txt',import.meta.url),'utf8'),/GNU GENERAL PUBLIC LICENSE/);
});
