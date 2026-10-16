const STORAGE_KEY='pdf-contigo-reading-v1';
const names=['large','contrast','motion'];
export function initReadingPreferences(doc=document,win=window){
 const status=doc.getElementById('reading-status');
 let saved;try{saved=JSON.parse(win.localStorage.getItem(STORAGE_KEY));}catch{}
 const apply=()=>{
  const preferences={};
  for(const name of names){const checked=doc.getElementById('reading-'+name).checked;preferences[name]=checked;doc.documentElement.toggleAttribute('data-reading-'+name,checked);}
  return preferences;
 };
 for(const name of names){
  const input=doc.getElementById('reading-'+name);input.checked=saved?.[name]===true;
  input.addEventListener('change',()=>{
   const preferences=apply();
   try{win.localStorage.setItem(STORAGE_KEY,JSON.stringify(preferences));status.textContent='Preferencias de lectura guardadas solo en este navegador.';}
   catch{status.textContent='Ajuste aplicado para esta visita. El navegador no permite guardarlo.';}
  });
 }
 apply();
 doc.getElementById('reading-reset').addEventListener('click',()=>{
  for(const name of names)doc.getElementById('reading-'+name).checked=false;
  apply();try{win.localStorage.removeItem(STORAGE_KEY);}catch{}
  status.textContent='Ajustes restablecidos. Se mantiene la preferencia de movimiento de tu sistema.';
 });
}
