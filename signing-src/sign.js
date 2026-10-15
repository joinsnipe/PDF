import { Buffer } from 'buffer';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import {readCertificate,CertificateSigner,pdfUnicodeLiteral} from './certificate.js';
import {signatureAppearance} from './appearance.js';
export {inspectCertificate} from './certificate.js';

export async function signDocument(pdfBytes,p12Bytes,password='',reason='Aprobación del documento',appearance={visible:false}){
 let material,signer;
 try{
  material=readCertificate(p12Bytes,password);const now=new Date(),name=material.info.signerName;
  const doc=await PDFDocument.load(pdfBytes,{updateMetadata:false});
  for(const [,obj]of doc.context.enumerateIndirectObjects()){
   if(obj instanceof PDFDict&&(obj.has(PDFName.of('ByteRange'))||obj.get(PDFName.of('FT'))===PDFName.of('Sig')||obj.get(PDFName.of('Type'))===PDFName.of('Sig')))throw new Error('El PDF contiene una firma o un campo de firma previo. Esta versión no permite cofirmar ni conservar firmas existentes.');
  }
  const form=doc.getForm();if(form.hasXFA())throw new Error('No se admiten formularios XFA.');
  if(form.getFields().length)form.flatten();
  const pageNumber=appearance.visible?Number(appearance.page):1;
  if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>doc.getPageCount())throw new Error('Elige una página válida para colocar la firma.');
  const page=doc.getPage(pageNumber-1),stamp=appearance.visible?await signatureAppearance(doc,page,appearance,material.info,now,reason):null;
  pdflibAddPlaceholder({pdfDoc:doc,pdfPage:page,reason:pdfUnicodeLiteral(reason),contactInfo:'',name:pdfUnicodeLiteral(name),location:'',widgetRect:stamp?.rect||[0,0,0,0],signingTime:now,signatureLength:32768,appName:'PDF'});
  if(stamp)for(const [,obj]of doc.context.enumerateIndirectObjects())if(obj instanceof PDFDict&&obj.get(PDFName.of('FT'))===PDFName.of('Sig'))obj.set(PDFName.of('AP'),doc.context.obj({N:stamp.ref}));
  const bytes=await doc.save({useObjectStreams:false,addDefaultPage:false,updateFieldAppearances:false});
  signer=new CertificateSigner(material);
  const signed=await new SignPdf().sign(Buffer.from(bytes),signer,now);
  return {bytes:new Uint8Array(signed),...material.info,visible:!!stamp,page:pageNumber};
 }finally{if(signer)signer.material=null;material=null;}
}
