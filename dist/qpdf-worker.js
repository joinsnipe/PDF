importScripts('./vendor/qpdf/qpdf.js');
self.onmessage=async({data:{tool,bytes,opts}})=>{
 let logs=[];
 try{
  const q=await Module({locateFile:()=>new URL('./vendor/qpdf/qpdf.wasm',self.location.href).href,noInitialRun:true,print:s=>logs.push(String(s)),printErr:s=>logs.push(String(s))});
  q.FS.writeFile('/input.pdf',bytes);
  let args;
  if(tool==='protect'){
   const random=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   args=['/input.pdf','--encrypt',String(opts.password),random,'256','--','/output.pdf'];
  }else if(tool==='unlock')args=[`--password=${String(opts.password)}`,'--decrypt','/input.pdf','/output.pdf'];
  else args=['/input.pdf','--object-streams=generate','/output.pdf'];
  const status=q.callMain(args);
  if(status!==0&&status!==3)throw new Error(logs.join('\n'));
  const result=q.FS.readFile('/output.pdf').slice();
  if(!result.length)throw new Error('No output');
  self.postMessage({bytes:result,note:tool==='protect'?'Cifrado AES de 256 bits. Guarda la contraseña: la aplicación no la conserva ni puede recuperarla.':tool==='unlock'?'Copia descifrada con la contraseña facilitada.':status===3?'Se recuperó una salida con advertencias. Revisa todas sus páginas: la recuperación puede ser parcial.':'Estructura reescrita por qpdf. Revisa el contenido: no recupera información que falte del archivo.'},[result.buffer]);
 }catch(e){self.postMessage({error:tool==='unlock'||/password|encrypted/i.test(logs.join(' ')+e.message)?'No se pudo abrir el PDF. Comprueba la contraseña; si es correcta, el archivo puede estar dañado o no ser compatible.':'El motor no pudo procesar este PDF. Puede estar dañado o usar funciones no compatibles.'});}
};
