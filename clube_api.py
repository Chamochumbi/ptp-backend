"""Clube PTP — identidade isolada. Requer PostgreSQL, segredos e homologação antes de uso público."""
import os, re, secrets, hashlib, hmac, datetime, smtplib, ssl
from email.message import EmailMessage
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
@app.get("/status/capabilities")
def operational_capabilities():
    smtp_keys=("PTP_SMTP_HOST","PTP_SMTP_FROM","PTP_SMTP_USER","PTP_SMTP_PASSWORD")
    smtp_configured=all(bool(os.getenv(k,"").strip()) for k in smtp_keys)
    if not DB_URL:
        return {"api":"online","database":"not_configured","invitations":"configured" if smtp_configured else "not_configured","operations_ready":False}
    try:
        with db() as c:
            names={r["table_name"] for r in c.execute("select table_name from information_schema.tables where table_schema='public'").fetchall()}
        required={"ptp_companies","ptp_users","ptp_sessions","ptp_invites","ptp_audit","ptp_applications","ptp_benefits","ptp_redemptions","ptp_offer_submissions","ptp_usage_events","ptp_member_credentials","ptp_checkin_tokens","ptp_physical_checkins"}
        database="ready" if required.issubset(names) else "migrations_pending"
    except HTTPException:
        database="unavailable"
    return {"api":"online","database":database,"invitations":"configured" if smtp_configured else "not_configured","operations_ready":database=="ready" and smtp_configured}

@app.get("/ready")
def ready():
    if not DB_URL:raise HTTPException(503,"Banco não configurado")
    with db() as c:
        found={r["table_name"] for r in c.execute("select table_name from information_schema.tables where table_schema='public'").fetchall()}
    required={"ptp_companies","ptp_users","ptp_sessions","ptp_invites","ptp_audit","ptp_applications"}
    if not required.issubset(found):raise HTTPException(503,"Migrações pendentes")
    return {"status":"ready","database":"postgresql","migrations":"present"}

def send_invite_email(email, token):
    host=os.getenv("PTP_SMTP_HOST","").strip()
    sender=os.getenv("PTP_SMTP_FROM","").strip()
    login=os.getenv("PTP_SMTP_USER","").strip()
    secret=os.getenv("PTP_SMTP_PASSWORD","")
    if not all((host,sender,login,secret)):
        raise HTTPException(503,"Entrega de convites ainda não configurada")
    url=os.getenv("PTP_INVITE_URL","https://headless-bnbjhenmacf-pedrousinae-140b.wix-site-host.com/painel.html")
    # The invitation token is not embedded in a tracking URL or server logs.
    msg=EmailMessage()
    msg["Subject"]="Convite individual — Clube de Benefícios PTP"
    msg["From"]=sender
    msg["To"]=email
    msg.set_content("Você foi convidado para o Clube de Benefícios PTP.\n"
                    "Acesse a área de participantes: "+url+"\n"
                    "Código de convite (uso único; válido por 48 horas): "+token+"\n"
                    "Não compartilhe este código.")
    try:
        with smtplib.SMTP_SSL(host,int(os.getenv("PTP_SMTP_PORT","465")),context=ssl.create_default_context(),timeout=12) as smtp:
            smtp.login(login,secret)
            smtp.send_message(msg)
    except (OSError,smtplib.SMTPException,ValueError):
        raise HTTPException(503,"Não foi possível entregar o convite; tente novamente")

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

class PasswordChange(BaseModel):
    current_password:str=Field(min_length=1)
    new_password:str=Field(min_length=12,max_length=128)

@app.post("/auth/change-password")
def change_password(data:PasswordChange,u=Depends(principal),authorization:str|None=Header(None)):
    if data.current_password==data.new_password:
        raise HTTPException(422,"A nova senha deve ser diferente da atual")
    session_token=authorization[7:].strip()
    with db() as c:
        account=c.execute("select id,password_hash from ptp_users where id=%s for update",(u["id"],)).fetchone()
        if not account or not check_password(data.current_password,account["password_hash"]):
            raise HTTPException(401,"Senha atual incorreta")
        c.execute("update ptp_users set password_hash=%s where id=%s",(password_hash(data.new_password),u["id"]))
        c.execute("update ptp_sessions set revoked_at=now() where user_id=%s and revoked_at is null",(u["id"],))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"password_changed",str(u["id"])))
        c.commit()
    return {"status":"changed","sessions_revoked":True,"message":"Senha alterada. Entre novamente."}

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
        send_invite_email(email,token)
        c.commit()
    return {"status":"sent","invite_id_delivery_required":False}

@app.post("/auth/accept-invite")
def accept_invite(data:InvitationAcceptance):
    with db() as c:
        invite=c.execute("""select id,email,role,company_id from ptp_invites
              where token_hash=%s and consumed_at is null and expires_at>now()
              for update""",(digest(data.token),)).fetchone()
        if not invite:raise HTTPException(400,"Convite inválido ou expirado")
        if invite["company_id"] is not None:
            company=c.execute("select active from ptp_companies where id=%s",(invite["company_id"],)).fetchone()
            if not company or not company["active"]:
                raise HTTPException(409,"Empresa não habilitada")
        if c.execute("select 1 from ptp_users where email=%s",(invite["email"],)).fetchone():
            raise HTTPException(409,"Conta já existente")
        c.execute("""insert into ptp_users(email,name,password_hash,role,company_id,active)
              values (%s,%s,%s,%s,%s,%s)""",(invite["email"],data.name,password_hash(data.password),invite["role"],invite["company_id"],invite["role"] in ("manager","employee") and invite["company_id"] is not None))
        c.execute("update ptp_invites set consumed_at=now() where id=%s",(invite["id"],))
        c.commit()
    return {"status":"created","active":invite["role"] in ("manager","employee") and invite["company_id"] is not None,
            "message":"Conta criada. Acesse com seu e-mail e senha." if invite["role"] in ("manager","employee") and invite["company_id"] is not None else "Conta criada; aguardando habilitação administrativa."}

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
    if data.application_type not in ("company","provider","access"):
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


class AdminRoleRequest(BaseModel):
    reason:str=Field(min_length=8,max_length=350)

@app.post("/admin/users/{user_id}/grant-ptp-admin")
def grant_ptp_admin(user_id:int,data:AdminRoleRequest,u=Depends(require("admin"))):
    # Reserved institutional identity; a public applicant cannot elevate itself.
    with db() as c:
        target=c.execute("select id,email,role,active from ptp_users where id=%s for update",(user_id,)).fetchone()
        if not target:raise HTTPException(404,"Conta não encontrada")
        if target["email"].strip().lower()!="parquetecnologicopiracicaba@gmail.com":
            raise HTTPException(403,"Perfil ADM reservado exclusivamente ao e-mail institucional PTP")
        if not target["active"]:
            raise HTTPException(409,"Ative a conta antes de atribuir perfil ADM")
        if target["role"]=="admin":return {"status":"already_admin","user_id":user_id}
        c.execute("update ptp_users set role='admin' where id=%s",(user_id,))
        c.execute("update ptp_sessions set revoked_at=now() where user_id=%s and revoked_at is null",(user_id,))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"ptp_admin_granted",str(user_id)))
        c.commit()
    return {"status":"admin_granted","user_id":user_id,"sessions_revoked":True}

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
        send_invite_email(email,token)
        c.commit()
    return {"invitation_id":row["id"],"status":"sent",
            "message":"Convite enviado ao e-mail do beneficiário"}


@app.get("/admin/beneficiaries")
def admin_all_beneficiaries(u=Depends(require("admin"))):
    with db() as c:
        people=c.execute("""select p.id,p.name,p.email,p.active,p.created_at,
           co.id as company_id,co.name as company_name
           from ptp_users p join ptp_companies co on co.id=p.company_id
           where p.role='employee' order by p.created_at desc limit 200""").fetchall()
    return {"beneficiaries":[dict(v) for v in people],"limit":200}

@app.get("/admin/overview")
def admin_overview(u=Depends(require("admin"))):
    with db() as c:
        companies=c.execute("""select count(*) total,
             count(*) filter(where active) active from ptp_companies""").fetchone()
        users=c.execute("""select count(*) total,
             count(*) filter(where active) active,
             count(*) filter(where role='employee') beneficiaries
             from ptp_users""").fetchone()
        pending=c.execute("""select count(*) total from ptp_applications
             where status in ('pending','under_review')""").fetchone()
        outstanding=c.execute("""select count(*) total from ptp_invites
             where consumed_at is null and expires_at>now()""").fetchone()
    return {"companies":dict(companies),"users":dict(users),
            "pending_applications":pending["total"],"pending_invites":outstanding["total"],
            "offers":None,"redemptions":None,"financial":None}


@app.get("/me/eligibility")
def account_eligibility(u=Depends(principal)):
    company_verified=u["role"]=="admin"
    if u["company_id"] is not None:
        with db() as c:
            company=c.execute("select active from ptp_companies where id=%s",(u["company_id"],)).fetchone()
            company_verified=bool(company and company["active"])
    eligible=bool(u["active"] and company_verified and u["role"] in ("admin","manager","employee"))
    return {"eligible":eligible,"company_verified":company_verified,
            "cpf_verified":False,"email_verified":False,
            "verification_note":"CPF e e-mail ainda não possuem módulo de verificação"}

@app.get("/company/members")
def company_members(u=Depends(require("manager","admin"))):
    if u["role"]=="admin" and u["company_id"] is None:
        raise HTTPException(422,"Selecione uma empresa pela visão administrativa")
    with db() as c:
        rows=c.execute("""select id,name,email,role,active,created_at from ptp_users
          where company_id=%s and role='employee' order by created_at desc limit 200""",(u["company_id"],)).fetchall()
    return {"members":[dict(x) for x in rows],"total":len(rows)}


@app.get("/company/invitations")
def company_invitations(u=Depends(require("manager","admin"))):
    if u["company_id"] is None:
        raise HTTPException(422,"Uma empresa vinculada é necessária")
    with db() as c:
        rows=c.execute("""select id,email,expires_at,consumed_at from ptp_invites
          where company_id=%s and role='employee' order by id desc limit 200""",(u["company_id"],)).fetchall()
    return {"invitations":[dict(x) for x in rows]}


class RedemptionRequest(BaseModel):
    benefit_id:str=Field(min_length=1,max_length=120)

@app.get("/benefits")
def list_benefits():
    with db() as c:
        rows=c.execute("select id,title,provider,category,description,active from ptp_benefits where active=true order by title limit 250").fetchall()
    return {"benefits":[dict(r) for r in rows]}

@app.post("/redemptions",status_code=201)
def create_redemption(data:RedemptionRequest,u=Depends(require("employee","manager"))):
    if u["company_id"] is None:
        raise HTTPException(403,"Vínculo empresarial obrigatório")
    with db() as c:
        co=c.execute("select active from ptp_companies where id=%s",(u["company_id"],)).fetchone()
        if not co or not co["active"]:raise HTTPException(403,"Empresa não habilitada")
        benefit=c.execute("select active from ptp_benefits where id=%s",(data.benefit_id,)).fetchone()
        if not benefit or not benefit["active"]:raise HTTPException(404,"Benefício indisponível")
        record=c.execute("""insert into ptp_redemptions(benefit_id,user_id,company_id)
            values (%s,%s,%s) returning id,status,requested_at""",
            (data.benefit_id,u["id"],u["company_id"])).fetchone()
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",(u["id"],"redemption_requested",str(record["id"])))
        c.commit()
    return dict(record)

@app.get("/me/redemptions")
def my_redemptions(u=Depends(principal)):
    with db() as c:
        rows=c.execute("""select r.id,r.benefit_id,b.title,r.status,r.requested_at,r.confirmed_at
           from ptp_redemptions r join ptp_benefits b on b.id=r.benefit_id
           where r.user_id=%s order by r.requested_at desc limit 200""",(u["id"],)).fetchall()
    return {"redemptions":[dict(x) for x in rows]}

@app.get("/admin/benefits")
def admin_benefits(u=Depends(require("admin"))):
    with db() as c:
        rows=c.execute("""select b.id,b.title,b.provider,b.category,b.active,
          count(r.id) filter (where r.status='confirmed') as confirmed,
          count(r.id) filter (where r.status='requested') as pending,
          count(distinct r.user_id) filter (where r.status='confirmed') as unique_users,
          count(distinct r.company_id) filter (where r.status='confirmed') as using_companies
          from ptp_benefits b left join ptp_redemptions r on r.benefit_id=b.id
          group by b.id order by b.title""").fetchall()
    return {"benefits":[dict(x) for x in rows]}

@app.get("/admin/benefits/{benefit_id}/usage")
def benefit_usage(benefit_id:str,u=Depends(require("admin"))):
    with db() as c:
        benefit=c.execute("select id,title,provider,category,description,active from ptp_benefits where id=%s",(benefit_id,)).fetchone()
        if not benefit:raise HTTPException(404,"Benefício não cadastrado")
        rows=c.execute("""select r.id,r.status,r.requested_at,r.confirmed_at,
              us.name as beneficiary,us.email as beneficiary_email,co.name as company
              from ptp_redemptions r join ptp_users us on us.id=r.user_id
              join ptp_companies co on co.id=r.company_id
              where r.benefit_id=%s order by r.requested_at desc limit 200""",(benefit_id,)).fetchall()
    return {"benefit":dict(benefit),"records":[dict(x) for x in rows],"returned_limit":200}

class RedemptionDecision(BaseModel):
    status:str
@app.post("/admin/redemptions/{redemption_id}/decision")
def decide_redemption(redemption_id:int,data:RedemptionDecision,u=Depends(require("admin"))):
    if data.status not in ("confirmed","cancelled"):raise HTTPException(422,"Decisão inválida")
    with db() as c:
        row=c.execute("""update ptp_redemptions
          set status=%s,confirmed_at=case when %s='confirmed' then now() else null end,
              confirmed_by=%s
          where id=%s and status='requested' returning id,status""",
          (data.status,data.status,u["id"],redemption_id)).fetchone()
        if not row:raise HTTPException(409,"Resgate inexistente ou já decidido")
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",
                  (u["id"],"redemption_"+data.status,str(redemption_id)))
        c.commit()
    return dict(row)


class BenefitCatalogItem(BaseModel):
    id:str=Field(min_length=1,max_length=120)
    title:str=Field(min_length=2,max_length=250)
    provider:str=Field(default="",max_length=250)
    category:str=Field(default="",max_length=100)
    description:str=Field(default="",max_length=5000)
    active:bool=True
class BenefitCatalogImport(BaseModel):
    benefits:list[BenefitCatalogItem]=Field(min_length=1,max_length=250)

@app.post("/admin/benefits/import")
def import_benefit_catalog(data:BenefitCatalogImport,u=Depends(require("admin"))):
    if any(v.category not in OFFER_CATEGORIES for v in data.benefits):raise HTTPException(422,"Categoria fora do padrão do Clube")
    if len({v.id for v in data.benefits})!=len(data.benefits):
        raise HTTPException(422,"Identificadores duplicados")
    with db() as c:
        for v in data.benefits:
            c.execute("""insert into ptp_benefits(id,title,provider,category,description,active)
                  values (%s,%s,%s,%s,%s,%s)
                  on conflict(id) do update set title=excluded.title,provider=excluded.provider,
                    category=excluded.category,description=excluded.description,active=excluded.active,
                    updated_at=now()""",
                  (v.id,v.title,v.provider,v.category,v.description,v.active))
        c.execute("insert into ptp_audit(actor_id,action,target) values (%s,%s,%s)",
                  (u["id"],"catalog_import",str(len(data.benefits))))
        c.commit()
    return {"imported":len(data.benefits),"message":"Catálogo gravado no banco do Clube"}


# Central catalog: database wins; the published 25-offer snapshot is a bootstrap-only fallback.
CATALOG_SEED_URL="https://headless-uydjfwgjdgr-pedrousinae-140b.wix-site-host.com/assets/ofertas-publicas.json"

@app.get("/catalog")
def central_catalog():
    import json,urllib.request
    if DB_URL:
        try:
            with db() as c:
                rows=c.execute("""select id,title,provider,category,description,active
                    from ptp_benefits order by id""").fetchall()
            if rows:
                return {"source":"postgresql","canonical":True,
                    "benefits":[{"id":r["id"],"title":r["title"],"partner":r["provider"],
                     "category":r["category"],"description":r["description"],"active":r["active"]} for r in rows]}
        except (HTTPException,psycopg.Error):
            pass
    try:
        with urllib.request.urlopen(CATALOG_SEED_URL,timeout=5) as resp:
            data=json.load(resp)
        if not isinstance(data,list) or len(data)<1:raise ValueError("Catálogo vazio")
        return {"source":"published_snapshot","canonical":False,"benefits":data,
                "warning":"Catálogo de contingência: banco ainda não homologado"}
    except Exception:
        raise HTTPException(503,"Catálogo indisponível")

@app.get("/catalog/providers")
def central_providers():
    catalog=central_catalog()
    groups={}
    for item in catalog["benefits"]:
        partner=(item.get("partner") or item.get("provider") or "Não identificado").strip()
        entry=groups.setdefault(partner,{"name":partner,"benefit_ids":[],"benefit_count":0})
        entry["benefit_ids"].append(str(item["id"]))
        entry["benefit_count"]+=1
    return {"source":catalog["source"],"canonical":catalog["canonical"],
             "providers":list(groups.values())}


OFFER_CATEGORIES=["Comunicação","Desenvolvimento","Educação","Finanças","Gestão","Hospedagem","Infraestrutura","Internacionalização","Saúde","Serviços","Sustentabilidade","Tecnologia"]

@app.get("/offer-categories")
def offer_categories():
    return {"categories":OFFER_CATEGORIES}

class OfferSubmission(BaseModel):
    title:str=Field(min_length=3,max_length=250)
    category:str=Field(min_length=2,max_length=100)
    description:str=Field(min_length=10,max_length=5000)
class ReviewOffer(BaseModel):
    decision:str
    reason:str=Field(default="",max_length=500)
class UsageEvent(BaseModel):
    event_type:str=Field(pattern="^(benefit_view|benefit_click|provider_view|profile_view)$")
    subject_type:str=Field(pattern="^(benefit|provider|profile)$")
    subject_id:str=Field(min_length=1,max_length=120)
@app.post("/provider/offers",status_code=201)
def submit_offer(data:OfferSubmission,u=Depends(require("provider"))):
    if data.category not in OFFER_CATEGORIES:raise HTTPException(422,"Selecione uma categoria válida do catálogo")
    with db() as c:
        row=c.execute("""insert into ptp_offer_submissions(provider_user_id,title,category,description)
            values(%s,%s,%s,%s) returning id,status,submitted_at""",
            (u["id"],data.title,data.category,data.description)).fetchone()
        c.execute("insert into ptp_audit(actor_id,action,target) values(%s,%s,%s)",
                  (u["id"],"offer_submitted",str(row["id"])))
        c.commit()
    return dict(row)
@app.get("/provider/offers")
def my_offers(u=Depends(require("provider"))):
    with db() as c:
        rows=c.execute("""select id,title,category,description,status,benefit_id,submitted_at,reviewed_at
          from ptp_offer_submissions where provider_user_id=%s order by submitted_at desc limit 250""",
          (u["id"],)).fetchall()
    return {"offers":[dict(r) for r in rows]}
@app.get("/admin/offers/queue")
def offer_queue(u=Depends(require("admin"))):
    with db() as c:
        rows=c.execute("""select o.id,o.title,o.category,o.description,o.status,o.submitted_at,
             p.name as provider,p.email as provider_email
          from ptp_offer_submissions o join ptp_users p on p.id=o.provider_user_id
          where o.status='pending' order by o.submitted_at limit 250""").fetchall()
    return {"offers":[dict(r) for r in rows]}
@app.post("/admin/offers/{offer_id}/review")
def review_offer(offer_id:int,data:ReviewOffer,u=Depends(require("admin"))):
    if data.decision not in ("approved","rejected"):raise HTTPException(422,"Decisão inválida")
    with db() as c:
        row=c.execute("""select o.id,o.title,o.category,o.description,o.status,
                 p.name as provider from ptp_offer_submissions o
                 join ptp_users p on p.id=o.provider_user_id
                 where o.id=%s for update of o""",(offer_id,)).fetchone()
        if not row:raise HTTPException(404,"Proposta inexistente")
        if row["status"]!="pending":raise HTTPException(409,"Proposta já analisada")
        benefit_id=None
        if data.decision=="approved":
            benefit_id="submitted-"+str(offer_id)
            c.execute("""insert into ptp_benefits(id,title,provider,category,description,active)
                values(%s,%s,%s,%s,%s,true) on conflict(id) do nothing""",
                (benefit_id,row["title"],row["provider"],row["category"],row["description"]))
        c.execute("""update ptp_offer_submissions set status=%s,benefit_id=%s,
                  reviewed_by=%s,reviewed_at=now() where id=%s""",
                  (data.decision,benefit_id,u["id"],offer_id))
        c.execute("insert into ptp_audit(actor_id,action,target) values(%s,%s,%s)",
                  (u["id"],"offer_"+data.decision,str(offer_id)))
        c.commit()
    return {"id":offer_id,"status":data.decision,"benefit_id":benefit_id}
@app.post("/usage/events",status_code=201)
def record_usage(data:UsageEvent,u=Depends(principal)):
    valid={"benefit_view":"benefit","benefit_click":"benefit","provider_view":"provider","profile_view":"profile"}
    if valid[data.event_type]!=data.subject_type:raise HTTPException(422,"Evento incompatível")
    with db() as c:
        c.execute("""insert into ptp_usage_events(user_id,company_id,event_type,subject_type,subject_id)
            values(%s,%s,%s,%s,%s)""",(u["id"],u["company_id"],data.event_type,data.subject_type,data.subject_id))
        c.commit()
    return {"recorded":True}
@app.get("/admin/analytics/dimensions")
def dimensions(u=Depends(require("admin"))):
    with db() as c:
        events=c.execute("""select event_type,subject_type,subject_id,count(*) as events,
          count(distinct user_id) as unique_users,count(distinct company_id) as companies
          from ptp_usage_events group by event_type,subject_type,subject_id
          order by events desc limit 500""").fetchall()
        flows=c.execute("""select status,count(*) as total from ptp_offer_submissions group by status""").fetchall()
    return {"events":[dict(r) for r in events],"offer_workflow":[dict(r) for r in flows]}


class PhysicalValidation(BaseModel):
    credential:str=Field(min_length=8,max_length=256)
    benefit_id:str=Field(min_length=1,max_length=120)
def physical_context(c,operator,credential,benefit_id,lock=False):
    if operator["role"]!="provider" and operator["role"]!="admin":raise HTTPException(403,"Operador não autorizado")
    b=c.execute("select id,title,provider,active from ptp_benefits where id=%s",(benefit_id,)).fetchone()
    if not b or not b["active"]:raise HTTPException(404,"Benefício indisponível")
    if operator["role"]=="provider":
        if not operator["company_id"]:raise HTTPException(403,"Ofertante ainda não vinculado a empresa")
        org=c.execute("select name,active from ptp_companies where id=%s",(operator["company_id"],)).fetchone()
        if not org or not org["active"] or org["name"].strip().casefold()!=b["provider"].strip().casefold():
            raise HTTPException(403,"Benefício não pertence a este ofertante")
    # Alphanumeric member code is a lookup only; check-in requires a rotating QR token.
    if credential.startswith("PTP-"):
        row=c.execute("""select us.id,us.name,us.company_id,us.active,co.active as company_active,
               cr.photo_url from ptp_member_credentials cr join ptp_users us on us.id=cr.user_id
               left join ptp_companies co on co.id=us.company_id
               where cr.member_code=%s""",(credential,)).fetchone()
        token_row=None
    else:
        lock_sql=" for update of t" if lock else ""
        token_row=c.execute("""select t.token_hash,t.user_id,t.expires_at,t.consumed_at from ptp_checkin_tokens t
            where t.token_hash=%s"""+lock_sql,(digest(credential),)).fetchone()
        if not token_row or token_row["consumed_at"] or token_row["expires_at"]<=utc():
            raise HTTPException(401,"QR expirado ou já utilizado")
        row=c.execute("""select us.id,us.name,us.company_id,us.active,co.active as company_active,
                cr.photo_url from ptp_users us left join ptp_companies co on co.id=us.company_id
                left join ptp_member_credentials cr on cr.user_id=us.id where us.id=%s""",
                (token_row["user_id"],)).fetchone()
    if not row or not row["active"] or not row["company_id"] or not row["company_active"]:
        raise HTTPException(403,"Beneficiário não habilitado")
    return b,row,token_row

@app.get("/me/credential")
def member_credential(u=Depends(require("employee","manager"))):
    if not u["company_id"]:raise HTTPException(403,"Empresa obrigatória")
    with db() as c:
        code=c.execute("select member_code,photo_url from ptp_member_credentials where user_id=%s",
                     (u["id"],)).fetchone()
        if not code:
            member_code="PTP-"+secrets.token_hex(6).upper()
            code=c.execute("""insert into ptp_member_credentials(user_id,member_code)
                  values(%s,%s) on conflict(user_id) do update set user_id=excluded.user_id
                  returning member_code,photo_url""",(u["id"],member_code)).fetchone()
        token=secrets.token_urlsafe(32)
        c.execute("""insert into ptp_checkin_tokens(token_hash,user_id,expires_at)
            values(%s,%s,now()+interval '2 minutes')""",(digest(token),u["id"]))
        c.commit()
    return {"name":u["name"],"member_code":code["member_code"],"photo_url":code["photo_url"],
            "qr_value":token,"qr_valid_seconds":120,
            "note":"Código alfanumérico identifica o associado; confirmação exige QR válido"}

@app.post("/provider/validate-member")
def validate_member(data:PhysicalValidation,u=Depends(require("provider","admin"))):
    with db() as c:
        b,member,_=physical_context(c,u,data.credential,data.benefit_id)
    return {"valid":True,"member_name":member["name"],"photo_url":member["photo_url"],
            "benefit_title":b["title"],"confirmation_allowed":not data.credential.startswith("PTP-"),
            "note":"Confira a fotografia presencialmente, quando cadastrada"}

@app.post("/provider/checkin",status_code=201)
def physical_checkin(data:PhysicalValidation,u=Depends(require("provider","admin"))):
    if data.credential.startswith("PTP-"):
        raise HTTPException(422,"Código impresso não autoriza resgate: solicite QR temporário")
    with db() as c:
        b,member,token_row=physical_context(c,u,data.credential,data.benefit_id,lock=True)
        result=c.execute("""insert into ptp_redemptions(benefit_id,user_id,company_id,status,confirmed_at,confirmed_by)
              values(%s,%s,%s,'confirmed',now(),%s) returning id,confirmed_at""",
              (b["id"],member["id"],member["company_id"],u["id"])).fetchone()
        c.execute("""insert into ptp_physical_checkins(redemption_id,provider_user_id,beneficiary_user_id,
                  benefit_id,company_id) values(%s,%s,%s,%s,%s)""",
                  (result["id"],u["id"],member["id"],b["id"],member["company_id"]))
        c.execute("update ptp_checkin_tokens set consumed_at=now() where token_hash=%s",
                  (token_row["token_hash"],))
        c.execute("insert into ptp_audit(actor_id,action,target) values(%s,%s,%s)",
                  (u["id"],"physical_checkin",str(result["id"])))
        c.commit()
    return {"redemption_id":result["id"],"status":"confirmed","confirmed_at":result["confirmed_at"]}

@app.get("/provider/checkins")
def provider_checkins(u=Depends(require("provider","admin"))):
    with db() as c:
        if u["role"]=="admin":
            rows=c.execute("""select p.id,p.benefit_id,b.title,p.confirmed_at from ptp_physical_checkins p
                join ptp_benefits b on b.id=p.benefit_id order by p.confirmed_at desc limit 200""").fetchall()
        else:
            rows=c.execute("""select p.id,p.benefit_id,b.title,p.confirmed_at from ptp_physical_checkins p
                join ptp_benefits b on b.id=p.benefit_id
                where p.provider_user_id=%s order by p.confirmed_at desc limit 200""",
                (u["id"],)).fetchall()
    return {"checkins":[dict(x) for x in rows]}
@app.get("/manager/redemptions")
def manager_redemptions(u=Depends(require("manager","admin"))):
    if not u["company_id"]:raise HTTPException(422,"Empresa não vinculada")
    with db() as c:
        rows=c.execute("""select r.id,r.benefit_id,b.title,r.status,r.confirmed_at,
            us.name as beneficiary from ptp_redemptions r join ptp_users us on us.id=r.user_id
            join ptp_benefits b on b.id=r.benefit_id where r.company_id=%s
            order by r.requested_at desc limit 200""",(u["company_id"],)).fetchall()
    return {"redemptions":[dict(x) for x in rows]}


@app.get("/provider/digital-requests")
def provider_digital_requests(u=Depends(require("provider","admin"))):
    if u["role"]=="provider" and not u["company_id"]:raise HTTPException(403,"Vincule uma empresa ofertante")
    with db() as c:
        if u["role"]=="admin":
            rows=c.execute("""select r.id,r.status,r.requested_at,r.benefit_id,b.title,
              us.name as member_name,co.name as member_company
              from ptp_redemptions r join ptp_benefits b on b.id=r.benefit_id
              join ptp_users us on us.id=r.user_id join ptp_companies co on co.id=r.company_id
              where r.status='requested' order by r.requested_at desc limit 200""").fetchall()
        else:
            rows=c.execute("""select r.id,r.status,r.requested_at,r.benefit_id,b.title,
              us.name as member_name,co.name as member_company
              from ptp_redemptions r join ptp_benefits b on b.id=r.benefit_id
              join ptp_users us on us.id=r.user_id join ptp_companies co on co.id=r.company_id
              join ptp_companies provider_co on provider_co.id=%s
              where r.status='requested' and provider_co.active
               and lower(trim(provider_co.name))=lower(trim(b.provider))
              order by r.requested_at desc limit 200""",(u["company_id"],)).fetchall()
    return {"requests":[dict(x) for x in rows]}
class ProviderDecision(BaseModel):
    decision:str
@app.post("/provider/digital-requests/{redemption_id}/decision")
def provider_digital_decision(redemption_id:int,data:ProviderDecision,u=Depends(require("provider","admin"))):
    if data.decision not in ("confirmed","cancelled"):raise HTTPException(422,"Decisão inválida")
    with db() as c:
        row=c.execute("""select r.id,b.provider,b.id as benefit_id
           from ptp_redemptions r join ptp_benefits b on b.id=r.benefit_id
           where r.id=%s and r.status='requested' for update of r""",(redemption_id,)).fetchone()
        if not row:raise HTTPException(409,"Solicitação indisponível ou já decidida")
        if u["role"]=="provider":
            company=c.execute("select name,active from ptp_companies where id=%s",(u["company_id"],)).fetchone() if u["company_id"] else None
            if not company or not company["active"] or company["name"].strip().casefold()!=row["provider"].strip().casefold():
                raise HTTPException(403,"A solicitação não pertence ao seu estabelecimento")
        c.execute("""update ptp_redemptions set status=%s,
              confirmed_at=case when %s='confirmed' then now() else null end,
              confirmed_by=%s where id=%s""",(data.decision,data.decision,u["id"],redemption_id))
        c.execute("insert into ptp_audit(actor_id,action,target) values(%s,%s,%s)",
                  (u["id"],"provider_digital_"+data.decision,str(redemption_id)))
        c.commit()
    return {"id":redemption_id,"status":data.decision}

# Explicit opt-in migration bootstrap for staging
import clube_startup  # noqa: E402,F401
