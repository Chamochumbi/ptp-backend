/* PTP · Mentor NEXT: serviço generativo opcional + recuperação documental fundamentada */
(function(){
'use strict';
const API='https://ptp-api.onrender.com/api/mentor';
const esc=x=>String(x??'');
const norm=x=>esc(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const stop=new Set(['como','para','com','qual','quais','quero','preciso','devo','minha','meu','uma','uns','dos','das','sobre','essa','esse','fazer','projeto','startup']);
const words=x=>[...new Set(norm(x).match(/[a-z0-9]{3,}/g)||[])].filter(x=>!stop.has(x));
const links=[
 {topic:'financiamento fomento finep pesquisa financiamento',title:'Finep — Financiamento e inovação',url:'https://www.finep.gov.br/'},
 {topic:'pesquisa acadêmica fapesp ciência bolsas',title:'FAPESP — Programas e oportunidades',url:'https://fapesp.br/'},
 {topic:'embrapii tecnologia inovação parceria ict industria',title:'EMBRAPII — Cooperação tecnológica',url:'https://embrapii.org.br/'},
 {topic:'bndes crédito investimento negócios escala',title:'BNDES — Crédito e inovação',url:'https://www.bndes.gov.br/'},
 {topic:'agricultura agro validação campo pesquisa',title:'Embrapa — Pesquisa e tecnologias agropecuárias',url:'https://www.embrapa.br/'},
 {topic:'empreendedorismo canvas validação cliente negócio',title:'Sebrae — Empreendedorismo e startups',url:'https://sebrae.com.br/'},
 {topic:'lei bem incentivos fiscais políticas inovação',title:'MCTI — Ciência, tecnologia e inovação',url:'https://www.gov.br/mcti/pt-br'}
];
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['drive.google.com','docs.google.com','fapesp.br','www.fapesp.br','www.finep.gov.br','embrapii.org.br','www.bndes.gov.br','www.embrapa.br','sebrae.com.br','www.gov.br'].includes(u.hostname)?u.href:''}catch{return ''}};
const sources=question=>{
 const q=words(question);
 let docs=[];
 if(typeof demoMentorSearch==='function')try{docs=demoMentorSearch(question).filter(x=>safeUrl(x.url)).map(x=>({title:esc(x.title),url:safeUrl(x.url),axis:esc(x.axis),page:x.page,excerpt:esc(x.text||'').slice(0,300),kind:'Trecho documental indexado'}))}catch(e){console.warn('Busca documental NEXT:',e)}
 const known=typeof DEMO_LIBRARY!=='undefined'&&Array.isArray(DEMO_LIBRARY)?DEMO_LIBRARY:[];
 let catalog=known.map(x=>({x,score:q.reduce((sum,w)=>sum+(words([x.title,x.axis,x.note,x.collection].join(' ')).some(t=>t.startsWith(w.slice(0,5)))?1:0),0)})).filter(o=>o.score>0&&safeUrl(o.x.url)).sort((a,b)=>b.score-a.score).slice(0,8).map(({x})=>({title:esc(x.title),url:safeUrl(x.url),axis:esc(x.axis),excerpt:'',kind:'Material da Biblioteca NEXT'}));
 const matched=links.map(x=>({x,score:q.reduce((s,w)=>s+(words(x.topic).some(t=>t.startsWith(w.slice(0,5)))?1:0),0)})).filter(x=>x.score).sort((a,b)=>b.score-a.score).slice(0,3).map(({x})=>({title:x.title,url:x.url,axis:'Fonte institucional externa',excerpt:'',kind:'Referência para consulta externa'}));
 let used=new Set();return [...docs,...catalog,...matched].filter(x=>!used.has(x.url)&&(used.add(x.url),true)).slice(0,12);
};
function advice(question,focus){
 const topic=norm(question+' '+focus),field=/agro|fazenda|agric|pecu|lavoura|safra|produtor|usina|sistema de producao/.test(topic);
 const customer=field?'produtores, cooperativas ou equipes operacionais do sistema de produção':'usuários, clientes e instituições demandantes';
 const first=/pitch|apresent|investid/.test(topic)?'Estruture uma narrativa de problema, evidência, solução, mercado, tração e pedido concreto.':/mvp|produto|prot(o|ó)tipo/.test(topic)?'Defina a menor experiência ou protótipo capaz de medir a hipótese central com usuários reais.':/finan|fomento|editais|investi/.test(topic)?'Identifique o estágio de maturidade e requisitos de elegibilidade antes de escolher instrumentos de capital ou fomento.':'Especifique o problema real, quem o enfrenta e como ele é medido antes de propor a solução.';
 return 'ROTEIRO ORIENTATIVO · SEM GERAÇÃO DE MODELO\n\nFoco informado: '+focus+'.\n\n1. Diagnóstico: '+first+'\n\n2. Evidência e descoberta: entreviste representantes de '+customer+' e registre comportamentos, processos atuais, custos e restrições.\n\n3. Experimento: formule uma hipótese falseável, um indicador-base, um grupo de teste e uma janela de avaliação. Evite assumir que interesse equivale a adoção.\n\n4. Validação: documente condições técnicas, econômicas, organizacionais e regulatórias. '+(field?'Considere sazonalidade, local de teste, logística, integração com processos produtivos e diferenças entre sistemas de produção.':'Considere privacidade, acessibilidade, operação e integração com fluxos existentes.')+'\n\n5. Próximos passos: elabore um plano de duas semanas contendo responsável, métrica de sucesso, orçamento, risco principal e decisão após o piloto.\n\n6. Apoio: consulte os materiais relacionados abaixo e aprofunde as hipóteses com mentores e atores do ecossistema PTP.\n\nEste roteiro é uma organização metodológica de apoio, não uma resposta generativa nem uma validação automática de resultados.';
}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
function show(target,answer,refs,mode,error){
 target.replaceChildren();
 const outer=el('section',undefined,'panel'),k=el('div',mode==='ia'?'RESPOSTA GERADA POR IA · NEXT / PTP':'ORIENTAÇÃO DOCUMENTAL · NEXT / PTP','eyebrow'),h=el('h3',mode==='ia'?'Orientação do Mentor NEXT IA':'Roteiro de orientação e fontes');outer.append(k,h);
 if(error)outer.append(el('p',error));
 const body=el('div',answer);body.style.whiteSpace='pre-wrap';body.style.lineHeight='1.7';outer.append(body);
 if(refs.length){outer.append(el('h3','Materiais de apoio e referências'));for(const ref of refs){const a=el('a',ref.title+(ref.page?' · p./seção '+ref.page:'')+' ↗','source-card');a.href=ref.url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='block';a.style.marginTop='9px';outer.append(a);if(ref.excerpt){const quote=el('p',ref.excerpt);quote.style.fontSize='12px';quote.style.color='#59746b';outer.append(quote)}}}
 outer.append(el('small',mode==='ia'?'Resposta gerada pelo serviço de IA. Referências recomendadas são exibidas separadamente; não representam citações comprovadas pelo modelo.':'O serviço generativo não foi confirmado nesta consulta. As referências de leitura não significam que os documentos tenham sido examinados integralmente.'));target.append(outer);
}
const previous=typeof demoMentor==='function'?demoMentor:null;
if(previous){
 demoMentor=function(){let html=previous();html=html.replace('Consultar acervo →','Perguntar ao Mentor NEXT →').replace('onclick="askDemoMentor()"','onclick="PTPMentor.perguntar()"');html=html.replace('Na versão de servidor, o Mentor exige correspondência documental e confere citações literais antes de exibir interpretações da IA. As recomendações se baseiam em referências documentais da Biblioteca NEXT e incluem links para consulta. Na aplicação de servidor, após configuração da credencial e consentimento, o Mentor produz uma resposta conversacional e só aceita citações verificadas nos materiais indexados. Se o acervo não sustentar a pergunta, não inventará fontes.','O Mentor combina orientação metodológica, referências da Biblioteca NEXT e fontes externas institucionais. Respostas generativas são identificadas separadamente e dependem da disponibilidade do serviço de IA.');html=html.replace('O link fornecido é o catálogo-mestre. Nesta versão, são mostradas referências da Biblioteca NEXT para consulta e aprofundamento. A resposta de um modelo de IA externo exige implantação com credenciais seguras.','As fontes indicadas são materiais recomendados. Trechos efetivamente indexados são identificados; referências externas exigem consulta aos originais. A geração por IA requer confirmação do servidor.');return html}
}
let loading=false;
window.PTPMentor={perguntar:async function(){
 if(loading)return;const question=document.getElementById('mentor-question')?.value?.trim()||'',target=document.getElementById('mentor-answer'),focus=document.getElementById('demo-mentor-focus')?.value||'Mentor NEXT';if(!target)return;if(question.length<10){target.textContent='Descreva sua pergunta com pelo menos dez caracteres.';return}
 const refs=sources(question),btn=document.querySelector('button[onclick="PTPMentor.perguntar()"]');loading=true;if(btn)btn.disabled=true;target.textContent='Buscando evidências e consultando o serviço de orientação…';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const payload={question:question.slice(0,2500),focus,sources:refs.map(x=>({title:x.title,url:x.url,axis:x.axis,note:x.excerpt.slice(0,240)}))};
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
  const data=await r.json().catch(()=>({}));if(!r.ok||typeof data.answer!=='string'||data.answer.trim().length<35)throw Error('O serviço não confirmou uma resposta generativa.');
  show(target,data.answer.slice(0,10000),refs,'ia','');
 }catch(e){show(target,advice(question,focus),refs,'fallback','Não foi possível confirmar geração de IA ao vivo nesta consulta. O roteiro abaixo não é apresentado como resposta de um modelo.')}
 finally{clearTimeout(timeout);loading=false;if(btn)btn.disabled=false}
}};
})();