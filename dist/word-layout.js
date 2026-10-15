import {openRenderedPdf,pageCanvas,canvasBlob} from './render.js';
import {pageRange,stem} from './core.js';
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const twips=n=>Math.round(n*20);
function run(part){return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${Math.round(Math.max(6,Math.min(48,part.size))*2)}"/>${part.bold?'<w:b/>':''}${part.italic?'<w:i/>':''}</w:rPr><w:t xml:space="preserve">${xml(part.text)}</w:t></w:r>`;}
function paragraph(parts,space=0){return `<w:p><w:pPr><w:spacing w:before="${twips(Math.min(30,Math.max(0,space)))}" w:after="0"/><w:keepLines/></w:pPr>${parts.map(run).join('')}</w:p>`;}
export function layoutLines(content,viewport){
 const pieces=content.items.filter(i=>'str'in i&&i.str.trim()).map(i=>{
  const [x,y]=viewport.convertToViewportPoint(i.transform[4],i.transform[5]),style=content.styles[i.fontName]||{};
  return {text:i.str,x,y,width:Math.abs(i.width),size:Math.max(6,Math.hypot(i.transform[2],i.transform[3])||i.height||12),bold:/bold|black|heavy/i.test(i.fontName+' '+(style.fontFamily||'')),italic:/italic|oblique/i.test(i.fontName+' '+(style.fontFamily||''))};
 }).sort((a,b)=>a.y-b.y||a.x-b.x);
 const lines=[];for(const p of pieces){let line=lines.findLast(l=>Math.abs(l.y-p.y)<=Math.max(2,Math.min(l.size,p.size)*.25));if(!line){line={y:p.y,size:p.size,parts:[]};lines.push(line);}line.parts.push(p);line.size=Math.max(line.size,p.size);}
 for(const line of lines){line.parts.sort((a,b)=>a.x-b.x);line.cells=[];let previous;
  for(const p of line.parts){const gap=previous?p.x-previous.x-previous.width:Infinity;
   if(!previous||gap>Math.max(14,line.size*1.4))line.cells.push({x:p.x,parts:[{...p}]});
   else{const cell=line.cells.at(-1);if(gap>1&&!/\s$/.test(cell.parts.at(-1).text)&&!/^\s/.test(p.text))cell.parts.push({...p,text:' '});cell.parts.push({...p});}
   previous=p;
  }
 }
 return lines;
}
function tableEnd(lines,start){
 const first=lines[start];if(first.cells.length<2||first.cells.length>8)return start;
 let end=start+1;while(end<lines.length){const row=lines[end],before=lines[end-1];if(row.y-before.y>Math.max(32,before.size*3)||row.cells.length!==first.cells.length||row.cells.some((c,i)=>Math.abs(c.x-first.cells[i].x)>12))break;end++;}
 // Do not turn ordinary multi-column prose into a table.
 if(end-start<3)return start;
 const short=lines.slice(start,end).every(r=>r.cells.every(c=>c.parts.map(p=>p.text).join('').length<=90));return short?end:start;
}
export function editablePage(lines,width){
 let output='',previousY=0,tables=0;
 for(let i=0;i<lines.length;){const end=tableEnd(lines,i);
  if(end>i){const first=lines[i],left=first.cells[0].x,available=Math.max(100,width-left-36),positions=first.cells.map(c=>c.x),widths=positions.map((x,n)=>Math.max(30,(positions[n+1]??left+available)-x));
   output+=`<w:tbl><w:tblPr><w:tblW w:w="${twips(available)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="B8B8B8"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${twips(w)}"/>`).join('')}</w:tblGrid>`;
   for(let row=i;row<end;row++)output+=`<w:tr>${lines[row].cells.map((c,col)=>`<w:tc><w:tcPr><w:tcW w:w="${twips(widths[col])}" w:type="dxa"/></w:tcPr>${paragraph(c.parts)}</w:tc>`).join('')}</w:tr>`;
   output+='</w:tbl><w:p/>';tables++;previousY=lines[end-1].y;i=end;
  }else{const line=lines[i];const parts=line.cells.flatMap((c,n)=>n?[{text:'   ',size:line.size},...c.parts]:c.parts);output+=paragraph(parts,previousY?line.y-previousY-line.size:0);previousY=line.y;i++;}
 }
 return {xml:output,tables};
}
function imageParagraph(id,width,height){const cx=Math.round(width*12700),cy=Math.round(height*12700);return `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Página ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Página ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;}
const section=(w,h,visual)=>`<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="${twips(w)}" w:h="${twips(h)}"/><w:pgMar w:top="${visual?0:720}" w:right="${visual?0:720}" w:bottom="${visual?0:720}" w:left="${visual?0:720}" w:header="0" w:footer="0"/></w:sectPr>`;
export async function layoutWord(file,opts,progress=()=>{},extra={},Zip=globalThis.JSZip){
 const mode=opts.wordmode||'editable';if(!['editable','visual'].includes(mode))throw new Error('Selecciona el modo de conversión a Word.');const visual=mode==='visual',doc=await openRenderedPdf(file.bytes,extra),z=new Zip();
 try{const selected=pageRange(opts.range,doc.numPages);if(selected.length>80)throw new Error('Selecciona hasta 80 páginas por conversión a Word.');let body='',tables=0,text='',rels='',previousSection='',totalBytes=0;
  for(let index=0;index<selected.length;index++){
   const number=selected[index]+1,page=await doc.getPage(number),viewport=page.getViewport({scale:1});
   if(previousSection)body+='<w:p><w:pPr>'+previousSection+'</w:pPr></w:p>';
   const w=Math.max(144,Math.min(1584,viewport.width)),h=Math.max(144,Math.min(1584,viewport.height));previousSection=section(w,h,visual);
   if(visual){const r=await pageCanvas(doc,number-1,1.5);try{const bytes=new Uint8Array(await(await canvasBlob(r.canvas,'image/jpeg',.9)).arrayBuffer());totalBytes+=bytes.length;if(totalBytes>80*1024*1024)throw new Error('El Word de imágenes supera 80 MB. Selecciona menos páginas.');const id=index+1;z.file(`word/media/page-${id}.jpg`,bytes);rels+=`<Relationship Id="image${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page-${id}.jpg"/>`;const scale=Math.min(w/viewport.width,(h-6)/viewport.height);body+=imageParagraph(id,viewport.width*scale,viewport.height*scale);}finally{r.canvas.width=r.canvas.height=0;r.page.cleanup();}}
   else{const content=await page.getTextContent();const lines=layoutLines(content,viewport);if(!lines.length)throw new Error(`La página ${number} no tiene texto seleccionable. Aplica OCR o elige conservar aspecto como imágenes.`);const converted=editablePage(lines,w-36);body+=converted.xml;tables+=converted.tables;text+=`Página ${number}\n`+lines.map(l=>l.cells.map(c=>c.parts.map(p=>p.text).join('')).join(' | ')).join('\n')+'\n\n';page.cleanup();}
   progress((index+1)/selected.length,`Preparando Word: página ${index+1} de ${selected.length}`);
  }
  z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="office" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}${previousSection}</w:body></w:document>`);
  return [{bytes:await z.generateAsync({type:'uint8array',compression:'DEFLATE'}),name:`${stem(file.name)}-${visual?'aspecto':'editable'}.docx`,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',preview:visual?'':text.slice(0,22000),sourcePdf:visual?file:undefined,note:visual?'Word con una imagen por página: conserva el aspecto del PDF; el texto y las tablas no son editables.':`Word editable con tamaños de texto y ${tables} tablas sencillas detectadas. Revisa columnas, tablas y saltos de página en Word. No reconstruye imágenes ni garantiza el diseño original.`}];
 }finally{await doc.destroy();}
}
