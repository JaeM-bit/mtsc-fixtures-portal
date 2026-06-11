#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
downloads_dir="$HOME/Downloads"
target_file="$project_dir/data/fixtures.json"

latest_file="$(find "$downloads_dir" -maxdepth 1 -type f -name 'fixtures*.json' -print0 \
  | xargs -0 ls -t 2>/dev/null \
  | head -n 1 || true)"

if [[ -z "$latest_file" ]]; then
  echo "No fixtures JSON file found in Downloads."
  exit 1
fi

node -e "
const fs = require('fs');
const file = process.argv[1];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(data.rows)) throw new Error('Missing rows array');
if (!Array.isArray(data.monthlyPlanned)) throw new Error('Missing monthlyPlanned array');
console.log(\`Valid fixtures JSON: \${data.rows.length} fixture rows, \${data.monthlyPlanned.length} monthly planned rows\`);
" "$latest_file"

mkdir -p "$(dirname "$target_file")"
cp "$latest_file" "$target_file"

echo "Copied:"
echo "$latest_file"
echo "to:"
echo "$target_file"
echo
echo "Next: commit and push data/fixtures.json in GitHub Desktop."
