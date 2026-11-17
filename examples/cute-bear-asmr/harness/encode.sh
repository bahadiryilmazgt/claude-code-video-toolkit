#!/bin/bash
# Encode the JPEG frame sequence + synthesized ASMR mix into the final MP4.
set -e
cd "$(dirname "$0")/.."
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i out/frames/f%04d.jpg -i public/asmr_mix.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -maxrate 20M -bufsize 40M -profile:v high -level 4.2 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t 30 out/cute-bear-asmr.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate:format=duration,size -of compact out/cute-bear-asmr.mp4
