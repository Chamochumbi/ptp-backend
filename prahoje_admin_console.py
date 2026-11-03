"""Pra Hj | isolated protected administrative routes."""
import os,time,hmac,hashlib,re
from urllib.parse import quote
from fastapi import Request, HTTPException, Depends
from fastapi.responses import HTMLResponse,JSONResponse
from pydantic import BaseModel
from prahoje_backend.app import APP,_wix,_query,_item_data

USER=os.getenv('ADMIN_LOGIN','')
PASS=os.getenv('ADMIN_SECRET','')
COOKIE='pra_hj_admin'
FORM_ID='cd2e856c-ff43-4e93-95af-45128253272d'

class Login(BaseModel):
    usuario:str
    senha:str

class Approval(BaseModel):
    organizadorId:str

def auth(req:Request):
    if not USER or not PASS:raise HTTPException(503,'Defina ADMIN_LOGIN e ADMIN_SECRET no Render')
    try:
        t,s=req.cookies.get(COOKIE,'').split('.')
        expected=hmac.new(PASS.encode(),t.encode(),hashlib.sha256).hexdigest()
        if not hmac.compare_digest(s,expected) or not 0<=time.time()-int(t)<28800:raise ValueError()
    except Exception:raise HTTPException(401,'Sessão expirada ou inválida')
    if req.method=='POST':
        origin=req.headers.get('origin')
        if origin and origin.rstrip('/')!=str(req.base_url).rstrip('/'):raise HTTPException(403,'Origem inválida')
    return True

@APP.post('/admin/login')
def login(x:Login):
    if not USER or not PASS:raise HTTPException(503,'Administrador não configurado')
    if not hmac.compare_digest(x.usuario,USER) or not hmac.compare_digest(x.senha,PASS):
        raise HTTPException(403,'Credenciais inválidas')
    ts=str(int(time.time()))
    signature=hmac.new(PASS.encode(),ts.encode(),hashlib.sha256).hexdigest()
    resp=JSONResponse({'ok':True})
    resp.set_cookie(COOKIE,ts+'.'+signature,secure=True,httponly=True,samesite='strict',max_age=28800,path='/admin')
    return resp

@APP.post('/admin/logout')
def logout():
    r=JSONResponse({'ok':True})
    r.delete_cookie(COOKIE,path='/admin')
    return r

def members():
    return _wix('POST','/members/v1/members/query',{'query':{'paging':{'limit':100}}}).get('members',[])

def member_exists(mid):
    if not re.fullmatch(r'[0-9a-fA-F-]{36}',mid):raise HTTPException(400,'Identificador inválido')
    if not any(m.get('id')==mid for m in members()):
        raise HTTPException(404,'Usuário ainda não possui conta Wix; envio de formulário não cria login')

def persist(mid,oid,state):
    found=_query('prahoje_habilitacoes',{'memberId':mid})
    old=found[0] if found else {}
    data={**(_item_data(old) if old else {}),'memberId':mid,'organizadorId':oid,'statusHabilitacao':state,
      'statusPagamento':'CONFERIDO_EXTERNAMENTE' if state=='HABILITADO' else 'ACESSO_SUSPENSO'}
    item={'data':data}
    if old.get('id'):item['id']=old['id']
    elif old.get('data',{}).get('_id'):item['id']=old['data']['_id']
    return _wix('POST','/wix-data/v2/items/save',{'dataCollectionId':'prahoje_habilitacoes','dataItem':item})

@APP.get('/admin/api/lista')
def listing(_=Depends(auth)):
    h={_item_data(x).get('memberId'):_item_data(x) for x in _query('prahoje_habilitacoes')}
    rows=[]
    for m in members():
        s=h.get(m.get('id'),{})
        rows.append({'id':m.get('id'),'nome':m.get('profile',{}).get('nickname') or '',
            'email':m.get('loginEmail') or '', 'statusConta':m.get('status'),
            'habilitacao':s.get('statusHabilitacao','PENDENTE'),'organizadorId':s.get('organizadorId','')})
    try:
        query={'query':{'filter':{'formId':FORM_ID,'namespace':'wix.form_app.form'}},'onlyYourOwn':False}
        subs=_wix('POST','/form-submission-service/v4/submissions/namespace/query',query)
        applications=[{'dados':s.get('submissions',{}),'data':s.get('createdDate')} for s in subs.get('submissions',[])]
    except HTTPException:applications=[]
    return {'membros':rows,'cadastros':applications}

@APP.post('/admin/api/{mid}/habilitar')
def enable(mid:str,body:Approval,_=Depends(auth)):
    member_exists(mid)
    if not re.fullmatch(r'[\w-]{1,128}',body.organizadorId):raise HTTPException(400,'Organizador inválido')
    _wix('POST','/members/v1/members/'+quote(mid)+'/approve',{})
    persist(mid,body.organizadorId,'HABILITADO')
    return {'id':mid,'status':'HABILITADO'}

@APP.post('/admin/api/{mid}/desabilitar')
def disable(mid:str,_=Depends(auth)):
    member_exists(mid)
    q=_query('prahoje_habilitacoes',{'memberId':mid})
    org=_item_data(q[0]).get('organizadorId') if q else mid
    persist(mid,org,'DESABILITADO')
    _wix('POST','/members/v1/members/'+quote(mid)+'/block',{})
    return {'id':mid,'status':'DESABILITADO'}

PAGE='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pra Hj | Gestão</title><style>
:root{font:16px system-ui;color:#fff;background:#0a0a12}body{margin:0}main{max-width:1100px;margin:auto;padding:24px}h1 em{color:#f24}.card{background:#1a1b26;border:1px solid #423b49;border-radius:20px;padding:22px;margin:20px 0}input{display:block;padding:13px;margin:8px 0 16px;background:#11131b;color:white;border:1px solid #766b7d;border-radius:10px}button{background:#e51646;border:0;border-radius:11px;padding:12px 16px;color:white;font-weight:800;cursor:pointer}table{border-collapse:collapse;min-width:700px;width:100%}td,th{padding:12px;border-bottom:1px solid #49404b;text-align:left}.scroll{overflow:auto}#status{white-space:pre-wrap}
</style></head><body><main><h1><em>Pra Hj</em> | Gestão de Associados</h1><p>Pagamento verificado externamente; liberação realizada no Wix.</p><div id="signin" class="card"><h2>Administrador</h2><form id="login"><label>Usuário<input id="usr" required></label><label>Senha<input id="pwd" type="password" required></label><button>Entrar</button></form></div><div id="panel" class="card" hidden><h2>Membros</h2><button id="refresh">Atualizar</button><div class="scroll"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Conta</th><th>Permissão</th><th>Ação</th></tr></thead><tbody id="rows"></tbody></table></div><h2>Cadastros</h2><p>Um formulário recebido não cria automaticamente uma conta Wix.</p><div id="submissions"></div><button id="logout">Sair</button></div><p id="status" role="status"></p></main><script>
const $=id=>document.getElementById(id);const say=t=>$('status').textContent=t;
async function api(path,obj){let options={credentials:'same-origin'};if(obj!==undefined){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(obj)}let res=await fetch('/admin'+path,options),j=await res.json().catch(()=>({}));if(!res.ok)throw Error(j.detail||'HTTP '+res.status);return j}
async function load(){const r=await api('/api/lista');$('signin').hidden=true;$('panel').hidden=false;$('rows').replaceChildren();for(const m of r.membros){let tr=document.createElement('tr');for(const x of [m.nome,m.email,m.statusConta,m.habilitacao]){let td=document.createElement('td');td.textContent=x||'—';tr.append(td)}let td=document.createElement('td'),b=document.createElement('button'),enabled=m.habilitacao==='HABILITADO';b.textContent=enabled?'Desabilitar':'Habilitar';b.onclick=async()=>{if(!confirm('Confirma alteração da conta?'))return;let org=m.organizadorId||m.id;if(!enabled){org=prompt('ID do organizador:',org);if(!org)return}b.disabled=true;try{await api('/api/'+m.id+'/'+(enabled?'desabilitar':'habilitar'),enabled?{}:{organizadorId:org});say('Permissão registrada no Wix.');await load()}catch(e){say(e.message)}finally{b.disabled=false}};td.append(b);tr.append(td);$('rows').append(tr)}$('submissions').replaceChildren();for(const s of r.cadastros){let p=document.createElement('p');p.textContent=JSON.stringify(s.dados);$('submissions').append(p)}say('Contas encontradas: '+r.membros.length)}
$('login').onsubmit=async e=>{e.preventDefault();try{await api('/login',{usuario:$('usr').value,senha:$('pwd').value});$('pwd').value='';await load()}catch(e){say(e.message)}};$('refresh').onclick=()=>load().catch(e=>say(e.message));$('logout').onclick=async()=>{await api('/logout',{});location.reload()};
</script></body></html>'''
@APP.get('/admin',response_class=HTMLResponse)
def admin_page():
    return HTMLResponse(PAGE,headers={'Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"})
