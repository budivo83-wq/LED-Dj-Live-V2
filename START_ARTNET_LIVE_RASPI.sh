#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "[BudiLight] Installing dependencies if needed..."
if [ ! -d node_modules ]; then npm install; fi
echo "[BudiLight] Starting with .env.local ArtNet defaults..."
npm start
