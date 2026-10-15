// Browser installation is offered only when the browser supplies a native prompt.
const button=document.querySelector('#install-app');
const help=document.querySelector('#install-dialog');
// A browser shortcut to an ephemeral localhost URL cannot start the desktop app.
const localDesktop=['127.0.0.1','localhost','[::1]'].includes(window.location.hostname);
let installPrompt=null;
const standalone=()=>!!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
button.hidden=localDesktop||standalone();
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();if(localDesktop)return;installPrompt=event;button.hidden=false;
});
window.addEventListener('appinstalled',()=>{installPrompt=null;button.hidden=true;help.close();});
button.addEventListener('click',async()=>{
  if(localDesktop)return;
  if(!installPrompt){help.showModal();return;}
  const prompt=installPrompt;installPrompt=null;button.disabled=true;
  try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')button.hidden=true;}
  catch{help.showModal();}
  finally{button.disabled=false;}
});
document.querySelector('#install-close').addEventListener('click',()=>help.close());
document.querySelector('#install-done').addEventListener('click',()=>help.close());
