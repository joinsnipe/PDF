import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.PDF_BUILD_DEPS?process.env.PDF_BUILD_DEPS+'/jsdom':'jsdom');
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
async function setup(installed=false){
 const dom=new JSDOM(html,{url:'https://pdf.example/'});globalThis.window=dom.window;globalThis.document=dom.window.document;
 window.navigator.standalone=installed;window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 await import('../dist/mobile.js?test='+Math.random());return {dom,button:document.querySelector('#install-app'),dialog:document.querySelector('#install-dialog')};
}
test('ayuda de instalación incluye Safari, Android y escritorio',async()=>{
 const {button,dialog,dom}=await setup();button.click();assert.equal(dialog.open,true);assert.match(dialog.textContent,/Safari/);assert.match(dialog.textContent,/Android/);assert.match(dialog.textContent,/Windows y Mac/);dom.window.close();
});
test('modo instalado de iOS oculta la invitación',async()=>{
 const {button,dom}=await setup(true);assert.equal(button.hidden,true);dom.window.close();
});
test('prompt nativo cancelado permite reintentar; appinstalled oculta el botón',async()=>{
 const {button,dialog,dom}=await setup();let prompted=false;const e=new window.Event('beforeinstallprompt',{cancelable:true});
 e.prompt=async()=>{prompted=true;};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);button.click();await new Promise(r=>setTimeout(r,0));
 assert.equal(prompted,true);assert.equal(button.hidden,false);button.click();assert.equal(dialog.open,true);
 window.dispatchEvent(new window.Event('appinstalled'));assert.equal(button.hidden,true);assert.equal(dialog.open,false);dom.window.close();
});
