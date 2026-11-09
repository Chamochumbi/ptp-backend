import {authorized,readPages} from './ptp_command_model.js?v=20261109-command4';

// Frontend identity is a UX guard; the backend verifies the member independently.
export async function verifyOwnerAccess(api) {
  const member=await api.myMember();
  if(!authorized(member))throw Object.assign(new Error('Esta conta não está autorizada a acessar a gestão da plataforma.'),{status:403,code:'OWNER_REQUIRED'});
  const result=await api.commandRequest('status');
  if(result.authorized!==true||result.memberId!==member.id)throw Object.assign(new Error('Não foi possível confirmar sua autorização.'),{status:403});
  return member;
}

export async function loadSources(ids,{query,isCurrent=()=>true,onProgress=()=>{},concurrency=4}) {
  const results=new Array(ids.length);
  let next=0,completed=0;
  async function worker() {
    while(isCurrent()) {
      const index=next++;
      if(index>=ids.length)return;
      try {
        const value=await readPages(async(...args)=>{
          if(!isCurrent())throw Object.assign(new Error('Consulta cancelada'),{code:'CANCELLED'});
          return query(...args);
        },ids[index]);
        results[index]={status:'fulfilled',value:{...value,checkedAt:Date.now()}};
      }catch(reason){results[index]={status:'rejected',reason};}
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
