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
// Windows ICO container; keep the existing PNG icon pixels unchanged.
const sizes=[32,192],images=await Promise.all(sizes.map(size=>readFile(new URL(`../dist/icons/pdf-${size}.png`,import.meta.url))));
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
images.forEach((bytes,i)=>{const at=6+16*i;header[at]=sizes[i];header[at+1]=sizes[i];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length;});
await writeFile(new URL('../dist/icons/pdf.ico',import.meta.url),Buffer.concat([header,...images]));
