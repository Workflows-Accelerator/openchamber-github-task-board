#!/bin/sh
# One-command rollback: b85676f-20261113 -> e604b9e-20261112
# Atomic repoint, graceful TERM of the supervisor, wait for exit, clean-env start.
set -eu
TARGET=/workspace/releases/board/e604b9e-20261112
CURRENT=/workspace/releases/board/current
PID_FILE=/tmp/opencode/board-supervisor/supervisor.pid

ln -s "$TARGET" "${CURRENT}.tmp"
mv -Tf "${CURRENT}.tmp" "$CURRENT"
echo "current -> $(readlink -f "$CURRENT")"

if [ -f "$PID_FILE" ]; then
  kill -TERM "$(cat "$PID_FILE")" 2>/dev/null || true
  while [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null || echo 0)" 2>/dev/null; do sleep 0.2; done
fi

env -i PATH=/workspace/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  HOME=/workspace GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
  /bin/sh /workspace/code/openchamber-config/tools/board/start.sh
