#!/usr/bin/env bash
# Launch the TypeQuest scene editor: starts the web dev server and opens /editor.html.
# Usage: ./editor.sh   (Ctrl+C stops the server)
cd "$(dirname "$0")/web" || exit 1
[ -d node_modules ] || npm install
exec npm run editor
