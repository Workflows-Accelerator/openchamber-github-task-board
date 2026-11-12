#!/bin/sh
# One-command rollback from e604b9e-20261112 to the previous live release.
set -eu
TARGET=/workspace/releases/board/26fbc00-20261112
ln -s "$TARGET" /workspace/releases/board/current.tmp
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current
kill -TERM "$(cat /tmp/opencode/board-supervisor/supervisor.pid)"
while kill -0 "$(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0)" 2>/dev/null; do sleep 0.2; done
/workspace/code/openchamber-config/tools/board/start.sh
