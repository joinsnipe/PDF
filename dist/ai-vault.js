import {assertAIKey,assertAIModel,aiError} from './ai-contract.js';
import {desktopAIEndpoint} from './ai-client.js';

// Password-derived encryption, not a key stored next to the ciphertext.
// This protects a locked copy at rest, not a compromised browser/device.
const STORAGE='pdf-contigo-ai-vault-v1',ITERATIONS=600000;
const encoder=new TextEncoder(),aad=encoder.encode(STORAGE);
const encode=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export function validateVault(record){
 if(!record||Object.keys(record).sort().join(',')!=='data,iv,salt,v'||record.v!==1||typeof record.data!=='string'||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(record.data)||record.data.length<24||record.data.length>4096||typeof record.salt!=='string'||!/^[A-Za-z0-9+/]{22}==$/.test(record.salt)||typeof record.iv!=='string'||!/^[A-Za-z0-9+/]{16}$/.test(record.iv))throw aiError('AI_STORAGE','La conexión guardada no se puede leer. Puedes borrarla y configurar tu API de nuevo.');
 return record;
}
export function validateVaultPassword(password){
 if(typeof password!=='string'||password.length<10||password.length>256)throw aiError('AI_VAULT_PASSWORD','Elige una contraseña de entre 10 y 256 caracteres para proteger tu conexión guardada.');
}
function settings(value){
 assertAIKey(value?.provider,value?.apiKey);assertAIModel(value.provider,value.model||'');
 if(typeof value.model!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,149}$/.test(value.model)||typeof value.manual!=='boolean'||typeof value.workspace!=='string'||(value.workspace&&!/^wrkspc_[a-zA-Z0-9]{10,80}$/.test(value.workspace)))throw new Error('Invalid settings');
 return {provider:value.provider,apiKey:value.apiKey,model:value.model,workspace:value.workspace,manual:value.manual};
}
async function derive(password,salt){
 if(!globalThis.crypto?.subtle)throw aiError('AI_STORAGE','Este navegador no permite guardar la conexión cifrada. Usa HTTPS o el paquete de escritorio. Puedes continuar sin guardarla.');
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sealVault(value,password){
 validateVaultPassword(password);const safe=settings(value),salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt);
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encoder.encode(JSON.stringify(safe)));
 return {v:1,salt:encode(salt),iv:encode(iv),data:encode(data)};
}
export async function openVault(record,password){
 validateVault(record);validateVaultPassword(password);
 const key=await derive(password,decode(record.salt));
 try{return settings(JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.iv),additionalData:aad},key,decode(record.data)))));}
 catch{throw aiError('AI_VAULT_UNLOCK','No se pudo desbloquear la conexión. Revisa tu contraseña de PDF Contigo; si la copia está dañada, tendrás que configurar la API de nuevo. No se ha contactado con el proveedor.');}
}
// Serialise disk mutations so Forget always follows an in-flight save.
let queue=Promise.resolve();
export function vaultStorage(action,record,{location=globalThis.location,fetcher=globalThis.fetch,storage}={}){
 const operation=async()=>{
  try{
   if(action==='save')validateVault(record);
   if(!['load','save','delete'].includes(action))throw new Error();
   const ai=desktopAIEndpoint(location);
   if(ai){
    const response=await fetcher(ai.replace(/\/ai$/,'/ai-vault'),{method:action==='load'?'GET':action==='save'?'PUT':'DELETE',headers:{'X-PDF-Local':'1',...(action==='save'?{'Content-Type':'application/json'}:{})},...(action==='save'?{body:JSON.stringify(record)}:{}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error();
    if(action==='load'){const text=await response.text();if(text.length>5000)throw new Error();const value=JSON.parse(text);return value===null?null:validateVault(value);}
   }else{
    storage=storage??globalThis.window?.localStorage;
    if(!storage)throw new Error();
    if(action==='load'){const text=storage.getItem(STORAGE);if(!text)return null;if(text.length>5000)throw new Error();return validateVault(JSON.parse(text));}
    if(action==='save')storage.setItem(STORAGE,JSON.stringify(record));else storage.removeItem(STORAGE);
   }
   return null;
  }catch(e){if(e.code==='AI_STORAGE')throw e;throw aiError('AI_STORAGE',action==='delete'?'No se pudo borrar la conexión guardada. Sigue bloqueada: vuelve a intentar borrarla.':'No se pudo acceder al almacenamiento de este dispositivo. En escritorio, actualiza el paquete; en el navegador, revisa sus permisos. Puedes usar la API sin guardarla.');}
 };
 const next=queue.then(operation,operation);queue=next.catch(()=>{});return next;
}
