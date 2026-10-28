#!/bin/bash
# usage: sheet.sh out.png frame1 frame2 ... (renders stills in a single bundle, tiles them)
out=$1; shift
mkdir -p out/stills
npx remotion bundle --log=error --out-dir=out/bundle >/dev/null 2>&1 || true
for fr in "$@"; do npx remotion still out/bundle FirstReplyWins out/stills/f$fr.png --frame=$fr --log=error --scale=0.5 & done; wait
args=(); for fr in "$@"; do args+=(-i out/stills/f$fr.png); done
n=$#
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf "[$i]drawtext=text='$(echo $@ | cut -d' ' -f$((i+1)))':x=10:y=10:fontsize=28:fontcolor=red[v$i];"; done; for i in $(seq 0 $((n-1))); do printf "[v$i]"; done)hstack=inputs=$n" "$out"
