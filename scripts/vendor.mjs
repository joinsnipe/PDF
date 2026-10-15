// Rebuild browser dependencies from the versions locked in package-lock.json.
import {cp,mkdir,readdir,rm,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('node_modules'),out=path.resolve('dist/vendor');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
async function copy(from,to){await mkdir(path.dirname(path.join(out,to)),{recursive:true});await cp(path.join(root,from),path.join(out,to),{recursive:true});}
await copy('pdf-lib/dist/pdf-lib.esm.min.js','pdf-lib.js');
await copy('pdf-lib/LICENSE.md','pdf-lib-LICENSE.txt');
await copy('jszip/dist/jszip.min.js','jszip.min.js');
await copy('jszip/LICENSE.markdown','jszip-LICENSE.txt');
for(const f of ['pdf.mjs','pdf.worker.mjs'])await copy('pdfjs-dist/legacy/build/'+f,f);
for(const dir of ['cmaps','standard_fonts','wasm'])await copy('pdfjs-dist/'+dir,dir);
await copy('pdfjs-dist/LICENSE','pdfjs-LICENSE.txt');
for(const f of ['tesseract.min.js','worker.min.js'])await copy('tesseract.js/dist/'+f,'ocr/'+f);
for(const f of await readdir(path.join(root,'tesseract.js-core')))if(/^tesseract-core.*\.(js|wasm)$/.test(f))await copy('tesseract.js-core/'+f,'ocr/core/'+f);
for(const lang of ['spa','eng'])await copy(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,`ocr/lang/${lang}.traineddata.gz`);
await copy('@neslinesli93/qpdf-wasm/dist/qpdf.js','qpdf/qpdf.js');
await copy('@neslinesli93/qpdf-wasm/dist/qpdf.wasm','qpdf/qpdf.wasm');
await copy('@neslinesli93/qpdf-wasm/package.json','qpdf/SOURCE.json');
// Preserve upstream copyright, license and NOTICE files with each distribution.
await cp('licenses',out,{recursive:true});
await cp('third_party/autofirma',path.join(out,'autofirma'),{recursive:true});
async function licenses(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.name.startsWith('.'))continue;
    const dir=path.join(directory,entry.name);
    if(entry.name.startsWith('@')){await licenses(dir);continue;}
    if(!entry.isDirectory())continue;
    let metadata;try{metadata=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));}catch{continue;}
    const destination=path.join(out,'legal',metadata.name.replaceAll('/','_')+'-'+metadata.version);
    await mkdir(destination,{recursive:true});
    await writeFile(path.join(destination,'SOURCE.json'),JSON.stringify({name:metadata.name,version:metadata.version,license:metadata.license,repository:metadata.repository},null,2));
    for(const f of await readdir(dir))if(/^(LICENSE|LICENCE|NOTICE|COPYING)(\.|$)/i.test(f))await cp(path.join(dir,f),path.join(destination,f),{recursive:true});
    try{await licenses(path.join(dir,'node_modules'));}catch(e){if(e.code!=='ENOENT')throw e;}
  }
}
await licenses(root);
console.log('Motores, modelos y licencias preparados en dist/vendor.');
