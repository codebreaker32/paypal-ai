#!/bin/sh
# tail.sh <clip-id>: for the last 3 s of the clip, the mean brightness of each frame (255 = all white), one per line.
f="/tmp/clips-trial/$1.mp4"
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
start=$(echo "$d - 3" | bc)
echo "$1: duration $d s"
nice -n 19 ffmpeg -loglevel error -ss "$start" -i "$f" -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - \
  | paste - - | awk -v s="$start" '{ split($2, t, ":"); split($4, y, "="); printf "%.2f s  Y=%.1f\n", s + t[2], y[2] }' | awk 'NR % 6 == 1'
