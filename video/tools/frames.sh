#!/bin/sh
# frames.sh <clip-id>...: one frame every 2 s of /tmp/clips-trial/<id>.mp4 into /tmp/clips-trial/frames/, at low priority.
mkdir -p /tmp/clips-trial/frames
for c in "$@"; do
  nice -n 19 ffmpeg -loglevel error -threads 1 -y -i "/tmp/clips-trial/$c.mp4" -vf fps=0.5 "/tmp/clips-trial/frames/$c-%03d.png"
  echo "$c: $(ls /tmp/clips-trial/frames | grep -c "^$c-")"
done
