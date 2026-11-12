import hashlib,json,re,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent.parent
BASE='28af19b'
HEAD='cd64af10bbc2e888990377143a2fcd1ce812bb7c'
def baseline(p):return subprocess.check_output(['git','show',f'{BASE}:{p}'],text=True)
app=Path('web/public/app.js').read_text()
base=baseline('web/public/app.js')
html=Path('web/public/index.html').read_text()
css=Path('web/public/theme.css').read_text()
def grid(s):
    start=s.index('    var baseStep = 24;',s.index('  function updateCanvasTransform('))
    end=s.index("    viewport.style.backgroundPosition =",start)
    end=s.index('\n',end)
    return s[start:end]
changed=subprocess.check_output(['git','diff','--name-only',BASE,HEAD],text=True).splitlines()
public=[]
for p in Path('web/public').rglob('*'):
    if p.is_file() and p.suffix in ['.js','.css','.html','.json','.svg']:public.append(p)
checks={
 'reviewed_sha':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==HEAD,
 'protected_server_panel_service':not any(p.startswith(('web/server/','panel/','service/')) or p=='web/server.ts' for p in changed),
 'markdown_arrange_packages_unchanged':not any(p in ['web/public/markdown.js','web/public/arrange.js','package.json','package-lock.json','pnpm-lock.yaml'] for p in changed),
 'dot_grid_segment_byte_identical':grid(app)==grid(base),
 'Canvas_EN_FR':"nav_canvas: 'Canvas'" in app and "nav_canvas: 'Canevas'" in app,
 'List_EN_FR':"nav_list: 'List'" in app and "nav_list: 'Liste'" in app,
 'sidebar_preserved':'id="app-sidebar"' in html,
 'floor_055':'var CANVAS_READABLE_MIN_SCALE = 0.55;' in app,
 'no_banned_words':not any(re.search(r'\b(?:n8n|mobile|Atelier)\b',p.read_text(),re.I) for p in public),
 'no_pictographic_glyphs':not any(re.search('[\U0001F300-\U0001FAFF\u2600-\u27BF]',p.read_text()) for p in public),
 'no_HTML_inline_style':not re.search(r'\bstyle\s*=\s*[\'\"]',html,re.I),
 'no_JS_generated_HTML_inline_style':not re.search(r'<[^>]+\bstyle\s*=',app,re.I),
 'manifest_identity':all(json.loads(Path('web/public/manifest.json').read_text())[k]=='Workflows Board' for k in ['name','short_name']),
 'CSP_unchanged_server':not any(p.startswith('web/server') for p in changed),
 'touch_sheet_targets':'.board-sheet .rename-project .button { min-height: 44px; }' in css,
 'sheet_reduced_motion':'@media (prefers-reduced-motion: reduce) { .board-sheet[open] { animation: none; } }' in css,
}
result={'baseline':BASE,'head':HEAD,'checks':checks,'grid_sha256':hashlib.sha256(grid(app).encode()).hexdigest(),'changed_source':[p for p in changed if p.startswith(('web/','scripts/'))],'note':'Only the dot-grid computation/assignments must be byte-identical, not the enclosing transform function whose animation/label hooks intentionally changed.'}
(OUT/'invariants.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
