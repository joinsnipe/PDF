import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PDFDocument,PDFName,PDFDict,degrees} from '../dist/vendor/pdf-lib.js';
import {openRenderedPdf,pageCanvas} from '../dist/render.js';
import {signatureInfo,assertCanSign,assertCanEdit} from '../dist/signature-policy.js';
import {decodeSignedPDF} from '../dist/autofirma.js';
const require=createRequire(import.meta.url),deps=process.env.PDF_BUILD_DEPS;
const forge=require(deps?deps+'/node-forge':'node-forge');
const canvas=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas':'@napi-rs/canvas');
Object.assign(globalThis,{self:globalThis,DOMMatrix:canvas.DOMMatrix,Path2D:canvas.Path2D,ImageData:canvas.ImageData});
globalThis.document={createElement:()=>canvas.createCanvas(1,1)};
const {signDocument,inspectCertificate}=await import('../dist/vendor/signing.js');
const keys=forge.pki.rsa.generateKeyPair(2048);
function certificate({expired=false,usage=true}={}){
 const cert=forge.pki.createCertificate();cert.publicKey=keys.publicKey;cert.serialNumber='01';
 cert.validity.notBefore=new Date(Date.now()-86400000);cert.validity.notAfter=new Date(Date.now()+(expired?-60000:86400000));
 cert.setSubject([{name:'commonName',value:'Ana Muñoz (Representante)',valueTagClass:forge.asn1.Type.UTF8},{name:'organizationName',value:'Empresa Ficticia Canarias, S.L.'}]);cert.setIssuer(cert.subject.attributes);
 cert.setExtensions([{name:'keyUsage',digitalSignature:usage,keyEncipherment:true}]);cert.sign(keys.privateKey,forge.md.sha256.create());return cert;
}
const cert=certificate();
function p12({key=keys.privateKey,certificate=cert,password='prueba',algorithm='3des'}={}){
 return new Uint8Array(Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(key,[certificate],password,{algorithm})).getBytes(),'binary'));
}
async function opensslP12(password,args=[]){
 const dir=await mkdtemp(join(tmpdir(),'pdf-p12-'));
 try{
  await writeFile(join(dir,'key.pem'),forge.pki.privateKeyToPem(keys.privateKey),{mode:0o600});
  await writeFile(join(dir,'cert.pem'),forge.pki.certificateToPem(cert));
  const result=spawnSync('openssl',['pkcs12','-export','-inkey',join(dir,'key.pem'),'-in',join(dir,'cert.pem'),'-out',join(dir,'test.p12'),'-passout','stdin',...args],{input:password+'\n'});
  assert.equal(result.status,0,result.stderr.toString());return new Uint8Array(await readFile(join(dir,'test.p12')));
 }finally{await rm(dir,{recursive:true,force:true});}
}
async function opensslAcceptsP12(bundle,password){
 const dir=await mkdtemp(join(tmpdir(),'pdf-p12-independent-'));
 try{
  await writeFile(join(dir,'test.p12'),bundle,{mode:0o600});
  const result=spawnSync('openssl',['pkcs12','-legacy','-in',join(dir,'test.p12'),'-noout','-passin','stdin'],{input:password+'\n'});
  assert.equal(result.status,0,result.stderr.toString());
 }finally{await rm(dir,{recursive:true,force:true});}
}
async function pdf(angle=0){const d=await PDFDocument.create();d.addPage([612,792]);const page=d.addPage([612,792]);page.setCropBox(15,25,560,720);page.setRotation(degrees(angle));return d.save();}
async function verify(bytes){
 const tmp=await mkdtemp(join(tmpdir(),'pdf-cms-'));
 try{
  const buffer=Buffer.from(bytes),match=buffer.toString('latin1').match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);assert.ok(match);
  const [a,b,c,d]=match.slice(1).map(Number);assert.equal(a,0);assert.equal(c+d,buffer.length);
  const hex=buffer.subarray(b+1,c-1).toString(),raw=Buffer.from(hex,'hex'),n=raw[1],size=n&128?raw.readUIntBE(2,n&127):n,header=n&128?2+(n&127):2;
  await writeFile(join(tmp,'signature.der'),raw.subarray(0,header+size));await writeFile(join(tmp,'content'),Buffer.concat([buffer.subarray(0,b),buffer.subarray(c)]));
  const result=spawnSync('openssl',['cms','-verify','-binary','-inform','DER','-in',join(tmp,'signature.der'),'-content',join(tmp,'content'),'-noverify','-out',join(tmp,'verified')]);
  assert.equal(result.status,0,result.stderr.toString());
 }finally{await rm(tmp,{recursive:true,force:true});}
}
test('certificado de empresa: titular Unicode y organización proceden del certificado',()=>{
 const info=inspectCertificate(p12(),'prueba');assert.equal(info.signerName,'Ana Muñoz (Representante)');assert.equal(info.organization,'Empresa Ficticia Canarias, S.L.');
});
test('errores distinguen contraseña, falta de clave, formato, fecha y uso',()=>{
 assert.throws(()=>inspectCertificate(p12(),'incorrecta'),e=>e.code==='CERT_INTEGRITY');
 assert.throws(()=>inspectCertificate(p12({key:null}),'prueba'),e=>e.code==='CERT_NO_KEY');
 assert.throws(()=>inspectCertificate(new Uint8Array([1,2,3]),''),e=>e.code==='CERT_FORMAT');
 assert.throws(()=>inspectCertificate(p12({certificate:certificate({expired:true})}),'prueba'),e=>e.code==='CERT_DATE');
 assert.throws(()=>inspectCertificate(p12({certificate:certificate({usage:false})}),'prueba'),e=>e.code==='CERT_USAGE');
});
for(const [label,password,args] of [
 ['AES / ASCII','Prueba#2026',[]],
 ['AES / tildes y símbolos','Contraseña-á€2026',[]],
 ['AES / espacios conservados',' espacio con #123 ',[]],
 ['3DES + RC2 / tildes','Contraseña-á€2026',['-legacy']],
 ['AES / contraseña vacía','',[]]
])test(`P12 externo OpenSSL: ${label}; abre y firma con verificación CMS`,async()=>{
 const bundle=await opensslP12(password,args);assert.equal(inspectCertificate(bundle,password).organization,'Empresa Ficticia Canarias, S.L.');
 await verify((await signDocument(await pdf(),bundle,password)).bytes);
 assert.throws(()=>inspectCertificate(bundle,password+'incorrecta'),e=>e.code==='CERT_INTEGRITY');
});
test('conserva compatibilidad con P12 AES antiguos de Forge y contraseña Latin-1',async()=>{
 const password='Contraseña-á',bundle=p12({password,algorithm:'aes256'});
 assert.equal(inspectCertificate(bundle,password).signerName,'Ana Muñoz (Representante)');
 await verify((await signDocument(await pdf(),bundle,password)).bytes);
});
for(const args of [['-legacy'],['-keypbe','PBE-SHA1-3DES','-certpbe','PBE-SHA1-3DES','-macalg','sha256']])test(`P12 con codificación anterior a OpenSSL 1.1.0: ${args.join(' ')}; mismo password aceptado por OpenSSL`,async()=>{
 const password=' Contraseña-á€2026 ',legacy=Buffer.from(password,'utf8').toString('latin1');
 // Modern OpenSSL + widened UTF-8 reproduces the bytes of old exports.
 // Its reader independently accepts the ORIGINAL human-readable password.
 const bundle=await opensslP12(legacy,args);await opensslAcceptsP12(bundle,password);
 assert.equal(inspectCertificate(bundle,password).signerName,'Ana Muñoz (Representante)');
 await verify((await signDocument(await pdf(),bundle,password)).bytes);
 assert.throws(()=>inspectCertificate(bundle,password+'incorrecta'),e=>e.code==='CERT_INTEGRITY');
 const asn1=forge.asn1.fromDer(Buffer.from(bundle).toString('binary'));
 const digest=asn1.value[2].value[0].value[1];digest.value=String.fromCharCode(digest.value.charCodeAt(0)^1)+digest.value.slice(1);
 const altered=new Uint8Array(Buffer.from(forge.asn1.toDer(asn1).getBytes(),'binary'));
 assert.throws(()=>inspectCertificate(altered,password),e=>e.code==='CERT_INTEGRITY');
 // A compatibility attempt must not leave Forge's PBES2 adapter modified.
 assert.equal(inspectCertificate(await opensslP12(password),password).signerName,'Ana Muñoz (Representante)');
});
test('un cifrado incompatible no se presenta como contraseña incorrecta',async()=>{
 const bundle=await opensslP12('prueba',['-keypbe','CAMELLIA-256-CBC']);
 assert.throws(()=>inspectCertificate(bundle,'prueba'),e=>e.code==='CERT_ALGORITHM');
});
test('rechaza un MAC manipulado aunque la contraseña sea correcta',async()=>{
 const bundle=await opensslP12('Contraseña-á€2026'),asn1=forge.asn1.fromDer(Buffer.from(bundle).toString('binary'));
 const digest=asn1.value[2].value[0].value[1];digest.value=String.fromCharCode(digest.value.charCodeAt(0)^1)+digest.value.slice(1);
 const altered=new Uint8Array(Buffer.from(forge.asn1.toDer(asn1).getBytes(),'binary'));
 assert.throws(()=>inspectCertificate(altered,'Contraseña-á€2026'),e=>e.code==='CERT_INTEGRITY');
});
test('sin motivo conserva una firma válida sin texto de aprobación',async()=>{
 const result=await signDocument(await pdf(),p12(),'prueba','');await verify(result.bytes);
 const doc=await PDFDocument.load(result.bytes),sig=doc.getForm().getSignature('Signature1').acroField.dict.lookup(PDFName.of('V'),PDFDict);
 assert.ok(!sig.has(PDFName.of('Reason'))||['','\uFEFF'].includes(sig.lookup(PDFName.of('Reason')).decodeText()));
});
test('P12 con keyBag sin cifrar firma y supera la verificación CMS',async()=>{
 const result=await signDocument(await pdf(),p12({password:null}),'');await verify(result.bytes);
});
test('metadatos de firma conservan acentos, paréntesis y barras',async()=>{
 const reason='Aprobación (empresa) \\ revisión';const result=await signDocument(await pdf(),p12(),'prueba',reason);await verify(result.bytes);
 const doc=await PDFDocument.load(result.bytes);const sig=doc.getForm().getSignature('Signature1').acroField.dict.lookup(PDFName.of('V'),PDFDict);
 assert.equal(sig.lookup(PDFName.of('Name')).decodeText(),'Ana Muñoz (Representante)');assert.equal(sig.lookup(PDFName.of('Reason')).decodeText(),reason);
});
for(const angle of [0,90,180,270])test(`firma visible en página 2, CropBox y giro ${angle}`,async()=>{
 const result=await signDocument(await pdf(angle),p12(),'prueba','Aprobación del documento',{visible:true,page:2,x:10,y:65,w:75,h:25});
 await verify(result.bytes);const doc=await PDFDocument.load(result.bytes),field=doc.getForm().getSignature('Signature1'),widget=field.acroField.getWidgets()[0];
 assert.equal(widget.dict.get(PDFName.of('P')).toString(),doc.getPage(1).ref.toString());
 const r=widget.getRectangle();assert.ok(r.width>100&&r.height>100);assert.ok(widget.dict.has(PDFName.of('AP')));
 const rendered=await openRenderedPdf(result.bytes,{standardFontDataUrl:fileURLToPath(new URL('../dist/vendor/standard_fonts/',import.meta.url))});try{
  const {canvas:c}=await pageCanvas(rendered,1,1);const ctx=c.getContext('2d');
  const left=Math.round(c.width*.1),top=Math.round(c.height*.65),right=Math.round(c.width*.85),bottom=Math.round(c.height*.90);
  const pixels=ctx.getImageData(left,top,right-left,bottom-top).data;let dark=0,red=0;
  for(let i=0;i<pixels.length;i+=4){if(pixels[i]<120&&pixels[i+1]<120&&pixels[i+2]<120)dark++;if(pixels[i]>150&&pixels[i+1]<90&&pixels[i+2]<100)red++;}
  assert.ok(dark>100,'texto visible en la zona elegida');assert.ok(red>100,'franja roja en la zona elegida');
  await mkdir(new URL('../test-output/',import.meta.url),{recursive:true});await writeFile(new URL(`../test-output/firma-visible-${angle}.png`,import.meta.url),c.toBuffer('image/png'));
  if(angle===0)await writeFile(new URL('../test-output/firma-empresa-ficticia.pdf',import.meta.url),result.bytes);
 }finally{await rendered.destroy();}
});
test('rechaza una posición ilegible, página inexistente y PDF ya firmado',async()=>{
 const source=await pdf(),bundle=p12();
 await assert.rejects(()=>signDocument(source,bundle,'prueba','',{visible:true,page:3}),/página/);
 await assert.rejects(()=>signDocument(source,bundle,'prueba','',{visible:true,page:2,x:10,y:10,w:5,h:5}),/Amplía/);
 const signed=await signDocument(source,bundle,'prueba');await assert.rejects(()=>signDocument(signed.bytes,bundle,'prueba'),/firma/);
});
test('certificación sin cambios: DocMDP enlazado a la firma, CMS válido y bloqueo de nuevas operaciones',async()=>{
 const source=await pdf(),result=await signDocument(source,p12(),'prueba','Cerrar documento',{visible:false,policy:'final'});
 await verify(result.bytes);
 const doc=await PDFDocument.load(result.bytes),info=signatureInfo(doc);
 assert.equal(info.count,1);assert.equal(info.certification,1);assert.equal(info.locked,true);
 const signature=doc.getForm().getSignature('Signature1').acroField.dict.get(PDFName.of('V'));
 assert.equal(doc.catalog.lookup(PDFName.of('Perms'),PDFDict).get(PDFName.of('DocMDP')).toString(),signature.toString());
 assert.throws(()=>assertCanSign(info,'approval'),{code:'PDF_SIGNATURE_LOCKED'});
 assert.throws(()=>assertCanEdit(info),{code:'PDF_SIGNED_DOCUMENT'});
 assert.deepEqual(await decodeSignedPDF(Buffer.from(result.bytes).toString('base64'),source,{policy:'final'}),result.bytes);
 const independent=spawnSync('python3',['-c',"import io,sys;from pypdf import PdfReader;r=PdfReader(io.BytesIO(sys.stdin.buffer.read()));s=r.trailer['/Root']['/Perms']['/DocMDP'];assert s['/Reference'][0]['/TransformParams']['/P']==1;assert s['/ByteRange'][2]+s['/ByteRange'][3]==len(r.stream.getvalue())"],{input:result.bytes});assert.equal(independent.status,0,independent.stderr.toString());
 // The certification permission is inside the cryptographically signed bytes.
 const changed=Buffer.from(result.bytes);const at=changed.indexOf(Buffer.from('/P 1'));assert.ok(at>0);changed[at+3]=50;
 await assert.rejects(()=>verify(changed));
});
test('aprobación admite cofirma pero no certificación posterior ni edición silenciosa',async()=>{
 const source=await pdf(),result=await signDocument(source,p12(),'prueba','',{visible:false});
 const info=signatureInfo(await PDFDocument.load(result.bytes));assert.equal(info.certification,0);assert.equal(info.count,1);
 assert.doesNotThrow(()=>assertCanSign(info,'approval'));
 assert.throws(()=>assertCanSign(info,'final'),{code:'PDF_CERTIFY_FIRST'});
 assert.throws(()=>assertCanEdit(info),{code:'PDF_SIGNED_DOCUMENT'});
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(result.bytes).toString('base64'),source,{policy:'final'}),{code:'AF_CERTIFICATION'});
 await assert.rejects(()=>decodeSignedPDF(Buffer.from(result.bytes).toString('base64'),source,{previous:{signed:true,count:1}}),{code:'AF_PREVIOUS_SIGNATURE'});
});
test('apariencia compacta: nombre largo a tamaño mínimo legible, sin truncar datos por añadir el motivo',async()=>{
 const long=certificate();long.setSubject([{name:'commonName',value:'Ana María Muñoz Fernández Representante de Empresa Ficticia Canarias',valueTagClass:forge.asn1.Type.UTF8}]);long.sign(keys.privateKey,forge.md.sha256.create());
 const result=await signDocument(await pdf(),p12({certificate:long}),'prueba','Motivo extenso '.repeat(20),{visible:true,page:1,x:10,y:60,w:45,h:12});
 await verify(result.bytes);
 const doc=await PDFDocument.load(result.bytes);assert.equal(doc.getForm().getSignature('Signature1').acroField.dict.lookup(PDFName.of('V'),PDFDict).lookup(PDFName.of('Name')).decodeText(),'Ana María Muñoz Fernández Representante de Empresa Ficticia Canarias');
 const rendered=await openRenderedPdf(result.bytes,{standardFontDataUrl:fileURLToPath(new URL('../dist/vendor/standard_fonts/',import.meta.url))});try{const {canvas:c}=await pageCanvas(rendered,0,1.5);await mkdir(new URL('../test-output/',import.meta.url),{recursive:true});await writeFile(new URL('../test-output/firma-compacta.png',import.meta.url),c.toBuffer('image/png'));}finally{await rendered.destroy();}
});
