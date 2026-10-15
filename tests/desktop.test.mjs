import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {bindDesktop} from '../dist/desktop.js';
const require=createRequire(import.meta.url),deps=process.env.PDF_BUILD_DEPS;
const {JSDOM}=require(deps?deps+'/jsdom':'jsdom');
const local='http://127.0.0.1:12345/'+'a'.repeat(32)+'/';
const page=url=>new JSDOM('<body><button id="desktop-exit" hidden>Salir de PDF</button></body>',{url});
test('web pública y servidor sin protocolo desktop no muestran Salir',async()=>{
 const publicPage=page('https://pdf.example/');let calls=0;
 await bindDesktop(publicPage.window,publicPage.window.document,()=>{calls++;});assert.equal(calls,0);
 const mac=page(local);await bindDesktop(mac.window,mac.window.document,async()=>({ok:false}));assert.equal(mac.window.document.querySelector('button').hidden,true);
});
test('cancelar mantiene la app; confirmar cierra con petición local y muestra aviso',async()=>{
 const dom=page(local),requests=[];let allow=false;dom.window.confirm=()=>allow;
 const request=async(url,options)=>{requests.push({url:String(url),options});return {ok:true,status:204,json:async()=>({app:'pdf-desktop-1'})};};
 await bindDesktop(dom.window,dom.window.document,request);const button=dom.window.document.querySelector('button');assert.equal(button.hidden,false);
 await button.onclick();assert.equal(requests.length,1);assert.equal(button.disabled,false);
 allow=true;await button.onclick();assert.equal(requests[1].url,local+'_desktop/stop');assert.equal(requests[1].options.method,'POST');assert.equal(requests[1].options.headers['X-PDF-Local'],'1');assert.match(dom.window.document.body.textContent,/PDF está cerrado/);
});
test('fallo al cerrar conserva la interfaz y permite reintentar',async()=>{
 const dom=page(local);let warned=false;dom.window.confirm=()=>true;dom.window.alert=()=>{warned=true;};
 await bindDesktop(dom.window,dom.window.document,async(url)=>String(url).endsWith('/ping')?{ok:true,json:async()=>({app:'pdf-desktop-1'})}:{status:403});
 const button=dom.window.document.querySelector('button');await button.onclick();assert.equal(button.disabled,false);assert.equal(warned,true);assert.equal(dom.window.document.querySelector('button'),button);
});
test('Abrir con entrega nombre y bytes al visor y elimina el identificador del historial',async()=>{
 const dom=page(local+'#open='+'b'.repeat(32)),bytes=new TextEncoder().encode('%PDF-1.7\nfixture').buffer;let received;
 dom.window.addEventListener('pdf-desktop-open',e=>{received=e.detail.file;});
 await bindDesktop(dom.window,dom.window.document,async(url,options)=>{
  if(String(url).endsWith('/ping'))return {ok:true,json:async()=>({app:'pdf-desktop-1'})};
  assert.equal(String(url),local+'_desktop/document/'+'b'.repeat(32));assert.equal(options.headers['X-PDF-Local'],'1');
  return {ok:true,headers:{get:()=>encodeURIComponent('Documento Muñoz.pdf')},arrayBuffer:async()=>bytes};
 });
 assert.equal(dom.window.location.hash,'');assert.equal(received.name,'Documento Muñoz.pdf');
 assert.equal(received.size,bytes.byteLength);assert.equal(await received.arrayBuffer(),bytes);
});
test('un documento caducado muestra cómo abrirlo otra vez y conserva la aplicación',async()=>{
 const dom=page(local+'#open='+'b'.repeat(32));let warning;dom.window.alert=message=>{warning=message;};
 await bindDesktop(dom.window,dom.window.document,async url=>String(url).endsWith('/ping')?{ok:true,json:async()=>({app:'pdf-desktop-1'})}:{ok:false,status:404});
 assert.match(warning,/Abrir con/);assert.equal(dom.window.location.hash,'');assert.equal(dom.window.document.querySelector('button').hidden,false);
});
