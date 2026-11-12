"""Pra Hj | isolated protected administrative routes."""
import os,time,hmac,hashlib,re,json,uuid,threading
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
        return [{**(x.get('data') or {}),'_id':str(x.get('id') or (x.get('data') or {}).get('_id') or '')} for x in data.get('dataItems',[])],None
    except (HTTPError,URLError,TimeoutError,ValueError,KeyError) as err:
        return None, 'Leitura pública não autorizada ou indisponível'


# Catalogo oficial gerenciado no próprio site Pra Hj. IDs são estáveis pelo link, não pelo título.
from datetime import datetime
from zoneinfo import ZoneInfo
_RADAR_FEED_URL='https://headless-uqcbszqzghi-pedrousinae-140b.wix-site-host.com/radar-eventos.json'
_RADAR_CACHE={'until':0.0,'data':None}
_RADAR_LOCK=threading.RLock()
def _public_event_id(link):
    h=2166136261
    for char in str(link or '').lower():
        h=((h ^ ord(char))*16777619)&0xffffffff
    return 'public-'+format(h,'08x')

def radar_active():
    now=time.time()
    with _RADAR_LOCK:
        if _RADAR_CACHE['data'] is not None and now<_RADAR_CACHE['until']:
            return _RADAR_CACHE['data']
    try:
        request=HTTPRequest(_RADAR_FEED_URL,headers={'Accept':'application/json','User-Agent':'PraHj-Engajamento/1'})
        with urlopen(request,timeout=10) as response:
            feed=json.loads(response.read(1000000))
        if not isinstance(feed,dict) or not isinstance(feed.get('events'),list):raise ValueError('Catálogo inválido')
        today=datetime.now(ZoneInfo('America/Sao_Paulo')).date().isoformat()
        events=[]
        published_ids=set()
        for item in feed['events'][:3000]:
            if not isinstance(item,dict):continue
            link=str(item.get('link') or '')
            if not link.startswith('https://') or not item.get('title'):continue
            event_id=_public_event_id(link)
            published_ids.add(event_id)
            if str(item.get('validUntil') or '0000-00-00')<today:continue
            events.append({**item,'id':event_id})
        data={'events':events,'allPublishedIds':sorted(published_ids),'count':len(events),'source':'Radar Pra Hj | catálogo oficial público','warning':'','catalogDate':feed.get('catalogDate'),'updatedAt':feed.get('updatedAt')}
        with _RADAR_LOCK:_RADAR_CACHE.update(data=data,until=now+90)
        return data
    except Exception:
        with _RADAR_LOCK:
            if _RADAR_CACHE['data'] is not None:
                return {**_RADAR_CACHE['data'],'warning':'Fonte temporariamente indisponível. Exibindo último catálogo confirmado.'}
        raise HTTPException(503,'Catálogo do Radar temporariamente indisponível. Curtidas não foram alteradas.')

# Pra Hj interactions v2: Wix CMS persistent log (pseudonymous, append-only).
SOCIAL_COLLECTION='prahoje_analytics_v2'
_SOCIAL_TOKEN={'value':None,'until':0.0}
_SOCIAL_CACHE={'data':None,'until':0.0}
_SOCIAL_LOCK=threading.RLock()
_SOCIAL_RATE={}
_SOCIAL_ALLOWED={'view','click','like'}
_SOCIAL_PUBLIC_ID=re.compile(r'^(?:public-[0-9a-f]{8}|[0-9a-fA-F-]{36})$')

def _social_token():
    with _SOCIAL_LOCK:
        if _SOCIAL_TOKEN['value'] and time.time()<_SOCIAL_TOKEN['until']:
            return _SOCIAL_TOKEN['value']
        client=os.getenv('WIX_PUBLIC_CLIENT_ID','')
        if not client:raise HTTPException(503,'Wix public client ID não configurado')
        request=HTTPRequest('https://www.wixapis.com/oauth2/token',
            data=json.dumps({'clientId':client,'grantType':'anonymous'}).encode(),
            headers={'Content-Type':'application/json'},method='POST')
        try:
            with urlopen(request,timeout=12) as response: data=json.load(response)
        except Exception as exc:
            raise HTTPException(503,'Falha na autorização de leitura e escrita social') from exc
        token=data.get('access_token') or data.get('accessToken')
        if not token:raise HTTPException(503,'A autorização social não retornou token')
        _SOCIAL_TOKEN.update(value=token,until=time.time()+1200)
        return token

def _social_request(method,path,body):
    token=_social_token()
    request=HTTPRequest('https://www.wixapis.com'+path,data=json.dumps(body).encode(),
        method=method,headers={'Authorization':token,'Content-Type':'application/json'})
    try:
        with urlopen(request,timeout=15) as response:return json.load(response)
    except HTTPError as exc:
        if exc.code==409:return {'_duplicate':True}
        raise HTTPException(503,'Armazenamento de engajamento temporariamente indisponível') from exc
    except Exception as exc:
        raise HTTPException(503,'Armazenamento de engajamento temporariamente indisponível') from exc

def _social_rows():
    with _SOCIAL_LOCK:
        if _SOCIAL_CACHE['data'] is not None and time.time()<_SOCIAL_CACHE['until']:
            return _SOCIAL_CACHE['data']
    rows=[]
    for page in range(100):
        result=_social_request('POST','/wix-data/v2/items/query',
            {'dataCollectionId':SOCIAL_COLLECTION,'query':{'paging':{'limit':100,'offset':page*100}}})
        items=result.get('dataItems') or []
        rows.extend((x.get('data') or {}) for x in items)
        if len(items)<100:break
    with _SOCIAL_LOCK:_SOCIAL_CACHE.update(data=rows,until=time.time()+20)
    return rows

def _social_aggregate():
    by={}
    liked={}
    visitors={}
    for record in _social_rows():
        eid=str(record.get('eventoId') or '')
        kind=str(record.get('tipo') or '')
        actor=str(record.get('atorHash') or '')
        if not _SOCIAL_PUBLIC_ID.fullmatch(eid) or kind not in _SOCIAL_ALLOWED:continue
        item=by.setdefault(eid,{'visualizacoes':0,'visualizacoesUnicas':0,'cliques':0,'likes':0,'ctr':0})
        if kind=='view':
            item['visualizacoes']+=1
            if actor:visitors.setdefault(eid,set()).add(actor)
        if kind=='click':item['cliques']+=1
        if kind=='like' and actor:liked.setdefault(eid,set()).add(actor)
    for eid,m in by.items():
        m['likes']=len(liked.get(eid,set()))
        m['visualizacoesUnicas']=len(visitors.get(eid,set()))
        m['ctr']=round(m['cliques']*100/max(1,m['visualizacoes']),2)
    return by

class SocialEventInput(BaseModel):
    eventoId:str
    visitanteId:str|None=None
    nomePublico:str|None=None
    publicarNome:bool=False

def _social_event_allowed(event_id):
    if event_id.startswith('public-'):
        return event_id in radar_active().get('allPublishedIds',[])
    # CMS events are protected by the editorial moderation workflow.
    try:
        published=[_item_data(x) for x in _query('prahoje_eventos')]
        if any(str(e.get('_id') or e.get('id'))==event_id and str(e.get('status') or '').upper()=='PUBLICADO' for e in published):
            return True
    except Exception:
        pass
    # Read-only fallback: the same public collection used by the events vitrine.
    # Fail closed if the publication state cannot be confirmed.
    public_events,public_error=public_events_from_media_tech()
    if public_events is None:
        return False
    return any(str(e.get('_id') or e.get('id'))==event_id and str(e.get('status') or '').upper()=='PUBLICADO'
               for e in public_events)

@APP.post('/v1/metricas/{kind}')
def social_event(kind:str,payload:SocialEventInput,req:Request):
    if kind not in _SOCIAL_ALLOWED:raise HTTPException(404,'Interação desconhecida')
    eid=payload.eventoId
    if not _SOCIAL_PUBLIC_ID.fullmatch(eid):raise HTTPException(400,'Evento inválido')
    if not _social_event_allowed(eid):raise HTTPException(404,'Evento não está publicado')
    raw=payload.visitanteId or req.cookies.get('ph_visitor_id','')
    if not re.fullmatch(r'[0-9a-fA-F-]{36}',raw or ''):raw=str(uuid.uuid4())
    secret=os.getenv('SOCIAL_HASH_SECRET') or PASS
    if not secret:raise HTTPException(503,'Assinatura de interação não configurada')
    actor=hmac.new(secret.encode(),(eid+'|'+raw).encode(),hashlib.sha256).hexdigest()[:32]
    # IP-based quick throttling is supplemental; uniqueness survives server restarts via IDs.
    host=req.client.host if req.client else 'unknown'
    key=host+'|'+eid+'|'+kind
    now=time.time()
    with _SOCIAL_LOCK:
        marks=[t for t in _SOCIAL_RATE.get(key,[]) if now-t<60]
        limit={'view':15,'click':15,'like':8}[kind]
        if len(marks)>=limit:raise HTTPException(429,'Muitas interações. Tente novamente mais tarde.')
        marks.append(now)
        _SOCIAL_RATE[key]=marks
    if kind=='like':bucket='ever'
    elif kind=='view':bucket=time.strftime('%Y-%m-%d',time.gmtime(now))
    else:bucket=str(int(now//60))+'|'+uuid.uuid4().hex[:8]
    unique=str(uuid.uuid5(uuid.NAMESPACE_URL,eid+'|'+kind+'|'+actor+'|'+bucket))
    item_data={'eventoId':eid,'tipo':kind,'atorHash':actor,
          'ocorridoEm':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(now)),
          'origem':'PRA_HJ_WEB','sessao':'day' if kind=='view' else 'one'}
    if kind=='like' and payload.publicarNome:
        alias=str(payload.nomePublico or '').strip()
        if not (2<=len(alias)<=32 and re.fullmatch(r"[\wÀ-ÿ .'-]+",alias,re.UNICODE)
                and not re.search(r"\b(?:https?|www|gmail|hotmail|outlook)\b",alias,re.IGNORECASE)):
            raise HTTPException(422,'Informe um apelido público válido (2 a 32 caracteres) ou curta sem identificação.')
        item_data.update(nomePublico=alias,consentimentoPublico=True)
    record={'dataCollectionId':SOCIAL_COLLECTION,'dataItem':{'id':unique,'data':item_data}}
    result=_social_request('POST','/wix-data/v2/items',record)
    accepted=not result.get('_duplicate',False)
    with _SOCIAL_LOCK:_SOCIAL_CACHE['until']=0
    resp=JSONResponse({'ok':True,'accepted':accepted,'reason':'registered' if accepted else 'already_liked'})
    resp.set_cookie('ph_visitor_id',raw,httponly=True,secure=True,samesite='none',max_age=31536000,path='/v1/metricas')
    return resp

@APP.get('/v1/metricas/curtidores')
def public_curtidores(eventoId:str):
    """Apenas apelidos publicados com consentimento; identificadores internos nunca são divulgados."""
    if not _SOCIAL_PUBLIC_ID.fullmatch(eventoId):raise HTTPException(400,'Evento inválido')
    names=[]
    seen=set()
    for row in _social_rows():
        if str(row.get('eventoId') or '')!=eventoId or row.get('tipo')!='like':
            continue
        if row.get('consentimentoPublico') is not True:continue
        name=str(row.get('nomePublico') or '').strip()
        actor=str(row.get('atorHash') or '')
        if not (2<=len(name)<=32 and actor and actor not in seen):continue
        seen.add(actor)
        names.append(name)
    return {'eventoId':eventoId,'likes':_social_aggregate().get(eventoId,{}).get('likes',0),
            'apelidosPublicos':names[:60],'totalApelidosPublicos':len(names),
            'observacao':'Apelidos informados voluntariamente; identidades não verificadas.'}

@APP.get('/v1/metricas/publicas')
def public_metricas(eventoId:str):
    if not _SOCIAL_PUBLIC_ID.fullmatch(eventoId):raise HTTPException(400,'Evento inválido')
    m=_social_aggregate().get(eventoId) or {}
    return {'eventoId':eventoId,**{k:m.get(k,0) for k in ('likes','visualizacoes','visualizacoesUnicas','cliques')}}

class MetricBatchRequest(BaseModel):
    eventIds:list[str]

@APP.post('/v1/metricas/likes/lote')
def likes_batch(payload:MetricBatchRequest):
    ids=list(dict.fromkeys(payload.eventIds))
    if len(ids)>100 or any(not _SOCIAL_PUBLIC_ID.fullmatch(str(i)) for i in ids):
        raise HTTPException(400,'Informe até 100 identificadores válidos')
    metrics=_social_aggregate()
    return {'counts':{eid:metrics.get(eid,{}).get('likes',0) for eid in ids},'source':'persistent-cms-v2'}


_SOCIAL_HEALTH={'checked':False,'writeVerified':False,'readVerified':False,'state':'not-tested'}

@APP.on_event('startup')
def social_smoke_check():
    """Test authenticated Wix visitor write + read without creating user metrics."""
    key=str(uuid.uuid5(uuid.NAMESPACE_URL,'pra-hj-social-healthcheck-v2'))
    body={'dataCollectionId':SOCIAL_COLLECTION,'dataItem':{
        'id':key,'data':{
            'eventoId':'test-healthcheck','tipo':'healthcheck','atorHash':'no-user',
            'ocorridoEm':'2026-11-09T00:00:00Z','origem':'server-selftest','sessao':'test'}}}
    try:
        result=_social_request('POST','/wix-data/v2/items',body)
        _SOCIAL_HEALTH['writeVerified']=bool(result.get('dataItem') or result.get('_duplicate'))
        _SOCIAL_CACHE['until']=0
        rows=_social_rows()
        _SOCIAL_HEALTH['readVerified']=any(x.get('eventoId')=='test-healthcheck' for x in rows)
        _SOCIAL_HEALTH['state']='ok' if _SOCIAL_HEALTH['writeVerified'] and _SOCIAL_HEALTH['readVerified'] else 'incomplete'
        print('PRA_HJ_SOCIAL_SELFTEST status='+_SOCIAL_HEALTH['state'])
    except Exception as exc:
        _SOCIAL_HEALTH['state']='error'
        print('PRA_HJ_SOCIAL_SELFTEST status=error type='+type(exc).__name__)
    finally:
        _SOCIAL_HEALTH['checked']=True

@APP.get('/admin/api/integration-health')
def integration_health(_=Depends(auth)):
    status={'backend':'online','socialCollection':SOCIAL_COLLECTION,'metricsWriteVerified':_SOCIAL_HEALTH['writeVerified'],'smokeTest':dict(_SOCIAL_HEALTH)}
    try:
        status['metricsReadVerified']=True
        status['metricsCount']=len(_social_aggregate())
    except Exception:
        status['metricsReadVerified']=False
    status['nextAction']='Validar likes e views de eventos reais, remoção de duplicidade e dashboard com o login ADM MASTER'
    return status

@APP.get('/admin/api/overview')
def overview(_=Depends(auth)):
    radar=radar_active()
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
    metrics_error=None
    try:
        by_event=_social_aggregate()
    except Exception:
        by_event={}
        metrics_error='Métricas sociais indisponíveis: verifique a conexão com o CMS de interações V2.'
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
    return {'radarEvents':radar['events'],'radarCount':radar['count'],'radarSource':radar['source'],'radarWarning':radar['warning'],'radarCatalogDate':radar['catalogDate'],'radarUpdatedAt':radar['updatedAt'],
            'events':events[:300],'totalEvents':len(events),
            'approvedEvents':approved,'pendingEvents':pending,
            'members':people,'applications':applications,
            'activeMembers':sum(x.get('habilitacao')=='HABILITADO' for x in people),
            'eventQueryError':error, 'eventSource':event_source,'metricsQueryError':metrics_error,'metricsByEvent':by_event,'metricsEventCount':len(by_event),
            'metricsTotals':{k:sum(max(0,int(float(m.get(k) or 0))) for m in by_event.values() if str(m.get(k) or '0').replace('.','',1).isdigit()) for k in ('visualizacoes','visualizacoesUnicas','cliques','likes')},'managementAvailable':management_available, 'integration':{'adminWixConfigured':bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')),'publicRead':event_source=='visitor-read-only','writeOperations':'Dependem de API administrativa válida'}, 'socialStorageStatus':'Falha ao consultar interações persistentes' if metrics_error else 'Consulta da base persistente de interações disponível; teste de escrita: '+_SOCIAL_HEALTH['state'],'financeStatus':'Não integrado: receita e pagamentos exigem confirmação transacional',
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
.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.kpi{border:1px solid var(--stroke);background:#1a1722;border-radius:18px;padding:22px;min-height:133px}.kpi small{color:#c7bdcd;font-size:12px}.kpi strong{font-size:36px;display:block;letter-spacing:-1px;margin:12px 0 2px}.kpi em{font-style:normal;font-size:11px;color:#aaa1b1}.surface{margin-top:18px;border:1px solid var(--stroke);background:#18151f;border-radius:20px;padding:23px}.twocol{display:grid;grid-template-columns:1.5fr 1fr;gap:18px}.tag{border-radius:30px;padding:5px 9px;border:1px solid #61415a;color:#ffd2ed;font-size:11px}.tbl{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:600px}th,td{text-align:left;border-bottom:1px solid #34303c;padding:13px 8px;font-size:12px}th{font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:#a9a2b4}td{color:#ede9f1}.strip{height:10px;background:#38303e;border-radius:12px;overflow:hidden;margin:20px 0 10px}.strip div{height:100%;background:linear-gradient(90deg,#ed087e,#ff8517);width:0}.login{max-width:455px;margin:10vh auto;padding:36px;border-radius:24px;background:#1c1925;border:1px solid #504054;box-shadow:0 18px 70px #0007}.login h1{font-size:34px}.login label{display:block;color:#ddd5e3;font-size:12px;font-weight:720;margin:17px 0 6px}.login input{width:100%;border:1px solid #51445a;background:#0f0d16;color:white;border-radius:12px;padding:15px}.login input:focus{outline:2px solid var(--pink)}.login button{width:100%;margin-top:21px}.notice{padding:12px;border:1px solid #553349;border-radius:11px;background:#241924;color:#fec5d9;margin-top:15px}.empty{padding:18px;color:#b7acbb;background:#231d2a;border-radius:11px}.view[hidden],.shell[hidden],#signin[hidden]{display:none!important}
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
<div class="kpi"><small>Eventos do Radar Pra Hj</small><strong id="k-radar">—</strong><em>Rastreados e ativos na vitrine</em></div>
<div class="kpi"><small>Eventos dos organizadores</small><strong id="k-events">—</strong><em>Cadastros enviados pelos usuários</em></div>
<div class="kpi"><small>Eventos de usuários aprovados</small><strong id="k-approved">—</strong><em>Conforme status editorial</em></div>
<div class="kpi"><small>Organizadores habilitados</small><strong id="k-active">—</strong><em>Acessos autorizados</em></div>
<div class="kpi"><small>Cadastros recebidos</small><strong id="k-applications">—</strong><em>Solicitações registradas</em></div></div>
<section class="surface"><h2>Engajamento de eventos · Indicadores consolidados</h2><div class="grid"><div class="kpi"><small>Visualizações totais</small><strong id="m-views">—</strong></div><div class="kpi"><small>Visualizações únicas</small><strong id="m-unique">—</strong></div><div class="kpi"><small>Cliques de interesse</small><strong id="m-clicks">—</strong></div><div class="kpi"><small>Likes recebidos</small><strong id="m-likes">—</strong></div></div><p class="muted" id="metricsSummaryStatus">Métricas privadas, sem valores estimados.</p></section><div class="twocol"><section class="surface"><h2>Funil editorial</h2><p class="muted">Situação dos eventos registrados na base. Registros sem status identificado não são tratados como aprovados.</p><div class="strip"><div id="approvalbar"></div></div><div class="muted" id="editorialText">Aguardando dados...</div></section>
<section class="surface"><h2>Condição operacional</h2><div class="tag">Dados internos</div><p class="muted" id="dataHealth">Carregando...</p><p class="muted">A apuração de faturamento só será exibida quando houver integração transacional verificada.</p></section></div>
<section class="surface"><h2>Prioridades de gestão</h2><div class="twocol"><p class="muted">1. Avaliar cadastros e habilitar perfis válidos.<br>2. Revisar agenda editorial e qualidade dos eventos.<br>3. Conferir assinaturas e pagamentos antes da liberação comercial.</p><p class="muted">4. Monitorar desempenho e conversão com dados auditáveis.<br>5. Consolidar relatórios gerenciais por período.<br>6. Revisar consistência entre Media Tech e vitrine.</p></div></section></div>
<div class="view" id="view-events" hidden>
<section class="surface"><h2>◈ Radar Pra Hj · Eventos rastreados</h2><p class="muted">Eventos ativos do catálogo da vitrine pública, rastreados e reunidos pelo Radar Pra Hj. Fonte e última data do catálogo indicadas abaixo. Essa lista não inclui cadastros submetidos por organizadores.</p><div class="tag" id="radarCount">—</div><p class="muted" id="radarStatus"></p><div class="tbl"><table><thead><tr><th>Evento rastreado</th><th>Data e horário</th><th>Local</th><th>Categoria</th><th>Fonte</th><th>Visualizações</th><th>Visitantes únicos</th><th>Cliques</th><th>Likes</th><th>CTR (%)</th></tr></thead><tbody id="radarRows"></tbody></table></div></section>
<section class="surface"><h2>♧ Eventos publicados por usuários</h2><p class="muted">Eventos submetidos por organizadores da plataforma, sujeitos à habilitação comercial e aprovação editorial.</p><div class="tbl"><table><thead><tr><th>Evento</th><th>Data</th><th>Local</th><th>Status</th><th>Visualizações</th><th>Únicas</th><th>Cliques</th><th>Likes</th><th>CTR</th></tr></thead><tbody id="eventRows"></tbody></table></div><p class="muted" id="metricsHealth" role="status">Indicadores consultados diretamente na base privada.</p></section></div>
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
set('k-radar',x.radarCount??'—');set('k-events',x.eventQueryError?'Indisponível':x.totalEvents);set('k-approved',x.eventQueryError?'—':x.approvedEvents);set('k-active',x.activeMembers);set('k-applications',x.applications.length);
set('stamp','Última consulta: '+new Date(x.generatedAt*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}));
set('dataHealth',x.eventQueryError?x.eventQueryError:(x.eventSource==='visitor-read-only'?'Leitura pública da base Media Tech ativa. Operações administrativas de escrita exigem credenciais de servidor.':'Consulta administrativa realizada. Acurácia depende da integridade da base de origem.'));
$('approvalbar').style.width=x.totalEvents?Math.round(x.approvedEvents/x.totalEvents*100)+'%':'0%';
set('editorialText',x.approvedEvents+' aprovados · '+x.pendingEvents+' pendentes · '+(x.totalEvents-x.approvedEvents-x.pendingEvents)+' outros/sem classificação');
const totals=x.metricsTotals||{};for(const [id,key] of [['m-views','visualizacoes'],['m-unique','visualizacoesUnicas'],['m-clicks','cliques'],['m-likes','likes']])set(id,x.metricsQueryError?'—':(totals[key]??0).toLocaleString('pt-BR'));set('metricsSummaryStatus',x.metricsQueryError||('Eventos com indicadores: '+x.metricsEventCount+' · Fonte: registros de interação persistentes no Media Tech.'));set('metricsHealth',x.metricsQueryError||'Indicadores consolidados a partir de registros persistentes de likes, visualizações e cliques.');
set('financeStatus',x.financeStatus);if(!x.managementAvailable){set('status','Gestão de membros em modo somente leitura: credencial administrativa de dados ausente.');}
set('radarCount',(x.radarCount||0)+' eventos ativos do Radar');
set('radarStatus',(x.radarWarning||'Feed publicado sincronizado')+' · Data do catálogo: '+(x.radarCatalogDate||'não informada')+' · Origem: '+(x.radarSource||'indisponível'));
const rbody=rows('radarRows');
for(const e of x.radarEvents||[]){const tr=document.createElement('tr');
  cell(tr,e.title||'Evento sem título');cell(tr,(e.date||'—')+' · '+(e.time||''));cell(tr,e.place||'—');cell(tr,e.category||'—');
  const td=document.createElement('td'),a=document.createElement('a');a.textContent='Fonte';a.href=e.link;a.target='_blank';a.rel='noopener noreferrer';td.append(a);tr.append(td);
  const m=x.metricsByEvent?.[e.id]||{};for(const key of ['visualizacoes','visualizacoesUnicas','cliques','likes','ctr'])cell(tr,x.metricsQueryError?'—':(m[key]??0));
  rbody.append(tr)}
if(!(x.radarEvents||[]).length){const tr=document.createElement('tr');cell(tr,'Nenhum evento ativo retornado pelo Radar');rbody.append(tr)}
const ebody=rows('eventRows');for(const e of x.events){const tr=document.createElement('tr');cell(tr,e.titulo||e.nome||e.title||'Evento sem título');cell(tr,e.data||e.dataInicio||e.startDate||'—');cell(tr,e.local||e.localizacao||e.venue||'—');cell(tr,e.statusEditorial||e.status||e.situacao||'Não classificado');const metric=x.metricsByEvent?.[e._id||e.id||e.eventoId]||{};if(x.metricsQueryError){for(let i=0;i<5;i++)cell(tr,'—')}else{cell(tr,metric.visualizacoes??0);cell(tr,metric.visualizacoesUnicas??0);cell(tr,metric.cliques??0);cell(tr,metric.likes??0);cell(tr,metric.ctr??0)}ebody.append(tr)}const cmsIds=new Set(x.events.map(e=>String(e._id||e.id||e.eventoId||'')));for(const [eventId,m] of Object.entries(x.metricsByEvent||{})){if(cmsIds.has(eventId))continue;const tr=document.createElement('tr');cell(tr,'Evento da vitrine · '+eventId);cell(tr,'Agenda pública');cell(tr,'Piracicaba');cell(tr,'Métricas registradas');cell(tr,m.visualizacoes??0);cell(tr,m.visualizacoesUnicas??0);cell(tr,m.cliques??0);cell(tr,m.likes??0);cell(tr,m.ctr??0);ebody.append(tr)}if(!x.events.length&&!Object.keys(x.metricsByEvent||{}).length){const tr=document.createElement('tr');cell(tr,x.eventQueryError||x.metricsQueryError||'Nenhum evento ou interação registrados');ebody.append(tr)}
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

# The legacy package may register /v1/metricas/{kind} first. Prefer the secured
# persistent CMS-based routes while leaving unrelated app routes untouched.
_modern_metrics_paths = {
    r.path for r in APP.router.routes
    if getattr(r,'path','').startswith('/v1/metricas/')
    and getattr(getattr(r,'endpoint',None),'__module__','') == __name__
}
APP.router.routes[:] = [
    r for r in APP.router.routes
    if not (getattr(r,'path','').startswith('/v1/metricas/')
            and getattr(getattr(r,'endpoint',None),'__module__','') != __name__)
]
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
