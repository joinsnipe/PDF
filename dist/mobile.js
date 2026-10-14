// Browser installation is offered only when the browser supplies a native prompt.
const button=document.querySelector('#install-app');
const help=document.querySelector('#install-dialog');
let installPrompt=null;
const standalone=()=>!!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
button.hidden=standalone();
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();installPrompt=event;button.hidden=false;
});
window.addEventListener('appinstalled',()=>{installPrompt=null;button.hidden=true;help.close();});
button.addEventListener('click',async()=>{
  if(!installPrompt){help.showModal();return;}
  const prompt=installPrompt;installPrompt=null;button.disabled=true;
  try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')button.hidden=true;}
  catch{help.showModal();}
  finally{button.disabled=false;}
});
document.querySelector('#install-close').addEventListener('click',()=>help.close());
document.querySelector('#install-done').addEventListener('click',()=>help.close());
