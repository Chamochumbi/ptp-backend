import os
from clube_api import app
from clube_migrate import run_migration

@app.on_event('startup')
def startup():
    if os.getenv('PTP_RUN_MIGRATIONS') == '1':
        run_migration()
