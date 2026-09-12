#!/usr/bin/env bash
set -euo pipefail

# Convert only the approved runtime sources. Never remove a background or
# create alpha: preserving source pixels is safer than trying to isolate dark
# hull details.
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
source_dir="$root/frontend/assets/ships/source"
output_dir="$root/frontend/assets/ships"

source_for() {
  local id="$1" source_name="$1"
  [[ "$id" == stargrave-class ]] && source_name=stargrave
  local source="$source_dir/$source_name-runtime.png"
  if [[ -f "$source" ]]; then
    printf '%s\n' "$source"
    return
  fi
  echo "missing approved runtime source: $source_name-runtime.png" >&2
  exit 1
}

sources=(
  horizon wayfarer odyssey vanguard sentinel aegis spearhead leviathan atlas dominion stargrave-class
)

for id in "${sources[@]}"; do
  source="$(source_for "$id")"
  presentation="$output_dir/presentation/$id.webp"
  thumbnail="$output_dir/thumbnail/$id.webp"

  filter='format=rgb24'
  thumbnail_filter='scale=320:180:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=0x030b14,format=yuv420p'

  ffmpeg -v error -y -i "$source" -vf "$filter" -c:v libwebp -quality 95 -compression_level 6 -an "$presentation"
  ffmpeg -v error -y -i "$presentation" -vf "$thumbnail_filter" -c:v libwebp -quality 90 -compression_level 6 -an "$thumbnail"
done
