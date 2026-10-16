import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {initReadingPreferences} from '../dist/accessibility.js';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
test('preferencias de lectura se aplican, restauran y borran sin guardar otros datos',()=>{
 const dom=new JSDOM(html,{url:'https://pdf.example/'}),{document}=dom.window;
 dom.window.localStorage.setItem('pdf-contigo-reading-v1',JSON.stringify({large:true,unexpected:'do not keep'}));
 initReadingPreferences(document,dom.window);
 assert.equal(document.getElementById('reading-large').checked,true);assert.equal(document.documentElement.hasAttribute('data-reading-large'),true);
 const contrast=document.getElementById('reading-contrast');contrast.checked=true;contrast.dispatchEvent(new dom.window.Event('change'));
 assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('pdf-contigo-reading-v1')),{large:true,contrast:true,motion:false});
 document.getElementById('reading-reset').click();assert.equal(dom.window.localStorage.length,0);assert.equal(document.documentElement.hasAttribute('data-reading-large'),false);assert.equal(contrast.checked,false);
 dom.window.close();
});
test('lectura cómoda funciona aunque el navegador bloquee el almacenamiento',()=>{
 const dom=new JSDOM(html),{document}=dom.window;
 initReadingPreferences(document,dom.window);const motion=document.getElementById('reading-motion');motion.checked=true;motion.dispatchEvent(new dom.window.Event('change'));
 assert.equal(document.documentElement.hasAttribute('data-reading-motion'),true);assert.match(document.getElementById('reading-status').textContent,/esta visita/);
 assert.equal(document.querySelector('a.skip').hash,'#main');assert.equal(document.getElementById('main').tabIndex,-1);
 assert.ok(document.getElementById('progress').getAttribute('aria-label'));
 for(const id of ['reading-large','reading-contrast','reading-motion'])assert.ok(document.getElementById(id).labels.length);
 dom.window.close();
});
