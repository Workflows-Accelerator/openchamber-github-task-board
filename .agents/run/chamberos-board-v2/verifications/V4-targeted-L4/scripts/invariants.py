import hashlib,json,re,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent.parent
BASE='28af19b'
REVIEWED='a1225f0'
HEAD='a1225f0'
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
fix_parent=subprocess.check_output(['git','rev-parse',REVIEWED+'^'],text=True).strip()
changed=subprocess.check_output(['git','diff','--name-only',fix_parent,REVIEWED],text=True).splitlines()
after=subprocess.check_output(['git','diff','--name-only',REVIEWED,'HEAD'],text=True).splitlines()
source_after=[p for p in after if p.startswith(('web/','scripts/','test/'))]
track_meta=re.compile(r'^(environment|n8n-token|resources|repos|nohup|notes|canary)$',re.I)
public=[]
for p in Path('web/public').rglob('*'):
    if p.is_file() and p.suffix in ['.js','.css','.html','.json','.svg']:public.append(p)
checks={
 # REVIEWED APP: a1225f0 must exist as a commit (full-object compare, not
 # string compare against the ambiguous short rev) and the working tree app
 # must still match the reviewed application exactly.
 'reviewed_sha_is_a1225f0':subprocess.check_output(['git','cat-file','-t','a1225f0'],text=True).strip()=='commit' and subprocess.check_output(['git','rev-parse','--verify','a1225f0^{commit}'],text=True).strip()=='a1225f023a736da70f6b06798c16a91b655cf01d',
 'worktree_matches_reviewed_app':subprocess.check_output(['git','diff','--name-only','a1225f0','--','web/public/app.js','web/tests/v3-ux-client.test.mjs','scripts/generate-delivery-smoke.mjs'],text=True).strip()=='',
 'source_unchanged_since_reviewed_app':source_after==[],
 'fix_touched_only_app_and_client_test':changed==['web/public/app.js','web/tests/v3-ux-client.test.mjs'],
 'protected_server_panel_service':not any(p.startswith(('web/server/','panel/','service/')) or p=='web/server.ts' for p in changed),
 'markdown_arrange_packages_unchanged':not any(p in ['web/public/markdown.js','web/public/arrange.js','package.json','package-lock.json','pnpm-lock.yaml'] for p in changed),
 'dot_grid_segment_byte_identical':grid(app)==grid(base),
 'Canvas_EN_FR':"nav_canvas: 'Canvas'" in app and "nav_canvas: 'Canevas'" in app,
 'List_EN_FR':"nav_list: 'List'" in app and "nav_list: 'Liste'" in app,
 'sidebar_preserved':'id="app-sidebar"' in html,
 'floor_055':'var CANVAS_READABLE_MIN_SCALE = 0.55;' in app and 'var CANVAS_MIN_SCALE = 0.2;' in app and 'var CANVAS_MAX_SCALE = 2.5;' in app,
 'no_banned_words':not any(re.search(r'\b(?:n8n|mobile|Atelier)\b',p.read_text(),re.I) for p in public),
 'no_pictographic_glyphs':not any(re.search('[\U0001F300-\U0001FAFF\u2600-\u27BF]',p.read_text()) for p in public),
 'no_HTML_inline_style':not re.search(r'\bstyle\s*=\s*[\'\"]',html,re.I),
 'no_JS_generated_HTML_inline_style':not re.search(r'<[^>]+\bstyle\s*=',app,re.I),
 'manifest_identity':all(json.loads(Path('web/public/manifest.json').read_text())[k]=='Workflows Board' for k in ['name','short_name']),
 'CSP_unchanged_server':not any(p.startswith('web/server') for p in changed),
 'touch_sheet_targets':'.board-sheet .rename-project .button { min-height: 44px; }' in css,
 'sheet_reduced_motion':'@media (prefers-reduced-motion: reduce) { .board-sheet[open] { animation: none; } }' in css,
 # V4-1-L4 must stay an untracked, unstaged snapshot: git tracks none of its
 # files, none is staged, and the directory is present with files on disk.
 'V4_1_L4_untracked':(subprocess.check_output(['git','ls-files','.agents/run/chamberos-board-v2/verifications/V4-1-L4'],text=True).strip()=='' and subprocess.check_output(['git','diff','--cached','--name-only','--','.agents/run/chamberos-board-v2/verifications/V4-1-L4'],text=True).strip()=='' and len(list(Path('.agents/run/chamberos-board-v2/verifications/V4-1-L4').rglob('*')))>0),
}
result={'baseline':BASE,'reviewed_application':REVIEWED,'effective_head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'fix_parent':fix_parent,'checks':checks,'grid_sha256':hashlib.sha256(grid(app).encode()).hexdigest(),'changed_source':[p for p in changed if p.startswith(('web/','scripts/'))],'note':'Dot-grid identical to 28af19b. Freeze verified against the fix diff (parent..a1225f0), then source compared to a1225f0 exactly.'}
(OUT/'invariants.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
