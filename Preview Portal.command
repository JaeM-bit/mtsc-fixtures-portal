#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

default_workbook="$PWD/outputs/01a004ef-b04b-7e21-b8a0-6ceca4eac598/Reusable_Tennis_Club_Portal_Template.xlsx"
workbook_path="${1:-$default_workbook}"

if [[ ! -f "$workbook_path" ]]; then
  echo "The default test workbook was not found."
  printf 'Drag an .xlsx or .xlsm file here, then press Return: '
  read -r workbook_path
  workbook_path="${workbook_path#\'}"
  workbook_path="${workbook_path%\'}"
fi

python3 ./scripts/preview-workbook.py "$workbook_path"

echo
read -r -p "Press Return to close this window..."
