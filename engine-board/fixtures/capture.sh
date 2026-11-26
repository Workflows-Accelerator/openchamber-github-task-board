#!/bin/sh
# Freeze the task-engine shapes the engine board reads, from a real store.
#
#   sh engine-board/fixtures/capture.sh
#
# Every payload named after a read verb (graph.json, status.json, project.json,
# runners.json, second-shape/*) is that verb's own --json output, unmodified. The
# store is built the only supported way: `task playbook apply` over the eighteen
# scenario manifests. Seventeen apply; 12 is refused by the loader at
# playbook.yaml:23 for its `.ts` producer fragment, and that refusal is asserted
# here rather than worked around.
#
# Two trees are committed:
#   - `fixtures/` is `incident-9` (09): three diagnostics fan in to one summary,
#     then a gate and a blocked remediation. The three diagnostics and the
#     summary are run through `task run`, so the capture carries ended attempts,
#     a waiting gate, and runner slots, not only initial states.
#   - `fixtures/second-shape/` is `bug-login-timeout` (02): three probes joined
#     to a decision by `after` edges, plus `blocked_by` in the fix chain. It is
#     the second dependency shape, committed so a test can read both.
#
# Nothing is written through the store port. When the engine gains a verb, the
# capture should use it, not a Python call into `taskengine`.
set -eu

ENGINE="${ENGINE:-/tmp/opencode/engine-c4ccf1e}"
EXPECTED_COMMIT="${EXPECTED_COMMIT:-c4ccf1e}"
PLAYBOOKS="${PLAYBOOKS:-/workspace/code/openchamber-config/.agents/run/scenarios-playbooks/manifests}"
ALLOW_ENGINE_REV="${ALLOW_ENGINE_REV:-0}"

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEMO="${TMPDIR:-/tmp}/opencode/engine-board-fixtures"
DB="$DEMO/board.sqlite3"
EXTRACT="$DEMO/manifests"

ACTUAL_COMMIT=$(git -C "$ENGINE" rev-parse --short=7 HEAD)
if [ "$ACTUAL_COMMIT" != "$EXPECTED_COMMIT" ] && [ "$ALLOW_ENGINE_REV" != "1" ]; then
    echo "engine is at $ACTUAL_COMMIT, capture is pinned to $EXPECTED_COMMIT" >&2
    echo "set ALLOW_ENGINE_REV=1 to capture a different revision on purpose" >&2
    exit 1
fi

rm -rf "$DEMO"
mkdir -p "$EXTRACT"
export TASK_DB="$DB"
export PYTHONDONTWRITEBYTECODE=1
TASK="$ENGINE/bin/task"

# Split a scenario page into the manifest and the fragments its YAML names. A
# section's first fenced block is the file body; 12's `controls.ts` section is a
# JSON description written under that name so the loader's own refusal is seen.
split_manifest() {
    python3 - "$1" "$2" <<'PY'
import os
import re
import sys

src, out = sys.argv[1:]
text = open(src, encoding="utf-8").read()
os.makedirs(out, exist_ok=True)
for section in re.split(r"(?m)^## ", text):
    if not section.strip():
        continue
    heading, _, rest = section.partition("\n")
    name = heading.split()[0].strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+\.(?:yaml|yml|json|ts)", name):
        continue
    block = re.search(r"```[a-z]*\n(.*?)\n```", rest, re.S)
    if block is None:
        continue
    with open(os.path.join(out, name), "w", encoding="utf-8") as handle:
        handle.write(block.group(1))
        handle.write("\n")
PY
}

APPLIED=0
REFUSED=0
apply_one() {
    name="$1"
    shift
    split_manifest "$PLAYBOOKS/$name.md" "$EXTRACT/$name"
    if "$TASK" playbook apply --project engine-board \
        --manifest "$EXTRACT/$name/playbook.yaml" "$@" --json \
        >"$DEMO/$name.out" 2>"$DEMO/$name.err"; then
        APPLIED=$((APPLIED + 1))
    else
        REFUSED=$((REFUSED + 1))
    fi
}

$TASK store migrate --json >"$DEMO/schema.json"
$TASK project add --project engine-board --max-concurrency 3 --json >/dev/null
# The diagnostics and the summary name `exec:ai`; the engine runner the apply
# mints carries `exec:engine`. Both are engine rows.
$TASK runner add --project engine-board --kind stub \
    --tags '["exec:ai"]' --capacity 3 --json >/dev/null

apply_one 01-feature-from-issue \
    --input issue=412 --input owner=person:ada --input approver=person:grace \
    --input worktree=worktrees/acme --input branch=feature
apply_one 02-bug-three-hypotheses \
    --input owner=person:ada --input worktree=worktrees/acme \
    --input branch=fix --input symptom=login-timeout
apply_one 03-pr-review \
    --input owner=person:ada --input pull=87 --input group_one=api \
    --input group_two=web --input group_three=schema
apply_one 04-video-production \
    --input owner=person:ada --input host=youtube --input assets=assets/reel \
    --input media_root=/media
apply_one 05-weekly-newsletter \
    --input owner=person:ada --input approver=person:grace --input issue_no=42
apply_one 06-inbox-triage \
    --input owner=person:ada --input message=5 --input mailbox=support
apply_one 07-research-question \
    --input owner=person:ada --input question="Which database" --input slug=database-choice
apply_one 08-destructive-migration \
    --input owner=person:ada --input approver=person:grace \
    --input database=appdb --input worktree=worktrees/acme
apply_one 09-incident-response \
    --input owner=person:ada --input oncall=person:grace --input alert=9 \
    --input service=checkout
apply_one 10-support-reply-that-sends \
    --input owner=person:ada --input approver=person:grace \
    --input ticket=31 --input mailbox=support
apply_one 11-event-planning \
    --input owner=person:ada --input organiser=person:grace \
    --input event_date=2026-12-01 --input headcount=40
apply_one 12-compliance-audit \
    --input owner=person:ada --input period=2026-Q4 --input controls=controls.csv
apply_one 13-sales-outreach \
    --input owner=person:ada --input approver=person:grace --input lead=7 \
    --input segment=beta --input contactable=true
apply_one 14-book-chapter \
    --input owner=person:ada --input approver=person:grace \
    --input chapter=chapter-3 --input voice=plain --input worktree=worktrees/book
apply_one 15-agent-hands-off \
    --input owner=person:ada --input target=handoff-15 --input worktree=worktrees/acme
apply_one 16-ai-authored-playbook \
    --input owner=person:ada --input version=1.4.0 --input channel=beta
apply_one 17-a-task-that-is-a-question \
    --input decider=person:grace --input question="Which database" --input slug=database-choice
apply_one 18-nightly-job-skipped-step \
    --input owner=person:ada --input source=s3://backups --input target=nightly

if [ "$APPLIED" != "17" ] || [ "$REFUSED" != "1" ]; then
    echo "expected 17 manifests applied and 1 refused; got $APPLIED and $REFUSED" >&2
    exit 1
fi
if ! grep -q 'playbook.yaml:23' "$DEMO/12-compliance-audit.err"; then
    echo "12's refusal no longer names playbook.yaml:23:" >&2
    cat "$DEMO/12-compliance-audit.err" >&2
    exit 1
fi

root_for() {
    "$TASK" graph --project engine-board --roots --json |
        python3 -c 'import json,sys
key = sys.argv[1]
print(next(n["task_id"] for n in json.load(sys.stdin)["nodes"] if n["tree_key"] == key))' "$1"
}

id_for() {
    "$TASK" graph --project engine-board --tree "$1" --json |
        python3 -c 'import json,sys
key = sys.argv[1]
print(next(n["task_id"] for n in json.load(sys.stdin)["nodes"] if n["node_key"] == key))' "$2"
}

# `run` is the supported path that ends an attempt; it also releases the next
# blocked_by row. The capture wants the ended-attempt and waiting shapes, so it
# drives the fan-in tree to its first gate.
run_node() {
    "$TASK" run "$(id_for "$1" "$2")" --json >/dev/null
}

ROOT=$(root_for incident-9)
run_node "$ROOT" diag-host
run_node "$ROOT" diag-db
run_node "$ROOT" diag-net
run_node "$ROOT" summarise

capture_tree() {
    root="$1"
    out="$2"
    mkdir -p "$out"
    "$TASK" graph --project engine-board --tree "$root" --json >"$out/graph.json"
    IDS=$(python3 -c 'import json,sys
print(" ".join(n["task_id"] for n in json.load(open(sys.argv[1]))["nodes"]))' \
        "$out/graph.json")
    "$TASK" status $IDS --json >"$out/status.json"
    "$TASK" project show --project engine-board --json >"$out/project.json"
    "$TASK" runner list --project engine-board --json >"$out/runners.json"
}

capture_tree "$ROOT" "$HERE"

ALT=$(root_for bug-login-timeout)
capture_tree "$ALT" "$HERE/second-shape"

# The list read is `task status --project`; there is no `task list` verb. It is
# captured whole (no cursor) so the report can point at the real page shape.
"$TASK" status --project engine-board --json >"$DEMO/list.json"

python3 - "$HERE/meta.json" "$HERE" "$ENGINE" "$ACTUAL_COMMIT" \
    "$DEMO/schema.json" "$ROOT" incident-9 \
    'task graph --project engine-board --tree <root_task_id> --json' \
    'task status <every tree task id> --json' \
    'task project show --project engine-board --json' \
    'task runner list --project engine-board --json' \
    'task store check --json (schema revision only)' <<'PY'
import json
import sys
from datetime import datetime, timezone

out, here, engine, commit, schema_path, root, tree_key, *verbs = sys.argv[1:]
schema = json.load(open(schema_path, encoding="utf-8"))
graph = json.load(open(here + "/graph.json", encoding="utf-8"))
status = json.load(open(here + "/status.json", encoding="utf-8"))
# The model reads `status` first and the graph second, so the states this read
# did not reach are the ones missing from that same merged view.
from_status = {row["task_id"]: row["rest_state"] for row in status["tasks"]}
states = {from_status.get(node["task_id"], node["rest_state"])
          for node in graph["nodes"]}
vocabulary = ["draft", "blocked", "ready", "waiting", "done",
              "failed", "cancelled", "skipped"]
meta = {
    "engine": {
        "path": engine,
        "commit": commit,
        "schema_revision": schema["schema_revision"],
    },
    "captured_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "project_id": "engine-board",
    "tree_key": tree_key,
    "root_task_id": root,
    "container_node_key": "$root",
    "read_verbs": verbs,
    "port_only_steps": [],
    "unobserved_states": [state for state in vocabulary if state not in states],
    "notes": [
        "the store is built by `task playbook apply` over 17 of the 18 scenario manifests; 12 is refused at playbook.yaml:23",
        "three diagnostics and the summary were run through `task run`, so their ended attempts and runner slots are read, not written through the store port",
        "the list read is `task status --project engine-board --json`; the engine has no `task list` verb",
        "contract conditions and an issue-mirror link are not printed by any read verb",
    ],
}
with open(out, "w", encoding="utf-8") as handle:
    json.dump(meta, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

python3 - "$HERE/meta.json" "$HERE/second-shape/meta.json" \
    "$HERE/second-shape/graph.json" "$ALT" bug-login-timeout <<'PY'
import json
import sys

primary_path, second_path, graph_path, root, tree_key = sys.argv[1:]
second = json.load(open(primary_path, encoding="utf-8"))
second["tree_key"] = tree_key
second["root_task_id"] = root

# The second tree's unobserved states are its own.
graph = json.load(open(graph_path, encoding="utf-8"))
status = json.load(open(second_path.replace("meta.json", "status.json"),
                        encoding="utf-8"))
from_status = {row["task_id"]: row["rest_state"] for row in status["tasks"]}
states = {from_status.get(node["task_id"], node["rest_state"])
          for node in graph["nodes"]}
vocabulary = ["draft", "blocked", "ready", "waiting", "done",
              "failed", "cancelled", "skipped"]
second["unobserved_states"] = [s for s in vocabulary if s not in states]
with open(second_path, "w", encoding="utf-8") as handle:
    json.dump(second, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

python3 - "$HERE/graph.json" "$HERE/status.json" "$HERE/second-shape/graph.json" \
    "$HERE/second-shape/status.json" "$DEMO/list.json" <<'PY'
import json
import sys

graph = json.load(open(sys.argv[1], encoding="utf-8"))
statuses = json.load(open(sys.argv[2], encoding="utf-8"))["tasks"]
alt = json.load(open(sys.argv[3], encoding="utf-8"))
alt_statuses = json.load(open(sys.argv[4], encoding="utf-8"))["tasks"]
listing = json.load(open(sys.argv[5], encoding="utf-8"))

for name, payload, rows in (("primary", graph, statuses), ("second", alt, alt_statuses)):
    if payload.get("next_cursor") is not None:
        raise SystemExit(f"{name} tree read is paged or has no completeness marker")
    ids = {node["task_id"] for node in payload["nodes"]}
    if ids != {status["task_id"] for status in rows}:
        raise SystemExit(f"{name} graph and status disagree")
    root = next((node for node in payload["nodes"] if node["parent_task_id"] is None), None)
    if root is None:
        raise SystemExit(f"{name} has no $root row")
    for node in payload["nodes"]:
        if node["task_id"] != root["task_id"] and node["parent_task_id"] not in ids:
            raise SystemExit(f"{name}: {node['node_key']} has a parent outside the read")

primary_states = {node["rest_state"] for node in graph["nodes"]}
if not {"done", "waiting", "blocked"} <= primary_states:
    raise SystemExit(f"primary lost a run shape: {sorted(primary_states)}")
if {edge["kind"] for edge in alt["edges"]} != {"after", "blocked_by"}:
    raise SystemExit("second tree no longer carries both edge kinds")
if not any(status.get("runner_slot") is not None for status in statuses):
    raise SystemExit("no ended attempt carries the runner slot the panel reads")
if not any(status.get("attempts") for status in statuses):
    raise SystemExit("no status row carries attempt history")
if not listing.get("tasks") or "next_cursor" not in listing:
    raise SystemExit("the project list read is not a page")

print("fixture shapes verified: %d primary rows, %d second-shape rows, %d listed"
      % (len(graph["nodes"]), len(alt["nodes"]), len(listing["tasks"])))
PY

echo "wrote fixtures to $HERE (engine $ACTUAL_COMMIT, schema $(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["schema_revision"])' "$DEMO/schema.json"))"
