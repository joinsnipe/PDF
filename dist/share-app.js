// Share the public app, never a localhost address, document or session URL.
export const APP_SHARE_URL='https://snipe-pdf.snipex.chatgpt.site/';
export function bindAppSharing(win,doc){
 const button=doc.getElementById('share-app'),dialog=doc.getElementById('share-app-dialog');
 const link=doc.getElementById('share-app-link'),copy=doc.getElementById('share-app-copy'),status=doc.getElementById('share-app-status');
 const shareData={title:'PDF Contigo',text:'Abre, organiza y trabaja con tus PDF con PDF Contigo.',url:APP_SHARE_URL};
 let sharing=false,copying=false;
 const selectLink=()=>{link.focus();link.select();link.setSelectionRange(0,link.value.length);};
 const showLink=()=>{link.value=APP_SHARE_URL;status.textContent='Copia el enlace y envíalo a quien quieras.';if(!dialog.open)dialog.showModal();};
 button.onclick=async()=>{
  if(sharing)return;
  sharing=true;button.disabled=true;
  try{
   if(typeof win.navigator.share==='function'&&(!win.navigator.canShare||win.navigator.canShare(shareData))){
    // Call during the click, before any await: native sharing needs user activation.
    await win.navigator.share(shareData);
   }else showLink();
  }catch(error){if(error?.name!=='AbortError')showLink();}
  finally{sharing=false;button.disabled=false;}
 };
 copy.onclick=async()=>{
  if(copying)return;
  copying=true;copy.disabled=true;
  try{
   if(typeof win.navigator.clipboard?.writeText!=='function')throw new Error('Clipboard unavailable');
   await win.navigator.clipboard.writeText(APP_SHARE_URL);
   status.textContent='Enlace copiado. Ya puedes pegarlo en tu mensaje.';
  }catch{selectLink();status.textContent='Mantén pulsado el enlace y elige Copiar, o usa Ctrl+C / ⌘C.';}
  finally{copying=false;copy.disabled=false;}
 };
 link.onclick=selectLink;
 doc.getElementById('share-app-close').onclick=()=>dialog.close();
 dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});
}
