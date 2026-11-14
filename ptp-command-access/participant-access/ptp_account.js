/* PTP account interface. Credentials go only to the official member authentication API. */
import {accountAuth, accountVerification, accountPasswordReset, loginHostedAccount} from './js/wix.js?v=ptp-20261028-final';
let dialog;
const labels={login:'Entrar na Plataforma PTP',register:'Criar minha conta PTP',verify:'Confirmar meu e-mail',reset:'Recuperar minha senha'};
const errors={connectionUnavailable:'Não foi possível conectar ao serviço de acesso. Confira sua conexão e tente novamente.',serviceUnavailable:'O serviço de acesso não concluiu a solicitação. Tente novamente mais tarde.',sessionUnavailable:'Sua identidade foi validada, mas não foi possível iniciar a sessão. Tente entrar novamente.',tooManyAttempts:'Muitas tentativas de acesso. Aguarde antes de tentar novamente.',verificationExpired:'A confirmação expirou. Volte para Entrar e solicite um novo código.',invalidVerification:'Código inválido ou expirado. Confira o código de seis números no e-mail ou volte para Entrar e reinicie o acesso.',additionalVerification:'Sua conta precisa de uma verificação adicional para continuar.',invalidEmail:'Confira o e-mail e a senha informados.',invalidPassword:'Confira o e-mail e a senha informados.',invalidCredentials:'Confira o e-mail e a senha informados.',emailAlreadyExists:'Este e-mail já possui uma conta. Entre ou recupere sua senha.',resetPassword:'Recupere sua senha antes de entrar.',missingCaptchaToken:'A verificação de segurança é necessária. Use o acesso seguro para continuar.',invalidCaptchaToken:'A verificação de segurança não foi concluída.'};
export function openAccount(mode='login') {
 if(dialog?.open){dialog.querySelector('input')?.focus();return;}
 const previous=document.activeElement;
 dialog=document.createElement('dialog');
 dialog.setAttribute('aria-label','Conta Plataforma PTP');
 dialog.style.cssText='width:min(440px,calc(100vw - 32px));max-height:90dvh;overflow:auto;box-sizing:border-box;border:1px solid #bcd4c9;border-radius:20px;padding:28px;color:#174e43;background:#fff;box-shadow:0 24px 80px #12382d40;font-family:inherit;';
 dialog.addEventListener('close',()=>{dialog.remove();dialog=null;previous?.focus?.()},{once:true});
 document.body.appendChild(dialog);
 let email='',busy=false;
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 function render(next){
  mode=next;dialog.replaceChildren();
  const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.className='btn outline';close.style.cssText='float:right;padding:6px 10px;font-size:12px';close.onclick=()=>{if(!busy)dialog.close();};
  const h=document.createElement('h2');h.textContent=labels[mode];h.style.cssText='clear:both;padding-top:18px;margin:0 0 10px;font-size:24px';
  const p=document.createElement('p');p.textContent=mode==='verify'?'Informe o código recebido no seu e-mail.':mode==='reset'?'Enviaremos as orientações de recuperação para seu e-mail.':'Uma conta para seu perfil e todas as suas participações no ecossistema.';p.style.cssText='font-size:14px;line-height:1.6;color:#557168';
  const form=document.createElement('form');form.style.cssText='display:grid;gap:16px';
  function field(name,label,type,autocomplete){const wrap=document.createElement('label');wrap.textContent=label;wrap.style.cssText='display:grid;gap:6px;font-size:14px;font-weight:600';const input=document.createElement('input');input.name=name;input.type=type;input.autocomplete=autocomplete;input.required=true;input.style.cssText='box-sizing:border-box;width:100%;padding:12px;border:1px solid #bcd4c9;border-radius:9px;font:inherit;color:#174e43;background:#fff';wrap.appendChild(input);form.appendChild(wrap);return input;}
  if(mode==='verify'){const code=field('code','Código de confirmação','text','one-time-code');code.inputMode='numeric';code.pattern='[0-9]{6}';code.maxLength=6;}
  else {field('email','E-mail','email','username').value=email;if(mode!=='reset'){const pw=field('password','Senha','password',mode==='register'?'new-password':'current-password');if(mode==='register')pw.minLength=8;}}
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='margin:0;font-size:13px;line-height:1.5';
  const submit=document.createElement('button');submit.type='submit';submit.className='btn';submit.textContent=mode==='login'?'Entrar':mode==='register'?'Criar conta':mode==='verify'?'Confirmar e continuar':'Enviar orientações';
  const secure=document.createElement('button');secure.type='button';secure.className='btn outline';secure.textContent='Continuar com verificação de segurança';secure.hidden=true;secure.style.display='none';
  secure.onclick=async()=>{if(busy)return;busy=true;secure.disabled=true;try{await loginHostedAccount();}catch{status.textContent='Não foi possível abrir a verificação. Tente novamente.';}finally{busy=false;secure.disabled=false;}};
  form.append(status,submit,secure);
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||!form.reportValidity())return;busy=true;submit.disabled=true;status.textContent='Aguarde…';
   const values=new FormData(form);email=String(values.get('email')||email).trim();
   try{
    if(mode==='reset'){await accountPasswordReset(email);status.textContent='Se houver uma conta para este e-mail, você receberá as orientações de recuperação.';return;}
    const result=mode==='verify'?await accountVerification(String(values.get('code')||'').trim()):await accountAuth(mode,email,String(values.get('password')||''));
    const password=form.elements.namedItem('password');if(password)password.value='';
    if(result.state==='SUCCESS'){status.textContent='Identidade confirmada. Concluindo seu acesso…';}
    else if(result.state==='EMAIL_VERIFICATION_REQUIRED')render('verify');
    else if(result.state==='OWNER_APPROVAL_REQUIRED')status.textContent='Seu cadastro aguarda aprovação da gestão. Você poderá entrar após a aprovação.';
    else {status.textContent=errors[result.errorCode]||'Não foi possível concluir o acesso. Confira os dados e tente novamente.';secure.hidden=!['missingCaptchaToken','invalidCaptchaToken','additionalVerification'].includes(result.errorCode);secure.style.display=secure.hidden?'none':'';}
   }catch(error){status.textContent=errors[error.code]||'Não foi possível concluir o acesso. Tente novamente mais tarde.';}
   finally{const password=form.elements.namedItem('password');if(password)password.value='';busy=false;submit.disabled=false;}
  });
  const links=document.createElement('div');links.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin-top:18px';
  for(const [target,label] of (mode==='login'?[['register','Criar conta'],['reset','Esqueci minha senha']]:[['login','Já tenho conta · Entrar']])){
   const b=document.createElement('button');b.type='button';b.className='btn outline';b.style.cssText='font-size:12px;padding:8px 10px';b.textContent=label;b.onclick=()=>{if(!busy){email=String(form.elements.namedItem('email')?.value||email);render(target);dialog.querySelector('input')?.focus();}};links.appendChild(b);
  }
  dialog.append(close,h,p,form,links);
 }
 render(mode==='register'?'register':'login');dialog.showModal();dialog.querySelector('input')?.focus();
}
