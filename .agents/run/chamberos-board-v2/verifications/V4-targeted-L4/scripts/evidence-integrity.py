"""Read-only review checks; write evidence only beneath this script's parent.

Run from worktree root after staging V4-targeted-L4. No browser or smoke run.
Strict R2 equality supplements the browser probe's 0.001 comparison tolerance.
"""
import hashlib
import json
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent
ROOT = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
PREFIX = OUT.relative_to(ROOT).as_posix() + '/'
PRIOR = ROOT / '.agents/run/chamberos-board-v2/verifications'
REVIEWED = 'a1225f023a736da70f6b06798c16a91b655cf01d'
DISPATCH = 'b07dd941ee6f6df5e496631335473d9876b19680'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def names(*args):
    return [s.decode() for s in git(*args).split(b'\0') if s]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tracked_at(revision, prefix):
    return names('ls-tree', '-rz', '--name-only', revision, '--', prefix)


def inventory(directory):
    return {
        p.relative_to(ROOT).as_posix(): sha(p.read_bytes())
        for p in sorted(directory.rglob('*')) if p.is_file()
    }


def view(value):
    return {key: value[key] for key in ['panX', 'panY', 'scale']}


def stored(value, expected):
    return value is not None and json.loads(value) == expected


checks = {}
checks['branch_feat_board_v3'] = git('branch', '--show-current').decode().strip() == 'feat/board-v3'
checks['reviewed_full_sha'] = git('rev-parse', 'a1225f0^{commit}').decode().strip() == REVIEWED
checks['reviewed_is_dispatch_ancestor'] = subprocess.run(
    ['git', 'merge-base', '--is-ancestor', REVIEWED, DISPATCH], cwd=ROOT, check=False
).returncode == 0

# Every tested source path, not just the two changed by the correction.
source_roots = ['web', 'panel', 'service', 'scripts', 'test', 'package.json',
                'package-lock.json', 'pnpm-lock.yaml', 'tsconfig.json']
source_files = names('ls-tree', '-rz', '--name-only', REVIEWED, '--', *source_roots)
source_rows = []
for name in source_files:
    path = ROOT / name
    current = path.read_bytes() if path.is_file() else b''
    reviewed = git('show', f'{REVIEWED}:{name}')
    source_rows.append({'path': name, 'sha256': sha(current),
                        'reviewed_sha256': sha(reviewed), 'exact': current == reviewed and path.is_file()})
checks['all_tested_source_exact_to_reviewed'] = all(row['exact'] for row in source_rows)
(OUT / 'reviewed-source.sha256').write_text(''.join(
    f"{row['sha256']}  {row['path']}\n" for row in source_rows
))

# Prior untracked and committed evidence: verify names as well as every byte.
old = json.loads((PRIOR / 'V4-bounded-fix/preserved-inputs.json').read_text())
preservation = {}
for name in ['V4-1-L4', 'V4-final-L4']:
    prefix = (PRIOR / name).relative_to(ROOT).as_posix() + '/'
    expected = {key: value for key, value in old.items() if key.startswith(prefix)}
    actual = inventory(PRIOR / name)
    exact = expected == actual
    preservation[name + '_prior_inventory'] = {
        'expected_files': len(expected), 'actual_files': len(actual), 'exact': exact,
        'mismatches': sorted(key for key in set(expected) | set(actual) if expected.get(key) != actual.get(key)),
    }
    checks[name + '_matches_prior_inventory'] = bool(expected) and exact

for name in ['V4-final-L4', 'V4-bounded-fix']:
    directory = PRIOR / name
    relative = directory.relative_to(ROOT).as_posix()
    expected_names = tracked_at(DISPATCH, relative)
    actual = inventory(directory)
    mismatches = [key for key in expected_names if actual.get(key) != sha(git('show', f'{DISPATCH}:{key}'))]
    exact = set(expected_names) == set(actual) and not mismatches
    preservation[name + '_dispatch_blobs'] = {
        'tracked_files': len(expected_names), 'actual_files': len(actual),
        'exact': exact, 'mismatches': mismatches,
    }
    checks[name + '_exact_to_dispatch_blobs'] = exact

untracked_path = (PRIOR / 'V4-1-L4').relative_to(ROOT).as_posix()
checks['V4_1_L4_untracked_unstaged'] = (
    not names('ls-files', '-z', '--', untracked_path)
    and not names('diff', '--cached', '--name-only', '-z', '--', untracked_path)
    and len(names('ls-files', '--others', '--exclude-standard', '-z', '--', untracked_path)) == 327
)

# Strict equality of every recorded return; do not round or apply a tolerance.
targeted = json.loads((OUT / 'targeted-review.json').read_text())
regression = json.loads((OUT / 'regression-review.json').read_text())
smoke = json.loads((OUT / 'smoke/smoke.json').read_text())
invariants = json.loads((OUT / 'invariants.json').read_text())
A = {'panX': 123.125, 'panY': -47.875, 'scale': 0.873}
B = {'panX': -201.625, 'panY': 93.375, 'scale': 1.237}
r2 = []
for row in targeted['r2']:
    steps = {key: value for step in row['steps'] for key, value in step.items()}
    scenario = row['scenario']
    expected = A
    details = {}
    if scenario == 'dependency-only':
        expected = steps['focus']['returnView']
    elif scenario == 'filter-during-focus':
        expected = view(steps['preFocus'])
        during = steps['filterDuringFocus']
        after = steps['afterClose']
        details['captured_true_pre_focus'] = during['filterView'] == expected and stored(during['stored'], expected)
        details['deferred_under_focus'] = during['pending'] is True and bool(during.get('focus'))
        details['consumed_pending_preserved_return'] = (
            after['pending'] is False and after.get('focus') is None
            and after['filterView'] == expected and stored(after['stored'], expected)
        )
    elif scenario == 'clear-under-focus-second-cycle':
        during = steps['clearedWhileFocused']
        second = row['secondEnd']
        details['deferred_A_under_focus'] = (
            during['pending'] is True and bool(during.get('focus'))
            and during['filterView'] == A and stored(during['stored'], A)
        )
        details['distinct_second_cycle_exact_B'] = view(second) == B and B != A
        details['second_cycle_consumed'] = (
            second['filterView'] is None and second['stored'] is None
            and second['pending'] is False and second.get('focus') is None
        )
    elif scenario == 'change-filter-without-clearing':
        during = steps['duringChange']
        after = steps['afterClose']
        details['deferred_change_preserved_A'] = (
            during['pending'] is True and len(during['filters']) == 1
            and during['filterView'] == A and stored(during['stored'], A)
        )
        details['handoff_preserved_A'] = (
            after['pending'] is False and after.get('focus') is None
            and after['filterView'] == A and stored(after['stored'], A)
        )
    elif scenario == 'exit-with-filter-active-then-clear':
        after = steps['afterClose']
        details['exact_true_pre_focus_on_exit'] = view(after) == view(steps['preFocus'])
        details['exit_preserved_A'] = after['filterView'] == A and stored(after['stored'], A)
    elif scenario == 'list-clear-reload-canvas':
        during = steps['clearedInList']
        details['list_clear_deferred_A'] = during['pending'] is True and during['filterView'] == A and stored(during['stored'], A)
    elif scenario == 'search-only':
        during = steps['searching']
        details['search_never_captures_or_moves'] = view(during) == A and during['filterView'] is None and during['stored'] is None
    else:
        raise ValueError(f'Unreviewed scenario: {scenario}')
    end = row['end']
    details['exact_final_numbers'] = view(end) == expected
    # state has no dependencyFocus property until the first selection. JSON
    # omits undefined for List/reload and search-only; null follows a close.
    # Neither is active focus. Numeric equality remains strict above.
    details['final_memory_storage_pending_focus_consumed'] = (
        end['filterView'] is None and end['stored'] is None
        and end['pending'] is False and end.get('focus') is None
    )
    r2.append({'width': row['width'], 'scenario': scenario, 'expected': expected,
               'actual': view(end), 'strict_checks': details, 'pass': all(details.values())})
checks['all_14_R2_strict_numeric_returns'] = len(r2) == 14 and all(row['pass'] for row in r2)

explicit = [row['explicit'] for row in targeted['r1'] if row.get('kind') == 'explicit']
incomplete = [row for row in explicit if row['missing']]
complete = [row for row in explicit if not row['missing']]
filtered_incomplete = [row for row in targeted['filterLimit'] if row['missing']]
checks['targeted_zero_failures_diagnostics'] = not any(targeted[key] for key in ['failures', 'errors', 'console', 'csp'])
checks['R1_32_explicit_20_complete_12_incomplete'] = len(explicit) == 32 and len(complete) == 20 and len(incomplete) == 12
checks['R1_incomplete_truthful_no_overlapping_cards_no_absent_endpoint_labels'] = all(
    row['scale'] == 0.2 and row['limitNote'] and row['limitNote']['hit']
    and not row['noteOverlapsAnyCard'] and not row['legendOverlapsAnyCard']
    and not row['misleadingLabels'] and not row['legendShowAllVisible'] and not row['barShowAllVisible']
    for row in incomplete
)
checks['R1_complete_no_false_limit'] = all(row['limitNote'] is None and not row['stateLimited'] for row in complete)
checks['filtered_28_complete_8_incomplete'] = (
    len(targeted['filterComplete']) == 28 and len(filtered_incomplete) == 8
    and all(row['kind'] == 'priority-high' for row in targeted['filterComplete'])
    and all(row['kind'] == 'stage-todo' and row['scale'] == 0.2 and row['warningHit']
            and not row['overlapsCard'] and not row['overlapsViewport'] and not row['barShowAllVisible']
            and len(row['missing']) == 4 and all(card['fullyOutside'] for card in row['missing'])
            for row in filtered_incomplete)
)
checks['regression_zero_failures_unexpected_errors'] = not any(regression[key] for key in ['failures', 'errors', 'console'])
checks['Arrange_Undo_strict_all_6_positions'] = regression['arrange']['before'] == regression['arrange']['undone'] and len(regression['arrange']['before']) == 6
checks['smoke_14_PASS'] = len(smoke) == 14 and all(row['verdict'] == 'PASS' for row in smoke)
checks['invariants_20_PASS'] = len(invariants['checks']) == 20 and all(invariants['checks'].values())

# Staging owns only evidence. Before the first git add, record a provisional
# empty staging set; the final report must use a run made after staging.
staged = names('diff', '--cached', '--name-only', '-z')
unstaged_tracked = names('diff', '--name-only', '-z')
checks['staging_evidence_only'] = all(name.startswith(PREFIX) for name in staged)
checks['no_unstaged_tracked_changes_outside_owned_evidence'] = all(name.startswith(PREFIX) for name in unstaged_tracked)
whitespace = subprocess.run(['git', 'diff', '--cached', '--check'], cwd=ROOT, text=True, capture_output=True, check=False)
checks['staged_whitespace_check'] = whitespace.returncode == 0
(OUT / 'staged-paths.txt').write_text(''.join(name + '\n' for name in staged))

# Do not normalize raw logs or screenshots. Hash them for review integrity.
raw_files = []
for path in sorted(OUT.rglob('*')):
    if path.is_file() and (path.parts[len(OUT.parts)] in ['logs', 'screenshots', 'smoke']
                          or path.name in ['targeted-review.json', 'targeted-review-initial.json',
                                           'regression-review.json', 'regression-review-initial.json', 'invariants.json']):
        # The current run's redirected log is still being written.
        if path.name != 'evidence-integrity.log':
            raw_files.append(path)
(OUT / 'raw-captures.sha256').write_text(''.join(
    f'{sha(path.read_bytes())}  {path.relative_to(ROOT).as_posix()}\n' for path in raw_files
))

result = {
    'reviewed_application': REVIEWED,
    'dispatch_head': DISPATCH,
    'effective_head': git('rev-parse', 'HEAD').decode().strip(),
    'checks': checks,
    'source_file_count': len(source_rows),
    'source_hash_manifest': 'reviewed-source.sha256',
    'source_mismatches': [row for row in source_rows if not row['exact']],
    'prior_evidence': preservation,
    'R2_strict_numeric_checks': r2,
    'R1_incomplete_dependency_tags': [row['tag'] for row in incomplete],
    'raw_capture_files_hashed': len(raw_files),
    'staged_file_count_at_check': len(staged),
    'staged_paths': 'staged-paths.txt',
    'staging_was_nonempty': bool(staged),
    'whitespace_exit': whitespace.returncode,
    'whitespace_output': whitespace.stdout + whitespace.stderr,
    'notes': [
        'No browser probes, test suites or smoke rerun by this integrity script.',
        'Staged path list proves names/scope, not self-referential final commit hashes.',
        'Exact raw-capture hashes exclude the integrity log being generated by this invocation.',
    ],
}
(OUT / 'integrity.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'checks': checks, 'source_files': len(source_rows),
                  'strict_R2_scenarios': len(r2), 'staged_files': len(staged),
                  'failed': [name for name, value in checks.items() if not value]}, ensure_ascii=False, indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
