"""Clube PTP — identidade isolada. Requer PostgreSQL, segredos e homologação antes de uso público."""
import os, re, secrets, hashlib, hmac, datetime
from contextlib import contextmanager
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg
from psycopg.rows import dict_row

app=FastAPI(title="Clube PTP - Identidade (Homologação)",docs_url=None,redoc_url=None,openapi_url=None)
DB_URL=os.getenv("DATABASE_URL","")
ORIGINS=[s.strip() for s in os.getenv("PTP_CORS_ORIGINS","").split(",") if s.strip()]
if ORIGINS: app.add_middleware(CORSMiddleware,allow_origins=ORIGINS,allow_credentials=False,allow_methods=["GET","POST"],allow_headers=["Authorization","Content-Type"])
@app.middleware("http")
async def no_cache(req:Request,call_next):
    response=await call_next(req)
    response.headers["Cache-Control"]="no-store"
    response.headers["X-Content-Type-Options"]="nosniff"
    response.headers["Referrer-Policy"]="no-referrer"
    return response
@contextmanager
def db():
    if not DB_URL: raise HTTPException(503,"Banco ainda não configurado")
    try:
        with psycopg.connect(DB_URL,connect_timeout=5,sslmode="require",row_factory=dict_row) as c:
            yield c
    except psycopg.Error:
        raise HTTPException(503,"Banco indisponível")
def utc():return datetime.datetime.now(datetime.timezone.utc)
def password_hash(password,salt=None):
    salt=salt or secrets.token_bytes(16)
    value=hashlib.pbkdf2_hmac("sha256",password.encode(),salt,600000)
    return salt.hex()+":"+value.hex()
def check_password(password,stored):
    try:
        salt,expected=stored.split(":",1)
        candidate=password_hash(password,bytes.fromhex(salt)).split(":")[1]
        return hmac.compare_digest(candidate,expected)
    except (ValueError,TypeError): return False
def digest(token):return hashlib.sha256(token.encode()).hexdigest()
def valid_email(v):
    v=v.strip().lower()
    if len(v)>254 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+",v):raise HTTPException(422,"Email inválido")
    return v

@app.get("/health")
def health():return {"status":"alive","service":"clube-ptp-identity"}
@app.get("/ready")
def ready():
    if not DB_URL:raise HTTPException(503,"Banco não configurado")
    with db() as c:
        found={r["table_name"] for r in c.execute("select table_name from information_schema.tables where table_schema='public'").fetchall()}
    required={"ptp_companies","ptp_users","ptp_sessions","ptp_invites","ptp_audit","ptp_applications"}
    if not required.issubset(found):raise HTTPException(503,"Migrações pendentes")
    return {"status":"ready","database":"postgresql","migrations":"present"}

class Login(BaseModel):
    email:str
    password:str=Field(min_length=1)
class InvitationAcceptance(BaseModel):
    token:str=Field(min_length=32)
    name:str=Field(min_length=2,max_length=180)
    password:str=Field(min_length=12,max_length=128)
class Invite(BaseModel):
    email:str
    role:str
    company_id:int|None=None
class UserDisable(BaseModel):
    reason:str=Field(min_length=5,max_length=350)

def principal(authorization:str|None=Header(None)):
    if not authorization or not authorization.startswith("Bearer "):raise HTTPException(401,"Autenticação necessária")
    token=authorization[7:].strip()
    if len(token)<32:raise HTTPException(401,"Sessão inválida")
    with db() as c:
        u=c.execute("""select u.id,u.email,u.name,u.role,u.company_id,u.active,c.active as company_active
          from ptp_sessions s join ptp_users u on u.id=s.user_id
          left join ptp_companies c on c.id=u.company_id
          where s.token_hash=%s and s.revoked_at is null and s.expires_at>now()""",(digest(token),)).fetchone()
    if not u or not u["active"]:raise HTTPException(401,"Sessão inválida ou usuário inativo")
    if u["company_id"] and not u["company_active"]:raise HTTPException(403,"Empresa não habilitada")
    return dict(u)
def require(*roles):
    def dependency(u=Depends(principal)):
        if u["role"] not in roles:raise HTTPException(403,"Permissão insuficiente")
        return u
    return dependency

@app.post("/auth/login")
def login(data:Login):
    email=valid_email(data.email)
    with db() as c:
        u=c.execute("""select u.id,u.password_hash,u.active,u.company_id,
                 co.active as company_active from ptp_users u
                 left join ptp_companies co on co.id=u.company_id
                 where u.email=%s""",(email,)).fetchone()
        if not u or not u["active"] or not check_password(data.password,u["password_hash"]):
            raise HTTPException(401,"Credenciais inválidas")
        if u["company_id"] is not None and not u["company_active"]:
            raise HTTPException(403,"Vínculo empresarial não habilitado")
        token=secrets.token_urlsafe(48)
        c.execute("insert into ptp_sessions(user_id,token_hash,expires_at) values (%s,%s,now()+interval '8 hours')",(u["id"],digest(token)))
        c.commit()
        return {"access_token":token,"token_type":"bearer","expires_in":28800}

@app.post("/auth/logout")
def logout(authorization:str|None=Header(None),u=Depends(principal)):
    token=authorization.split(" ",1)[1]
    with db() as c:
        c.execute("update ptp_sessions set revoked_at=now() where token_hash=%s and user_id=%s",(digest(token),u["id"]))
        c.commit()
    return {"status":"revoked"}

@app.get("/me")
def me(u=Depends(principal)):
    return {k:v for k,v in u.items() if k!="company_active"}
@app.get("/admin/summary")
def admin_summary(u=Depends(require("admin"))):
    with db() as c:
        counts={}
        for name,table in (("companies","ptp_companies"),("users","ptp_users"),("sessions","ptp_sessions")):
            counts[name]=c.execute("select count(*) as n from "+table).fetchone()["n"]
    return counts

@app.post("/admin/invites")
def create_invitation(data:Invite,u=Depends(require("admin","manager"))):
    email=valid_email(data.email)
    if data.role not in ("manager","employee","provider"):raise HTTPException(422,"Papel inválido")
    if u["role"]=="manager" and (data.role!="employee" or data.company_id!=u["company_id"]):
        raise HTTPException(403,"Gestor só convida colaboradores da própria empresa")
    if data.role in ("manager","employee") and not data.company_id:raise HTTPException(422,"Empresa obrigatória")
    token=secrets.token_urlsafe(40)
    with db() as c:
        if data.company_id is not None:
            company=c.execute("select active from ptp_companies where id=%s",(data.company_id,)).fetchone()
            if not company or not company["active"]:
                raise HTTPException(409,"A associação da empresa deve estar habilitada")
        if c.execute("select 1 from ptp_users where email=%s",(email,)).fetchone():
            raise HTTPException(409,"Usuário já cadastrado")
        c.execute("""insert into ptp_invites(email,role,company_id,token_hash,created_by,expires_at)
                  values (%s,%s,%s,%s,%s,now()+interval '48 hours')""",
                  (email,data.role,data.company_id,digest(token),u["id"]))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",
                  (u["id"],"invite_created",email))
        c.commit()
    # Apenas homologação: envio por email transacional ainda não está integrado.
    return {"status":"pending_delivery","invite_id_delivery_required":True}

@app.post("/auth/accept-invite")
def accept_invite(data:InvitationAcceptance):
    with db() as c:
        invite=c.execute("""select id,email,role,company_id from ptp_invites
              where token_hash=%s and consumed_at is null and expires_at>now()
              for update""",(digest(data.token),)).fetchone()
        if not invite:raise HTTPException(400,"Convite inválido ou expirado")
        if c.execute("select 1 from ptp_users where email=%s",(invite["email"],)).fetchone():
            raise HTTPException(409,"Conta já existente")
        c.execute("""insert into ptp_users(email,name,password_hash,role,company_id,active)
              values (%s,%s,%s,%s,%s,false)""",(invite["email"],data.name,password_hash(data.password),invite["role"],invite["company_id"]))
        c.execute("update ptp_invites set consumed_at=now() where id=%s",(invite["id"],))
        c.commit()
    return {"status":"created","message":"Conta criada; habilitação e critérios empresariais ainda sujeitos à verificação"}

@app.post("/admin/users/{user_id}/disable")
def disable_user(user_id:int,data:UserDisable,u=Depends(require("admin"))):
    if user_id==u["id"]:raise HTTPException(409,"Não é permitido desabilitar a própria conta nesta operação")
    with db() as c:
        result=c.execute("update ptp_users set active=false where id=%s returning id",(user_id,)).fetchone()
        if not result:raise HTTPException(404,"Usuário não encontrado")
        c.execute("update ptp_sessions set revoked_at=now() where user_id=%s and revoked_at is null",(user_id,))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"user_disabled",str(user_id)))
        c.commit()
    return {"status":"disabled"}


class ActivationRequest(BaseModel):
    reason:str=Field(min_length=5,max_length=350)
@app.post("/admin/users/{user_id}/activate")
def activate_user(user_id:int,data:ActivationRequest,u=Depends(require("admin"))):
    with db() as c:
        target=c.execute("select id,company_id,role from ptp_users where id=%s",(user_id,)).fetchone()
        if not target:raise HTTPException(404,"Conta não encontrada")
        if target["company_id"]:
            co=c.execute("select active from ptp_companies where id=%s",(target["company_id"],)).fetchone()
            if not co or not co["active"]:raise HTTPException(409,"Empresa não homologada")
        c.execute("update ptp_users set active=true where id=%s",(user_id,))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"user_activated",str(user_id)))
        c.commit()
    return {"status":"activated"}

@app.get("/admin/users")
def list_users(u=Depends(require("admin"))):
    with db() as c:
        return {"users":[dict(r) for r in c.execute(
          "select id,email,name,role,company_id,active,created_at from ptp_users order by id desc limit 200").fetchall()]}

@app.get("/admin/audit")
def list_audit(u=Depends(require("admin"))):
    with db() as c:
        return {"events":[dict(r) for r in c.execute(
          "select id,actor_id,action,target,created_at from ptp_audit order by id desc limit 200").fetchall()]}


class CompanyCreate(BaseModel):
    name:str=Field(min_length=3,max_length=200)
class CompanyDecision(BaseModel):
    reason:str=Field(min_length=5,max_length=350)

@app.get("/admin/companies")
def admin_companies(u=Depends(require("admin"))):
    with db() as c:
        companies=c.execute("""select co.id,co.name,co.active,co.created_at,
         count(us.id) as total_people,
         count(us.id) filter (where us.active) as active_people
         from ptp_companies co left join ptp_users us on us.company_id=co.id
         group by co.id order by co.id desc limit 200""").fetchall()
    return {"companies":[dict(company) for company in companies]}

@app.post("/admin/companies")
def admin_create_company(data:CompanyCreate,u=Depends(require("admin"))):
    with db() as c:
        co=c.execute("insert into ptp_companies(name,active) values (%s,false) returning id,name,active",(data.name.strip(),)).fetchone()
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"company_created",str(co["id"])))
        c.commit()
    return dict(co)

@app.post("/admin/companies/{company_id}/activate")
def admin_activate_company(company_id:int,data:CompanyDecision,u=Depends(require("admin"))):
    with db() as c:
        co=c.execute("update ptp_companies set active=true where id=%s returning id",(company_id,)).fetchone()
        if not co:raise HTTPException(404,"Empresa não encontrada")
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"company_activated",str(company_id)))
        c.commit()
    return {"status":"active"}

@app.post("/admin/companies/{company_id}/suspend")
def admin_suspend_company(company_id:int,data:CompanyDecision,u=Depends(require("admin"))):
    with db() as c:
        co=c.execute("update ptp_companies set active=false where id=%s returning id",(company_id,)).fetchone()
        if not co:raise HTTPException(404,"Empresa não encontrada")
        c.execute("""update ptp_sessions set revoked_at=now()
              where user_id in (select id from ptp_users where company_id=%s)
              and revoked_at is null""",(company_id,))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"company_suspended",str(company_id)))
        c.commit()
    return {"status":"suspended","sessions_revoked":True}


class ApplicationSubmit(BaseModel):
    application_type:str
    organization_name:str=Field(min_length=3,max_length=200)
    contact_name:str=Field(min_length=3,max_length=160)
    contact_email:str
    contact_phone:str|None=Field(default=None,max_length=40)
    employee_count:int|None=Field(default=None,ge=1)
    notes:str|None=Field(default=None,max_length=2000)
class ApplicationReview(BaseModel):
    status:str
    reason:str=Field(min_length=5,max_length=350)

@app.post("/applications",status_code=201)
def submit_application(data:ApplicationSubmit):
    if data.application_type not in ("company","provider"):
        raise HTTPException(422,"Tipo de solicitação inválido")
    email=valid_email(data.contact_email)
    with db() as c:
        row=c.execute("""insert into ptp_applications
         (application_type,organization_name,contact_name,contact_email,contact_phone,employee_count,notes)
         values (%s,%s,%s,%s,%s,%s,%s) returning id,submitted_at""",
         (data.application_type,data.organization_name.strip(),data.contact_name.strip(),email,
          data.contact_phone,data.employee_count,data.notes)).fetchone()
        c.commit()
    return {"status":"pending","application_id":row["id"],"submitted_at":row["submitted_at"],"message":"Solicitação registrada para análise da equipe PTP. Não constitui adesão ou liberação de acesso."}

@app.get("/admin/applications")
def list_applications(u=Depends(require("admin"))):
    with db() as c:
        rows=c.execute("""select id,application_type,organization_name,contact_name,contact_email,
          contact_phone,employee_count,notes,status,submitted_at,reviewed_at from ptp_applications
          order by submitted_at desc limit 200""").fetchall()
    return {"applications":[dict(row) for row in rows]}

@app.post("/admin/applications/{application_id}/review")
def review_application(application_id:int,data:ApplicationReview,u=Depends(require("admin"))):
    if data.status not in ("under_review","approved","rejected"):
        raise HTTPException(422,"Situação inválida")
    with db() as c:
        row=c.execute("""update ptp_applications set status=%s,reviewed_by=%s,reviewed_at=now()
            where id=%s returning id,status""",(data.status,u["id"],application_id)).fetchone()
        if not row:raise HTTPException(404,"Solicitação não encontrada")
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",
                  (u["id"],"application_"+data.status,str(application_id)))
        c.commit()
    return dict(row)


@app.get("/manager/beneficiaries")
def manager_beneficiaries(u=Depends(require("manager"))):
    if u["company_id"] is None:raise HTTPException(403,"Gestor sem associação")
    with db() as c:
        rows=c.execute("""select id,name,email,role,active,created_at from ptp_users
          where company_id=%s and role='employee' order by created_at desc limit 200""",(u["company_id"],)).fetchall()
        invites=c.execute("""select id,email,expires_at,consumed_at from ptp_invites
          where company_id=%s and role='employee' order by id desc limit 200""",(u["company_id"],)).fetchall()
    return {"beneficiaries":[dict(x) for x in rows],"invitations":[dict(x) for x in invites]}

class BeneficiaryInvite(BaseModel):
    email:str
@app.post("/manager/beneficiaries/invitations",status_code=202)
def invite_beneficiary(data:BeneficiaryInvite,u=Depends(require("manager"))):
    if u["company_id"] is None:raise HTTPException(403,"Gestor sem empresa")
    email=valid_email(data.email)
    with db() as c:
        company=c.execute("select active from ptp_companies where id=%s",(u["company_id"],)).fetchone()
        if not company or not company["active"]:raise HTTPException(409,"Empresa ainda não habilitada")
        if c.execute("select 1 from ptp_users where email=%s",(email,)).fetchone():
            raise HTTPException(409,"E-mail já cadastrado")
        if c.execute("""select 1 from ptp_invites where email=%s and company_id=%s and
                    consumed_at is null and expires_at>now()""",(email,u["company_id"])).fetchone():
            raise HTTPException(409,"Convite válido já registrado")
        token=secrets.token_urlsafe(40)
        row=c.execute("""insert into ptp_invites(email,role,company_id,token_hash,created_by,expires_at)
          values (%s,'employee',%s,%s,%s,now()+interval '48 hours') returning id""",
          (email,u["company_id"],digest(token),u["id"])).fetchone()
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"beneficiary_invited",email))
        c.commit()
    return {"invitation_id":row["id"],"status":"pending_delivery",
            "message":"Convite registrado, mas o envio de e-mail ainda não está habilitado"}

# Explicit opt-in migration bootstrap for staging
import clube_startup  # noqa: E402,F401
