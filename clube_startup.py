import os
from pathlib import Path
import psycopg
from clube_api import app

@app.on_event("startup")
def initialize_staging_database():
    if os.getenv("PTP_RUN_MIGRATIONS") != "1":
        return
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is required for migration")
    sql = Path(__file__).with_name("clube_migration_001.sql").read_text(encoding="utf-8")
    with psycopg.connect(dsn, sslmode="require", connect_timeout=10) as conn:
        conn.execute(sql)
        conn.commit()
