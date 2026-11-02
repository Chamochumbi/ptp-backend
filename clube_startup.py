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
    for name in ("clube_migration_001.sql","clube_migration_002.sql","clube_migration_003.sql","clube_migration_004.sql","clube_migration_005.sql"):
        sql=Path(__file__).with_name(name).read_text(encoding="utf-8")
        with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
            conn.execute(sql)
            conn.commit()
    print("PTP_DATABASE_CHECK: migrations_applied",flush=True)
    # First administrator: explicit one-time opt-in, never a public endpoint.
    admin_email=os.getenv("PTP_BOOTSTRAP_ADMIN_EMAIL","").strip().lower()
    admin_password=os.getenv("PTP_BOOTSTRAP_ADMIN_PASSWORD","")
    if admin_email and admin_password:
        if admin_email!="parquetecnologicopiracicaba@gmail.com" or len(admin_password)<16:
            print("PTP_ADMIN_BOOTSTRAP: configuration_invalid",flush=True)
            return
        from clube_api import password_hash
        with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
            existing=conn.execute("select id from ptp_users where lower(email)=%s",(admin_email,)).fetchone()
            if existing:
                print("PTP_ADMIN_BOOTSTRAP: account_exists_no_change",flush=True)
            else:
                conn.execute("""insert into ptp_users(email,name,password_hash,role,company_id,active)
                    values (%s,%s,%s,'admin',null,true)""",
                    (admin_email,"Administração PTP",password_hash(admin_password)))
                conn.commit()
                print("PTP_ADMIN_BOOTSTRAP: initial_account_created",flush=True)

