import { signDocument } from './vendor/signing.js';
self.onmessage=async({data})=>{
 try{const result=await signDocument(data.pdf,data.cert,data.password,data.reason);self.postMessage(result,[result.bytes.buffer]);}
 catch(e){self.postMessage({error:e.message||'No se ha podido firmar el documento.'});}
 finally{data.cert.fill(0);data.password='';}
};
