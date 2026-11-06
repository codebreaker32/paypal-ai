#!/bin/sh
# pair.sh <frameA.png> <frameB.png> <out.png>: two frames side by side at half size.
nice -n 19 ffmpeg -loglevel error -y -i "$1" -i "$2" -filter_complex "[0]scale=960:-1[a];[1]scale=960:-1[b];[a][b]hstack" "$3"
