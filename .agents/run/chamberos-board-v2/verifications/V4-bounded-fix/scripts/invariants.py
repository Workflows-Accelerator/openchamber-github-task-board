# Fresh bounded-pass invariants; old evidence remains read-only.
import hashlib,json,re,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent.parent
BASE='0cef002f5401d54483c2c037fea998702fc5da08'
def git(*args):return subprocess.check_output(['git',*args],text=True)
def baseline(p):return git('show',f'{BASE}:{p}')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
app=Path('web/public/app.js').read_text()
html=Path('web/public/index.html').read_text()
css=Path('web/public/theme.css').read_text()
def grid(s):
    start=s.index('    var baseStep = 24;',s.index('  function updateCanvasTransform('))
    end=s.index('\n',s.index('    viewport.style.backgroundPosition =',start))
    return s[start:end]
changed=git('diff','--name-only',BASE).splitlines()
allowed=['web/public/app.js','web/tests/v3-ux-client.test.mjs']
prefix='.agents/run/chamberos-board-v2/verifications/V4-bounded-fix/'
preserved=json.loads((OUT/'preserved-inputs.json').read_text())
preserved_now={str(p.relative_to(Path.cwd())):sha(p) for d in ['V4-1-L4','V4-final-L4'] for p in sorted((OUT.parent/d).rglob('*')) if p.is_file()}
public=[p for p in Path('web/public').rglob('*') if p.is_file() and p.suffix in ['.js','.css','.html','.json','.svg']]
checks={
 'branch_unchanged':git('branch','--show-current').strip()=='feat/board-v3',
 'only_owned_paths':all(p in allowed or p.startswith(prefix) for p in changed),
 'previous_evidence_exact':preserved_now==preserved,
 'V4_1_L4_untracked':not git('ls-files',str(OUT.parent/'V4-1-L4')).strip(),
 'server_panel_service_packages_unchanged':all(p in allowed or p.startswith(prefix) for p in changed),
 'smoke_unchanged':Path('scripts/generate-delivery-smoke.mjs').read_text()==baseline('scripts/generate-delivery-smoke.mjs'),
 'dot_grid_segment_byte_identical':grid(app)==grid(baseline('web/public/app.js')),
 'markdown_arrange_css_html_unchanged':all(Path(p).read_text()==baseline(p) for p in ['web/public/markdown.js','web/public/arrange.js','web/public/theme.css','web/public/index.html']),
 'Canvas_List_sidebar_preserved':all(v in app for v in ["nav_canvas: 'Canvas'","nav_canvas: 'Canevas'","nav_list: 'List'","nav_list: 'Liste'"]) and 'id="app-sidebar"' in html,
 'zoom_bounds_and_floor_preserved':all(v in app for v in ['var CANVAS_MIN_SCALE = 0.2;','var CANVAS_MAX_SCALE = 2.5;','var CANVAS_READABLE_MIN_SCALE = 0.55;']),
 'no_banned_words':not any(re.search(r'\b(?:n8n|mobile|Atelier)\b',p.read_text(),re.I) for p in public),
 'no_pictographs':not any(re.search('[\U0001F300-\U0001FAFF\u2600-\u27BF]',p.read_text()) for p in public),
 'no_HTML_inline_style':not re.search(r'\bstyle\s*=\s*[\'"]',html,re.I),
 'no_JS_generated_HTML_inline_style':not re.search(r'<[^>]+\bstyle\s*=',app,re.I),
 'D38_unchanged':app[app.index('  function sidebarRailActive('):app.index('  function matchesSearch(')]==baseline('web/public/app.js')[baseline('web/public/app.js').index('  function sidebarRailActive('):baseline('web/public/app.js').index('  function matchesSearch(')],
}
result={'base':BASE,'effective_head':git('rev-parse','HEAD').strip(),'checks':checks,'grid_sha256':hashlib.sha256(grid(app).encode()).hexdigest(),'changed':changed,'source_sha256':sha('web/public/app.js')}
(OUT/'invariants.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
