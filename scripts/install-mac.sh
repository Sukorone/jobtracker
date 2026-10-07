#!/bin/bash
# Installs (or updates) Job Tracker as a background service on this Mac.
# Re-run after `git pull` to rebuild and restart.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.jobtracker.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/jobtracker.log"
NODE="$(command -v node)"
PORT="${PORT:-8787}"

echo "→ Устанавливаю зависимости и собираю…"
(cd "$ROOT" && npm ci --no-audit --no-fund && npm run build)
(cd "$ROOT/server" && npm ci --omit=dev --no-audit --no-fund)

mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/server/data"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$NODE</string><string>src/index.ts</string></array>
  <key>WorkingDirectory</key><string>$ROOT/server</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>$PORT</string>
    <key>DATA_DIR</key><string>$ROOT/server/data</string>
    <key>STATIC_DIR</key><string>$ROOT/dist</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf "http://localhost:$PORT/api/health" >/dev/null && break
  sleep 0.5
done
curl -sf "http://localhost:$PORT/api/health" >/dev/null || { echo "Сервер не поднялся, смотрите $LOG"; exit 1; }

IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
echo
echo "✓ Job Tracker работает и будет запускаться сам."
echo "  На этом Mac:      http://localhost:$PORT/jobtracker/"
[ -n "$IP" ] && echo "  С айфона (Wi-Fi): http://$IP:$PORT/jobtracker/"
echo "  Пользователи:     cd \"$ROOT/server\" && node src/cli.ts add <логин>"
echo "  Логи:             $LOG"
