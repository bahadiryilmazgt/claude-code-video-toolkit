#!/bin/bash
# usage: sheet.sh out.png in1.png in2.png ... (side by side, 540px wide each)
out=$1; shift
args=(); filt=""; i=0
for f in "$@"; do args+=(-i "$f"); filt+="[$i:v]scale=540:-1[v$i];"; i=$((i+1)); done
ins=""; for ((k=0;k<i;k++)); do ins+="[v$k]"; done
ffmpeg -loglevel error -y "${args[@]}" -filter_complex "${filt}${ins}hstack=inputs=$i" "$out"
