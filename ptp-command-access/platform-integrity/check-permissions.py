import json,re,concurrent.futures,datetime,urllib.request,urllib.error
from pathlib import Path
root='https://www.wixapis.com'
def post(path,body,token=''):
 req=urllib.request.Request(root+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json',**({'Authorization':token} if token else {})})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,{}
status,auth=post('/oauth2/token',{'clientId':'33921d68-22e1-4e95-b38a-d8f4c70aa416','grantType':'anonymous'})
token=auth.get('access_token','')
if not token:raise SystemExit('Anonymous access unavailable: '+str(status))
names=re.findall(r"'([^']+)'",re.search(r'COLLECTIONS = Object.freeze\(\[(.*?)\]',Path('sprint/backend/command.mjs').read_text()).group(1))
def check(name):
 try:
  code,data=post('/wix-data/v2/items/query',{'dataCollectionId':name,'query':{'paging':{'limit':1,'offset':0}}},token)
  return {'collection':name,'status':code,'returned':len(data.get('dataItems',[])) if code==200 else None}
 except Exception as e:return {'collection':name,'status':'unavailable','error':type(e).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:results=list(pool.map(check,names))
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'access':'anonymous','results':results}
Path('sprint/platform-integrity/cms-permissions-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
