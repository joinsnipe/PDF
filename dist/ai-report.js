import {coverageText,itemCitations} from './ai-contract.js';

// Provider text never becomes HTML, URLs or executable attributes.
export function renderAIReport(container,report,visitPage){
 container.replaceChildren();container.className='ai-report';
 const element=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
 if(report.documentType)container.append(element('p','Tipo de documento según la IA: '+report.documentType));
 const coverage=element('p',coverageText(report.coverage));coverage.className='ai-report-coverage';container.append(coverage);
 let section,group;
 for(const item of report.items){
  if(item.group!==group){group=item.group;section=document.createElement('section');section.append(element('h3',group));container.append(section);}
  const article=document.createElement('article');article.append(element('p',item.text));
  const details=document.createElement('details'),citations=itemCitations(item);
  details.append(element('summary','Ver respaldo en el PDF · '+[...new Set(citations.map(c=>'p. '+c.page))].join(', ')));
  for(const citation of citations){
   details.append(element('blockquote',citation.quote));const button=element('button','Abrir página '+citation.page);button.type='button';button.className='text-button';button.onclick=()=>visitPage(citation.page);details.append(button);
  }
  article.append(details);section.append(article);
 }
 if(report.items.length&&report.missing.length){const section=document.createElement('section');section.append(element('h3','Datos que la IA no ha identificado'),element('p','Comprueba si aparecen en el original.'));const list=document.createElement('ul');for(const text of report.missing)list.append(element('li',text));section.append(list);container.append(section);}
}
