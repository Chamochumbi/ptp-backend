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

@APP.get('/v1/metricas/publicas')
def public_metricas(eventoId:str):
    """Public aggregate only. Never expose raw interactions, visitor IDs or management data."""
    if not re.fullmatch(r'[A-Za-z0-9:_.-]{6,128}',eventoId):
        raise HTTPException(400,'Identificador do evento inválido')
    try:
        data=[_item_data(x) for x in _query('prahoje_metricas_eventos',{'eventoId':eventoId})]
    except Exception:
        raise HTTPException(503,'Indicadores centralizados temporariamente indisponíveis')
    if not data:
        return {'eventoId':eventoId,'likes':0,'visualizacoes':0,'visualizacoesUnicas':0,'cliques':0}
    latest=max(data,key=lambda x:str(x.get('atualizadoEm') or ''))
    result={'eventoId':eventoId}
    for key in ('likes','visualizacoes','visualizacoesUnicas','cliques'):
        try:result[key]=max(0,int(float(latest.get(key) or 0)))
        except (TypeError,ValueError):result[key]=0
    return result


class MetricBatchRequest(BaseModel):
    eventIds:list[str]

@APP.post('/v1/metricas/likes/lote')
def likes_batch(payload:MetricBatchRequest):
    """Return only public aggregate likes. One backend request per visible page."""
    ids=list(dict.fromkeys(payload.eventIds))
    if len(ids)>100 or any(not re.fullmatch(r'[A-Za-z0-9:_.-]{6,128}',str(i)) for i in ids):
        raise HTTPException(400,'Informe até 100 identificadores válidos')
    if not ids:return {'counts':{},'source':'central'}
    try:
        items=[_item_data(x) for x in _query('prahoje_metricas_eventos')]
    except Exception:
        raise HTTPException(503,'Contador central temporariamente indisponível')
    wanted=set(ids)
    latest={}
    for m in items:
        mid=str(m.get('eventoId') or '')
        if mid in wanted and (mid not in latest or str(m.get('atualizadoEm') or '')>str(latest[mid].get('atualizadoEm') or '')):
            latest[mid]=m
    result={}
    for mid in ids:
        try:result[mid]=max(0,int(float((latest.get(mid) or {}).get('likes') or 0)))
        except (TypeError,ValueError):result[mid]=0
    return {'counts':result,'source':'central'}

@APP.get('/admin/api/integration-health')
def integration_health(_=Depends(auth)):
    state={'backend':'online','adminConfigured':bool(USER and PASS),
           'wixAdminCredentialPresent':bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')),
           'socialStorage':'wix-private-cms','socialWriteVerified':False,'socialReadVerified':False}
    try:
        _query('prahoje_metricas_eventos',{'eventoId':'__healthprobe__'})
        state['socialReadVerified']=True
    except Exception:
        pass
    state['socialWriteVerified']=False
    state['nextAction']='Configurar credencial administrativa válida para leitura e gravação no CMS; realizar teste de escrita protegido'
    return state


_RADAR_SNAPSHOT=json.loads("{\"catalogDate\":\"2026-11-09\",\"updatedAt\":\"2026-11-09T12:01:52.883Z\",\"events\":[{\"title\":\"2º Workshop da Agricultura Familiar\",\"category\":\"educacao\",\"price\":\"free\",\"date\":\"09/11\",\"time\":\"9h\",\"place\":\"Piracicaba\",\"teaser\":\"Encontro sobre agricultura familiar paulista.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3623928\",\"validUntil\":\"2026-11-09\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Novembro Azul: Masculinidades e Saúde Integral\",\"category\":\"humano\",\"price\":\"free\",\"date\":\"10/11\",\"time\":\"18h\",\"place\":\"SIMESPI · Rua Samuel Neves, 1601\",\"teaser\":\"Palestra com Fabrício Dorigati sobre saúde integral do homem.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3623346\",\"validUntil\":\"2026-11-10\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Embaixadores da Gentileza\",\"category\":\"humano\",\"price\":\"paid\",\"date\":\"11/11\",\"time\":\"8h30\",\"place\":\"ACIPI\",\"teaser\":\"Encontro sobre gentileza, cultura organizacional e bem-estar.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3620462\",\"validUntil\":\"2026-11-11\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Seminário de Automação Industrial · Pushcorp\",\"category\":\"educacao\",\"price\":\"free\",\"date\":\"12/11\",\"time\":\"10h\",\"place\":\"Piracicaba\",\"teaser\":\"Conteúdo técnico sobre automação industrial.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3580118\",\"validUntil\":\"2026-11-12\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Show Emo + Os Fantasmas de Astorga\",\"category\":\"shows\",\"price\":\"paid\",\"date\":\"13/11\",\"time\":\"17h\",\"place\":\"Piracicaba\",\"teaser\":\"Show e lançamento musical.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3623283\",\"validUntil\":\"2026-11-13\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"7ª Dama Lúdica · Aniversário Camaleão Lúdico\",\"category\":\"cultura\",\"price\":\"paid\",\"date\":\"14/11\",\"time\":\"15h\",\"place\":\"Cervejaria Dama Bier\",\"teaser\":\"Mais de 50 jogos de tabuleiro e celebração de aniversário, até 20h.\",\"link\":\"https://www.sympla.com.br/evento/7a-dama-ludica-especial-halloween/3622479\",\"validUntil\":\"2026-11-14\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Sofrência em Dose Dupla · Milene Gatti e Dri Lima\",\"category\":\"shows\",\"price\":\"paid\",\"date\":\"14/11\",\"time\":\"19h30\",\"place\":\"Vila Real Music Bar\",\"teaser\":\"Música sertaneja com Milene Gatti e Dri Lima.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3607136\",\"validUntil\":\"2026-11-14\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"A Menina e o Vento · Sábado\",\"category\":\"cultura\",\"price\":\"paid\",\"date\":\"14/11\",\"time\":\"20h\",\"place\":\"Floreia Teatro\",\"teaser\":\"Montagem teatral de Maria Clara Machado.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3623730\",\"validUntil\":\"2026-11-14\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"DUSAN Bailin · 3ª Edição\",\"category\":\"festas\",\"price\":\"paid\",\"date\":\"14/11\",\"time\":\"21h\",\"place\":\"Piracicaba\",\"teaser\":\"Festa e música na terceira edição.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3622822\",\"validUntil\":\"2026-11-14\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Latinolovefest Old School\",\"category\":\"festas\",\"price\":\"paid\",\"date\":\"14/11\",\"time\":\"21h\",\"place\":\"Cross · Centro\",\"teaser\":\"Festa de reggaeton clássico em Piracicaba.\",\"link\":\"https://www.sympla.com.br/evento/latinolovefest-old-school/3626592\",\"validUntil\":\"2026-11-14\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Pool do Gois\",\"category\":\"festas\",\"price\":\"paid\",\"date\":\"15/11\",\"time\":\"11h\",\"place\":\"Piracicaba\",\"teaser\":\"Encontro com música e lazer.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3559131\",\"validUntil\":\"2026-11-15\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"A Menina e o Vento · Domingo\",\"category\":\"cultura\",\"price\":\"paid\",\"date\":\"15/11\",\"time\":\"20h\",\"place\":\"Floreia Teatro\",\"teaser\":\"Segunda apresentação da montagem teatral.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3623748\",\"validUntil\":\"2026-11-15\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"O que propõe o fim da escala 6x1?\",\"category\":\"negocios\",\"price\":\"free\",\"date\":\"17/11\",\"time\":\"18h30\",\"place\":\"Piracicaba\",\"teaser\":\"Debate sobre propostas de mudança na jornada de trabalho.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3634113\",\"validUntil\":\"2026-11-17\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"André Santi · Stand-up Comedy\",\"category\":\"cultura\",\"price\":\"paid\",\"date\":\"19/11\",\"time\":\"20h30\",\"place\":\"Palatino Paulista\",\"teaser\":\"Stand-up comedy com ingressos pela Sympla.\",\"link\":\"https://www.sympla.com.br/evento/andre-santi-em-piracicaba-stand-up-comedy/3600205\",\"validUntil\":\"2026-11-19\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Acampamento Imago: O Maior dos Tesouros\",\"category\":\"humano\",\"price\":\"check\",\"date\":\"20/11\",\"time\":\"11h\",\"place\":\"Piracicaba\",\"teaser\":\"Atividade temática de convivência e experiências.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3572253\",\"validUntil\":\"2026-11-20\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Domingueira Agro · Costelada de Chão\",\"category\":\"gastronomia\",\"price\":\"paid\",\"date\":\"22/11\",\"time\":\"10h\",\"place\":\"Piracicaba\",\"teaser\":\"Confraternização com costelada.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3605833\",\"validUntil\":\"2026-11-22\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Arena ND 2026\",\"category\":\"inovacao\",\"price\":\"free\",\"date\":\"26/11\",\"time\":\"13h30\",\"place\":\"Faculdade Pecege · Av. Cezira Giovanoni Moretti, 580\",\"teaser\":\"Conexões, inovação e conteúdo de ecossistema.\",\"link\":\"https://www.linka.la/event/fc7dba32-11bc-432b-bfa8-c83ee6ef8c5d\",\"validUntil\":\"2026-11-26\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"João Suplicy canta Beatles e Elvis\",\"category\":\"shows\",\"price\":\"paid\",\"date\":\"27/11\",\"time\":\"22h\",\"place\":\"Piracicaba\",\"teaser\":\"Show de João Suplicy com repertório de Beatles e Elvis.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3582578\",\"validUntil\":\"2026-11-27\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"A Cidade e as Serras · SESI\",\"category\":\"cultura\",\"price\":\"free\",\"date\":\"26/11 a 28/11\",\"time\":\"20h (26 e 27); 19h (28)\",\"place\":\"Teatro SESI Piracicaba · Av. Luiz Ralph Benatti, 600\",\"teaser\":\"Espetáculo teatral; reservas liberadas a partir de 12/11.\",\"link\":\"https://www.sesisp.org.br/evento/edbf7c89-ad97-49ea-8082-3e06932a2121/a-cidade-e-as-serras-\",\"validUntil\":\"2026-11-28\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Esquadrão Motocycle\",\"category\":\"esportes\",\"price\":\"free\",\"date\":\"28/11\",\"time\":\"13h\",\"place\":\"Piracicaba\",\"teaser\":\"Encontro de motociclismo.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3551063\",\"validUntil\":\"2026-11-28\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Automação com IA · Piracicaba\",\"category\":\"educacao\",\"price\":\"paid\",\"date\":\"26 a 28/11\",\"time\":\"9h\",\"place\":\"Campus Pecege\",\"teaser\":\"Imersão presencial em agentes de IA, automação e aplicações empresariais.\",\"link\":\"https://www.linka.la/event/007e525c-ba9c-4975-95e4-3aef1b8b191f\",\"validUntil\":\"2026-11-28\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Além do que se vê · Mostra de Dança\",\"category\":\"cultura\",\"price\":\"free\",\"date\":\"29/11\",\"time\":\"19h\",\"place\":\"Teatro SESI Piracicaba · Av. Luiz Ralph Benatti, 600\",\"teaser\":\"Mostra dos Núcleos de Dança SESI; novo lote a partir de 22/11.\",\"link\":\"https://www.sesisp.org.br/evento/3f9b3018-3a32-49d0-9808-a83b519c427d/alem-do-que-se-ve\",\"validUntil\":\"2026-11-29\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Pantanal Caipira · Tanquã\",\"category\":\"turismo\",\"price\":\"paid\",\"date\":\"29/11\",\"time\":\"6h30\",\"place\":\"Tanquã\",\"teaser\":\"Natureza, contemplação e experiência turística.\",\"link\":\"https://www.sescsp.org.br/programacao/pantanal-caipira-tanqua-piracicaba-sp-4/\",\"validUntil\":\"2026-11-29\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Serginho Lacerda · Vida de Pai\",\"category\":\"cultura\",\"price\":\"paid\",\"date\":\"03/12\",\"time\":\"20h\",\"place\":\"Piracicaba\",\"teaser\":\"Espetáculo de humor de Serginho Lacerda.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3582573\",\"validUntil\":\"2026-12-03\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"The Black Parade\",\"category\":\"shows\",\"price\":\"paid\",\"date\":\"05/12\",\"time\":\"18h\",\"place\":\"Piracicaba\",\"teaser\":\"Show temático de rock.\",\"link\":\"https://www.sympla.com.br/evento/lgc/3630332\",\"validUntil\":\"2026-12-05\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Festa do Justin · All Eras\",\"category\":\"festas\",\"price\":\"paid\",\"date\":\"11/12\",\"time\":\"21h\",\"place\":\"Benjamim Rock Bar\",\"teaser\":\"Festa pop temática no Benjamim Rock Bar.\",\"link\":\"https://www.sympla.com.br/evento/festa-do-justin-em-piracicaba-sp-all-eras/3587935\",\"validUntil\":\"2026-12-11\",\"origin\":\"RADAR_PRA_HJ\"},{\"title\":\"Seminário Internacional de Aikido\",\"category\":\"esportes\",\"price\":\"paid\",\"date\":\"13 e 14/03/2027\",\"time\":\"consulte programação\",\"place\":\"Sesc Piracicaba\",\"teaser\":\"Seminário internacional com Tsuruzo Miyamoto Shihan.\",\"link\":\"https://www.linka.la/event/fb77b978-0438-4c30-b52d-033441c2610a\",\"validUntil\":\"2027-03-14\",\"origin\":\"RADAR_PRA_HJ\"}]}")
_RADAR_URL='https://headless-uqcbszqzghi-pedrousinae-140b.wix-site-host.com/radar-eventos.json'

def radar_active():
    """Segregated catalogue of public Radar events, independently of organizer CMS."""
    data=_RADAR_SNAPSHOT
    source='fallback-snapshot'
    warning='Catálogo de contingência; sincronização da vitrine não confirmada.'
    try:
        with urlopen(HTTPRequest(_RADAR_URL,headers={'Accept':'application/json','User-Agent':'PraHj-Command/1.0'}),timeout=7) as response:
            fresh=json.load(response)
        if isinstance(fresh.get('events'),list):
            data=fresh
            source='public-feed'
            warning=None
    except Exception:
        pass
    from datetime import datetime
    from zoneinfo import ZoneInfo
    day=datetime.now(ZoneInfo('America/Sao_Paulo')).date().isoformat()
    events=[]
    seen=set()
    for item in data.get('events',[]):
        if not isinstance(item,dict) or str(item.get('validUntil') or '')<day:continue
        link=str(item.get('link') or '')
        if not link.startswith('https://') or not item.get('title') or link.lower() in seen:continue
        seen.add(link.lower())
        h=2166136261
        for char in link.lower():
            h=((h ^ ord(char))*16777619)&0xffffffff
        events.append({**item,'id':f'public-{h:08x}','origin':'RADAR_PRA_HJ','trackingSource':'agenda_publica'})
    return {'events':events,'count':len(events),'source':source,'warning':warning,
            'updatedAt':data.get('updatedAt'),'catalogDate':data.get('catalogDate')}

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
    return {'radarEvents':radar['events'],'radarCount':radar['count'],'radarSource':radar['source'],'radarWarning':radar['warning'],'radarCatalogDate':radar['catalogDate'],'radarUpdatedAt':radar['updatedAt'],
            'events':events[:300],'totalEvents':len(events),
            'approvedEvents':approved,'pendingEvents':pending,
            'members':people,'applications':applications,
            'activeMembers':sum(x.get('habilitacao')=='HABILITADO' for x in people),
            'eventQueryError':error, 'eventSource':event_source,'metricsQueryError':metrics_error,'metricsByEvent':by_event,'metricsEventCount':len(by_event),
            'metricsTotals':{k:sum(max(0,int(float(m.get(k) or 0))) for m in by_event.values() if str(m.get(k) or '0').replace('.','',1).isdigit()) for k in ('visualizacoes','visualizacoesUnicas','cliques','likes')},'managementAvailable':management_available, 'integration':{'adminWixConfigured':bool(os.getenv('WIX_API_KEY') or os.getenv('WIX_TOKEN')),'publicRead':event_source=='visitor-read-only','writeOperations':'Dependem de API administrativa válida'}, 'socialStorageStatus':'Indisponível: métricas exigem conector privado válido' if metrics_error else 'Leitura das métricas privadas disponível (escrita ainda não homologada)','financeStatus':'Não integrado: receita e pagamentos exigem confirmação transacional',
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
<section class="surface"><h2>◈ Radar Pra Hj · Eventos rastreados</h2><p class="muted">Eventos ativos do catálogo da vitrine pública, rastreados e reunidos pelo Radar Pra Hj. Fonte e última data do catálogo indicadas abaixo. Essa lista não inclui cadastros submetidos por organizadores.</p><div class="tag" id="radarCount">—</div><p class="muted" id="radarStatus"></p><div class="tbl"><table><thead><tr><th>Evento rastreado</th><th>Data e horário</th><th>Local</th><th>Categoria</th><th>Fonte</th><th>Views</th><th>Cliques</th><th>Likes</th></tr></thead><tbody id="radarRows"></tbody></table></div></section>
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
const totals=x.metricsTotals||{};for(const [id,key] of [['m-views','visualizacoes'],['m-unique','visualizacoesUnicas'],['m-clicks','cliques'],['m-likes','likes']])set(id,x.metricsQueryError?'—':(totals[key]??0).toLocaleString('pt-BR'));set('metricsSummaryStatus',x.metricsQueryError||('Eventos com indicadores: '+x.metricsEventCount+' · Fonte: base privada Media Tech.'));set('metricsHealth',x.metricsQueryError||'Indicadores por evento consultados na base de métricas do Media Tech.');
set('financeStatus',x.financeStatus);if(!x.managementAvailable){set('status','Gestão de membros em modo somente leitura: credencial administrativa de dados ausente.');}
set('radarCount',(x.radarCount||0)+' eventos ativos do Radar');
set('radarStatus',(x.radarWarning||'Feed publicado sincronizado')+' · Data do catálogo: '+(x.radarCatalogDate||'não informada')+' · Origem: '+(x.radarSource||'indisponível'));
const rbody=rows('radarRows');
for(const e of x.radarEvents||[]){const tr=document.createElement('tr');
  cell(tr,e.title||'Evento sem título');cell(tr,(e.date||'—')+' · '+(e.time||''));cell(tr,e.place||'—');cell(tr,e.category||'—');
  const td=document.createElement('td'),a=document.createElement('a');a.textContent='Fonte';a.href=e.link;a.target='_blank';a.rel='noopener noreferrer';td.append(a);tr.append(td);
  const m=x.metricsByEvent?.[e.id]||{};for(const key of ['visualizacoes','cliques','likes'])cell(tr,x.metricsQueryError?'—':(m[key]??0));
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
