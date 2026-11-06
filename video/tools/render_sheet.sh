#!/bin/sh
# render_sheet.sh <video.mp4> <out.png>: one frame every 2 s (labelled with its time), 5 across at 384x216.
mkdir -p "$(dirname "$2")"
nice -n 19 ffmpeg -loglevel error -y -i "$1" \
  -vf "fps=0.5,scale=384:216,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7,tile=5x5:padding=3:color=white" \
  -frames:v 1 "$2"
echo "$2"
