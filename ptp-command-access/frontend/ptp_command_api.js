const ENDPOINT = 'https://ptp-command-access.onrender.com/api/command/';
const MESSAGES = {
  session_required:'Sua sessão expirou. Entre novamente.',
  owner_required:'Esta conta não está autorizada para o Centro de Comando.',
  service_not_configured:'O acesso gerencial aguarda a ativação da integração protegida. Sua conta foi reconhecida.',
  service_permission_denied:'A integração de gestão precisa ter sua permissão restabelecida.',
  rate_limited:'Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente.'
};
export function createCommandAPI({validMemberToken, sessionVersion = () => 0, logout = () => {}, fetchImpl = fetch}) {
  return async function commandRequest(action, body = {}) {
    if (!['status','query'].includes(action)) throw new Error('Operação inválida.');
    const epoch = sessionVersion();
    const current = () => {if(epoch !== sessionVersion())throw Object.assign(new Error('A sessão mudou. Valide o acesso novamente.'), {code:'SESSION_CHANGED'});};
    const token = await validMemberToken();
    current();
    if (!token) throw Object.assign(new Error(MESSAGES.session_required), {status:401, code:'session_required'});
    let response;
    try {
      response = await fetchImpl(ENDPOINT + action, {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:token},
        body:JSON.stringify(body), cache:'no-store', credentials:'omit', redirect:'error', signal:AbortSignal.timeout(45000)
      });
    } catch { current(); throw Object.assign(new Error('O serviço de gestão demorou a responder. Tente novamente.'), {status:503, code:'service_unavailable'}); }
    current();
    let result;
    try { result = await response.json(); } catch { current(); throw Object.assign(new Error('O serviço retornou uma resposta inválida.'), {status:502}); }
    current();
    if(response.status === 401)logout();
    if (!response.ok) throw Object.assign(new Error(MESSAGES[result?.error] || 'Não foi possível consultar a gestão. Tente novamente.'), {status:response.status, code:result?.error});
    if (!result || typeof result !== 'object')throw Object.assign(new Error('Resposta inválida do serviço.'), {status:502});
    if (action === 'status' ? result.authorized !== true || typeof result.memberId !== 'string' : !Array.isArray(result.dataItems)) throw Object.assign(new Error('Não foi possível confirmar a resposta do serviço.'), {status:502});
    return result;
  };
}
