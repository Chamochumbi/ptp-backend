from fastapi import FastAPI, Response

app = FastAPI(title='Clube de Benefícios PTP — staging deployment check', docs_url=None, redoc_url=None, openapi_url=None)

@app.get('/health')
def health():
    return {'status': 'alive', 'service': 'clube-ptp-staging', 'transactional': False}

@app.get('/ready', status_code=503)
def readiness(response: Response):
    response.status_code = 503
    return {'status': 'not_ready', 'reason': 'full authenticated API and PostgreSQL migrations not deployed'}
