#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

summer_workbook="/Users/johnmacpherson/Library/CloudStorage/OneDrive-Personal (01-09-2026 12:39)/Pers/Tennis/Fixtures/Summer 2026/Summer 2026 Master Fixture List v1.59.xlsm"

if [[ ! -f "$summer_workbook" ]]; then
  echo "Summer workbook not found:"
  echo "$summer_workbook"
  echo
  echo "If its name or location has changed, update this command with the new path."
  read -r -p "Press Return to close this window..."
  exit 1
fi

python3 ./scripts/watch-workbook.py "$summer_workbook"
