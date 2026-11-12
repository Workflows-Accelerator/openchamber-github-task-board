"""V4-1d safety invariants; all outputs stay in this verification directory."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

BASE = '594cb21'
OUT = Path(__file__).resolve().parent.parent


def baseline(path, revision=BASE):
    return subprocess.check_output(['git', 'show', f'{revision}:{path}'], text=True)


def function_block(source, name):
    start = source.index('  function ' + name + '(')
    end = source.index('\n  }\n', start) + 5
    return source[start:end]


app = Path('web/public/app.js').read_text()
css = Path('web/public/theme.css').read_text()
base_app = baseline('web/public/app.js')
base_css = baseline('web/public/theme.css')
changed = subprocess.check_output(['git', 'diff', '--name-only', BASE], text=True).splitlines()
restricted = ('web/server/', 'panel/', 'service/')
prohibited = ['web/public/markdown.js', 'web/public/arrange.js', 'package.json', 'package-lock.json', 'pnpm-lock.yaml']
transform = function_block(app, 'updateCanvasTransform')

checks = {
    'branch_is_feat_board_v3': subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip() == 'feat/board-v3',
    'restricted_paths_unchanged': not any(p.startswith(restricted) or p in prohibited for p in changed),
    'dot_grid_byte_identical_to_base': transform == function_block(base_app, 'updateCanvasTransform'),
    'dot_grid_byte_identical_to_hostile_review_base': transform == function_block(baseline('web/public/app.js', '6535937'), 'updateCanvasTransform'),
    'D37_floor_unchanged': 'var CANVAS_READABLE_MIN_SCALE = 0.55;' in app and 'var CANVAS_READABLE_MIN_SCALE = 0.55;' in base_app,
    'D37_english_action_unchanged': "canvas_show_all: 'Show all ({n})'" in app and "canvas_show_all: 'Show all ({n})'" in base_app,
    'D37_french_action_unchanged': "canvas_show_all: 'Tout afficher ({n})'" in app and "canvas_show_all: 'Tout afficher ({n})'" in base_app,
    'D37_framing_functions_unchanged': all(function_block(app, name) == function_block(base_app, name) for name in ['computeFraming', 'frameDependencyFocus', 'frameFilteredCanvas', 'showAllCanvas', 'applyDependencyFocus']),
    'only_approved_production_paths': all(p in ['web/public/app.js', 'web/public/theme.css', 'web/tests/v3-ux-client.test.mjs'] for p in changed if not p.startswith('.agents/')),
    'stale_suffixless_screenshots_removed': all(not (OUT.parent / 'V4-1c' / 'screenshots' / f'd2-spread-{kind}-{width}.png').exists() for kind in ['focus', 'show-all'] for width in [360, 390, 768, 1280]),
    'V4_1c_has_151_png_files': len(list((OUT.parent / 'V4-1c' / 'screenshots').glob('*.png'))) == 151,
    'V4_1d_has_45_png_files': len(list((OUT / 'screenshots').glob('*.png'))) == 45,
}

for selector in ['.sheet-content h3', '.sheet-intro', '.sheet-group', ':root', ':root[data-theme="light"]', '.canvas-card-title']:
    pattern = re.escape(selector) + r' \{[^}]*\}'
    checks[selector + '_unchanged'] = re.findall(pattern, base_css) == re.findall(pattern, css)

report = {
    'base': BASE,
    'checks': checks,
    'allPass': all(checks.values()),
    'dotGridSha256': hashlib.sha256(transform.encode()).hexdigest(),
    'changedProductionPaths': [p for p in changed if not p.startswith('.agents/')],
}
(OUT / 'invariants.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
raise SystemExit(0 if report['allPass'] else 1)
