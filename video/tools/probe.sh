#!/bin/sh
# probe.sh: size, frame rates, codec and duration of every trial clip.
for f in /tmp/clips-trial/*.mp4; do
  printf '%s  ' "$(basename "$f")"
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt,width,height,r_frame_rate,avg_frame_rate -show_entries format=duration -of csv=p=0:s=, "$f" | tr '\n' ' '
  echo
done
