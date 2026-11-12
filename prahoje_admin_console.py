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
            'editorial':_editorial_summary(events),'editorialWriteAvailable':bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')) and event_source=='admin-api',
            'approvedEvents':approved,'pendingEvents':pending,
            'members':people,'applications':applications,
            'activeMembers':sum(x.get('habilitacao')=='HABILITADO' for x in people),
            'eventQueryError':error, 'eventSource':event_source,'metricsQueryError':metrics_error,'metricsByEvent':by_event,'metricsEventCount':len(by_event),
            'metricsTotals':{k:sum(max(0,int(float(m.get(k) or 0))) for m in by_event.values() if str(m.get(k) or '0').replace('.','',1).isdigit()) for k in ('visualizacoes','visualizacoesUnicas','cliques','likes')},'managementAvailable':management_available, 'integration':{'adminWixConfigured':bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')),'publicRead':event_source=='visitor-read-only','writeOperations':'Dependem de API administrativa válida'}, 'socialStorageStatus':'Falha ao consultar interações persistentes' if metrics_error else 'Consulta da base persistente de interações disponível; teste de escrita: '+_SOCIAL_HEALTH['state'],'financeStatus':'Não integrado: receita e pagamentos exigem confirmação transacional',
            'generatedAt':int(time.time())}


class EditorialDecision(BaseModel):
    acao:str
    parecer:str=''
    expectedStatus:str|None=None
    destaque:bool|None=None

_PENDING_STATES={'PENDENTE','EM_ANALISE','EM_AJUSTES','AJUSTES_SOLICITADOS'}
_PUBLIC_STATES={'PUBLICADO','APROVADO'}
_REJECTED_STATES={'REJEITADO','ARQUIVADO'}
_ACTION_TO_STATE={
    'ANALISAR':'EM_ANALISE',
    'PUBLICAR':'PUBLICADO',
    'AJUSTES':'EM_AJUSTES',
    'REJEITAR':'REJEITADO',
    'DESPUBLICAR':'PENDENTE',
}
def _editorial_status(item):
    return str(item.get('status') or item.get('statusEditorial') or 'PENDENTE').upper().strip()
def _editorial_record(item):
    data=_item_data(item)
    return {**data,'_id':str(item.get('id') or data.get('_id') or data.get('id') or '')}
def _editorial_summary(records):
    statuses=[_editorial_status(x) for x in records]
    return {
        'pendentes':sum(x in _PENDING_STATES for x in statuses),
        'publicados':sum(x in _PUBLIC_STATES for x in statuses),
        'rejeitados':sum(x in _REJECTED_STATES for x in statuses),
        'semClassificacao':sum(x not in (_PENDING_STATES|_PUBLIC_STATES|_REJECTED_STATES) for x in statuses),
        'total':len(statuses),
    }


@APP.get('/admin/api/capabilities')
def admin_capabilities(_=Depends(auth)):
    """Diagnóstico protegido. Nunca retorna credenciais ou dados de autenticação."""
    credential_present=bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN'))
    read_ok=False
    failure=None
    if credential_present:
        try:
            read_ok=isinstance(_query('prahoje_eventos'),list)
        except Exception:
            failure='Conexão administrativa do CMS indisponível. Verifique a integração do servidor com a conta Wix do Media Tech.'
    else:
        failure='O servidor não possui credencial de serviço Wix habilitada para administrar a coleção de eventos.'
    return {
        'role':'ADMIN_MASTER',
        'sessionAuthenticated':True,
        'singleLogin':True,
        'editorialReadAvailable':read_ok,
        'editorialWriteAvailable':credential_present and read_ok,
        'requiresSeparateEditorLogin':False,
        'reason':failure,
        'serverPermissionRequired':not (credential_present and read_ok),
    }

@APP.get('/admin/api/editorial')
def editorial_queue(_=Depends(auth)):
    """Fila somente leitura protegida, sem permitir escrita pela identidade do visitante."""
    source='admin-api'
    writable=bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN'))
    try:
        records=[_editorial_record(x) for x in _query('prahoje_eventos')]
    except Exception:
        entries,error=public_events_from_media_tech()
        if entries is None:
            raise HTTPException(503,'Fila editorial indisponível: leitura administrativa e leitura pública sem acesso.')
        records=entries
        source='visitor-read-only'
        writable=False
    records.sort(key=lambda x: (
        0 if _editorial_status(x) in _PENDING_STATES else 1,
        str(x.get('_createdDate') or x.get('dataInicio') or '')
    ))
    return {'events':records[:300], 'counts':_editorial_summary(records),
            'source':source, 'writeAvailable':writable and source=='admin-api',
            'writableReason':'Operações de aprovação exigem credenciais administrativas Wix configuradas no servidor.'
                            if not (writable and source=='admin-api') else '',
            'readOnly':not (writable and source=='admin-api'),'generatedAt':int(time.time())}

@APP.post('/admin/api/editorial/{event_id}/review')
def editorial_review(event_id:str,body:EditorialDecision,_=Depends(auth)):
    """Decisões explícitas ADMIN MASTER. Publicar depende de curadoria e validação comercial."""
    if not re.fullmatch(r'[a-fA-F0-9-]{36}',event_id):
        raise HTTPException(400,'Identificador inválido')
    action=str(body.acao or '').upper().strip()
    if action not in _ACTION_TO_STATE:
        raise HTTPException(400,'Ação editorial inválida')
    note=str(body.parecer or '').strip()
    if len(note)>1000:raise HTTPException(422,'Parecer limitado a 1.000 caracteres')
    if action in ('AJUSTES','REJEITAR') and len(note)<8:
        raise HTTPException(422,'Informe um parecer de pelo menos 8 caracteres')
    if not (os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')):
        raise HTTPException(503,'Escrita editorial indisponível: configure credencial administrativa Wix no servidor')
    try:
        items=_query('prahoje_eventos')
    except Exception:
        raise HTTPException(503,'Banco administrativo indisponível; nenhuma alteração foi realizada')
    original=next((x for x in items
                   if str(x.get('id') or _item_data(x).get('_id') or '')==event_id),None)
    if original is None:raise HTTPException(404,'Evento não encontrado na base editorial')
    data=dict(_item_data(original))
    old_status=_editorial_status(data)
    if body.expectedStatus is not None and old_status!=str(body.expectedStatus).upper().strip():
        raise HTTPException(409,'O status mudou desde sua última consulta; atualize a fila antes de decidir.')
    if old_status==_ACTION_TO_STATE[action]:
        raise HTTPException(409,'O evento já está neste estado editorial')
    if action=='PUBLICAR':
        city=str(data.get('cidadeId') or data.get('cidade') or '').lower().strip()
        if city not in ('piracicaba','piracicaba-sp','piracicaba sp'):
            raise HTTPException(422,'Somente eventos em Piracicaba podem ser publicados')
        if not all([str(data.get('titulo') or '').strip(),str(data.get('local') or '').strip(),
                    data.get('dataInicio')]):
            raise HTTPException(422,'Título, local e data de início são obrigatórios')
        event_url=str(data.get('url') or '').strip()
        if not event_url.startswith('https://'):
            raise HTTPException(422,'Link de referência HTTPS obrigatório antes da publicação')
        origin=str(data.get('origem') or '').lower()
        if not origin.startswith('radar'):
            mid=str(data.get('enviadoPorMemberId') or '').strip()
            if not re.fullmatch(r'[a-fA-F0-9-]{36}',mid):
                raise HTTPException(403,'Evento de organizador exige conta vinculada e assinatura confirmada')
            verify_paid_subscription(mid)
    next_status=_ACTION_TO_STATE[action]
    updated={k:v for k,v in data.items() if not k.startswith('_')}
    updated.update({
        'status':next_status,'parecerEditorial':note,
        'revisadoEm':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
        'revisadoPor':USER,
    })
    if body.destaque is not None and action=='PUBLICAR':
        updated['destaque']=body.destaque
    payload={'dataCollectionId':'prahoje_eventos',
             'dataItem':{'id':event_id,'data':updated}}
    try:
        saved=_wix('POST','/wix-data/v2/items/save',payload)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503,'Falha ao gravar parecer no CMS. Nenhuma confirmação de aprovação foi obtida.')
    record=saved.get('dataItem') or {}
    saved_data=record.get('data') or {}
    # A aprovação só é comunicada como concluída após confirmação de escrita.
    if not record:
        raise HTTPException(503,'CMS não confirmou atualização; consulte o evento antes de repetir')
    return {'ok':True,'id':event_id,'previousStatus':old_status,
            'status':str(saved_data.get('status') or next_status).upper(),
            'action':action, 'revisadoEm':updated['revisadoEm']}

PAGE='''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Pra Hj | Centro de Comando Executivo</title>
<style>
:root{color-scheme:dark;font:15px Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f9f8fd;background:#0c0b13;--muted:#aca9ba;--stroke:#32303f;--pink:#ed087e;--orange:#ff8517}*{box-sizing:border-box}
body{margin:0;background:radial-gradient(ellipse at 90% -20%,#4b1241 0,transparent 42%),#0c0b13}a{color:inherit;text-decoration:none}button,input{font:inherit}button{cursor:pointer}.shell{max-width:1510px;margin:auto;display:grid;grid-template-columns:245px minmax(0,1fr);min-height:100vh}
aside{padding:28px 17px;background:#14121d;border-right:1px solid var(--stroke);position:sticky;top:0;height:100vh}.brand{font-size:33px;font-weight:950;letter-spacing:-2px;color:#fff}.brand span{color:var(--pink)}.brand-image{width:168px;height:72px;max-width:100%;object-fit:contain;object-position:left center;display:block}.sub{font-size:10px;letter-spacing:2.4px;font-weight:800;color:#bcb2bf;margin-bottom:35px}
.menu{width:100%;display:block;text-align:left;border:0;border-radius:13px;padding:14px 15px;color:#bfbac9;background:transparent;margin:4px 0;font-weight:740}.menu.active,.menu:hover{background:#332133;color:white}.menu.active{box-shadow:inset 3px 0 #f9168a}
aside .bottom{margin-top:45px;color:#8b8598;font-size:12px;line-height:1.8}main{padding:31px clamp(20px,3.7vw,57px) 65px;min-width:0}.top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px;margin-bottom:30px}.eyebrow{color:#fc62af;font-size:11px;font-weight:850;letter-spacing:2px;text-transform:uppercase}h1{font-size:clamp(26px,3vw,43px);letter-spacing:-1.3px;margin:9px 0}h2{font-size:18px;margin:0 0 16px}.muted{color:var(--muted);line-height:1.55}.actions{display:flex;gap:9px;flex-wrap:wrap}.btn{border:1px solid #48414e;background:#26222e;padding:11px 15px;color:#fff;border-radius:11px;font-weight:760}.btn.hot{background:linear-gradient(110deg,#e6007e,#f85a38);border-color:transparent}.btn:disabled{opacity:.45}
.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.kpi{border:1px solid var(--stroke);background:#1a1722;border-radius:18px;padding:22px;min-height:133px}.kpi small{color:#c7bdcd;font-size:12px}.kpi strong{font-size:36px;display:block;letter-spacing:-1px;margin:12px 0 2px}.kpi em{font-style:normal;font-size:11px;color:#aaa1b1}.surface{margin-top:18px;border:1px solid var(--stroke);background:#18151f;border-radius:20px;padding:23px}.twocol{display:grid;grid-template-columns:1.5fr 1fr;gap:18px}.tag{border-radius:30px;padding:5px 9px;border:1px solid #61415a;color:#ffd2ed;font-size:11px}.tbl{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:600px}th,td{text-align:left;border-bottom:1px solid #34303c;padding:13px 8px;font-size:12px}th{font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:#a9a2b4}td{color:#ede9f1}.strip{height:10px;background:#38303e;border-radius:12px;overflow:hidden;margin:20px 0 10px}.strip div{height:100%;background:linear-gradient(90deg,#ed087e,#ff8517);width:0}.login{max-width:455px;margin:10vh auto;padding:36px;border-radius:24px;background:#1c1925;border:1px solid #504054;box-shadow:0 18px 70px #0007}.login h1{font-size:34px}.login label{display:block;color:#ddd5e3;font-size:12px;font-weight:720;margin:17px 0 6px}.login input{width:100%;border:1px solid #51445a;background:#0f0d16;color:white;border-radius:12px;padding:15px}.login input:focus{outline:2px solid var(--pink)}.login button{width:100%;margin-top:21px}.notice{padding:12px;border:1px solid #553349;border-radius:11px;background:#241924;color:#fec5d9;margin-top:15px}.empty{padding:18px;color:#b7acbb;background:#231d2a;border-radius:11px}.view[hidden],.shell[hidden],#signin[hidden],#cmsApprovalSetup[hidden]{display:none!important}
@media(max-width:1050px){.grid{grid-template-columns:repeat(2,1fr)}.twocol{grid-template-columns:1fr}}@media(max-width:760px){.shell{display:block}aside{position:static;height:auto;padding:13px}.brand{font-size:27px}.sub{margin-bottom:12px}.nav{display:flex;overflow-x:auto;gap:4px}.menu{white-space:nowrap;width:auto}aside .bottom{display:none}main{padding:22px 15px}.grid{gap:9px}.kpi{padding:15px}.kpi strong{font-size:27px}}

.editorial-filter{display:flex;flex-wrap:wrap;gap:9px;margin:16px 0;align-items:center}
.editorial-filter select,.editorial-filter input{border-radius:12px;border:1px solid #4d4051;background:#18151f;color:#fff;padding:11px 12px;min-width:130px}
.editorial-filter input{flex:1 1 220px}
.editorial-list{display:grid;gap:14px}
.review-card{border-radius:16px;border:1px solid #504052;padding:19px;background:linear-gradient(135deg,#26202d,#191620)}
.review-card .review-head{display:flex;justify-content:space-between;gap:14px;align-items:start;flex-wrap:wrap}
.review-card h3{margin:0 0 7px;font-size:17px}
.review-card .meta{color:#cfc4d3;font-size:12px;line-height:1.8}
.review-card .review-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.review-card textarea{background:#11101b;color:#fff;border:1px solid #6c5268;border-radius:10px;padding:11px;min-height:68px;width:100%;resize:vertical;font:inherit}
.review-card .source-link{color:#ffaacb;text-decoration:underline;font-size:12px}
.review-card .description{white-space:pre-wrap;color:#d7cbd9;font-size:13px;line-height:1.55}
.review-card .btn{font-size:12px;padding:9px 12px}
.review-card .btn.publish{background:#18593f;border-color:#279366}
.review-card .btn.warn{background:#633c16;border-color:#a66c2d}
.review-card .btn.reject{background:#60222d;border-color:#b44762}
.review-card .btn:disabled{opacity:.4;cursor:not-allowed}
.editorial-help{border:1px solid #64435c;background:#291c2b;border-radius:12px;padding:12px 15px;color:#eacbdc}
.review-card .checkbox{display:inline-flex;gap:8px;align-items:center;font-size:12px;color:#e9dbe8}
.review-card input[type=checkbox]{accent-color:#eb1871}
@media(max-width:600px){.editorial-filter{flex-direction:column;align-items:stretch}.editorial-filter select,.editorial-filter input{width:100%}.review-card{padding:14px}}

/* Admin Master: all actionable indicators and controls are explicitly keyboard-accessible. */
.kpi[data-open]{cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}
.kpi[data-open]:hover,.kpi[data-open]:focus-visible{border-color:#f95b91;background:#302135;transform:translateY(-2px)}
.kpi[data-open]::after{content:"Abrir área →";display:block;margin-top:9px;font-size:11px;color:#fca0c9;font-weight:780}
.kpi[data-open]:focus-visible,.action-tile:focus-visible,.menu:focus-visible{outline:3px solid #ff89be;outline-offset:3px}
.quick-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
.action-tile{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:9px;min-height:124px;border-radius:16px;border:1px solid #59405c;background:linear-gradient(130deg,#312039,#231b30);color:#fff;padding:17px;text-align:left;font:inherit;cursor:pointer}
.action-tile strong{font-size:15px;line-height:1.35;color:#fff}
.action-tile small{line-height:1.4;color:#d9bfd4;font-size:12px}
.action-tile:hover{border-color:#ff5c92;background:#3c2540}
.action-tile.primary{background:linear-gradient(118deg,#ad084e,#e73050);border-color:#ff6790}
.action-tile.primary small{color:#fff}
.admin-session-chip{padding:8px 12px;border:1px solid #79556c;border-radius:999px;background:#281c2b;color:#ffe1ef;font-size:12px;font-weight:850}
.admin-ops-status{margin:8px 0;border-left:3px solid #f23a72;padding:10px 13px;background:#261b2b;border-radius:7px;color:#e7d3e1;font-size:13px}
.admin-ops-status.ok{border-color:#48bc86;background:#172b23}
.admin-ops-status.blocked{border-color:#ffae55}
.editorial-card-target{cursor:pointer;text-decoration:underline dotted #f59fc5;text-underline-offset:4px}
.review-card button,.btn,.menu{min-height:42px}
@media(max-width:960px){.quick-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.quick-actions{grid-template-columns:1fr}.action-tile{min-height:96px}.admin-session-chip{font-size:11px}}
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
<button class="menu active" data-view="overview">◈ Visão executiva</button><button class="menu" data-view="editorial" id="editorialMenu">✓ Curadoria <span id="pendingMenuCount"></span></button><button class="menu" data-view="events">▦ Eventos</button><button class="menu" data-view="people">♧ Organizadores</button><button class="menu" data-view="applications">≡ Credenciamento</button><button class="menu" data-view="finance">◉ Assinaturas & finanças</button><button class="menu" data-view="operations">⚙ Operação</button></div>
<div class="bottom">ADMIN MASTER · ADMPRAHJ<br>Powered by Run b.o.</div>
</aside>
<main>
<div class="top"><div><div class="eyebrow">Pra Hj / inteligência de gestão</div><h1 id="heading">Visão executiva</h1><div class="muted" id="stamp">Dados administrativos protegidos</div><div style="margin-top:12px"><span id="adminRoleBadge" class="admin-session-chip">ADMIN MASTER · Sessão protegida</span></div></div><div class="actions"><a class="btn" target="_blank" rel="noopener noreferrer" href="https://headless-uqcbszqzghi-pedrousinae-140b.wix-site-host.com/">↗ Vitrine pública</a><button class="btn" id="refresh">↻ Atualizar</button><button class="btn" id="logout">Sair</button></div></div>
<div class="view" id="view-overview">
<section class="surface" style="margin-top:0">
<div class="eyebrow">Gestão à vista · Decida sem sair da plataforma</div><h2 style="margin-top:7px">Ações rápidas do administrador</h2>
<p class="muted">Os indicadores e atalhos abrem diretamente sua área de trabalho. Nenhuma decisão editorial é executada apenas pela navegação.</p>
<div class="quick-actions">
<button type="button" class="action-tile primary" data-open="editorial"><strong>✓ Aprovar eventos pendentes</strong><small>Analise, publique, solicite ajustes ou rejeite — sempre com confirmação</small></button>
<button type="button" class="action-tile" data-open="events"><strong>▦ Todos os eventos</strong><small>Radar, eventos publicados, engajamento e desempenho</small></button>
<button type="button" class="action-tile" data-open="people"><strong>♧ Habilitar organizadores</strong><small>Permissões vinculadas à verificação de assinatura e pagamento</small></button>
<button type="button" class="action-tile" data-open="applications"><strong>≡ Conferir cadastros</strong><small>Examine solicitações e identifique pendências</small></button>
<button type="button" class="action-tile" data-open="finance"><strong>◉ Assinaturas e finanças</strong><small>Informações verificadas, sem estimativas de receita</small></button>
<button type="button" class="action-tile" data-open="operations"><strong>⚙ Operação e integração</strong><small>Serviços, páginas operacionais e disponibilidade dos dados</small></button>
</div><div class="admin-ops-status" role="status"><span id="adminConnectionStatus">Verificando CMS...</span> <button class="btn" id="adminConnectionCheck" type="button" style="margin-left:10px">↻ Verificar conexão</button></div><div id="adminOpsStatus" class="admin-ops-status" role="status">Verificando permissões de operação...</div>
</section>
<div class="grid">
<div class="kpi" data-open="events"><small>Eventos do Radar Pra Hj</small><strong id="k-radar">—</strong><em>Rastreados e ativos na vitrine</em></div>
<div class="kpi" data-open="events"><small>Eventos dos organizadores</small><strong id="k-events">—</strong><em>Cadastros enviados pelos usuários</em></div>
<div class="kpi" data-open="events"><small>Eventos de usuários aprovados</small><strong id="k-approved">—</strong><em>Conforme status editorial</em></div>
<div class="kpi" data-open="people"><small>Organizadores habilitados</small><strong id="k-active">—</strong><em>Acessos autorizados</em></div>
<div class="kpi" data-open="applications"><small>Cadastros recebidos</small><strong id="k-applications">—</strong><em>Solicitações registradas</em></div><div class="kpi" data-open="editorial"><small>Fila editorial pendente</small><strong id="k-pending">—</strong><em>Eventos aguardando decisão</em></div></div>
<section class="surface"><h2>Engajamento de eventos · Indicadores consolidados</h2><div class="grid"><div class="kpi" data-open="events"><small>Visualizações totais</small><strong id="m-views">—</strong></div><div class="kpi" data-open="events"><small>Visualizações únicas</small><strong id="m-unique">—</strong></div><div class="kpi" data-open="events"><small>Cliques de interesse</small><strong id="m-clicks">—</strong></div><div class="kpi" data-open="events"><small>Likes recebidos</small><strong id="m-likes">—</strong></div></div><p class="muted" id="metricsSummaryStatus">Métricas privadas, sem valores estimados.</p></section><div class="twocol"><section class="surface"><h2>Funil editorial</h2><p class="muted">Situação dos eventos registrados na base. Registros sem status identificado não são tratados como aprovados.</p><div class="strip"><div id="approvalbar"></div></div><div class="muted" id="editorialText">Aguardando dados...</div></section>
<section class="surface"><h2>Condição operacional</h2><div class="tag">Dados internos</div><p class="muted" id="dataHealth">Carregando...</p><p class="muted">A apuração de faturamento só será exibida quando houver integração transacional verificada.</p></section></div>
<section class="surface"><div class="top"><div><h2>Curadoria editorial · Decisões pendentes</h2><p class="muted">Aprovação individual, parecer e publicação supervisionada, com registros no Media Tech.</p></div><button class="btn hot" type="button" id="openEditorial">✓ Abrir fila editorial</button></div></section>
<section class="surface"><h2>Prioridades de gestão</h2><div class="twocol"><p class="muted">1. Avaliar cadastros e habilitar perfis válidos.<br>2. Revisar agenda editorial e qualidade dos eventos.<br>3. Conferir assinaturas e pagamentos antes da liberação comercial.</p><p class="muted">4. Monitorar desempenho e conversão com dados auditáveis.<br>5. Consolidar relatórios gerenciais por período.<br>6. Revisar consistência entre Media Tech e vitrine.</p></div></section></div>
<div class="view" id="view-editorial" hidden>
<section class="surface">
<div class="top" style="margin-bottom:12px">
 <div><div class="eyebrow">MODERAÇÃO RESTRITA · PIRACICABA</div><h2>Fila de aprovação de eventos</h2><p class="muted">Analise cada evento e sua fonte antes de publicar. Eventos Radar exigem curadoria; eventos de organizadores exigem também assinatura e pagamento verificados no servidor.</p></div>
 <div class="actions"><button class="btn" id="editorialReload" type="button">↻ Atualizar fila</button></div>
</div>
<div class="grid"><div class="kpi"><small>Pendentes / em análise</small><strong id="eq-pending">—</strong></div><div class="kpi"><small>Publicados</small><strong id="eq-published">—</strong></div><div class="kpi"><small>Rejeitados</small><strong id="eq-rejected">—</strong></div><div class="kpi"><small>Total no CMS</small><strong id="eq-total">—</strong></div></div>
<div class="editorial-help" id="editorialMessage" role="status" style="margin-top:16px">Aguardando consulta da fila.</div>
<div id="cmsApprovalSetup" class="surface" style="border-color:#784457">
  <h2>Conexão de publicação · CMS Media Tech</h2>
  <p class="muted">Sua sessão ADMIN MASTER já autoriza a operação deste painel. Se o servidor ainda não possui credencial administrativa própria, os botões apresentam o motivo do bloqueio sem descartar sua análise.</p>
  <div class="actions">
    <a class="btn" href="https://manage.wix.com/account/api-keys" target="_blank" rel="noopener noreferrer">1. Gerenciar chave de integração</a>
    <a class="btn" href="https://dashboard.render.com/web/srv-dbl1lufb9u1s738nbong" target="_blank" rel="noopener noreferrer">2. Configurar segredo no servidor</a>
    <button class="btn hot" type="button" id="recheckEditorial" style="background:#a5225b">3. Revalidar permissões</button>
  </div>
  <p class="muted" style="font-size:12px">Conceda somente leitura e escrita da coleção de eventos do Media Tech e guarde a chave exclusivamente em <code>WIX_API_KEY</code> no servidor. Nunca informe chaves em chats ou campos públicos.</p>
</div>

<div class="editorial-filter">
<label for="editorialFilter">Status</label><select id="editorialFilter"><option value="pending">Aguardando decisão</option><option value="all">Todos os registros</option><option value="PUBLICADO">Publicados</option><option value="EM_AJUSTES">Solicitaram ajustes</option><option value="REJEITADO">Rejeitados</option></select>
<label for="editorialSearch">Pesquisar</label><input id="editorialSearch" type="search" placeholder="Título, local, fonte ou organizador">
</div>
<div id="editorialCards" class="editorial-list" aria-live="polite"></div>
</section>
</div>
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
function show(view){if(!document.getElementById('view-'+view))view='overview';if(location.hash.slice(1)!==view)history.replaceState(null,'','#'+view);document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!=='view-'+view);document.querySelectorAll('.menu').forEach(x=>x.classList.toggle('active',x.dataset.view===view));set('heading',({overview:'Visão executiva',editorial:'Curadoria e aprovação',events:'Gestão de eventos',people:'Organizadores',applications:'Credenciamento',finance:'Assinaturas & finanças',operations:'Operação'})[view]);}
document.querySelectorAll('.menu').forEach(b=>b.onclick=()=>show(b.dataset.view));
document.querySelectorAll('[data-open]').forEach(el=>{
 const target=el.dataset.open;
 if(!target)return;
 if(!['BUTTON','A'].includes(el.tagName)){el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','Abrir '+target)}
 el.addEventListener('click',()=>show(target));
 el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(target)}})
});window.addEventListener('hashchange',()=>show(location.hash.slice(1)||'overview'));
function rows(id){$(id).replaceChildren();return $(id)}
function render(x){
state=x;$('signin').hidden=true;$('app').hidden=false;
set('k-pending',x.editorial?.pendentes??x.pendingEvents??'—');set('pendingMenuCount',x.editorial?.pendentes??x.pendingEvents??'—');
set('k-radar',x.radarCount??'—');set('k-events',x.eventQueryError?'Indisponível':x.totalEvents);set('k-approved',x.eventQueryError?'—':x.approvedEvents);set('k-active',x.activeMembers);set('k-applications',x.applications.length);
set('stamp','Última consulta: '+new Date(x.generatedAt*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}));
set('dataHealth',x.eventQueryError?x.eventQueryError:(x.eventSource==='visitor-read-only'?'Leitura pública da base Media Tech ativa. Operações administrativas de escrita exigem credenciais de servidor.':'Consulta administrativa realizada. Acurácia depende da integridade da base de origem.'));
const canDecide=x.editorialWriteAvailable===true;
const ops=$('adminOpsStatus');
ops.className='admin-ops-status '+(canDecide?'ok':'blocked');
ops.textContent=canDecide?'✓ Operação administrativa habilitada: autenticação ADMIN MASTER e conexão editorial disponíveis.':'⚠ ADMIN MASTER autenticado; decisões de publicação só serão liberadas quando a conexão de escrita do CMS estiver validada no servidor. O painel permanece disponível para análise.';
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

let editorialState=null;
const pendingStatuses=new Set(['PENDENTE','EM_ANALISE','EM_AJUSTES','AJUSTES_SOLICITADOS']);
const normalizeText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const statusOf=e=>String(e.status||e.statusEditorial||'PENDENTE').toUpperCase().trim();
const dateText=v=>{const raw=v?.$date||v;if(!raw)return 'Não informado';const dt=new Date(raw);return Number.isFinite(dt.getTime())?dt.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}):String(raw)};
const isRadar=e=>normalizeText(e.origem).startsWith('radar');
function addNode(parent,tag,value,cls){
 const el=document.createElement(tag);if(cls)el.className=cls;
 el.textContent=String(value??'');parent.append(el);return el;
}
function safeHTTPS(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}}
function renderEditorial(){
 const records=editorialState?.events||[];
 const filter=$('editorialFilter').value,query=normalizeText($('editorialSearch').value.trim());
 const pending=editorialState?.counts||{};
 for(const [id,key] of [['eq-pending','pendentes'],['eq-published','publicados'],['eq-rejected','rejeitados'],['eq-total','total']])set(id,pending[key]??'—');
 const canWrite=editorialState?.writeAvailable===true;
 const setup=$('cmsApprovalSetup');if(setup)setup.hidden=canWrite;
 $('editorialMessage').textContent=canWrite?
   'Ações de curadoria disponíveis. Nenhum registro será aprovado automaticamente. A decisão é gravada no CMS com parecer, data e usuário administrativo.':
   (editorialState?.writableReason||'Consulta somente leitura. Configure a integração administrativa para habilitar decisões.');
 const items=records.filter(e=>(filter==='all'||(filter==='pending'?pendingStatuses.has(statusOf(e)):statusOf(e)===filter))&&(!query||normalizeText([e.titulo,e.local,e.origem,e.organizadorId,e.descricao].join(' ')).includes(query)));
 $('editorialCards').replaceChildren();
 if(!items.length){addNode($('editorialCards'),'p','Nenhum evento corresponde aos filtros.','empty');return}
 for(const event of items){
  const wrap=document.createElement('article');wrap.className='review-card';
  const top=document.createElement('div');top.className='review-head';wrap.append(top);
  const left=document.createElement('div');top.append(left);
  addNode(left,'h3',event.titulo||'Evento sem título');
  addNode(left,'span',statusOf(event),'tag');
  addNode(top,'span',isRadar(event)?'Radar institucional':'Organizador associado','tag');
  addNode(wrap,'div','📅 '+dateText(event.dataInicio)+' · Término: '+dateText(event.dataFim),'meta');
  addNode(wrap,'div','📍 '+(event.local||'Local não cadastrado')+' · '+(event.cidadeId||'Município não informado'),'meta');
  addNode(wrap,'div','Origem: '+(event.origem||'Não informada')+' · Categoria: '+(event.categoria||'Não informada'),'meta');
  addNode(wrap,'div','Valor: '+(event.tipoAcesso||'A consultar')+' · Organizador: '+(event.organizadorId||event.enviadoPorMemberId||'Não informado'),'meta');
  if(event.descricao)addNode(wrap,'p',event.descricao,'description');
  const link=safeHTTPS(event.url);if(link){const a=addNode(wrap,'a','↗ Conferir fonte e inscrições','source-link');a.href=link;a.target='_blank';a.rel='noopener noreferrer'}
  const note=document.createElement('textarea');note.maxLength=1000;note.placeholder='Parecer editorial. Obrigatório para solicitar ajustes ou rejeitar; recomendado para toda decisão.';note.setAttribute('aria-label','Parecer para '+(event.titulo||'evento'));note.value=event.parecerEditorial||'';wrap.append(note);
  const actions=document.createElement('div');actions.className='review-actions';wrap.append(actions);
  const highlight=document.createElement('label');highlight.className='checkbox';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=event.destaque===true;
  highlight.append(checkbox,document.createTextNode(' Destacar na vitrine'));actions.append(highlight);
  const operations=[['ANALISAR','Em análise',''],['PUBLICAR','✓ Aprovar e publicar','publish'],['AJUSTES','Solicitar ajustes','warn'],['REJEITAR','Rejeitar','reject']];
  if(statusOf(event)==='PUBLICADO')operations.push(['DESPUBLICAR','Retirar da vitrine','warn']);
  for(const [action,label,cls] of operations){
   const button=addNode(actions,'button',label,'btn '+cls);
   button.type='button';button.disabled=statusOf(event)===({'ANALISAR':'EM_ANALISE','PUBLICAR':'PUBLICADO','AJUSTES':'EM_AJUSTES','REJEITAR':'REJEITADO','DESPUBLICAR':'PENDENTE'}[action]);
   button.title=canWrite?label:'Clique para identificar a autorização pendente no CMS';
   button.addEventListener('click',async()=>{
    if(!canWrite){
      const reason=editorialState?.writableReason||'Integração administrativa indisponível.';
      set('editorialMessage','O comando foi recebido, mas o CMS não pode gravá-lo: '+reason+' Consulte a Conexão de publicação e revalide as permissões.');
      $('cmsApprovalSetup')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    const observation=note.value.trim();
    if(['AJUSTES','REJEITAR'].includes(action)&&observation.length<8){note.focus();set('editorialMessage','Informe um parecer de pelo menos 8 caracteres.');return}
    if(!confirm('Confirma "'+label+'" para "'+(event.titulo||'Evento')+'"? A decisão ficará registrada.'))return;
    actions.querySelectorAll('button').forEach(x=>x.disabled=true);
    set('editorialMessage','Registrando decisão no servidor…');
    try{
      const result=await api('/api/editorial/'+encodeURIComponent(event._id||event.id)+'/review',{
       acao:action,parecer:observation,expectedStatus:statusOf(event),destaque:checkbox.checked
      });
      set('editorialMessage','Decisão registrada: '+result.status+' · '+(event.titulo||'Evento'));
      await loadEditorial();await load();
    }catch(err){set('editorialMessage','Não foi possível concluir: '+err.message);actions.querySelectorAll('button').forEach(x=>x.disabled=!canWrite)}
   });
  }
  $('editorialCards').append(wrap);
 }
}
async function loadEditorial(){
 try{editorialState=await api('/api/editorial');renderEditorial();set('pendingMenuCount',editorialState.counts?.pendentes??'—');set('k-pending',editorialState.counts?.pendentes??'—')}
 catch(err){editorialState=null;$('editorialCards').replaceChildren();set('editorialMessage','Falha na consulta editorial: '+err.message)}
}

async function checkAdminAccess(){
 const status=$('adminOpsStatus');
 try{
  const result=await api('/api/capabilities');
  const available=result.editorialWriteAvailable===true;
  const badge=$('adminRoleBadge');
  if(badge)badge.textContent='ADMIN MASTER · Sessão única autenticada';
  if(status){
   status.className='admin-ops-status '+(available?'ok':'blocked');
   status.textContent=available?
    '✓ Sua sessão ADMIN MASTER está autorizada e o servidor confirmou a conexão administrativa de dados. Você pode decidir na Curadoria sem outro login.':
    'ADMIN MASTER reconhecido. A consulta da fila está disponível quando a fonte pública responde, mas a publicação permanece bloqueada até regularizar a permissão de escrita do servidor. '+(result.reason||'');
  }
  const msg=$('adminConnectionStatus');if(msg)msg.textContent=available?'✓ CMS administrativo conectado':'⚠ Integração de escrita pendente';
  const button=$('adminConnectionCheck');if(button)button.disabled=false;
 }catch(error){
  if(status){status.className='admin-ops-status blocked';status.textContent='Não foi possível validar a integração administrativa: '+error.message}
 }
}

$('editorialReload').addEventListener('click',async()=>{await loadEditorial();await checkAdminAccess()});
$('recheckEditorial').addEventListener('click',async()=>{await loadEditorial();await checkAdminAccess()});
$('openEditorial').addEventListener('click',()=>show('editorial'));
$('adminConnectionCheck').addEventListener('click',checkAdminAccess);

$('editorialFilter').addEventListener('change',renderEditorial);
$('editorialSearch').addEventListener('input',renderEditorial);

async function load(){set('status','Sincronizando informações...');try{const r=await api('/api/overview');render(r);await loadEditorial();await checkAdminAccess();show(location.hash.slice(1)||'overview');set('status','Dados atualizados.')}catch(err){$('signin').hidden=true;$('app').hidden=false;set('status','Acesso autorizado. Indicadores temporariamente indisponíveis: '+err.message);}}
$('login').onsubmit=async ev=>{ev.preventDefault();const msg=$('loginStatus');msg.hidden=false;msg.textContent='Validando acesso...';try{await api('/login',{usuario:$('usr').value,senha:$('pwd').value});$('pwd').value='';$('signin').hidden=true;$('app').hidden=false;msg.hidden=true;await load()}catch(err){msg.textContent=err.message}};
$('refresh').onclick=()=>load().catch(err=>set('status',err.message));$('logout').onclick=async()=>{await api('/logout',{});location.reload()};
api('/api/session').then(session=>{
const badge=$('adminRoleBadge');
if(badge)badge.textContent=(session.role||'ADMIN MASTER')+' · '+(session.user||'Administrador')+' · Sessão protegida';
return load()
}).catch(()=>{});
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
