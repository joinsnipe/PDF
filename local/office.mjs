import {readFile,writeFile,mkdir,mkdtemp,rm,access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const MAX_INPUT=25*1024*1024;
const MAX_PART=20*1024*1024,MAX_EXPANDED=80*1024*1024;
const parts={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'};
const error=(code,message)=>Object.assign(new Error(message),{code});
let busy=false;
export function validateOffice(input,extension){
 if(!Object.hasOwn(parts,extension)||!input.length||input.length>MAX_INPUT)throw error('OFFICE_FORMAT','Selecciona DOCX, XLSX o PPTX de hasta 25 MB, sin contraseña ni macros.');
 try{
  const bytes=Buffer.from(input);let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
  if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))throw 0;
  const count=bytes.readUInt16LE(end+10);if(!count||count>5000||count!==bytes.readUInt16LE(end+8))throw 0;
  let at=bytes.readUInt32LE(end+16),total=0;const names=new Set();if(at+bytes.readUInt32LE(end+12)!==end)throw 0;
  for(let n=0;n<count;n++){
   if(bytes.readUInt32LE(at)!==0x02014b50)throw 0;
   const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),compressed=bytes.readUInt32LE(at+20),size=bytes.readUInt32LE(at+24),nameLength=bytes.readUInt16LE(at+28),extraLength=bytes.readUInt16LE(at+30),commentLength=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42),name=bytes.subarray(at+46,at+46+nameLength).toString('utf8');
   total+=size;if(flags&1||![0,8].includes(method)||size>MAX_PART||total>MAX_EXPANDED||names.has(name)||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||/vbaproject|\/embeddings\/|\/externallinks\/|\/activex\//i.test(name))throw 0;names.add(name);
   if(bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+8)!==method)throw 0;
   const localNameLength=bytes.readUInt16LE(local+26),start=local+30+localNameLength+bytes.readUInt16LE(local+28);if(bytes.subarray(local+30,local+30+localNameLength).toString('utf8')!==name||start+compressed>bytes.readUInt32LE(end+16))throw 0;
   if(/\.(xml|rels)$/i.test(name)){
    const packed=bytes.subarray(start,start+compressed),raw=method===8?inflateRawSync(packed,{maxOutputLength:MAX_PART}):packed;if(raw.length!==size)throw 0;
    let xml=new TextDecoder('utf-8',{fatal:true}).decode(raw);if(/<!DOCTYPE|<!ENTITY/i.test(xml)||xml.includes('\0'))throw 0;
    xml=xml.replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v)));
    if(/macroEnabled/i.test(xml)||/\bDDE(?:AUTO)?\b|INCLUDE(?:TEXT|PICTURE)|WEBSERVICE\s*\(/i.test(xml.replace(/<[^>]*>/g,'')))throw 0;
    if(/\.rels$/i.test(name))for(const match of xml.matchAll(/<[^!?][^>]*>/g)){const tag=match[0];if(/TargetMode\s*=\s*["']external["']/i.test(tag)&&!/\bType\s*=\s*["'][^"']*\/hyperlink["']/i.test(tag))throw 0;}
   }
   at+=46+nameLength+extraLength+commentLength;if(at>end)throw 0;
  }
  if(at!==end||!names.has(parts[extension])||!names.has('[Content_Types].xml'))throw 0;
 }catch{throw error('OFFICE_UNSUPPORTED','El archivo no es un Office compatible. No se admiten macros, objetos incrustados, vínculos de datos externos, documentos cifrados ni archivos dañados.');}
}
export async function findOffice(){
 const candidates=['/Applications/LibreOffice.app/Contents/MacOS/soffice',...(process.env.PATH||'').split(path.delimiter).filter(Boolean).map(p=>path.join(p,'soffice'))];
 for(const candidate of candidates)try{await access(candidate,constants.X_OK);if((await stat(candidate)).isFile())return candidate;}catch{}
 return null;
}
export async function convertOffice(bytes,extension){
 validateOffice(bytes,extension);const executable=await findOffice();if(!executable)throw error('OFFICE_MISSING','Instala LibreOffice en este ordenador y pulsa Comprobar instalación.');if(busy)throw error('OFFICE_BUSY','Ya hay una conversión de Office en curso. Espera a que termine.');busy=true;let folder;
 try{
  folder=await mkdtemp(path.join(tmpdir(),'pdf-contigo-office-'));const profile=path.join(folder,'profile'),output=path.join(folder,'output'),source=path.join(folder,'document.'+extension);await mkdir(path.join(profile,'user'),{recursive:true});await mkdir(output);await writeFile(source,bytes,{mode:0o600});
  await writeFile(path.join(profile,'user/registrymodifications.xcu'),'<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>');
  await new Promise((resolve,reject)=>{let timedOut=false;const child=spawn(executable,['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--nologo','--nodefault','--nolockcheck','--nofirststartwizard','--convert-to','pdf','--outdir',output,source],{stdio:'ignore',detached:true});const timer=setTimeout(()=>{timedOut=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},90000);child.on('error',()=>{clearTimeout(timer);reject(error('OFFICE_CONVERT','No se pudo ejecutar LibreOffice.'));});child.on('close',code=>{clearTimeout(timer);timedOut?reject(error('OFFICE_TIMEOUT','LibreOffice superó 90 segundos. Prueba un documento más pequeño.')):code?reject(error('OFFICE_CONVERT','LibreOffice no pudo convertir el documento.')):resolve();});});
  const result=path.join(output,'document.pdf');if((await stat(result)).size>100*1024*1024)throw error('OFFICE_SIZE','El PDF generado supera 100 MB.');const pdf=await readFile(result);if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw 0;return pdf;
 }catch(e){if(e?.code?.startsWith('OFFICE_'))throw e;throw error('OFFICE_CONVERT','No se pudo generar el PDF. Abre el documento en LibreOffice, revisa sus fuentes y guarda una copia nueva.');}
 finally{if(folder)await rm(folder,{recursive:true,force:true}).catch(()=>{});busy=false;}
}
