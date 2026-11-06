# check_beats.py <demo.json> <clips dir>: per scene, each beat's source window and any frozen last frame.
import json
import subprocess
import sys

d = json.load(open(sys.argv[1], encoding='utf-8'))
for s in d['timeline']:
    if s.get('kind') != 'demo':
        continue
    clip = f"{sys.argv[2]}/{s['video'].split('/')[-1]}"
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip],
                               capture_output=True, text=True).stdout.strip())
    beats = s.get('beats') or [{'atSec': 0, 'videoStartSec': s.get('videoStartSec', 0), 'playbackRate': s.get('playbackRate', 1)}]
    out = []
    for i, b in enumerate(beats):
        end_at = beats[i + 1]['atSec'] if i + 1 < len(beats) else s['durationSec']
        rate = b.get('playbackRate', s.get('playbackRate', 1))
        vs = b.get('videoStartSec', b['atSec'])
        src_end = vs + (end_at - b['atSec']) * rate
        frozen = max(0.0, (src_end - dur) / rate)
        out.append(f"{b['atSec']:.1f}-{end_at:.1f}s <- src {vs:.1f}-{src_end:.1f} x{rate}" + (f" FROZEN {frozen:.1f}s" if frozen > 0.05 else ''))
    print(f"{s['id']:<10} {s['durationSec']:6.2f}s clip {dur:5.1f}s | " + ' | '.join(out))
