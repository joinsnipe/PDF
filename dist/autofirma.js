import {PDFDocument,PDFDict,PDFName,PDFArray,PDFNumber} from './vendor/pdf-lib.js';

const MAX_INPUT=100*1024*1024,MAX_OUTPUT=110*1024*1024;
const fault=(code,message)=>Object.assign(new Error(message),{code});

export function autofirmaPlatform(nav=globalThis.navigator){
 const ua=nav?.userAgent||'',platform=nav?.userAgentData?.platform||nav?.platform||'';
 if(/Android|iPhone|iPad|iPod/i.test(ua)||(/Mac/i.test(platform)&&nav?.maxTouchPoints>1))return null;
 if(/Win/i.test(platform)||/Windows/i.test(ua))return 'WINDOWS';
 if(/Mac/i.test(platform)||/Macintosh/i.test(ua))return 'APPLE';
 return null;
}

// Java Properties are ASCII escaped: a custom reason cannot inject extra options.
export function autofirmaProperties({reason='',visible=true}={}){
 reason=String(reason);
 if(reason.length>120||/[\r\n\0]/.test(reason))throw fault('AF_REASON','Escribe un motivo de una sola línea, de hasta 120 caracteres.');
 const escaped=reason.replace(/[^a-zA-Z0-9 .,:;()_-]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
 return ['mode=implicit','signatureSubFilter=ETSI.CAdES.detached',
  'visibleSignature='+(visible?'want':'none'),...(reason?['signReason='+escaped]:[])].join('\n');
}

export function autofirmaError(type='',message=''){
 const detail=String(type)+' '+String(message),code=detail.match(/\bSAF_\d+\b/)?.[0];
 if(/cancel/i.test(detail))return fault('AF_CANCELLED','Firma cancelada. Puedes volver a intentarlo cuando quieras.');
 if(/ApplicationNotFound|IOException|WebSocket|Timeout|InterruptedException|Network/i.test(detail))return fault('AF_CONNECTION','No se ha podido comunicar con AutoFirma. Acepta «Abrir AutoFirma» si el navegador lo pregunta. Si ya está instalada, ciérrala y vuelve a intentarlo; consulta la ayuda de firma si continúa.');
 if(/NoCertificates|CertificateNotFound|NoValidCertificate/i.test(detail))return fault('AF_CERTIFICATE','AutoFirma no ha encontrado un certificado utilizable. Comprueba que puedes firmar este PDF directamente desde AutoFirma.');
 if(/UnsupportedProtocol|NeedsUpdatedVersion/i.test(detail))return fault('AF_VERSION','Actualiza AutoFirma desde su página oficial y vuelve a abrir el navegador.');
 return fault('AF_NATIVE','AutoFirma no ha completado la firma'+(code?' ('+code+')':'')+'. Revisa el aviso de AutoFirma. Este error no identifica un problema con la contraseña del P12.');
}

function toBase64(bytes){
 const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return btoa(chunks.join(''));
}

export async function decodeSignedPDF(encoded,original){
 if(typeof encoded!=='string'||!encoded.length||encoded.length>Math.ceil(MAX_OUTPUT/3)*4+4||!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encoded))throw fault('AF_RESPONSE','AutoFirma ha devuelto una respuesta que no es un PDF reconocible.');
 let bytes;
 try{bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
 catch{throw fault('AF_RESPONSE','No se ha podido leer la respuesta de AutoFirma.');}
 if(bytes.length>MAX_OUTPUT||!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw fault('AF_RESPONSE','AutoFirma no ha devuelto un archivo PDF.');
 if(original&&bytes.length===original.length&&bytes.every((b,i)=>b===original[i]))throw fault('AF_RESPONSE','AutoFirma ha devuelto el documento sin cambios. No se ofrece como firmado.');
 // Structural sanity check, NOT cryptographic verification or certificate trust.
 let hasSignature=false;
 try{
  const doc=await PDFDocument.load(bytes,{updateMetadata:false});
  for(const [,obj] of doc.context.enumerateIndirectObjects()){
   if(!(obj instanceof PDFDict))continue;
   const range=obj.lookup(PDFName.of('ByteRange'));
   if(!(range instanceof PDFArray)||range.size()!==4||!obj.has(PDFName.of('Contents')))continue;
   const n=range.asArray().map(v=>v instanceof PDFNumber?v.asNumber():NaN);
   if(n.every(Number.isSafeInteger)&&n[0]===0&&n[1]>0&&n[2]>n[1]&&n[3]>0&&n[2]+n[3]===bytes.length)hasSignature=true;
  }
 }catch{throw fault('AF_RESPONSE','El PDF devuelto por AutoFirma no se ha podido abrir.');}
 if(!hasSignature)throw fault('AF_RESPONSE','No se ha encontrado una estructura de firma que cubra el PDF recibido. No se ofrece como firmado.');
 return bytes; // Never reserialize a signed document.
}

let pending=false;
export async function signWithAutoFirma(file,opts={},progress=()=>{},env={}){
 const win=env.window||globalThis.window,doc=env.document||globalThis.document;
 const keystore=autofirmaPlatform(win?.navigator);
 if(!keystore||typeof win.WebSocket!=='function')throw fault('AF_UNSUPPORTED','Esta integración de AutoFirma requiere Windows o Mac y un navegador actualizado. En móvil puedes usar las otras herramientas de PDF.');
 if(!opts.consent)throw fault('AF_CONSENT','Confirma que quieres firmar este documento con tu certificado.');
 if(!file.bytes?.length||file.bytes.length>MAX_INPUT)throw fault('AF_SIZE','Selecciona un PDF de hasta 100 MB.');
 const properties=autofirmaProperties(opts);
 if(pending)throw fault('AF_BUSY','Ya hay una firma en curso. Termínala o cancélala en AutoFirma.');
 pending=true;
 progress(.15,'Acepta abrir AutoFirma y elige allí tu certificado. Si has pedido una marca visible, selecciona su página y posición.');
 try{
  const encoded=toBase64(file.bytes);
  const response=await new Promise((resolve,reject)=>{
   const frame=doc.createElement('iframe');frame.hidden=true;frame.title='Conexión local con AutoFirma';
   let finished=false,timer;
   const finish=(value,error)=>{if(finished)return;finished=true;clearTimeout(timer);frame.onload=frame.onerror=null;frame.remove();error?reject(error):resolve(value);};
   timer=setTimeout(()=>finish(null,fault('AF_COMPONENT','No se pudo cargar el componente de AutoFirma. Vuelve a abrir PDF.')),10000);
   frame.onerror=()=>finish(null,fault('AF_COMPONENT','No se pudo cargar el componente de AutoFirma. Vuelve a abrir PDF.'));
   frame.onload=()=>{
    try{
     const bridge=frame.contentWindow?.PDFNativeBridge;
     if(typeof bridge?.sign!=='function')throw new Error('Missing bridge');
     clearTimeout(timer);timer=setTimeout(()=>finish(null,fault('AF_TIMEOUT','La firma ha superado cinco minutos. Cierra la operación pendiente en AutoFirma antes de volver a intentarlo.')),env.timeoutMs||300000);
     bridge.sign({data:encoded,properties,keystore},value=>finish(value), (type,message)=>finish(null,autofirmaError(type,message)));
    }catch{finish(null,fault('AF_COMPONENT','No se pudo iniciar la comunicación con AutoFirma. Comprueba que está instalada y vuelve a intentarlo.'));}
   };
   frame.src=new URL('./autofirma-bridge.html',import.meta.url).href;doc.body.append(frame);
  });
  progress(.9,'Recibiendo el PDF de AutoFirma…');
  return await decodeSignedPDF(response,file.bytes);
 }finally{pending=false;}
}
