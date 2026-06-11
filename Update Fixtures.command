#!/usr/bin/env bash
cd "$(dirname "$0")"
./scripts/import-latest-fixtures-json.sh
echo
read -r -p "Press Return to close this window..."
