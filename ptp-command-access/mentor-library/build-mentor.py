from pathlib import Path
import json
p=Path(__file__).resolve().parent
core=(p/'ptp_mentor_library_core.js').read_text().rstrip()
workspace=(p/'ptp_mentor_workspace.js').read_text().rstrip()
quick=(p/'ptp_mentor_simple.js').read_text().replace('/*__MENTOR_TOPICS__*/[]',json.dumps(json.loads((p/'mentor-topics.json').read_text()),ensure_ascii=False))
(p/'ptp_mentor_next.js').write_text(core+'\n\n'+workspace+'\n\n'+quick)
