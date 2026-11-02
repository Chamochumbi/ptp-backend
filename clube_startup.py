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
    for name in ("clube_migration_001.sql","clube_migration_002.sql","clube_migration_003.sql"):
        sql=Path(__file__).with_name(name).read_text(encoding="utf-8")
        with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
            conn.execute(sql)
            conn.commit()
    print("PTP_DATABASE_CHECK: migrations_applied",flush=True)
