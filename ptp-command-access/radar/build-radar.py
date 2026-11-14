from pathlib import Path
root=Path(__file__).parent
bundle=root/'ptp_observatorio.js'
s=bundle.read_text();marker=s.index('/* PTP Observatório v5');start=s.rfind('(function(){',0,marker)
assert start>=0
bundle.write_text((root/'ptp_radar.js').read_text()+'\n'+s[start:])
