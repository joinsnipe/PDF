import { Buffer } from 'buffer';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import forge from 'node-forge';

export async function signDocument(pdfBytes,p12Bytes,password,reason='Aprobación del documento'){
 const input=Buffer.from(p12Bytes);let p12,signer;
 try{
  try{p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(input.toString('binary'))),false,password);}catch{throw new Error('No se pudo abrir el certificado. Comprueba el archivo P12/PFX y su contraseña.');}
  const keys=p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[];
  const certs=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
  if(keys.length!==1||!keys[0].key?.n)throw new Error('Se requiere un certificado P12/PFX con una única clave privada RSA.');
  const key=keys[0].key;
  const cert=certs.map(x=>x.cert).find(c=>c?.publicKey?.n&&key.n.compareTo(c.publicKey.n)===0&&key.e.compareTo(c.publicKey.e)===0);
  if(!cert)throw new Error('El certificado no corresponde a la clave privada.');
  const now=new Date();if(now<cert.validity.notBefore||now>cert.validity.notAfter)throw new Error('El certificado está caducado o todavía no es válido según la fecha del equipo.');
  const usage=cert.getExtension('keyUsage');if(usage&&!usage.digitalSignature&&!usage.nonRepudiation)throw new Error('El certificado no autoriza firma de documentos.');
  const name=cert.subject.getField('CN')?.value||'Firmante';
  const doc=await PDFDocument.load(pdfBytes,{updateMetadata:false});
  for(const [,obj]of doc.context.enumerateIndirectObjects()){
   if(obj instanceof PDFDict&&(obj.has(PDFName.of('ByteRange'))||obj.get(PDFName.of('FT'))===PDFName.of('Sig')||obj.get(PDFName.of('Type'))===PDFName.of('Sig')))throw new Error('El PDF contiene una firma o un campo de firma previo. Esta versión no permite cofirmar ni conservar firmas existentes.');
  }
  const form=doc.getForm();if(form.hasXFA())throw new Error('No se admiten formularios XFA.');
  if(form.getFields().length)form.flatten();
  // Use Unicode PDF strings for visible metadata after placeholder creation.
  pdflibAddPlaceholder({pdfDoc:doc,reason,contactInfo:'',name,location:'',signingTime:now,signatureLength:32768,appName:'PDF'});
  const bytes=await doc.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false});
  signer=new P12Signer(input,{passphrase:password});
  const signed=await new SignPdf().sign(Buffer.from(bytes),signer,now);
  return {bytes:new Uint8Array(signed),signerName:name,validUntil:cert.validity.notAfter.toISOString()};
 }finally{input.fill(0);if(signer){signer.cert.clear();signer.options.passphrase='';}p12=null;}
}
