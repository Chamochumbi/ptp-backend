"""Safe startup migration: starts without DB credentials, initializes schema when configured."""
import os
from pathlib import Path
import psycopg
from clube_api import app

@app.on_event("startup")
def initialize_staging_database():
    dsn=os.getenv("DATABASE_URL","").strip()
    if not dsn:
        print("PTP_DATABASE_CHECK: connection_not_configured",flush=True)
        return
    if os.getenv("PTP_RUN_MIGRATIONS")!="1":
        print("PTP_DATABASE_CHECK: migrations_disabled",flush=True)
        return
    for name in ("clube_migration_001.sql","clube_migration_002.sql","clube_migration_003.sql","clube_migration_004.sql","clube_migration_005.sql","clube_migration_006.sql"):
        sql=Path(__file__).with_name(name).read_text(encoding="utf-8")
        with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
            conn.execute(sql)
            conn.commit()
    bootstrap_hash=os.getenv("PTP_FIRST_ADMIN_BOOTSTRAP_HASH","").strip()
    if os.getenv("PTP_FIRST_ADMIN_BOOTSTRAP")=="1" and bootstrap_hash:
        email="parquetecnologicopiracicaba@gmail.com"
        with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
            conn.execute("select pg_advisory_xact_lock(71204008)")
            active=conn.execute("select 1 from ptp_users where role='admin' and active=true limit 1").fetchone()
            if not active:
                conn.execute("""insert into ptp_users(email,name,password_hash,role,company_id,active)
                    values (%s,%s,%s,'admin',null,true)
                    on conflict(email) do update set
                    name=excluded.name,password_hash=excluded.password_hash,role='admin',company_id=null,active=true""",
                    (email,"Administração Institucional PTP",bootstrap_hash))
                conn.execute("insert into ptp_audit(action,target) values ('institutional_admin_bootstrapped',%s)",(email,))
                print("PTP_ADMIN_BOOTSTRAP: institutional_account_created",flush=True)
            else:
                print("PTP_ADMIN_BOOTSTRAP: active_admin_exists_no_change",flush=True)
            conn.commit()
    print("PTP_DATABASE_CHECK: migrations_applied",flush=True)
    print("PTP_ADMIN_BOOTSTRAP: email_verified_flow_only",flush=True)
