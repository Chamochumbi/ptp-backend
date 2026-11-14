from pathlib import Path
p=Path(__file__).resolve().parent
(p/'ptp_mentor_next.js').write_text((p/'ptp_mentor_library_core.js').read_text().rstrip()+'\n\n'+(p/'ptp_mentor_workspace.js').read_text())
