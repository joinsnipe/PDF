import {readFile,mkdir,writeFile,rename,unlink} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
export const vaultPath=()=>path.join(process.env.LOCALAPPDATA||path.join(homedir(),'.local/state'),'PDF-Herramientas','state','ai-vault-v1.json');
export function validateVaultRecord(record){
 if(!record||Object.keys(record).sort().join(',')!=='data,iv,salt,v'||record.v!==1||typeof record.data!=='string'||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(record.data)||record.data.length<24||record.data.length>4096||typeof record.salt!=='string'||!/^[A-Za-z0-9+/]{22}==$/.test(record.salt)||typeof record.iv!=='string'||!/^[A-Za-z0-9+/]{16}$/.test(record.iv))throw new Error('Invalid vault');
 return record;
}
export async function readVault(file=vaultPath()){
 try{const data=await readFile(file,'utf8');if(data.length>5000)throw new Error();return validateVaultRecord(JSON.parse(data));}catch(e){if(e.code==='ENOENT')return null;throw e;}
}
export async function writeVault(record,file=vaultPath()){
 const data=JSON.stringify(validateVaultRecord(record)),dir=path.dirname(file),temp=file+'.'+randomBytes(12).toString('hex');
 await mkdir(dir,{recursive:true,mode:0o700});
 try{await writeFile(temp,data,{mode:0o600,flag:'wx'});await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}
}
export async function deleteVault(file=vaultPath()){try{await unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
