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
// Standard Windows sizes. DIB at small sizes supports legacy shell readers;
// 256px PNG keeps the large icon sharp without increasing the package much.
const sizes=[16,24,32,48,64,128,256],images=[];
for(const size of sizes){
 const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');ctx.drawImage(await loadImage(Buffer.from(svg)),0,0,size,size);
 if(size===256){images.push(canvas.toBuffer('image/png'));continue;}
 const pixels=ctx.getImageData(0,0,size,size).data,stride=Math.ceil(size/32)*4;
 const dib=Buffer.alloc(40+size*size*4+stride*size);
 dib.writeUInt32LE(40,0);dib.writeInt32LE(size,4);dib.writeInt32LE(size*2,8);dib.writeUInt16LE(1,12);dib.writeUInt16LE(32,14);dib.writeUInt32LE(size*size*4,20);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const src=(y*size+x)*4,dst=40+((size-1-y)*size+x)*4;
  dib[dst]=pixels[src+2];dib[dst+1]=pixels[src+1];dib[dst+2]=pixels[src];dib[dst+3]=pixels[src+3];
  if(pixels[src+3]===0)dib[40+size*size*4+(size-1-y)*stride+(x>>3)]|=128>>(x%8);
 }
 images.push(dib);
}
const header=Buffer.alloc(6+16*images.length);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);let offset=header.length;
images.forEach((bytes,i)=>{const at=6+16*i;header[at]=sizes[i]===256?0:sizes[i];header[at+1]=header[at];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length;});
await writeFile(new URL('../dist/icons/pdf.ico',import.meta.url),Buffer.concat([header,...images]));
