import {Buffer} from 'buffer';
import forge from 'node-forge';
import {Signer} from '@signpdf/signpdf';

const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};

// PKCS#12 MAC / legacy PBE use UTF-16; PBES2 expects password bytes.
// Forge forwards the same JS string to both. Encode only at the PBES2
// boundary, without changing the supplied password or bypassing the MAC.
function parseP12(asn1,password,utf8=true,pbes2Password=password){
 const original=forge.pki.pbe.getCipherForPBES2;let pbes2Attempted=false;
 forge.pki.pbe.getCipherForPBES2=(oid,params)=>{pbes2Attempted=true;return original(oid,params,utf8&&pbes2Password!=null?forge.util.encodeUtf8(pbes2Password):pbes2Password);};
 try{return forge.pkcs12.pkcs12FromAsn1(asn1,false,password);}
 catch(e){e.pbes2Attempted=pbes2Attempted;throw e;}
 finally{forge.pki.pbe.getCipherForPBES2=original;}
}
const unsupported=e=>/unsupported|not supported|unknown hash/i.test(e.message);
const macFailure=e=>/MAC could not be verified/i.test(e.message);
const decryptFailure=e=>/Failed to decrypt|Unable to decrypt|Invalid padding/i.test(e.message);
function openWithEncoding(asn1,password,pbes2Password=password){
 try{return parseP12(asn1,password,true,pbes2Password);}
 catch(e){
  // Accept older Forge exports that used Latin-1 password bytes. Retry only
  // after PBES2 was attempted, never after a failed integrity check. Wrong
  // decryption can also surface as invalid ASN.1 if padding happens to fit. The
  // original password is still used to verify the MAC on every attempt.
  if(/[^\x00-\x7f]/.test(pbes2Password)&&e.pbes2Attempted&&!unsupported(e)&&!macFailure(e)){
   try{return parseP12(asn1,password,false,pbes2Password);}catch{}
  }
  throw e;
 }
}
function openP12(asn1,password){
 try{return openWithEncoding(asn1,password);}
 catch(e){
  if(password==='')return parseP12(asn1,null);
  // OpenSSL < 1.1.0 widened each UTF-8 byte to a UTF-16 code unit for
  // PKCS#12 MAC / legacy PBE. Modern OpenSSL still reads those exports.
  // Try that documented encoding only after a MAC mismatch. PBES2 keeps
  // the original password bytes. Every path must pass the MAC; no password
  // trimming, guessing, normalization or integrity bypass is performed.
  if(macFailure(e)&&/[^\x00-\x7f]/.test(password)){
   try{return openWithEncoding(asn1,forge.util.encodeUtf8(password),password);}
   catch(legacyError){if(!macFailure(legacyError))throw legacyError;}
  }
  throw e;
 }
}
export function readCertificate(bytes,password=''){
 const input=Buffer.from(bytes);
 try{
  let asn1,p12;
  try{asn1=forge.asn1.fromDer(forge.util.createBuffer(input.toString('binary')));}
  catch{fail('CERT_FORMAT','El archivo no es un P12/PFX válido. Un archivo CER/CRT solo contiene la parte pública y no permite firmar.');}
  try{p12=openP12(asn1,password);}
  catch(e){
   if(unsupported(e))fail('CERT_ALGORITHM','El archivo utiliza un formato o cifrado que esta versión no admite. Este error no indica que la contraseña sea incorrecta.');
   if(macFailure(e))fail('CERT_INTEGRITY','No se ha podido verificar la integridad del P12/PFX. Puede deberse a la contraseña de exportación, a una codificación incompatible o a un archivo alterado. Este resultado no permite distinguir la causa.');
   if(decryptFailure(e)||e.pbes2Attempted)fail('CERT_DECRYPT','No se ha podido descifrar el contenido del P12/PFX. Puede ser una incompatibilidad de cifrado o de codificación, otra contraseña de cifrado o un archivo dañado.');
   fail('CERT_FORMAT','No se ha podido interpretar la estructura del P12/PFX. El archivo puede estar dañado o usar una variante no compatible.');
  }
  const bags=type=>p12.getBags({bagType:type})[type]||[];
  const keys=[...bags(forge.pki.oids.pkcs8ShroudedKeyBag),...bags(forge.pki.oids.keyBag)];
  if(!keys.length)fail('CERT_NO_KEY','El archivo no incluye una clave privada. Necesitas una copia P12/PFX exportada con su clave privada para poder firmar.');
  if(keys.some(b=>!b.key?.n||!b.key?.e))fail('CERT_KEY_TYPE','La clave de este certificado no es RSA o no se puede leer. ECDSA, DNIe y tarjetas no están admitidos en esta versión.');
  const unique=new Map(keys.map(b=>[b.key.n.toString(16)+':'+b.key.e.toString(16),b.key]));
  if(unique.size!==1)fail('CERT_MULTIPLE_KEYS','El archivo contiene varias claves privadas. Exporta únicamente el certificado que quieras utilizar.');
  const key=[...unique.values()][0];
  const certs=bags(forge.pki.oids.certBag).map(b=>b.cert).filter(Boolean);
  const matches=certs.filter(c=>c.publicKey?.n&&key.n.compareTo(c.publicKey.n)===0&&key.e.compareTo(c.publicKey.e)===0);
  if(!matches.length)fail('CERT_KEY_MISMATCH','No se encuentra un certificado que corresponda a la clave privada del archivo.');
  const now=new Date();const valid=matches.filter(c=>now>=c.validity.notBefore&&now<=c.validity.notAfter);
  if(!valid.length)fail('CERT_DATE','El certificado está caducado o todavía no es válido según la fecha del equipo.');
  const distinct=new Map(valid.map(c=>[forge.asn1.toDer(forge.pki.certificateToAsn1(c)).getBytes(),c]));
  if(distinct.size!==1)fail('CERT_MULTIPLE_CERTS','Hay varios certificados vigentes para la misma clave. Exporta solo el certificado que quieras utilizar.');
  const cert=[...distinct.values()][0];const usage=cert.getExtension('keyUsage');
  if(usage&&!usage.digitalSignature&&!usage.nonRepudiation)fail('CERT_USAGE','El uso declarado por este certificado no permite firmar documentos.');
  const field=(dn,name)=>{const attr=dn.getField(name);if(!attr)return '';return attr.valueTagClass===forge.asn1.Type.UTF8?forge.util.decodeUtf8(attr.value):attr.value;};
  const info={signerName:field(cert.subject,'CN')||'Firmante',organization:field(cert.subject,'O'),issuer:field(cert.issuer,'CN')||field(cert.issuer,'O'),validUntil:cert.validity.notAfter.toISOString()};
  return {key,cert,certs,info};
 }finally{input.fill(0);}
}
export function inspectCertificate(bytes,password){return readCertificate(bytes,password).info;}
export class CertificateSigner extends Signer{
 constructor(material){super();this.material=material;}
 async sign(pdfBytes,time){
  const {key,cert,certs}=this.material,p7=forge.pkcs7.createSignedData();
  p7.content=forge.util.createBuffer(pdfBytes.toString('binary'));
  for(const certificate of certs)p7.addCertificate(certificate);
  p7.addSigner({key,certificate:cert,digestAlgorithm:forge.pki.oids.sha256,authenticatedAttributes:[
   {type:forge.pki.oids.contentType,value:forge.pki.oids.data},
   {type:forge.pki.oids.signingTime,value:time},
   {type:forge.pki.oids.messageDigest}
  ]});
  p7.sign({detached:true});
  const cms=p7.toAsn1(),tbs=forge.pki.certificateToAsn1(cert).value[0];
  const issuerIndex=tbs.value[0].tagClass===forge.asn1.Class.CONTEXT_SPECIFIC?3:2;
  // Keep the exact issuer Name from the certificate. Rebuilding it from forge's
  // flattened attributes can double-encode UTF-8 or lose multi-valued RDN sets,
  // making independent CMS verifiers unable to find the signer's certificate.
  const signedData=cms.value[1].value[0],signerInfo=signedData.value.at(-1).value[0];
  signerInfo.value[1].value[0]=tbs.value[issuerIndex];
  return Buffer.from(forge.asn1.toDer(cms).getBytes(),'binary');
 }
}

// The placeholder library writes literal PDF strings. Encode all UTF-16 bytes
// as octal escapes so company names, accents, parentheses and backslashes survive.
export function pdfUnicodeLiteral(value){
 const text=String(value),bytes=[254,255];
 for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);bytes.push(n>>8,n&255);}
 return bytes.map(n=>'\\'+n.toString(8).padStart(3,'0')).join('');
}
