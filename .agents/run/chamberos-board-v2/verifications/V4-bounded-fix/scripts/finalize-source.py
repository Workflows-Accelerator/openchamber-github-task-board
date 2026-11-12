# Run only after all verification. Does not stage or commit.
from pathlib import Path
import hashlib,json,subprocess,re
OUT=Path(__file__).resolve().parent.parent
def git(*args):return subprocess.check_output(['git',*args],text=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
tested=json.loads((OUT/'tested-source.json').read_text())
assert all(sha(p)==h for p,h in tested['source_sha256'].items()),'sources changed after tested snapshot'
for phase in ['after-final']:
    for name in ['independent-browser','completion-browser-corrected']:
        d=json.loads((OUT/phase/f'{name}.json').read_text());assert not d['failures'],f'{phase}/{name} failed'
d=json.loads((OUT/'targeted.json').read_text());assert len(d['r1'])==32 and len(d['r2'])==12 and not d['failures']
smoke=json.loads((OUT/'smoke/smoke.json').read_text());assert len(smoke)==14 and all(x['verdict']=='PASS' for x in smoke)
for name in ['npm-test','web-tests']:
    s=(OUT/'logs'/f'{name}.log').read_text();assert re.search(r'^# fail 0$',s,re.M),name
    assert re.search(r'^# skipped 0$',s,re.M),name
receipts=(OUT/'command-results.tsv').read_text().splitlines()
for name in ['npm-test','web-tests','typecheck','server-bundle','delivery-smoke','after-final-independent','after-final-completion','targeted-final']:
    rows=[r.split('\t') for r in receipts if r.split('\t')[0]==name];assert len(rows)==1 and rows[0][1]=='0',name
assert set(git('diff','--name-only').splitlines())=={'web/public/app.js','web/tests/v3-ux-client.test.mjs'},'unexpected tracked changes'
assert git('rev-parse','HEAD').strip()==tested['base'],'unexpected base SHA'
assert git('branch','--show-current').strip()=='feat/board-v3'
subprocess.run(['git','diff','--check'],check=True)
assert (OUT/'application-fix.diff').read_text()==git('diff','--no-ext-diff','--','web/public/app.js')
assert (OUT/'regression-tests.diff').read_text()==git('diff','--no-ext-diff','--','web/tests/v3-ux-client.test.mjs')
print(json.dumps({'status':'ready_for_source_commit','tested_source':tested,'r1':32,'r2':12,'smoke':14,'source_paths':git('diff','--name-only').splitlines()},indent=2))
