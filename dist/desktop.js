// Inactive on the hosted site and on the Mac launcher.
export async function bindDesktop(win=window, doc=document, request=fetch){
 if(win.location.hostname!=='127.0.0.1')return;
 const base=new URL('./',win.location.href);
 if(!/^\/[A-Za-z0-9_-]{32}\/$/.test(base.pathname))return;
 try{
  const response=await request(new URL('_desktop/ping',base),{cache:'no-store'});
  if(!response.ok||(await response.json()).app!=='pdf-desktop-1')return;
 }catch{return;}
 const button=doc.getElementById('desktop-exit');button.hidden=false;
 button.onclick=async()=>{
  if(!win.confirm('¿Cerrar PDF? Guarda antes tus resultados. Se cerrará la aplicación para todas sus pestañas abiertas.'))return;
  button.disabled=true;
  try{
   const response=await request(new URL('_desktop/stop',base),{method:'POST',headers:{'X-PDF-Local':'1'},cache:'no-store'});
   if(response.status!==204)throw new Error();
   const message=doc.createElement('p');message.textContent='PDF está cerrado. Puedes cerrar esta pestaña. Para volver a utilizarlo, abre el icono PDF.';
   message.style.cssText='max-width:600px;margin:15vh auto;padding:24px;font:18px/1.6 Arial,sans-serif';
   doc.body.replaceChildren(message);
  }catch{button.disabled=false;win.alert('No se ha podido cerrar PDF. Vuelve a intentarlo.');}
 };
 const match=/^#open=([A-Za-z0-9_-]{32})$/.exec(win.location.hash);
 if(match){
  win.history.replaceState(null,'',base.href);
  try{
   const response=await request(new URL('_desktop/document/'+match[1],base),{headers:{'X-PDF-Local':'1'},cache:'no-store'});
   if(!response.ok)throw new Error();
   const bytes=await response.arrayBuffer();
   const name=decodeURIComponent(response.headers.get('X-PDF-Name')||'documento.pdf');
   // Keep the ordinary file-picker validation and encrypted-PDF prompt in app.js.
   win.dispatchEvent(new win.CustomEvent('pdf-desktop-open',{detail:{file:{name,size:bytes.byteLength,arrayBuffer:async()=>bytes}}}));
  }catch{win.alert('No se ha podido abrir ese documento. Vuelve a seleccionarlo con «Abrir con → PDF» o desde el visor de PDF.');}
 }
}
if(typeof window!=='undefined'){
 if(document.readyState==='complete')bindDesktop();
 else window.addEventListener('load',()=>bindDesktop(),{once:true});
}
