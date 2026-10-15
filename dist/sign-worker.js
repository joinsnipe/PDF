import { signDocument, inspectCertificate } from './vendor/signing.js';
self.onmessage=async({data})=>{
 try{if(data.action==='inspect'){self.postMessage(inspectCertificate(data.cert,data.password));return;}const result=await signDocument(data.pdf,data.cert,data.password,data.reason,data.appearance);self.postMessage(result,[result.bytes.buffer]);}
 catch(e){self.postMessage({error:e.message||'No se ha podido firmar el documento.',code:e.code||'SIGN_FAILED'});}
 finally{data.cert.fill(0);data.password='';}
};
