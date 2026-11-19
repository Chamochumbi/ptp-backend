from pathlib import Path
root=Path(__file__).parent
bundle=root/'ptp_observatorio.js'
s=bundle.read_text();marker=s.index('/* PTP Observatório v5');start=s.rfind('(function(){',0,marker)
assert start>=0
import runpy
runpy.run_path(str(root.parent/'news/build-news.py'))
bundle.write_text((root/'ptp_radar.js').read_text()+'\n'+(root.parent/'news/ptp_news.bundle.js').read_text()+'\n'+s[start:])
