#!/bin/sh
# Freeze the task-engine shapes the engine board reads.
#
# The capture is pinned to the engine revision the slice was built against.
# Rerunning it mints new task ids and timestamps, so review the shapes, not the
# ids, when a regeneration diff appears.
#
#   sh engine-board/fixtures/capture.sh
#
# Every file named after a read verb (graph.json, status.json, project.json,
# runners.json) is that verb's own --json output, unmodified. Two rows have no
# CLI path in the engine and are written through the store port that INTERFACE
# §4.1 defines:
#   - a node with incoming `blocked_by` / `after` edges, because `task create`
#     has no edge flag;
#   - an attempt left in `phase = live`, because `task run` drives the engine
#     until the stub ends the attempt.
# Both are noted in meta.json so a reader can tell them from verb output.
set -eu

ENGINE="${ENGINE:-/workspace/code/task-engine}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-33651ee}"
ALLOW_ENGINE_REV="${ALLOW_ENGINE_REV:-0}"

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEMO="${TMPDIR:-/tmp}/opencode/engine-board-fixtures"
DB="$DEMO/board.sqlite3"
CONTRACT="$DEMO/contract.json"
CHECK="$DEMO/check.json"

ACTUAL_COMMIT=$(git -C "$ENGINE" rev-parse --short=7 HEAD)
if [ "$ACTUAL_COMMIT" != "$EXPECTED_COMMIT" ] && [ "$ALLOW_ENGINE_REV" != "1" ]; then
    echo "engine is at $ACTUAL_COMMIT, capture is pinned to $EXPECTED_COMMIT" >&2
    echo "set ALLOW_ENGINE_REV=1 to capture a different revision on purpose" >&2
    exit 1
fi

rm -rf "$DEMO"
mkdir -p "$DEMO"

cat >"$CONTRACT" <<'JSON'
{
  "outcomes": ["done"],
  "conditions": [{"kind": "evidence", "evidence_kind": "report"}]
}
JSON

cat >"$CHECK" <<'JSON'
{
  "outcomes": ["done"],
  "conditions": [{"kind": "check", "name": "unit"}]
}
JSON

export TASK_DB="$DB"
export PYTHONPATH="$ENGINE${PYTHONPATH:+:$PYTHONPATH}"
export PYTHONDONTWRITEBYTECODE=1
TASK="python3 -m taskengine"

field() {
    python3 -c 'import json,sys; print(json.load(sys.stdin)["'"$1"'"])'
}

$TASK store migrate --json >"$DEMO/schema.json"
$TASK project add --project engine-board --max-concurrency 2 --json >/dev/null
$TASK runner add --project engine-board --kind stub --capacity 2 --json >/dev/null

CREATE=$($TASK create --project engine-board --tree-key engine-board-slice-1 \
    --key build --goal "Build the engine-backed board slice" \
    --contract "$CONTRACT" --json)
ROOT=$(printf '%s' "$CREATE" | field root_task_id)

$TASK create --project engine-board --tree "$ROOT" --key build/spec \
    --goal "Freeze the fixture shapes" --contract "$CONTRACT" --draft --json >/dev/null
$TASK create --project engine-board --tree "$ROOT" --key build/read-model \
    --goal "Fold graph and status into one tree" --contract "$CONTRACT" --json >/dev/null
$TASK create --project engine-board --tree "$ROOT" --key build/render \
    --goal "Render the tree read-only" --contract "$CONTRACT" --json >/dev/null
$TASK create --project engine-board --tree "$ROOT" --key build/render/legend \
    --goal "Explain every state word" --contract "$CONTRACT" --draft --json >/dev/null
VERIFY=$($TASK create --project engine-board --tree "$ROOT" --key build/verify \
    --goal "Prove the frozen fixture matches the engine" --contract "$CHECK" --json)
VERIFY_ID=$(printf '%s' "$VERIFY" | field task_id)

# The read model's `done` row and the `waiting` row a rejected settle produces.
GRAPH_PROBE=$($TASK graph --project engine-board --json)
READ_MODEL=$(printf '%s' "$GRAPH_PROBE" | python3 -c \
    'import json,sys; print(next(n["task_id"] for n in json.load(sys.stdin)["nodes"] if n["node_key"]=="build/read-model"))')
RENDER=$(printf '%s' "$GRAPH_PROBE" | python3 -c \
    'import json,sys; print(next(n["task_id"] for n in json.load(sys.stdin)["nodes"] if n["node_key"]=="build/render"))')
$TASK run "$READ_MODEL" --json >/dev/null
$TASK run "$VERIFY_ID" --json >/dev/null

# Port-only shapes. See the header comment and meta.json's `port_only_steps`.
python3 - "$DB" "$CONTRACT" "$ROOT" "$VERIFY_ID" "$RENDER" <<'PY'
import json
import sys
from datetime import datetime, timedelta, timezone

from taskengine.model import digest_of, new_id
from taskengine.store import Store

db, contract_path, root, verify, render = sys.argv[1:]
contract = json.load(open(contract_path, encoding="utf-8"))
store = Store(db)
project = "engine-board"

node = {
    "goal": "Wire the read model to the live engine",
    "title": "Wire the read model to the live engine",
    "body": "Wire the read model to the live engine",
    "approval_required": False,
}
created = store.get_or_create_node(
    root,
    "build/integration",
    node,
    edges=[
        {"blocker_task_id": verify, "kind": "blocked_by"},
        {"blocker_task_id": render, "kind": "after"},
    ],
    created_by="person:local",
    initial_state="blocked",
    contract=contract,
    workspace={"kind": "none"},
)
if created.name not in ("created", "existing"):
    raise SystemExit(f"integration node: {created!r}")

request = store.admit_run(
    project, render, "person:local", classification="face_intent", admitted=True
)
if request.name not in ("admitted", "existing"):
    raise SystemExit(f"run request: {request!r}")

head = store.head_sequence(project, "task", render)
attempt_id = new_id("attempt")
claim = store.claim(
    project,
    render,
    attempt_id,
    head,
    "person:local",
    digest_of({"spec": "engine-board-fixture"}),
    run_request_id=request["run_request_id"],
    capacity=2,
    workspace_state="none",
)
if claim.name != "claimed":
    raise SystemExit(f"claim: {claim!r}")

lease = (datetime.now(timezone.utc) + timedelta(days=1)).strftime(
    "%Y-%m-%dT%H:%M:%SZ"
)
launch = store.begin_launch(project, attempt_id, claim["stored_fence"], lease)
if launch.name != "admitted":
    raise SystemExit(f"begin_launch: {launch!r}")

live = store.transition_attempt(
    project,
    attempt_id,
    expected_phase="launching",
    expected_fence=launch["fence"],
    to_phase="live",
    handle_ref="fixture-live-1",
)
if live.name != "ok":
    raise SystemExit(f"transition_attempt: {live!r}")
PY

# The tree read is the supported call at the pinned revision: top-level nodes
# name the root as their parent. The depth is explicit because `graph --tree`
# defaults to 2 and truncates deeper trees without a marker.
$TASK graph --project engine-board --tree "$ROOT" --depth 8 --json >"$HERE/graph.json"
$TASK graph --project engine-board --json >"$DEMO/graph-project.json"
IDS=$(python3 -c \
    'import json,sys; print(" ".join(n["task_id"] for n in json.load(open(sys.argv[1]))["nodes"]))' \
    "$HERE/graph.json")
$TASK status $IDS --json >"$HERE/status.json"
$TASK project show --project engine-board --json >"$HERE/project.json"
$TASK runner list --project engine-board --json >"$HERE/runners.json"

python3 - "$HERE/meta.json" "$ENGINE" "$ACTUAL_COMMIT" "$DEMO/schema.json" "$ROOT" <<'PY'
import json
import sys
from datetime import datetime, timezone

out, engine, commit, schema_path, root = sys.argv[1:]
schema = json.load(open(schema_path, encoding="utf-8"))
meta = {
    "engine": {
        "path": engine,
        "commit": commit,
        "schema_revision": schema["schema_revision"],
    },
    "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "project_id": "engine-board",
    "tree_key": "engine-board-slice-1",
    "root_task_id": root,
    "container_node_key": "$root",
    "read_verbs": [
        "task graph --project engine-board --tree <root_task_id> --depth 8 --json",
        "task graph --project engine-board --json (completeness check)",
        "task status <every tree task_id> --json",
        "task project show --project engine-board --json",
        "task runner list --project engine-board --json",
    ],
    "port_only_steps": [
        "store.get_or_create_node(..., edges=[blocked_by, after], initial_state=blocked): task create has no edge flag",
        "store.claim + store.begin_launch + store.transition_attempt(to_phase=live): task run drives the stub to an end",
    ],
    "unobserved_states": ["failed", "cancelled", "skipped"],
    "notes": [
        "tree_key is the value passed to task create --tree-key; no read verb returns it",
        "task title, goal, priority, tags and requires are in the store but no read verb prints them; task create has no flag for tags or requires",
        "runner_slot and runner_id are in INTERFACE §2's attempt table but no read verb prints them",
        "graph --tree is read with --depth 8; its default depth is 2 and truncates without a marker",
    ],
}
with open(out, "w", encoding="utf-8") as handle:
    json.dump(meta, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

python3 - "$HERE/graph.json" "$HERE/status.json" "$DEMO/graph-project.json" <<'PY'
import json
import sys

graph = json.load(open(sys.argv[1], encoding="utf-8"))
statuses = json.load(open(sys.argv[2], encoding="utf-8"))["tasks"]
project = json.load(open(sys.argv[3], encoding="utf-8"))

states = {node["rest_state"] for node in graph["nodes"]}
missing = {"draft", "blocked", "ready", "waiting", "done"} - states
if missing:
    raise SystemExit(f"capture lost rest_state values: {sorted(missing)}")

kinds = {edge["kind"] for edge in graph["edges"]}
if kinds != {"blocked_by", "after"}:
    raise SystemExit(f"capture edge kinds are {sorted(kinds)}")

by_id = {node["task_id"]: node for node in graph["nodes"]}
root = next((n for n in graph["nodes"] if n["node_key"] == "$root"), None)
if root is None:
    raise SystemExit("capture lost the $root container")
for node in graph["nodes"]:
    if node["task_id"] == root["task_id"]:
        continue
    if node["parent_task_id"] not in by_id:
        raise SystemExit(
            f"{node['node_key']} has a parent outside the read; the tree read truncated"
        )
if not any(node["parent_task_id"] == root["task_id"] for node in graph["nodes"]):
    raise SystemExit("no top-level node names the root as its parent")

if {node["task_id"] for node in project["nodes"]} != set(by_id):
    raise SystemExit("graph --tree and graph --project disagree; the tree read is incomplete")

live = [status for status in statuses if status["phase"] == "live"]
if len(live) != 1 or live[0]["slot"] is None:
    raise SystemExit("capture has no single live attempt with a slot")

if not any(
    status["wait"] and status["wait"].get("cause") == "settle_rejected"
    for status in statuses
):
    raise SystemExit("capture has no rejected-settle wait")

print("fixture shapes verified")
PY

echo "wrote fixtures to $HERE"
