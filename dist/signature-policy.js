import {PDFDocument,PDFDict,PDFArray,PDFName,PDFNumber,PDFRef} from './vendor/pdf-lib.js';

const key=PDFName.of;
const fault=(code,message)=>Object.assign(new Error(message),{code});

// Structural inspection only. A detected signature is NOT a validated signature.
// Walk direct dictionaries as well as indirect objects; empty signature fields
// are not signatures. Never save/normalize the document during inspection.
export function signatureInfo(doc){
 const seen=new Set(),signatures=new Set();let certification=0,restricted=false;
 const resolve=value=>value instanceof PDFRef?doc.context.lookup(value):value;
 const walk=value=>{
  value=resolve(value);if(!value||seen.has(value))return;seen.add(value);
  if(value instanceof PDFDict){
   if(value.has(key('ByteRange'))||((value.get(key('Type'))===key('Sig')||value.get(key('Type'))===key('DocTimeStamp'))&&value.has(key('Contents'))))signatures.add(value);
   if(value.get(key('TransformMethod'))===key('FieldMDP'))restricted=true;
   for(const [,child]of value.entries())walk(child);
  }else if(value instanceof PDFArray)for(const child of value.asArray())walk(child);
 };
 walk(doc.catalog);for(const [,value]of doc.context.enumerateIndirectObjects())walk(value);
 const perms=resolve(doc.catalog.get(key('Perms'))),certified=perms instanceof PDFDict&&perms.has(key('DocMDP'));
 if(certified){
  const signature=resolve(perms.get(key('DocMDP'))),refs=signature instanceof PDFDict?resolve(signature.get(key('Reference'))):null;
  if(signatures.has(signature)&&refs instanceof PDFArray)for(const entry of refs.asArray()){
   const ref=resolve(entry);if(!(ref instanceof PDFDict)||ref.get(key('TransformMethod'))!==key('DocMDP'))continue;
   const params=resolve(ref.get(key('TransformParams'))),p=params instanceof PDFDict?resolve(params.get(key('P'))):null;
   if(p instanceof PDFNumber&&[1,2,3].includes(p.asNumber()))certification=certification?Math.min(certification,p.asNumber()):p.asNumber();else restricted=true;
  }
 }
 if(certified&&!certification)restricted=true;
 return {count:signatures.size,signed:signatures.size>0||certified,certification,restricted,locked:certification===1||restricted};
}
export async function inspectSignatures(bytes){return signatureInfo(await PDFDocument.load(bytes,{updateMetadata:false}));}
export function assertCanSign(info,policy='approval'){
 if(!['approval','final'].includes(policy))throw fault('PDF_SIGN_POLICY','Selecciona cómo quieres proteger el documento al firmarlo.');
 if(info.locked)throw fault('PDF_SIGNATURE_LOCKED','Este PDF declara restricciones que impiden añadir otra firma desde esta app. Conserva el firmado y utiliza el original sin firmar si necesitas cambios.');
 if(policy==='final'&&(info.signed||info.certification))throw fault('PDF_CERTIFY_FIRST','Certificar sin cambios debe ser la primera firma. Este PDF ya está firmado: usa el original sin firmar o elige añadir otra firma si está permitido.');
}
export function assertCanEdit(info){
 if(info.signed||info.certification)throw fault('PDF_SIGNED_DOCUMENT','Este PDF ya contiene una firma digital. Para conservarla, esta app no modifica sus páginas ni su seguridad. Puedes leerlo, descargar el original o añadir otra firma si está permitido. Para editar, utiliza la copia sin firmar.');
}
export const readsOriginal=tool=>['viewer','text','pdfimages','word','summary','compare'].includes(tool);
export function signatureNotice(info){
 if(!info?.signed)return '';
 return `${info.count||1} ${info.count===1?'firma detectada':'firmas detectadas'}. ${info.locked?'El PDF declara restricciones para nuevas firmas.':'Puede admitir más firmas según sus permisos.'} La app no verifica su validez. El contenido firmado se conserva sin editar.`;
}
