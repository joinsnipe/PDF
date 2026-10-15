importScripts('./vendor/qpdf/qpdf.js');
self.onmessage=async({data:{tool,bytes,opts={}}})=>{
 let logs=[],q,args;let stage='input';
 const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
 try{
  if(!['protect','unlock','repair'].includes(tool))fail('PDF_OPERATION','Operación PDF no compatible.');
  const password=String(opts.password??'');
  if(password.includes('\0')||(password.isWellFormed&&!password.isWellFormed()))fail('PDF_PASSWORD_FORMAT','La contraseña contiene caracteres que el motor no puede representar.');
  if(tool==='protect'&&(Array.from(password).length<8||password.length>100||new TextEncoder().encode(password).length>127))fail('PDF_PASSWORD_LENGTH','Usa entre 8 y 100 caracteres. Las tildes, símbolos y emojis ocupan más espacio: reduce la longitud si supera el límite del cifrado (127 bytes).');
  stage='engine';
  q=await Module({locateFile:()=>new URL('./vendor/qpdf/qpdf.wasm',self.location.href).href,noInitialRun:true});
  // This pinned WASM build ignores print/printErr. Capture stderr through its
  // supported FS API so diagnostics are reliable and aren't printed to console.
  q.FS.close(q.FS.streams[2]);q.FS.open('/stderr.log','w');
  q.FS.writeFile('/input.pdf',bytes);stage='process';
  if(tool==='protect'){
   const random=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   // Named options preserve leading @ / -- as password text, not qpdf arguments.
   args=['/input.pdf','--encrypt',`--user-password=${password}`,`--owner-password=${random}`,'--bits=256','--','/output.pdf'];
  }else if(tool==='unlock')args=[`--password=${password}`,'--decrypt','/input.pdf','/output.pdf'];
  else args=['/input.pdf','--object-streams=generate','/output.pdf'];
  let status=q.callMain(args);
  logs.push(new TextDecoder().decode(q.FS.readFile('/stderr.log')));
  // Older PDFs use one byte per Latin-1 character. This WASM build does not
  // recover every such encoding automatically. Try the exact same characters
  // as explicit bytes, only after an authentication failure, never by guessing.
  if(tool==='unlock'&&status!==0&&status!==3&&/invalid password/i.test(logs.join(' '))&&/[\x80-\xff]/.test(password)&&[...password].every(c=>c.charCodeAt(0)<=255)){
   const hex=[...password].map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
   args.fill('');args=['--password-mode=hex-bytes',`--password=${hex}`,'--decrypt','/input.pdf','/output.pdf'];
   status=q.callMain(args);logs.push(new TextDecoder().decode(q.FS.readFile('/stderr.log')));
  }
  if(status!==0&&status!==3)throw new Error('QPDF_PROCESS');
  const result=q.FS.readFile('/output.pdf').slice();
  if(!result.length)throw new Error('QPDF_NO_OUTPUT');
  const warning=status===3?' El motor ha recuperado el archivo con advertencias: revisa todas sus páginas.':'';
  self.postMessage({bytes:result,note:(tool==='protect'?'Cifrado AES de 256 bits. Guarda la contraseña: la aplicación no la conserva ni puede recuperarla.':tool==='unlock'?'Copia sin cifrado. Si el original contenía firmas digitales, esta copia reescrita puede invalidarlas; conserva el original.':'Estructura reescrita por qpdf. Revisa el contenido: no recupera información que falte del archivo.')+warning},[result.buffer]);
 }catch(e){
  let code=e.code,message=e.code?e.message:'';const detail=logs.join(' ');
  if(!code){
   if(stage==='engine'){code='PDF_ENGINE';message='No se pudo cargar el motor PDF. Extrae todo el ZIP y vuelve a abrir PDF.cmd; en la web, recarga la aplicación.';}
   else if(/invalid password|incorrect password/i.test(detail)){code='PDF_PASSWORD';message='La contraseña facilitada no abre este PDF. Usa la contraseña del documento, que puede ser distinta de la del certificado. También puede existir una incompatibilidad o un daño en sus datos de cifrado.';}
   else if(/unsupported.*(encrypt|security)|unknown.*(encrypt|security)|unsupported encryption filter/i.test(detail)){code='PDF_ENCRYPTION';message='El método de protección de este PDF no es compatible con esta versión. No implica que la contraseña esté mal.';}
   else{code='PDF_STRUCTURE';message='No se pudo procesar la estructura del PDF. Puede estar dañado o usar funciones no compatibles; este error no indica una contraseña incorrecta.';}
  }
  self.postMessage({error:message,code});
 }finally{
  for(const file of ['/input.pdf','/output.pdf','/stderr.log'])try{q?.FS.unlink(file);}catch{}
  opts.password='';opts.confirm='';args?.fill('');logs.length=0;
 }
};
