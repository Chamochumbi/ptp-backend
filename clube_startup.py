"""Safe startup migration: starts without DB credentials, initializes schema when configured."""
import os
from pathlib import Path
import psycopg
from clube_api import app

@app.on_event("startup")
def initialize_staging_database():
    dsn=os.getenv("DATABASE_URL","").strip()
    if not dsn or os.getenv("PTP_RUN_MIGRATIONS")!="1":
        return
    for name in ("clube_migration_001.sql","clube_migration_002.sql"):
        sql=Path(__file__).with_name(name).read_text(encoding="utf-8")
        with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
            conn.execute(sql)
            conn.commit()
