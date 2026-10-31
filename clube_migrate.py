"""Run once in a controlled staging environment with DATABASE_URL set."""
import os,pathlib,psycopg
dsn=os.environ.get("DATABASE_URL")
if not dsn: raise SystemExit("DATABASE_URL ausente; migração não executada")
sql=pathlib.Path(__file__).with_name("clube_migration_001.sql").read_text(encoding="utf-8")
with psycopg.connect(dsn,sslmode="require",connect_timeout=10) as conn:
    conn.execute(sql)
    conn.commit()
print("Migração 001 aplicada")
