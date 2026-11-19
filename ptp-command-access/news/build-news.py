from pathlib import Path
import json
r=Path(__file__).parent
catalog=json.loads((r/'ptp_noticias.json').read_text())
master=json.loads((r.parent/'radar/monitor-sources.internal.json').read_text())
assert all(a['id'] in {e['id'] for e in master['entities']} for a in catalog['actors'])
core=(r/'ptp_news.js').read_text().replace('/*__NEWS_CATALOG__*/',json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
(r/'ptp_news.bundle.js').write_text(core)
