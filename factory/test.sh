#!/usr/bin/env bash
set -euo pipefail

reports="${FACTORY_REPORTS_DIR:-reports}"
mkdir -p "$reports"

npx vitest run --reporter=default --reporter=junit --outputFile.junit="$reports/junit.xml" "$@"
