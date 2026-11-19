/* PTP release: mapa de jornadas e compatibilidade de navegação, sem fluxos demonstrativos. */
(function(){
'use strict';
const routes=[
 {title:'Começar e cadastrar',description:'Crie um único perfil e escolha as jornadas que deseja desenvolver.',links:[['Meu perfil geral','ecOnboard'],['Cadastrar mentor','ecMentorRegister'],['Cadastrar empresa','ecCompany'],['Cadastrar startup ou projeto','ecProject'],['Cadastrar currículo','ecTalent'],['Cadastrar comunidade','ecCommunityRegister']]},
 {title:'Publicar oportunidades',description:'Divulgue vagas, desafios e programas com as opções de visibilidade de cada ficha.',links:[['Cadastrar vaga','ecNewJob'],['Cadastrar desafio','ecNewChallenge'],['Vitrine de Vagas','ecJobs'],['Vitrine de Desafios','ecChallenges']]},
 {title:'Encontrar pessoas e organizações',description:'Consulte somente fichas públicas e utilize os canais profissionais escolhidos pelos titulares.',links:[['Matchmaking 360°','ecNetworking'],['Vitrine de Talentos','ecTalentDirectory'],['Empresas','ecCompaniesDirectory'],['Startups e Projetos','ecProjects'],['Mentores','fxMentors'],['Comunidades','ecCommunitiesDirectory']]},
 {title:'Desenvolver e acompanhar',description:'Explore programas, materiais e oportunidades de apoio; rascunhos locais são identificados como tal.',links:[['Meu centro de gestão','ecCenter'],['NEXT','ecNext'],['Escola de Inovadores','ecEscola'],['Mentoria NEXT','mentor'],['Biblioteca NEXT','library'],['Ideias para Inovar','ecPira']]}
];
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(){
 return '<section class="ec-section"><div class="ec-head"><div><div class="eyebrow">SUA JORNADA · PLATAFORMA DE INOVAÇÃO PTP</div><h2>Como usar a plataforma</h2><p>Uma identidade, diferentes formas de participar. Escolha o próximo passo, sem precisar procurar páginas ou realizar cadastros duplicados.</p></div></div>'+
 '<div class="ec-grid">'+routes.map((group,i)=>'<article class="ec-card"><span class="ec-tag">ETAPA '+(i+1)+'</span><h3>'+escape(group.title)+'</h3><p>'+escape(group.description)+'</p><div class="ec-actionrow" style="display:flex;flex-wrap:wrap;gap:9px">'+group.links.map(([title,route])=>'<button class="btn outline" type="button" onclick="setView('+JSON.stringify(route).replace(/"/g,'&quot;')+')">'+escape(title)+' →</button>').join('')+'</div></article>').join('')+'</div>'+
 '<p class="v16-helper" style="margin-top:15px">A publicação em vitrines depende da opção de visibilidade definida na ficha. Dados e documentos pessoais não são exibidos publicamente. A conexão direta utiliza o canal profissional disponibilizado pelo participante; mensagens privadas entre contas e alertas de e-mail ainda não estão habilitados.</p></section>';
}
function install(){
 if(typeof EC_VIEWS==='undefined'||typeof window.setView!=='function'){setTimeout(install,150);return}
 EC_VIEWS.ecGuide=page;
 const redirects={community:'ecCommunitiesDirectory',programsDemo:'ecNext',dashboard:'ecCenter',v7growth:'ecCenter',v7talents:'ecTalentDirectory',profileDemo:'ecOnboard'};
 const standalone=new Set(['home','mentor','library','workspace','journey','ecRegistrationHub','ecMyRegistrations']);
 const restricted=new Set(['ecAdmin','v33Command','admin','review','alerts','modSocial','milestones']);
 const available=key=>!restricted.has(key)&&(standalone.has(key)||Object.hasOwn(EC_VIEWS,key));
 let restoring=false;
 if(!window.setView.__ptpReleaseNavigation){
  const previous=window.setView;
  const next=function(key){
   const route=redirects[key]||key,result=previous.call(this,route);
   if(!restoring&&available(route)&&typeof state!=='undefined'&&state.view===route&&location.hash!=='#'+route){history.pushState(null,'',location.pathname+location.search+'#'+route);}
   return result;
  };
  next.__ptpReleaseNavigation=true;window.setView=next;
 }
 const restore=()=>{
  let key;try{key=decodeURIComponent(location.hash.slice(1));}catch{return;}
  const route=redirects[key]||key;if(!available(route)||typeof state!=='undefined'&&state.view===route)return;
  restoring=true;try{window.setView(route);}finally{restoring=false;}
 };
 window.addEventListener('popstate',restore);window.addEventListener('hashchange',restore);
 if(location.hash==='#ecGuide')window.setView('ecGuide');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
