#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

winter_workbook="/Users/johnmacpherson/Library/CloudStorage/OneDrive-Personal/Pers/Tennis/Fixtures/Winter 2026 to 2027/Winter 2026:27 Master Fixture List v1.59.xlsm"

if [[ ! -f "$winter_workbook" ]]; then
  echo "Winter workbook not found:"
  echo "$winter_workbook"
  echo
  echo "If its name or location has changed, update this command with the new path."
  read -r -p "Press Return to close this window..."
  exit 1
fi

python3 ./scripts/watch-workbook.py "$winter_workbook"
