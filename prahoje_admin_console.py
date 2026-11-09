"""Pra Hj | isolated protected administrative routes."""
import os,time,hmac,hashlib,re,json
from urllib.request import Request as HTTPRequest, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from fastapi import Request, HTTPException, Depends
from fastapi.responses import HTMLResponse,JSONResponse
from pydantic import BaseModel
from prahoje_backend.app import APP,_wix,_query,_item_data

USER=os.getenv('ADMIN_LOGIN','')
PASS=os.getenv('ADMIN_SECRET','')
COOKIE='pra_hj_admin'
LOGIN_FAILURES={}
MAX_FAILURES=5
LOCK_SECONDS=900
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
        if origin:
            target=urlsplit(origin)
            if target.scheme!='https' or target.netloc.lower()!=req.headers.get('host','').lower():
                raise HTTPException(403,'Origem inválida')
    return True

@APP.post('/admin/login')
def login(x:Login,req:Request):
    if not USER or not PASS:raise HTTPException(503,'Administrador não configurado')
    address=req.client.host if req.client else 'unknown'
    now=time.time()
    attempts=[t for t in LOGIN_FAILURES.get(address,[]) if now-t<LOCK_SECONDS]
    if len(attempts)>=MAX_FAILURES:
        raise HTTPException(429,'Muitas tentativas. Tente novamente mais tarde.')
    valid_user=hmac.compare_digest(x.usuario,USER)
    valid_pass=hmac.compare_digest(x.senha,PASS)
    if not (valid_user and valid_pass):
        attempts.append(now)
        LOGIN_FAILURES[address]=attempts
        raise HTTPException(403,'Credenciais inválidas')
    LOGIN_FAILURES.pop(address,None)
    ts=str(int(time.time()))
    signature=hmac.new(PASS.encode(),ts.encode(),hashlib.sha256).hexdigest()
    resp=JSONResponse({'ok':True})
    resp.set_cookie(COOKIE,ts+'.'+signature,secure=True,httponly=True,samesite='strict',max_age=28800,path='/admin')
    return resp

@APP.get('/admin/api/session')
def session(_=Depends(auth)):
    return {'authenticated':True,'role':'ADMIN_MASTER','user':USER}

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
      'statusPagamento':(_item_data(old) if old else {}).get('statusPagamento','NAO_VERIFICADO')}
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

ELIGIBLE_PLAN_IDS={
    'f6aa3a5f-1a49-4ecb-b500-55376ea546be',
    'b53e5e61-3ec1-4001-ab22-430902ba6326',
    '3cd9863c-0f36-4d29-b3c0-190e1eee7f72',
}

def verify_paid_subscription(mid:str):
    """Fail closed: only an ACTIVE, PAID order for an eligible Pra Hj plan authorizes publication."""
    try:
        page=0
        while page<10:
            result=_wix('GET','/pricing-plans/v2/orders?buyerIds='+quote(mid)+'&orderStatuses=ACTIVE&limit=50&offset='+str(page*50))
            orders=result.get('orders',[])
            for order in orders:
                buyer=order.get('buyer') or {}
                if (buyer.get('memberId')==mid
                    and order.get('status')=='ACTIVE'
                    and order.get('planId') in ELIGIBLE_PLAN_IDS
                    and order.get('lastPaymentStatus')=='PAID'
                    and (not order.get('endDate') or order.get('endDate')>time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))):
                    return order
            if not (result.get('pagingMetadata') or {}).get('hasNext'):
                break
            page+=1
    except HTTPException:
        raise HTTPException(503,'Não foi possível confirmar pagamento e assinatura no serviço financeiro. Habilitação bloqueada.')
    except Exception:
        raise HTTPException(503,'Validação financeira indisponível. Habilitação bloqueada.')
    raise HTTPException(403,'Habilitação negada: exige plano Pra Hj elegível, assinatura ACTIVE e pagamento PAID.')

@APP.post('/admin/api/{mid}/habilitar')
def enable(mid:str,body:Approval,_=Depends(auth)):
    member_exists(mid)
    if not re.fullmatch(r'[\w-]{1,128}',body.organizadorId):raise HTTPException(400,'Organizador inválido')
    order=verify_paid_subscription(mid)
    _wix('POST','/members/v1/members/'+quote(mid)+'/approve',{})
    persist(mid,body.organizadorId,'HABILITADO')
    return {'id':mid,'status':'HABILITADO','subscriptionId':order.get('id')}

@APP.post('/admin/api/{mid}/desabilitar')
def disable(mid:str,_=Depends(auth)):
    member_exists(mid)
    q=_query('prahoje_habilitacoes',{'memberId':mid})
    org=_item_data(q[0]).get('organizadorId') if q else mid
    persist(mid,org,'DESABILITADO')
    _wix('POST','/members/v1/members/'+quote(mid)+'/block',{})
    return {'id':mid,'status':'DESABILITADO'}


def public_events_from_media_tech():
    """Read public CMS data with visitor credentials. This never grants admin write access."""
    client_id=os.getenv('WIX_PUBLIC_CLIENT_ID','')
    if not client_id:
        return None, 'Client ID público não configurado'
    try:
        token_req=HTTPRequest(
            'https://www.wixapis.com/oauth2/token',
            data=json.dumps({'clientId':client_id,'grantType':'anonymous'}).encode(),
            headers={'Content-Type':'application/json'},
            method='POST'
        )
        with urlopen(token_req,timeout=9) as response:
            auth_data=json.load(response)
        token=auth_data.get('access_token') or auth_data.get('accessToken')
        if not token:
            return None, 'Não foi possível obter credencial de leitura'
        query_req=HTTPRequest(
            'https://www.wixapis.com/wix-data/v2/items/query',
            data=json.dumps({'dataCollectionId':'prahoje_eventos','query':{'paging':{'limit':100}}}).encode(),
            headers={'Content-Type':'application/json','Authorization':token},
            method='POST'
        )
        with urlopen(query_req,timeout=12) as response:
            data=json.load(response)
        return [x.get('data') or {} for x in data.get('dataItems',[])],None
    except (HTTPError,URLError,TimeoutError,ValueError,KeyError) as err:
        return None, 'Leitura pública não autorizada ou indisponível'

@APP.get('/admin/api/overview')
def overview(_=Depends(auth)):
    events=[]
    error=None
    event_source='admin-api'
    try:
        events=[_item_data(x) for x in _query('prahoje_eventos')]
    except Exception:
        public_events,public_error=public_events_from_media_tech()
        if public_events is None:
            error='Consulta de eventos indisponível. O conector de gestão precisa de credenciais de servidor; '+str(public_error)
            event_source='unavailable'
        else:
            events=public_events
            event_source='visitor-read-only'
    metrics=[]
    metrics_error=None
    try:
        metrics=[_item_data(x) for x in _query('prahoje_metricas_eventos')]
    except Exception:
        metrics_error='Métricas indisponíveis: conector de dados administrativo não autorizado.'
    by_event={}
    for m in metrics:
        event_id=str(m.get('eventoId') or '').strip()
        if not event_id:continue
        prev=by_event.get(event_id)
        if not prev or str(m.get('atualizadoEm') or '')>=str(prev.get('atualizadoEm') or ''):
            by_event[event_id]=m
    management_available=True
    try:
        registrations=listing()
        people=registrations.get('membros',[])
        applications=registrations.get('cadastros',[])
    except Exception:
        management_available=False
        people=[]
        applications=[]
    def label(e):
        return str(e.get('statusEditorial') or e.get('status') or e.get('situacao') or '').upper()
    approved=sum(label(e) in ('APROVADO','APROVADA','PUBLICADO','PUBLICADA','ACTIVE') for e in events)
    pending=sum('PEND' in label(e) or 'REVIS' in label(e) for e in events)
    return {'events':events[:300],'totalEvents':len(events),
            'approvedEvents':approved,'pendingEvents':pending,
            'members':people,'applications':applications,
            'activeMembers':sum(x.get('habilitacao')=='HABILITADO' for x in people),
            'eventQueryError':error, 'eventSource':event_source,'metricsQueryError':metrics_error,'metricsByEvent':by_event,'metricsEventCount':len(by_event),
            'metricsTotals':{k:sum(max(0,int(float(m.get(k) or 0))) for m in by_event.values() if str(m.get(k) or '0').replace('.','',1).isdigit()) for k in ('visualizacoes','visualizacoesUnicas','cliques','likes')},'managementAvailable':management_available, 'integration':{'adminWixConfigured':bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')),'publicRead':event_source=='visitor-read-only','writeOperations':'Dependem de API administrativa válida'}, 'financeStatus':'Não integrado: receita e pagamentos exigem confirmação transacional',
            'generatedAt':int(time.time())}

PAGE='''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Pra Hj | Centro de Comando Executivo</title>
<style>
:root{color-scheme:dark;font:15px Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f9f8fd;background:#0c0b13;--muted:#aca9ba;--stroke:#32303f;--pink:#ed087e;--orange:#ff8517}*{box-sizing:border-box}
body{margin:0;background:radial-gradient(ellipse at 90% -20%,#4b1241 0,transparent 42%),#0c0b13}a{color:inherit;text-decoration:none}button,input{font:inherit}button{cursor:pointer}.shell{max-width:1510px;margin:auto;display:grid;grid-template-columns:245px minmax(0,1fr);min-height:100vh}
aside{padding:28px 17px;background:#14121d;border-right:1px solid var(--stroke);position:sticky;top:0;height:100vh}.brand{font-size:33px;font-weight:950;letter-spacing:-2px;color:#fff}.brand span{color:var(--pink)}.brand-image{width:168px;height:72px;max-width:100%;object-fit:contain;object-position:left center;display:block}.sub{font-size:10px;letter-spacing:2.4px;font-weight:800;color:#bcb2bf;margin-bottom:35px}
.menu{width:100%;display:block;text-align:left;border:0;border-radius:13px;padding:14px 15px;color:#bfbac9;background:transparent;margin:4px 0;font-weight:740}.menu.active,.menu:hover{background:#332133;color:white}.menu.active{box-shadow:inset 3px 0 #f9168a}
aside .bottom{margin-top:45px;color:#8b8598;font-size:12px;line-height:1.8}main{padding:31px clamp(20px,3.7vw,57px) 65px;min-width:0}.top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px;margin-bottom:30px}.eyebrow{color:#fc62af;font-size:11px;font-weight:850;letter-spacing:2px;text-transform:uppercase}h1{font-size:clamp(26px,3vw,43px);letter-spacing:-1.3px;margin:9px 0}h2{font-size:18px;margin:0 0 16px}.muted{color:var(--muted);line-height:1.55}.actions{display:flex;gap:9px;flex-wrap:wrap}.btn{border:1px solid #48414e;background:#26222e;padding:11px 15px;color:#fff;border-radius:11px;font-weight:760}.btn.hot{background:linear-gradient(110deg,#e6007e,#f85a38);border-color:transparent}.btn:disabled{opacity:.45}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.kpi{border:1px solid var(--stroke);background:#1a1722;border-radius:18px;padding:22px;min-height:133px}.kpi small{color:#c7bdcd;font-size:12px}.kpi strong{font-size:36px;display:block;letter-spacing:-1px;margin:12px 0 2px}.kpi em{font-style:normal;font-size:11px;color:#aaa1b1}.surface{margin-top:18px;border:1px solid var(--stroke);background:#18151f;border-radius:20px;padding:23px}.twocol{display:grid;grid-template-columns:1.5fr 1fr;gap:18px}.tag{border-radius:30px;padding:5px 9px;border:1px solid #61415a;color:#ffd2ed;font-size:11px}.tbl{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:600px}th,td{text-align:left;border-bottom:1px solid #34303c;padding:13px 8px;font-size:12px}th{font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:#a9a2b4}td{color:#ede9f1}.strip{height:10px;background:#38303e;border-radius:12px;overflow:hidden;margin:20px 0 10px}.strip div{height:100%;background:linear-gradient(90deg,#ed087e,#ff8517);width:0}.login{max-width:455px;margin:10vh auto;padding:36px;border-radius:24px;background:#1c1925;border:1px solid #504054;box-shadow:0 18px 70px #0007}.login h1{font-size:34px}.login label{display:block;color:#ddd5e3;font-size:12px;font-weight:720;margin:17px 0 6px}.login input{width:100%;border:1px solid #51445a;background:#0f0d16;color:white;border-radius:12px;padding:15px}.login input:focus{outline:2px solid var(--pink)}.login button{width:100%;margin-top:21px}.notice{padding:12px;border:1px solid #553349;border-radius:11px;background:#241924;color:#fec5d9;margin-top:15px}.empty{padding:18px;color:#b7acbb;background:#231d2a;border-radius:11px}.view[hidden],.shell[hidden],#signin[hidden]{display:none!important}
@media(max-width:1050px){.grid{grid-template-columns:repeat(2,1fr)}.twocol{grid-template-columns:1fr}}@media(max-width:760px){.shell{display:block}aside{position:static;height:auto;padding:13px}.brand{font-size:27px}.sub{margin-bottom:12px}.nav{display:flex;overflow-x:auto;gap:4px}.menu{white-space:nowrap;width:auto}aside .bottom{display:none}main{padding:22px 15px}.grid{gap:9px}.kpi{padding:15px}.kpi strong{font-size:27px}}
</style></head>
<body>
<section id="signin" class="login">
<div class="brand"><img src="https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com/logo-pra-hj.svg" alt="Pra Hj" class="brand-image"></div><div class="sub">MEDIATEK · ACESSO RESTRITO</div>
<div class="eyebrow">Identidade administrativa</div><h1>Seu centro de comando.</h1><p class="muted">Entre com suas credenciais para acessar a gestão operacional, editorial e estratégica do Pra Hj.</p>
<form id="login"><label for="usr">Usuário</label><input id="usr" name="usuario" autocomplete="username" value="ADMPRAHJ" required>
<label for="pwd">Senha</label><input id="pwd" name="senha" type="password" autocomplete="current-password" required>
<button class="btn hot">Acessar gestão à vista</button></form>
<div class="notice" id="loginStatus" role="status" hidden></div>
<p class="muted" style="font-size:11px;margin-top:20px">Acesso protegido no servidor. Esta página não armazena sua senha.</p>
</section>
<div class="shell" id="app" hidden>
<aside><div class="brand"><img src="https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com/logo-pra-hj.svg" alt="Pra Hj" class="brand-image"></div><div class="sub">CENTRO DE COMANDO</div><div class="nav">
<button class="menu active" data-view="overview">◈ Visão executiva</button><button class="menu" data-view="events">▦ Eventos</button><button class="menu" data-view="people">♧ Organizadores</button><button class="menu" data-view="applications">≡ Credenciamento</button><button class="menu" data-view="finance">◉ Assinaturas & finanças</button><button class="menu" data-view="operations">⚙ Operação</button></div>
<div class="bottom">ADMIN MASTER · ADMPRAHJ<br>Powered by Run b.o.</div>
</aside>
<main>
<div class="top"><div><div class="eyebrow">Pra Hj / inteligência de gestão</div><h1 id="heading">Visão executiva</h1><div class="muted" id="stamp">Dados administrativos protegidos</div></div><div class="actions"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://headless-uqcbszqzghi-pedrousinae-140b.wix-site-host.com/">↗ Vitrine pública</a><button class="btn" id="refresh">↻ Atualizar</button><button class="btn" id="logout">Sair</button></div></div>
<div class="view" id="view-overview">
<div class="grid">
<div class="kpi"><small>Eventos cadastrados</small><strong id="k-events">—</strong><em>Registros consultados</em></div>
<div class="kpi"><small>Eventos aprovados</small><strong id="k-approved">—</strong><em>Conforme status editorial</em></div>
<div class="kpi"><small>Organizadores habilitados</small><strong id="k-active">—</strong><em>Acessos autorizados</em></div>
<div class="kpi"><small>Cadastros recebidos</small><strong id="k-applications">—</strong><em>Solicitações registradas</em></div></div>
<section class="surface"><h2>Engajamento de eventos · Indicadores consolidados</h2><div class="grid"><div class="kpi"><small>Visualizações totais</small><strong id="m-views">—</strong></div><div class="kpi"><small>Visualizações únicas</small><strong id="m-unique">—</strong></div><div class="kpi"><small>Cliques de interesse</small><strong id="m-clicks">—</strong></div><div class="kpi"><small>Likes recebidos</small><strong id="m-likes">—</strong></div></div><p class="muted" id="metricsSummaryStatus">Métricas privadas, sem valores estimados.</p></section><div class="twocol"><section class="surface"><h2>Funil editorial</h2><p class="muted">Situação dos eventos registrados na base. Registros sem status identificado não são tratados como aprovados.</p><div class="strip"><div id="approvalbar"></div></div><div class="muted" id="editorialText">Aguardando dados...</div></section>
<section class="surface"><h2>Condição operacional</h2><div class="tag">Dados internos</div><p class="muted" id="dataHealth">Carregando...</p><p class="muted">A apuração de faturamento só será exibida quando houver integração transacional verificada.</p></section></div>
<section class="surface"><h2>Prioridades de gestão</h2><div class="twocol"><p class="muted">1. Avaliar cadastros e habilitar perfis válidos.<br>2. Revisar agenda editorial e qualidade dos eventos.<br>3. Conferir assinaturas e pagamentos antes da liberação comercial.</p><p class="muted">4. Monitorar desempenho e conversão com dados auditáveis.<br>5. Consolidar relatórios gerenciais por período.<br>6. Revisar consistência entre Media Tech e vitrine.</p></div></section></div>
<div class="view" id="view-events" hidden><section class="surface"><h2>Gestão de eventos</h2><p class="muted">Consulta da base cadastrada. Edição e aprovação devem seguir o fluxo autorizado do sistema, não uma alteração visual de status.</p><div class="tbl"><table><thead><tr><th>Evento</th><th>Data</th><th>Local</th><th>Status</th><th>Visualizações</th><th>Únicas</th><th>Cliques</th><th>Likes</th><th>CTR</th></tr></thead><tbody id="eventRows"></tbody></table></div><p class="muted" id="metricsHealth" role="status">Indicadores consultados diretamente na base privada.</p></section></div>
<div class="view" id="view-people" hidden><section class="surface"><h2>Organizadores e permissões</h2><p class="muted">A habilitação exige assinatura ativa e pagamento confirmado no servidor; o bloqueio de cadastro e a suspensão são administrados separadamente.</p><div class="tbl"><table><thead><tr><th>Organizador</th><th>Conta</th><th>Habilitação</th><th>Operação</th></tr></thead><tbody id="memberRows"></tbody></table></div></section></div>
<div class="view" id="view-applications" hidden><section class="surface"><h2>Solicitações de credenciamento</h2><div id="applicationRows"></div></section></div>
<div class="view" id="view-finance" hidden><section class="surface"><h2>Assinaturas e resultado financeiro</h2><div class="notice">Indicadores financeiros não homologados: nenhuma receita, conversão paga ou inadimplência será presumida.</div><p class="muted" id="financeStatus">Conciliação indisponível.</p><a class="btn" href="https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com/planos.html" target="_blank" rel="noopener noreferrer">Consultar planos ↗</a></section></div>
<div class="view" id="view-operations" hidden><section class="surface"><h2>Central operacional</h2><p class="muted">Acesso às frentes de operação existentes.</p><div class="actions"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com/eventos.html">Cadastro de eventos ↗</a><a class="btn" target="_blank" rel="noopener noreferrer" href="https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com/usuarios.html">Credenciamento ↗</a><a class="btn" target="_blank" rel="noopener noreferrer" href="https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com/operacao.html">Media Tech ↗</a></div></section></div>
<p class="muted" id="status" role="status"></p>
</main></div>
<script>
const $=id=>document.getElementById(id), api=async(path,obj)=>{const opts={credentials:'same-origin'};if(obj!==undefined){opts.method='POST';opts.headers={'Content-Type':'application/json'};opts.body=JSON.stringify(obj)}const r=await fetch('/admin'+path,opts),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.detail||'Falha na operação: HTTP '+r.status);return j};
const set=(id,value)=>$(id).textContent=value;let state=null;
function cell(tr,v){const td=document.createElement('td');td.textContent=String(v??'—');tr.append(td)}
function show(view){document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!=='view-'+view);document.querySelectorAll('.menu').forEach(x=>x.classList.toggle('active',x.dataset.view===view));set('heading',({overview:'Visão executiva',events:'Gestão de eventos',people:'Organizadores',applications:'Credenciamento',finance:'Assinaturas & finanças',operations:'Operação'})[view]);}
document.querySelectorAll('.menu').forEach(b=>b.onclick=()=>show(b.dataset.view));
function rows(id){$(id).replaceChildren();return $(id)}
function render(x){
state=x;$('signin').hidden=true;$('app').hidden=false;
set('k-events',x.eventQueryError?'Indisponível':x.totalEvents);set('k-approved',x.eventQueryError?'—':x.approvedEvents);set('k-active',x.activeMembers);set('k-applications',x.applications.length);
set('stamp','Última consulta: '+new Date(x.generatedAt*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}));
set('dataHealth',x.eventQueryError?x.eventQueryError:(x.eventSource==='visitor-read-only'?'Leitura pública da base Media Tech ativa. Operações administrativas de escrita exigem credenciais de servidor.':'Consulta administrativa realizada. Acurácia depende da integridade da base de origem.'));
$('approvalbar').style.width=x.totalEvents?Math.round(x.approvedEvents/x.totalEvents*100)+'%':'0%';
set('editorialText',x.approvedEvents+' aprovados · '+x.pendingEvents+' pendentes · '+(x.totalEvents-x.approvedEvents-x.pendingEvents)+' outros/sem classificação');
const totals=x.metricsTotals||{};for(const [id,key] of [['m-views','visualizacoes'],['m-unique','visualizacoesUnicas'],['m-clicks','cliques'],['m-likes','likes']])set(id,x.metricsQueryError?'—':(totals[key]??0).toLocaleString('pt-BR'));set('metricsSummaryStatus',x.metricsQueryError||('Eventos com indicadores: '+x.metricsEventCount+' · Fonte: base privada Media Tech.'));set('metricsHealth',x.metricsQueryError||'Indicadores por evento consultados na base de métricas do Media Tech.');
set('financeStatus',x.financeStatus);if(!x.managementAvailable){set('status','Gestão de membros em modo somente leitura: credencial administrativa de dados ausente.');}
const ebody=rows('eventRows');for(const e of x.events){const tr=document.createElement('tr');cell(tr,e.titulo||e.nome||e.title||'Evento sem título');cell(tr,e.data||e.dataInicio||e.startDate||'—');cell(tr,e.local||e.localizacao||e.venue||'—');cell(tr,e.statusEditorial||e.status||e.situacao||'Não classificado');const metric=x.metricsByEvent?.[e._id||e.id||e.eventoId]||{};if(x.metricsQueryError){for(let i=0;i<5;i++)cell(tr,'—')}else{cell(tr,metric.visualizacoes??0);cell(tr,metric.visualizacoesUnicas??0);cell(tr,metric.cliques??0);cell(tr,metric.likes??0);cell(tr,metric.ctr??0)}ebody.append(tr)}if(!x.events.length){const tr=document.createElement('tr');cell(tr,x.eventQueryError||'Nenhum evento registrado');ebody.append(tr)}
const mbody=rows('memberRows');for(const m of x.members){const tr=document.createElement('tr');cell(tr,m.nome||m.email||'Organizador');cell(tr,m.statusConta);cell(tr,m.habilitacao);const td=document.createElement('td'),b=document.createElement('button');b.className='btn';const active=m.habilitacao==='HABILITADO';b.textContent=active?'Suspender':'Validar plano e habilitar';b.disabled=!x.managementAvailable;b.title=x.managementAvailable?'Alterar autorização':'Integração administrativa não configurada';b.onclick=async()=>{if(!confirm('Confirma a alteração de autorização deste organizador?'))return;let payload={};if(!active){const org=prompt('Identificador do organizador',m.organizadorId||m.id);if(!org)return;payload={organizadorId:org}}b.disabled=true;try{await api('/api/'+encodeURIComponent(m.id)+'/'+(active?'desabilitar':'habilitar'),payload);set('status','Autorização atualizada no servidor.');await load()}catch(err){set('status',err.message)}finally{b.disabled=false}};td.append(b);tr.append(td);mbody.append(tr)}if(!x.members.length){const tr=document.createElement('tr');cell(tr,'Nenhum membro retornado');mbody.append(tr)}
const apps=$('applicationRows');apps.replaceChildren();if(!x.applications.length){const p=document.createElement('p');p.className='empty';p.textContent='Nenhum cadastro retornado pela consulta.';apps.append(p)}for(const a of x.applications){const p=document.createElement('pre');p.className='empty';p.style.whiteSpace='pre-wrap';p.style.overflowWrap='anywhere';p.textContent=JSON.stringify(a.dados,null,2);apps.append(p)}
}
async function load(){set('status','Sincronizando informações...');try{const r=await api('/api/overview');render(r);set('status','Dados atualizados.')}catch(err){$('signin').hidden=true;$('app').hidden=false;set('status','Acesso autorizado. Indicadores temporariamente indisponíveis: '+err.message);}}
$('login').onsubmit=async ev=>{ev.preventDefault();const msg=$('loginStatus');msg.hidden=false;msg.textContent='Validando acesso...';try{await api('/login',{usuario:$('usr').value,senha:$('pwd').value});$('pwd').value='';$('signin').hidden=true;$('app').hidden=false;msg.hidden=true;await load()}catch(err){msg.textContent=err.message}};
$('refresh').onclick=()=>load().catch(err=>set('status',err.message));$('logout').onclick=async()=>{await api('/logout',{});location.reload()};
api('/api/session').then(()=>load()).catch(()=>{});
</script></body></html>'''
@APP.get('/admin',response_class=HTMLResponse)
def admin_page():
    return HTMLResponse(PAGE,headers={'Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' https://headless-jzeufymuejv-pedrousinae-140b.wix-site-host.com; connect-src 'self'; frame-ancestors 'none'"})

# The packaged legacy backend registers /admin before this module is imported.
# Starlette resolves the FIRST matching route, so remove those legacy routes
# when their paths are replaced by this protected, modern admin console.
_modern_admin_paths = {
    route.path for route in APP.router.routes
    if getattr(route, 'path', '').startswith('/admin')
    and getattr(route, 'endpoint', None)
    and getattr(route.endpoint, '__module__', '') == __name__
}
APP.router.routes[:] = [
    route for route in APP.router.routes
    if not (
        getattr(route, 'path', '') in _modern_admin_paths
        and getattr(getattr(route, 'endpoint', None), '__module__', '') != __name__
    )
]
