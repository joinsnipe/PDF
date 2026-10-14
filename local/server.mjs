import http from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.gz':'application/gzip','.bcmap':'application/octet-stream','.pfb':'application/octet-stream','.ttf':'font/ttf'};
export function makeHandler(directory,token,getPort){
  return async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    const fail=code=>{res.statusCode=code;res.end();};
    if(req.headers.host!==`127.0.0.1:${getPort()}`)return fail(403);
    if(!['GET','HEAD'].includes(req.method))return fail(405);
    try{
      const raw=req.url.split('?')[0],prefix=`/${token}/`;
      if(!raw.startsWith(prefix))return fail(404);
      const relative=decodeURIComponent(raw.slice(prefix.length));
      if(relative.includes('\\')||relative.includes('\0')||relative.split('/').some(p=>p==='.'||p==='..'))return fail(404);
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
