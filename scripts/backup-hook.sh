#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then echo 'Usage: DATA_DIR=/var/lib/veladeck backup-hook.sh /private/backup/output'; exit 1; fi
mkdir -p "$1"
chmod 700 "$1"
node --env-file-if-exists=.env --import tsx scripts/backup.ts "$1"
