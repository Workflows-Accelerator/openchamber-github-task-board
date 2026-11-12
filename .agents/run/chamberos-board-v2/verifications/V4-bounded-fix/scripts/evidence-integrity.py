import hashlib,json,subprocess
from pathlib import Path
OUT=Path(__file__).resolve().parent.parent
PREFIX=str(OUT.relative_to(Path.cwd()))+'/'
def git(*args):return subprocess.check_output(['git',*args],text=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
source=json.loads((OUT/'tested-source.json').read_text())
checks={
 'branch':git('branch','--show-current').strip()=='feat/board-v3',
 'source_matches_tested':all(sha(p)==h for p,h in source['source_sha256'].items()),
 'only_proof_staged':all(p.startswith(PREFIX) for p in git('diff','--cached','--name-only').splitlines()),
 'only_proof_uncommitted_tracked':all(p.startswith(PREFIX) for p in git('diff','--name-only').splitlines()),
 'old_evidence_and_untracked_fixture_preserved':all(sha(p)==h for p,h in json.loads((OUT/'preserved-inputs.json').read_text()).items()),
 'V4_1_L4_not_staged_or_tracked':not git('ls-files','.agents/run/chamberos-board-v2/verifications/V4-1-L4').strip(),
 'application_patch_exact':(OUT/'application-fix.diff').read_text()==git('diff','--no-ext-diff',source['base'],'--','web/public/app.js'),
 'regressions_patch_exact':(OUT/'regression-tests.diff').read_text()==git('diff','--no-ext-diff',source['base'],'--','web/tests/v3-ux-client.test.mjs'),
}
# Raw unified patches carry mandatory one-space context lines. Raw npm logs
# contain their own blank lines. Preserve them exactly; never rewrite evidence.
# All other staged files must pass the ordinary Git whitespace check.
raw={'application-fix.diff','regression-tests.diff','logs/typecheck.log','logs/npm-test.log','logs/focused-tests.log','logs/evidence-integrity.log'}
staged=git('diff','--cached','--name-only').splitlines()
exclusions=[p for p in staged if p[len(PREFIX):] in raw]
command=['git','diff','--cached','--check','--','.',*[f':(exclude){p}' for p in exclusions]]
r=subprocess.run(command,text=True,capture_output=True)
checks['staged_whitespace_except_exact_raw']=r.returncode==0
result={'head':git('rev-parse','HEAD').strip(),'checks':checks,'raw_whitespace_exceptions':exclusions,'raw_sha256':{p:sha(p) for p in exclusions},'whitespace_stdout':r.stdout,'whitespace_stderr':r.stderr,'whitespace_exit':r.returncode}
print(json.dumps(result,indent=2))
raise SystemExit(0 if all(checks.values()) else 1)
