#!/bin/sh
# at_frames.sh <clip-id> <out.png> <t1> <t2> ...: the source frames at those times, side by side (480 px each), labelled.
c="$1"; out="$2"; shift 2
dir=$(mktemp -d)
n=0
for t in "$@"; do
  n=$((n + 1))
  nice -n 19 ffmpeg -loglevel error -y -ss "$t" -i "/tmp/clips-trial/$c.mp4" -frames:v 1 \
    -vf "scale=640:-1,drawtext=text='src $t s':x=8:y=8:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.7" "$dir/$n.png"
done
nice -n 19 ffmpeg -loglevel error -y -framerate 1 -i "$dir/%d.png" -vf "tile=${n}x1:padding=4:color=white" -frames:v 1 "$out"
rm -rf "$dir"
echo "$out"
