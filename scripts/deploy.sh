#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm ci
npm run verify
npm run build
sudo install -d -m 750 -o "$(id -un)" /var/lib/veladeck
sudo install -d -m 750 /etc/veladeck
if [ ! -f /etc/veladeck/env ]; then
  echo 'Create /etc/veladeck/env from .env.example first; set DATA_DIR and PUBLIC_BASE_URL. No service changes made.'
  exit 1
fi
NODE="$(command -v node)"
SERVICE_FILE="$(mktemp)"
trap 'rm -f "$SERVICE_FILE"' EXIT
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=VelaDeck personal agent workspace
After=network.target
[Service]
User=$(id -un)
WorkingDirectory=$ROOT
EnvironmentFile=/etc/veladeck/env
ExecStart=$NODE $ROOT/dist/server/index.js
Restart=on-failure
TimeoutStopSec=30
UMask=0027
NoNewPrivileges=true
ProtectSystem=full
[Install]
WantedBy=multi-user.target
EOF
sudo install -m 644 "$SERVICE_FILE" /etc/systemd/system/veladeck.service
sudo systemctl daemon-reload
sudo systemctl enable --now veladeck.service
sudo systemctl status --no-pager veladeck.service
