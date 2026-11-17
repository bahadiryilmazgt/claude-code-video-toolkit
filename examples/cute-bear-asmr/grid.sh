#!/bin/bash
# usage: grid.sh video.mp4 start_s end_s step_s cols out.png  -> labelled contact sheet
v=$1; a=$2; b=$3; st=$4; cols=$5; out=$6
n=$(python3 -c "import math;print(int(math.floor(($b-$a)/$st+1e-6))+1)")
rows=$(( (n + cols - 1) / cols ))
ffmpeg -loglevel error -y -ss $a -t $(python3 -c "print($b-$a+0.01)") -i "$v" \
  -vf "fps=1/$st,scale=216:384,drawtext=text='%{pts\:flt\:$a}':x=4:y=4:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.5,tile=${cols}x${rows}" -frames:v 1 "$out"
