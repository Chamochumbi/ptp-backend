export const OWNER_ID='1a825376-fa27-48c6-9e81-3b7bd0ad8bed';
export const OWNER_EMAIL='parquetecnologicopiracicaba@gmail.com';
export const SOURCES=[
 ['PTPEnviosEcossistema','Inscrições do ecossistema'],
 ['PTPPerfisUsuarios','Perfis de participantes'],
 ['PTPVitrinesPublicas','Vitrine pública'],
 ['PTPProjetosComunidade','Projetos da comunidade'],
 ['PTPDesafiosComunidade','Desafios da comunidade'],
 ['PTPOportunidadesComunidade','Oportunidades da comunidade'],
 ['PTPInteracoesPublicas','Interações públicas'],
 ['PTPRegistrosMembros','Histórico de atividades'],
 ['PTPOrganizacoes','Organizações institucionais'],
 ['PTPPerfis','Perfis institucionais'],
 ['PTPProjetos','Projetos institucionais'],
 ['PTPDesafios','Desafios institucionais'],
 ['PTPVagas','Vagas'],
 ['PTPMentoresPublicos','Mentores'],
 ['PTPMentorias','Mentorias'],
 ['PTPConexoes','Conexões'],
 ['PTPSolicitacoesPublicas','Solicitações'],
 ['PTPPrivateMessages','Mensagens privadas'],
 ['PTPNotificationSubscribers','Preferências de notificações'],
 ['PTPNotificationDeliveries','Entregas de notificações'],
 ['PTPAuditoria','Auditoria']
];
export function authorized(member){return member?.id===OWNER_ID&&String(member.loginEmail||'').trim().toLowerCase()===OWNER_EMAIL&&member.loginEmailVerified===true&&member.status==='APPROVED';}
export function dateValue(value){const d=new Date(value?.$date??value??'');return Number.isFinite(d.getTime())?d:null;}
export function created(row){return dateValue(row.data?._createdDate??row.createdDate);}
export function parseJSON(value){if(typeof value!=='string')return value;try{return JSON.parse(value);}catch{return value;}}
export function nameOf(row){return String(row.data?.name||row.data?.nome||row.data?.title||row.data?.titulo||'Sem título');}
export function statusOf(row,source,published){if(source==='PTPEnviosEcossistema'&&published?.has(row.id))return 'Na vitrine';return String(row.data?.status|| (source==='PTPPerfisUsuarios'?'Perfil cadastrado':source==='PTPRegistrosMembros'?'Histórico':'Sem situação'));}
export function groupCount(rows,field){const result=new Map();for(const r of rows){const raw=r.data?.[field];const name=typeof raw==='string'&&raw.trim()?raw.trim():'Não informado';result.set(name,(result.get(name)||0)+1);}return [...result].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));}
export function filterRows(rows,{source,search='',status='',days=0,published,now=Date.now()}){const q=search.toLocaleLowerCase('pt-BR').trim();return rows.filter(r=>{const d=r.data||{};return (!q||[nameOf(r),d.email,d.cidade,r.id,d.categoria,d.kind].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(q)))&&(!status||statusOf(r,source,published)===status)&&(!days||(created(r)&&created(r).getTime()>=now-days*86400000));}).sort((a,b)=>(created(b)?.getTime()||0)-(created(a)?.getTime()||0));}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function trend(rows,now=new Date()){const day=d=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);const end=day(now),anchor=new Date(end+'T12:00:00-03:00'),buckets=new Map();for(let i=29;i>=0;i--)buckets.set(day(new Date(+anchor-i*86400000)),0);for(const row of rows){const d=created(row);if(d&&buckets.has(day(d)))buckets.set(day(d),buckets.get(day(d))+1);}return [...buckets];}
export async function readPages(query,source,limit=100,cap=20000){const items=[],seen=new Set();let total=null;for(let offset=0;offset<cap;offset+=limit){const result=await query(source,limit,offset);if(!Array.isArray(result.dataItems))throw new Error('Resposta de dados inválida');const page=result.dataItems;const meta=result.pagingMetadata||{};if(Number.isFinite(meta.total))total=meta.total;for(const row of page){if(!row.id||seen.has(row.id))continue;seen.add(row.id);items.push(row);}const more=meta.hasNext===true||(meta.hasNext!==false&&page.length===limit&&(total===null||offset+page.length<total));if(!more)return {items,total:total??items.length,complete:!meta.tooManyToCount&&(total===null||items.length===total)};if(!page.length)throw new Error('Paginação interrompida');}return {items,total,complete:false};}

