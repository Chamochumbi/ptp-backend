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
    required={"ptp_companies","ptp_users","ptp_sessions","ptp_invites","ptp_audit"}
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
        u=c.execute("select id,password_hash,active from ptp_users where email=%s",(email,)).fetchone()
        if not u or not u["active"] or not check_password(data.password,u["password_hash"]):
            raise HTTPException(401,"Credenciais inválidas")
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
              values (%s,%s,%s,%s,%s,true)""",(invite["email"],data.name,password_hash(data.password),invite["role"],invite["company_id"]))
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
