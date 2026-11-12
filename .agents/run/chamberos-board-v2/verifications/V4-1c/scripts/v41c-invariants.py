"""V4-1c source invariants against the accepted 6535937 baseline."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

BASE = '6535937'
OUT = Path(__file__).resolve().parent.parent


def baseline(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}']).decode()


def function_block(source, name):
    start = source.index('  function ' + name + '(')
    end = source.index('\n  }\n', start) + 5
    return source[start:end]


app = Path('web/public/app.js').read_text()
css = Path('web/public/theme.css').read_text()
html = Path('web/public/index.html').read_text()
base_app = baseline('web/public/app.js')
base_css = baseline('web/public/theme.css')
transform = function_block(app, 'updateCanvasTransform')
changed = subprocess.check_output(['git', 'diff', '--name-only', BASE], text=True).splitlines()
restricted = ('web/server/', 'panel/', 'service/')
prohibited = ['web/public/markdown.js', 'web/public/arrange.js', 'package.json', 'package-lock.json', 'pnpm-lock.yaml']

checks = {
    'dot_grid_function_byte_identical': transform == function_block(base_app, 'updateCanvasTransform'),
    'restricted_paths_unchanged': not any(path.startswith(restricted) or path in prohibited for path in changed),
    'html_no_inline_style_attribute': not re.search(r'\sstyle\s*=', html, re.I),
    'no_added_inline_style_attribute': not re.search(r'\sstyle\s*=', '\n'.join(line[1:] for line in subprocess.check_output(['git', 'diff', '--no-ext-diff', BASE, '--', 'web/public/app.js', 'web/public/index.html', 'web/public/theme.css'], text=True).splitlines() if line.startswith('+') and not line.startswith('+++')), re.I),
    'one_phone_filter_entry': 'id="applied-filter-btn"' in html and 'compact-filter' not in html,
    'focus_close_wording': "fr ? 'Fermer' : 'Close'" in app,
    'product_name': "brand_title: 'Workflows Board'" in app,
    'no_new_dependencies_or_build_step': not any(path in prohibited[2:] for path in changed),
}

# Source comments are not product copy; the pre-existing CSS comment mentioning
# the pictograph rule must not be mistaken for user-visible text.
for path, text in [('web/public/app.js', app), ('web/public/theme.css', css), ('web/public/index.html', html)]:
    copy = re.sub(r'/\*[\s\S]*?\*/|<!--[\s\S]*?-->', '', text)
    checks[path + '_no_banned_copy'] = re.search(r'\b(?:Atelier|n8n|mobile|emoji)\b', copy, re.I) is None
    checks[path + '_no_pictographs'] = re.search('[\U0001F300-\U0001FAFF\u2600-\u27BF]', text) is None

for selector in ['.sheet-content h3', '.sheet-intro', '.sheet-group', ':root', ':root[data-theme="light"]']:
    pattern = re.escape(selector) + r' \{[^}]*\}'
    before = re.findall(pattern, base_css)
    after = re.findall(pattern, css)
    checks[selector + '_rhythm_or_colours_unchanged'] = before == after

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
