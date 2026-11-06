#!/bin/sh
# at.sh <clip-id> <seconds>...: mean brightness (YAVG, 255 = white) of the frame at each time.
c="$1"; shift
for t in "$@"; do
  y=$(ffmpeg -loglevel error -ss "$t" -i "/tmp/clips-trial/$c.mp4" -frames:v 1 -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - | grep -o "YAVG=[0-9.]*")
  echo "$c at $t s: $y"
done
