#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

config_file=".codex/workbook-watch-path"
if [[ -f "$config_file" ]]; then
  workbook_path="$(<"$config_file")"
else
  workbook_path=""
fi

workbook_path="${workbook_path#file://}"
workbook_path="${workbook_path#file:/}"

if [[ -n "$workbook_path" && ! -f "$workbook_path" ]]; then
  echo "The previously selected workbook has moved or been renamed:"
  echo "$workbook_path"
  workbook_path=""
fi

if [[ -z "$workbook_path" || "$workbook_path" == http://* || "$workbook_path" == https://* ]]; then
  printf 'Enter the full path to your .xlsm workbook: '
  read -r workbook_path
  workbook_path="${workbook_path#file://}"
  workbook_path="${workbook_path#file:/}"
fi

if [[ -z "$workbook_path" ]]; then
  echo "No workbook path supplied."
  exit 1
fi

if [[ "$workbook_path" == http://* || "$workbook_path" == https://* ]]; then
  echo "That looks like a web URL, not a local workbook path."
  echo "Use a real path such as /Users/you/Documents/.../Summer 2026.xlsm"
  echo "If the file is in OneDrive, open it in Finder and copy its local path."
  exit 1
fi

mkdir -p .codex
printf '%s\n' "$workbook_path" > "$config_file"

python3 ./scripts/watch-workbook.py "$workbook_path"
