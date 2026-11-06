#!/bin/sh
# changes.sh <clip-id> [threshold] (CLIPS=<dir>, default /tmp/clips-trial): times (s) where the picture changes noticeably, one line.
t="${2:-0.02}"
printf '%s: ' "$1"
ffmpeg -loglevel info -i "${CLIPS:-/tmp/clips-trial}/$1.mp4" -vf "scale=480:-1,select='gt(scene,$t)',showinfo" -f null - 2>&1 \
  | grep -o "pts_time:[0-9.]*" | cut -d: -f2 | awk '{ printf "%.1f ", $1 }'
echo
