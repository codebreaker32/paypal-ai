#!/bin/sh
# sheet.sh <clip-id>: a contact sheet of its 2-second frames (4 across, 480x270 each) -> /tmp/clips-trial/sheets/<id>.png
mkdir -p /tmp/clips-trial/sheets
n=$(ls /tmp/clips-trial/frames | grep -c "^$1-")
rows=$(( (n + 3) / 4 ))
nice -n 19 ffmpeg -loglevel error -y -framerate 1 -i "/tmp/clips-trial/frames/$1-%03d.png" \
  -vf "scale=480:270,drawtext=text='%{frame_num}':start_number=0:x=8:y=8:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6,tile=4x$rows:padding=4:color=white" \
  -frames:v 1 "/tmp/clips-trial/sheets/$1.png"
echo "$1: $n frames, $rows rows"
