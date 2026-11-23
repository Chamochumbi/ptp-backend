from pathlib import Path
import json
from urllib.parse import urlparse
p=Path(__file__).resolve().parent
core=(p/'ptp_mentor_library_core.js').read_text().rstrip()
storage=(p/'ptp_mentor_storage.js').read_text().rstrip()
embedded,_=json.JSONDecoder().raw_decode(core.split('const externalCatalog = ',1)[1])
curated=json.loads((p/'external-curation.json').read_text())
if embedded!=curated: raise ValueError('External catalog differs from external-curation.json')
for item in curated:
    url=urlparse(item['url'])
    if url.scheme!='https' or not url.hostname or url.username or url.password: raise ValueError('Unsafe reference URL')
topics=json.loads((p/'mentor-topics.json').read_text())
ids={x['id'] for x in curated+json.loads((p/'catalog.original.json').read_text())}
if len({t['id'] for t in topics})!=len(topics): raise ValueError('Duplicate topic')
for topic in topics:
    if not set(topic['refs'])<=ids: raise ValueError('Unresolved reference in '+topic['id'])
workspace=(p/'ptp_mentor_workspace.js').read_text().rstrip()
journey=(p/'ptp_mentor_journey.js').read_text().rstrip()
quick=(p/'ptp_mentor_simple.js').read_text().replace('/*__MENTOR_TOPICS__*/[]',json.dumps(json.loads((p/'mentor-topics.json').read_text()),ensure_ascii=False))
chat=(p/'ptp_mentor_chat.js').read_text().rstrip()
(p/'ptp_mentor_next.js').write_text(core+'\n\n'+storage+'\n\n'+workspace+'\n\n'+journey+'\n\n'+quick+'\n\n'+chat)
