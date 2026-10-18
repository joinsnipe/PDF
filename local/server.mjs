import {readVault,writeVault,deleteVault,vaultPath} from './vault.mjs';
import {forwardAI,AI_MAX_INPUT} from './ai.mjs';
import {findOffice,convertOffice,MAX_INPUT} from './office.mjs';
import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.ico':'image/vnd.microsoft.icon','.gz':'application/gzip','.bcmap':'application/octet-stream','.pfb':'application/octet-stream','.ttf':'font/ttf'};
export function makeHandler(directory,token,getPort,aiFetcher=fetch,savedVaultPath=vaultPath()){
  return async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    const fail=code=>{res.statusCode=code;res.end();};
    if(req.headers.host!==`127.0.0.1:${getPort()}`)return fail(403);
    try{
      const raw=req.url.split('?')[0],prefix=`/${token}/`;
      if(!raw.startsWith(prefix))return fail(404);
      const relative=decodeURIComponent(raw.slice(prefix.length));
      if(relative.includes('\\')||relative.includes('\0')||relative.split('/').some(p=>p==='.'||p==='..'))return fail(404);
      if(relative==='_desktop/ai-vault'){
        if(req.headers['x-pdf-local']!=='1'||!['same-origin',undefined].includes(req.headers['sec-fetch-site'])||(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${getPort()}`)||(req.method!=='GET'&&req.headers.origin!==`http://127.0.0.1:${getPort()}`))return fail(403);
        try{
          if(req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(await readVault(savedVaultPath)));}
          if(req.method==='DELETE'){if(Number(req.headers['content-length']||0)!==0||req.headers['transfer-encoding'])return fail(400);await deleteVault(savedVaultPath);res.statusCode=204;return res.end();}
          if(req.method!=='PUT')return fail(405);
          const length=Number(req.headers['content-length']);if(!Number.isInteger(length)||length<1||length>5000||req.headers['transfer-encoding']||req.headers['content-type']!=='application/json')return fail(400);
          let size=0;const chunks=[];req.setTimeout(15000,()=>req.destroy());for await(const chunk of req){size+=chunk.length;if(size>length)throw new Error();chunks.push(chunk);}if(size!==length)throw new Error();req.setTimeout(0);
          await writeVault(JSON.parse(Buffer.concat(chunks).toString('utf8')),savedVaultPath);res.statusCode=204;return res.end();
        }catch{return fail(400);}
      }
      if(relative==='_desktop/ai'&&req.method==='POST'){
        if(req.headers.origin!==`http://127.0.0.1:${getPort()}`||req.headers['x-pdf-local']!=='1'||!['same-origin',undefined].includes(req.headers['sec-fetch-site']))return fail(403);
        const length=Number(req.headers['content-length']);if(!Number.isInteger(length)||length<1||length>AI_MAX_INPUT||req.headers['transfer-encoding']||req.headers['content-type']!=='application/json')return fail(400);
        try{let size=0;const chunks=[];req.setTimeout(15000,()=>req.destroy());for await(const chunk of req){size+=chunk.length;if(size>length)throw new Error();chunks.push(chunk);}if(size!==length)throw new Error();req.setTimeout(0);const result=await forwardAI(JSON.parse(Buffer.concat(chunks).toString('utf8')),aiFetcher);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(result));}
        catch{return fail(400);}
      }
      if(relative==='_desktop/office/status'&&req.method==='GET'){
        if(req.headers['x-pdf-local']!=='1'||!['same-origin',undefined].includes(req.headers['sec-fetch-site']))return fail(403);
        res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({available:!!await findOffice()}));
      }
      if(relative==='_desktop/office/convert'&&req.method==='POST'){
        if(req.headers.origin!==`http://127.0.0.1:${getPort()}`||req.headers['x-pdf-local']!=='1'||!['same-origin',undefined].includes(req.headers['sec-fetch-site']))return fail(403);
        const length=Number(req.headers['content-length']);if(!Number.isInteger(length)||length<1||length>MAX_INPUT||req.headers['transfer-encoding']||req.headers['content-type']!=='application/octet-stream')return fail(400);
        try{let size=0;const chunks=[];req.setTimeout(15000,()=>req.destroy());for await(const chunk of req){size+=chunk.length;if(size>length)throw new Error();chunks.push(chunk);}if(size!==length)throw new Error();req.setTimeout(0);const result=await convertOffice(Buffer.concat(chunks),req.headers['x-pdf-extension']);res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Length',result.length);return res.end(result);}
        catch(e){res.statusCode=400;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({code:e.code?.startsWith('OFFICE_')?e.code:'OFFICE_INPUT',error:e.code?.startsWith('OFFICE_')?e.message:'No se pudo leer el archivo completo.'}));}
      }
      if(!['GET','HEAD'].includes(req.method))return fail(405);
      const root=await realpath(directory);
      const file=await realpath(path.join(root,relative||'index.html'));
      if(!file.startsWith(root+path.sep)||!(await stat(file)).isFile())return fail(404);
      const bytes=await readFile(file);
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',bytes.length);
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch{return fail(404);}
  };
}
async function main(){
  const here=path.dirname(fileURLToPath(import.meta.url));let assets=path.join(here,'app');
  try{await stat(path.join(assets,'index.html'));}catch{assets=path.resolve(here,'../dist');}
  await stat(path.join(assets,'index.html'));
  const token=randomBytes(24).toString('base64url');
  const server=http.createServer(makeHandler(assets,token,()=>server.address().port));
  server.listen(0,'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${server.address().port}/${token}/`;
    console.log(`PDF — Herramientas locales\n\n${url}\n\nMantén esta ventana abierta mientras utilizas PDF.\nPulsa Ctrl+C para salir. Si no se abre el navegador, copia el enlace.\n`);
    if(process.platform==='darwin')spawn('open',[url],{stdio:'ignore'}).on('error',()=>{});
  });
  server.on('error',e=>{console.error('No se pudo abrir PDF:',e.message);process.exitCode=1;});
  process.on('SIGINT',()=>server.close(()=>process.exit(0)));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error('Extrae todo el ZIP antes de abrir PDF.',e.message);process.exitCode=1;});
