import { Buffer } from 'buffer';
import { PDFDocument, PDFName, PDFDict, PDFInvalidObject } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import {readCertificate,CertificateSigner,pdfUnicodeLiteral} from './certificate.js';
import {signatureAppearance} from './appearance.js';
import {signatureInfo,assertCanSign} from '../dist/signature-policy.js';
export {inspectCertificate} from './certificate.js';

export async function signDocument(pdfBytes,p12Bytes,password='',reason='Aprobación del documento',appearance={visible:false}){
 let material,signer;
 try{
  material=readCertificate(p12Bytes,password);const now=new Date(),name=material.info.signerName;
  const doc=await PDFDocument.load(pdfBytes,{updateMetadata:false});
  const policy=appearance.policy||'approval';assertCanSign(signatureInfo(doc),policy);
  for(const [,obj]of doc.context.enumerateIndirectObjects()){
   if(obj instanceof PDFDict&&(obj.has(PDFName.of('ByteRange'))||obj.get(PDFName.of('FT'))===PDFName.of('Sig')||obj.get(PDFName.of('Type'))===PDFName.of('Sig')))throw new Error('El PDF contiene una firma o un campo de firma previo. Esta versión no permite cofirmar ni conservar firmas existentes.');
  }
  const form=doc.getForm();if(form.hasXFA())throw new Error('No se admiten formularios XFA.');
  if(form.getFields().length)form.flatten();
  const pageNumber=appearance.visible?Number(appearance.page):1;
  if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>doc.getPageCount())throw new Error('Elige una página válida para colocar la firma.');
  const page=doc.getPage(pageNumber-1),stamp=appearance.visible?await signatureAppearance(doc,page,appearance,material.info,now,reason):null;
  pdflibAddPlaceholder({pdfDoc:doc,pdfPage:page,reason:pdfUnicodeLiteral(reason),contactInfo:'',name:pdfUnicodeLiteral(name),location:'',widgetRect:stamp?.rect||[0,0,0,0],signingTime:now,signatureLength:32768,appName:'PDF'});
  if(policy==='final'){
   const field=doc.getForm().getSignature('Signature1').acroField.dict;
   const ref=field.get(PDFName.of('V')),signature=doc.context.lookup(ref);
   const references=doc.context.obj([{Type:'SigRef',TransformMethod:'DocMDP',TransformParams:{Type:'TransformParams',P:1,V:'1.2'},Data:doc.context.trailerInfo.Root}]);
   // @signpdf stores its own dictionary as a raw PDFInvalidObject to keep the
   // signing placeholder out of object streams. Extend that owned dictionary
   // before signing; never append permissions to an already signed PDF.
   const raw=new Uint8Array(signature.sizeInBytes());signature.copyBytesInto(raw,0);
   if(raw[raw.length-2]!==62||raw[raw.length-1]!==62)throw new Error('No se pudo preparar la certificación del documento.');
   const extra=new TextEncoder().encode('\n/Reference '+references.toString()+'\n>>'),combined=new Uint8Array(raw.length-2+extra.length);
   combined.set(raw.subarray(0,-2));combined.set(extra,raw.length-2);doc.context.assign(ref,PDFInvalidObject.of(combined));
   doc.catalog.set(PDFName.of('Perms'),doc.context.obj({DocMDP:ref}));
  }
  if(stamp)for(const [,obj]of doc.context.enumerateIndirectObjects())if(obj instanceof PDFDict&&obj.get(PDFName.of('FT'))===PDFName.of('Sig'))obj.set(PDFName.of('AP'),doc.context.obj({N:stamp.ref}));
  const bytes=await doc.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false});
  signer=new CertificateSigner(material);
  const signed=await new SignPdf().sign(Buffer.from(bytes),signer,now);
  return {bytes:new Uint8Array(signed),...material.info,visible:!!stamp,page:pageNumber,policy};
 }finally{if(signer)signer.material=null;material=null;}
}
