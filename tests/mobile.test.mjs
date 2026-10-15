import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.PDF_BUILD_DEPS?process.env.PDF_BUILD_DEPS+'/jsdom':'jsdom');
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
async function setup(installed=false,url='https://pdf.example/'){
 const dom=new JSDOM(html,{url});globalThis.window=dom.window;globalThis.document=dom.window.document;
 window.navigator.standalone=installed;window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 await import('../dist/mobile.js?test='+Math.random());return {dom,button:document.querySelector('#install-app'),dialog:document.querySelector('#install-dialog')};
}
test('ayuda de instalación incluye Safari, Android y escritorio',async()=>{
 const {button,dialog,dom}=await setup();button.click();assert.equal(dialog.open,true);assert.match(dialog.textContent,/Safari/);assert.match(dialog.textContent,/Android/);assert.match(dialog.textContent,/Windows y Mac/);dom.window.close();
});
test('modo instalado de iOS oculta la invitación',async()=>{
 const {button,dom}=await setup(true);assert.equal(button.hidden,true);dom.window.close();
});
test('escritorio local no ofrece instalar un acceso web que no arranca el servidor',async()=>{
 const {button,dialog,dom}=await setup(false,'http://127.0.0.1:12345/'+'a'.repeat(32)+'/');
 assert.equal(button.hidden,true);let prompted=false;
 const event=new window.Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{prompted=true;};window.dispatchEvent(event);
 button.click();assert.equal(prompted,false);assert.equal(button.hidden,true);assert.equal(dialog.open,false);dom.window.close();
});
test('prompt nativo cancelado permite reintentar; appinstalled oculta el botón',async()=>{
 const {button,dialog,dom}=await setup();let prompted=false;const e=new window.Event('beforeinstallprompt',{cancelable:true});
 e.prompt=async()=>{prompted=true;};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);button.click();await new Promise(r=>setTimeout(r,0));
 assert.equal(prompted,true);assert.equal(button.hidden,false);button.click();assert.equal(dialog.open,true);
 window.dispatchEvent(new window.Event('appinstalled'));assert.equal(button.hidden,true);assert.equal(dialog.open,false);dom.window.close();
});
test('Compartir usa el enlace público desde escritorio local, sin ruta ni datos de sesión',async()=>{
 const {dom}=await setup(false,'http://127.0.0.1:12345/private-session/?document=private.pdf#secret');
 const share=document.querySelector('#share-app');let received,finish,calls=0;
 window.navigator.share=data=>{calls++;received=data;return new Promise(resolve=>{finish=resolve;});};
 const pending=share.onclick();assert.equal(calls,1);assert.equal(share.disabled,true);await share.onclick();assert.equal(calls,1);
 assert.deepEqual(received,{title:'PDF Contigo',text:'Abre, organiza y trabaja con tus PDF con PDF Contigo.',url:'https://snipe-pdf.snipex.chatgpt.site/'});
 finish();await pending;assert.equal(share.disabled,false);assert.equal(document.querySelector('#share-app-dialog').open,false);dom.window.close();
});
test('cancelar Compartir no muestra error; un bloqueo ofrece copiar y permite reintentar',async()=>{
 const {dom}=await setup(true),button=document.querySelector('#share-app'),dialog=document.querySelector('#share-app-dialog');
 window.navigator.share=async()=>{throw Object.assign(new Error('Cancelado'),{name:'AbortError'});};
 await button.onclick();assert.equal(dialog.open,false);assert.equal(button.disabled,false);
 window.navigator.share=async()=>{throw Object.assign(new Error('Bloqueado'),{name:'NotAllowedError'});};
 await button.onclick();assert.equal(dialog.open,true);assert.equal(document.querySelector('#share-app-link').value,'https://snipe-pdf.snipex.chatgpt.site/');assert.equal(button.disabled,false);
 document.querySelector('#share-app-close').click();assert.equal(dialog.open,false);dom.window.close();
});
test('Compartir sin API nativa copia el enlace y ofrece selección manual si se deniega el portapapeles',async()=>{
 const {dom}=await setup(),button=document.querySelector('#share-app');let copied;
 await button.onclick();assert.equal(document.querySelector('#share-app-dialog').open,true);
 Object.defineProperty(window.navigator,'clipboard',{configurable:true,value:{writeText:async text=>{copied=text;}}});
 const copy=document.querySelector('#share-app-copy');await copy.onclick();assert.equal(copied,'https://snipe-pdf.snipex.chatgpt.site/');assert.match(document.querySelector('#share-app-status').textContent,/Enlace copiado/);
 window.navigator.clipboard.writeText=async()=>{throw new Error('Denied');};await copy.onclick();
 const link=document.querySelector('#share-app-link');assert.equal(document.activeElement,link);assert.equal(link.selectionStart,0);assert.equal(link.selectionEnd,link.value.length);assert.match(document.querySelector('#share-app-status').textContent,/Mantén pulsado/);assert.equal(copy.disabled,false);dom.window.close();
});
