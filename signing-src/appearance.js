import {PDFDocument,StandardFonts,rgb,PDFName} from 'pdf-lib';

function geometry(page){
 const c=page.getCropBox(),angle=((page.getRotation().angle%360)+360)%360;
 if(![0,90,180,270].includes(angle))throw new Error('El giro de esta página no es compatible con la firma visible.');
 return {angle,width:angle%180?c.height:c.width,height:angle%180?c.width:c.height,
  map:(x,y)=>angle===90?[c.x+c.width-y,c.y+x]:angle===180?[c.x+c.width-x,c.y+c.height-y]:angle===270?[c.x+y,c.y+c.height-x]:[c.x+x,c.y+y]};
}
function wrap(text,font,size,width){
 const lines=[];let line='';
 for(const character of text){
  if(font.widthOfTextAtSize(line+character,size)>width&&line){lines.push(line.trim());line=character;}else line+=character;
 }
 if(line.trim())lines.push(line.trim());return lines;
}
export async function signatureAppearance(doc,page,options,info,time,reason){
 const r={x:Number(options.x??10),y:Number(options.y??72),w:Number(options.w??65),h:Number(options.h??20)};
 if(Object.values(r).some(n=>!Number.isFinite(n))||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>100||r.y+r.h>100)throw new Error('La zona de firma debe quedar dentro de la página.');
 const g=geometry(page),width=g.width*r.w/100,height=g.height*r.h/100;
 if(width<150||height<64)throw new Error('Amplía la zona de firma para que el nombre y la fecha sean legibles.');
 const stamp=await PDFDocument.create(),p=stamp.addPage([width,height]);
 const regular=await stamp.embedFont(StandardFonts.Helvetica),bold=await stamp.embedFont(StandardFonts.HelveticaBold);
 const date=time.toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC');
 const rows=[['FIRMADO DIGITALMENTE',bold],[info.signerName,bold],...(info.organization?[[info.organization,regular]]:[]),[date,regular],...(reason?[[reason,regular]]:[])];
 for(const [text,font]of rows){try{font.encodeText(text);}catch{throw new Error('El nombre del certificado contiene caracteres que esta apariencia no puede representar. Desactiva «Mostrar firma en la página» para conservar el nombre completo en la firma criptográfica.');}}
 let size=11,lines;
 for(;size>=7;size-=.5){lines=rows.flatMap(([text,font])=>wrap(text,font,size,width-24).map(text=>({text,font})));if(lines.length*size*1.25<=height-20)break;}
 if(size<7)throw new Error('Amplía la zona de firma para que quepan los datos del certificado.');
 p.drawRectangle({x:0,y:0,width,height,color:rgb(1,1,1),borderColor:rgb(.72,.72,.72),borderWidth:.6});
 p.drawRectangle({x:0,y:0,width:3,height,color:rgb(.78,.17,.20)});
 let y=(height+lines.length*size*1.25)/2-size;for(const {text,font}of lines){p.drawText(text,{x:12,y,size,font,color:rgb(.15,.15,.15)});y-=size*1.25;}
 await stamp.flush();
 const embedded=await doc.embedPage(p);await embedded.embed();
 const matrices={0:[1,0,0,1,0,0],90:[0,1,-1,0,height,0],180:[-1,0,0,-1,width,height],270:[0,-1,1,0,0,width]};
 doc.context.lookup(embedded.ref).dict.set(PDFName.of('Matrix'),doc.context.obj(matrices[g.angle]));
 const left=g.width*r.x/100,bottom=g.height*(1-(r.y+r.h)/100),corners=[g.map(left,bottom),g.map(left+width,bottom),g.map(left,bottom+height),g.map(left+width,bottom+height)];
 return {ref:embedded.ref,rect:[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))]};
}
