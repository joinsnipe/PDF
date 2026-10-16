// The PDF client is static; Vinext serves the site. The former AI relay is retired.
import {cp,mkdir,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),hosting=new URL('hosting/',root);
const publicDir=new URL('public/',hosting);
await rm(publicDir,{recursive:true,force:true});await mkdir(publicDir,{recursive:true});
for(const name of await readdir(new URL('dist/',root)))if(!['client','server','.openai'].includes(name))await cp(new URL('dist/'+name,root),new URL(name,publicDir),{recursive:true});
let config={d1:null,r2:null};try{const source=JSON.parse(await readFile(new URL('.openai/hosting.json',root),'utf8'));const {static:unused,...worker}=source;config={...config,...worker};}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(new URL('.openai/',hosting),{recursive:true});await writeFile(new URL('.openai/hosting.json',hosting),JSON.stringify(config,null,2)+'\n');
const result=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{cwd:fileURLToPath(hosting),stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
for(const name of ['client','server','.openai']){const dest=new URL('dist/'+name,root);await rm(dest,{recursive:true,force:true});await cp(new URL('dist/'+name,hosting),dest,{recursive:true});}
