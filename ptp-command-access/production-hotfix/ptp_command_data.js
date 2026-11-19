import {authorized,readPages} from './ptp_command_model.js?v=20261113-session5';

// The browser identity check improves UX. CMS permissions enforce data access.
export async function verifyOwnerAccess(api) {
  const member=await api.myMember();
  if(!authorized(member))throw Object.assign(new Error('Esta conta não está autorizada a acessar a gestão da plataforma.'),{status:403,code:'OWNER_REQUIRED'});
  const token=await api.validMemberToken();
  if(!token)throw Object.assign(new Error('Sua sessão expirou. Entre novamente.'),{status:401});
  // This collection is CMS_EDITOR with an explicit owner grant. Unlike a
  // member-author collection, it cannot return another member's own rows.
  // Querying it also works when empty; no admin-only permissions API is needed.
  const result=await api.request('/data/v2/items/query',{
    method:'POST',token,
    body:{dataCollectionId:'PTPRegistrosMembros',query:{paging:{limit:1,offset:0}}}
  });
  if(!Array.isArray(result.dataItems))throw new Error('O serviço retornou uma resposta de autorização inválida.');
  return member;
}

export function accessRevoked(error) {
  return error?.status===401 || (error?.status===403 && ['owner_required','OWNER_REQUIRED'].includes(error.code));
}

export async function loadSources(ids,{query,isCurrent=()=>true,onProgress=()=>{},concurrency=4}) {
  const results=new Array(ids.length);
  let next=0,completed=0,revoked=false;
  async function worker() {
    while(!revoked&&isCurrent()) {
      const index=next++;
      if(index>=ids.length)return;
      try {
        const value=await readPages(async(...args)=>{
          if(revoked||!isCurrent())throw Object.assign(new Error('Consulta cancelada'),{code:'CANCELLED'});
          return query(...args);
        },ids[index]);
        results[index]={status:'fulfilled',value:{...value,checkedAt:Date.now()}};
      }catch(reason){results[index]={status:'rejected',reason};if(accessRevoked(reason))revoked=true;}
      if(!isCurrent())return;
      completed++;
      onProgress({completed,total:ids.length,id:ids[index],result:results[index]});
    }
  }
  await Promise.allSettled(Array.from({length:Math.max(1,Math.min(4,concurrency,ids.length))},worker));
  return results;
}

export function publicationIndex(entry) {
  // An incomplete public list must never classify a published item as pending.
  return entry?.complete?new Set(entry.items.filter(r=>r.data?.status==='Publicado').map(r=>r.id)):null;
}
