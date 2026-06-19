#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

config_file=".codex/workbook-watch-path"
if [[ -f "$config_file" ]]; then
  workbook_path="$(<"$config_file")"
else
  printf 'Enter the full path to your .xlsm workbook: '
  read -r workbook_path
  if [[ -z "$workbook_path" ]]; then
    echo "No workbook path supplied."
    exit 1
  fi
  mkdir -p .codex
  printf '%s\n' "$workbook_path" > "$config_file"
fi

python3 ./scripts/watch-workbook.py "$workbook_path"
