"""Run manually after migration. Never put an admin password in source control."""
import os,sys,psycopg
from clube_api import password_hash,valid_email
email=os.getenv("PTP_ADMIN_EMAIL","").strip().lower()
pwd=os.getenv("PTP_ADMIN_PASSWORD","")
dsn=os.getenv("DATABASE_URL")
if not dsn or not email or len(pwd)<16:
    raise SystemExit("DATABASE_URL, PTP_ADMIN_EMAIL e senha >=16 caracteres necessários")
valid_email(email)
with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
    existing=conn.execute("select id from ptp_users where email=%s",(email,)).fetchone()
    if existing:raise SystemExit("Conta já existe; bootstrap idempotente sem sobrescrever")
    conn.execute("insert into ptp_users(email,name,password_hash,role,company_id,active) values(%s,%s,%s,'admin',null,true)",(email,"Administração institucional PTP",password_hash(pwd)))
    conn.commit()
print("Conta institucional criada. Revogue o segredo de bootstrap e habilite MFA antes da produção.")
