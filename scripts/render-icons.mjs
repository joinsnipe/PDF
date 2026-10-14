import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,loadImage}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas':'@napi-rs/canvas');
const svg=await readFile(new URL('../dist/icon.svg',import.meta.url),'utf8');
for(const size of [32,192,512]){
 const c=createCanvas(size,size);c.getContext('2d').drawImage(await loadImage(Buffer.from(svg)),0,0,size,size);await writeFile(new URL(`../dist/icons/pdf-${size}.png`,import.meta.url),c.toBuffer('image/png'));
}
const mask=svg.replace('rx="112"','rx="0"');
const c=createCanvas(512,512);c.getContext('2d').drawImage(await loadImage(Buffer.from(mask)),0,0,512,512);await writeFile(new URL('../dist/icons/pdf-maskable-512.png',import.meta.url),c.toBuffer('image/png'));
