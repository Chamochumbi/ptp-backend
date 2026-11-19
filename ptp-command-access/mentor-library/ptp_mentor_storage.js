/* Local account partitioning, not a server authorization or encrypted vault. */
(function(){
  'use strict';
  const listeners=new Set();
  function identity(){
    try {
      const account=window.PTPConta, status=account?.estado?.();
      if(!status||status.carregando)return 'pending';
      if(!status.autenticado)return 'visitor';
      const id=account.memberId?.();
      if(!account.token?.()||typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return 'locked';
      return 'member:'+id;
    }catch{return 'locked';}
  }
  let context=identity(), generation=0;
  function refresh(){
    const next=identity();if(next===context)return false;
    context=next;generation++;
    for(const fn of listeners)fn();
    if(typeof state!=='undefined'&&state.view==='mentor'&&typeof render==='function')render();
    return true;
  }
  function open(base,temporary=false){
    const captured=context, epoch=generation;
    const key=captured==='visitor'?base:base+':'+captured;
    function check(){refresh();if(epoch!==generation||captured==='pending'||captured==='locked')throw Error('O contexto da conta mudou ou ainda não foi confirmado.');}
    return {get(){check();return (temporary?sessionStorage:localStorage).getItem(key);},set(value){check();(temporary?sessionStorage:localStorage).setItem(key,value);}};
  }
  function message(){
    if(context==='pending')return 'Confirmando sua conta. Aguarde para recuperar ou salvar registros.';
    if(context==='locked')return 'A sessão precisa ser renovada. Entre novamente para recuperar seus registros.';
    if(context==='visitor')return 'Modo visitante: os registros são compartilhados por quem usa este navegador. Entre com sua conta para manter um histórico separado.';
    return 'Registros separados para esta conta neste navegador. Ainda não há sincronização entre dispositivos.';
  }
  window.PTPMentorStorage={open,refresh,message,context:()=>context,epoch:()=>generation,onChange:fn=>listeners.add(fn),ready:()=>context==='visitor'||context.startsWith('member:')};
  document.addEventListener('ptp:member-auth-state',refresh);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener?.('focus',refresh);
  window.addEventListener?.('pageshow',refresh);
  // SDK expiration can clear the token without emitting the profile event.
  if(typeof setInterval==='function')setInterval(refresh,2000);
})();
