"""Validate evidence scope and raw captures without rewriting their whitespace."""
from pathlib import Path
import hashlib
import re
import subprocess

PREFIX = '.agents/run/chamberos-board-v2/verifications/V4-final-L4/'
OUT = Path(PREFIX)
REVIEWED = 'cd64af10bbc2e888990377143a2fcd1ce812bb7c'
RAW = {
    'application-review.diff': '350e558ecc410d2ea10822bc50fd68271594535af54fc3001bc045e4c1621228',
    'logs/typecheck.log': '87e893f7ce7c223477c7f6f0803880736ce687204e91f7f2c39155d39d2ad90d',
    'logs/staged-diff-check.log': '2c7016d75db57234cd398dc900c145d43b548d0fbc54cbb02ae02988c0b9c869',
}

def git(*args):
    return subprocess.check_output(['git', *args])

assert git('branch', '--show-current').decode().strip() == 'feat/board-v3'
assert git('rev-parse', 'HEAD').decode().strip() == REVIEWED
for relative, expected in RAW.items():
    actual = hashlib.sha256((OUT / relative).read_bytes()).hexdigest()
    assert actual == expected, (relative, actual)
    print('Raw capture unchanged:', relative, actual)

patch = (OUT / 'application-review.diff').read_bytes()
paths = re.findall(r'^diff --git a/(\S+) b/\S+$', patch.decode(), re.MULTILINE)
assert len(paths) == 9
assert patch == git('diff', '--no-ext-diff', '28af19b..' + REVIEWED, '--', *paths)
print('Raw patch byte-identical to reviewed Git increment: 9 source/test/smoke paths')

lines = (OUT / 'logs/staged-diff-check.log').read_text().splitlines()
assert len(lines) == 109
for index in range(0, 108, 2):
    match = re.fullmatch(re.escape(PREFIX) + r'application-review\.diff:(\d+): trailing whitespace\.', lines[index])
    assert match and lines[index + 1] == '+ ', lines[index:index + 2]
    assert patch.splitlines()[int(match.group(1)) - 1] == b' '
assert lines[-1] == PREFIX + 'logs/typecheck.log:4: new blank line at EOF.'
print('Initial diff-check exit-2 diagnostics explained: 54 required context spaces, one raw npm EOF blank')

for manifest in ['reviewed-source.sha256', 'preserved-inputs.sha256']:
    entries = (OUT / manifest).read_text().splitlines()
    for line in entries:
        expected, path = line.split('  ', 1)
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected, path
    print('Hash manifest valid:', manifest, len(entries), 'files')

staged = git('diff', '--cached', '--name-only', '-z').decode().split('\0')[:-1]
assert staged and all(path.startswith(PREFIX) for path in staged)
assert not git('diff', '--name-only', '--', '.', ':(exclude)' + PREFIX).strip()
assert not git('diff', REVIEWED, '--name-only', '--', '.', ':(exclude)' + PREFIX).strip()
print('Evidence-only staged scope:', len(staged), 'paths; no tracked product changes')

# Raw captures must stay exact. Check every other staged file with default rules.
command = ['git', 'diff', '--cached', '--check', '--', PREFIX]
command += [':(exclude)' + PREFIX + relative for relative in RAW]
result = subprocess.run(command, capture_output=True, text=True)
print('Scoped whitespace command:', ' '.join(command))
print('Scoped whitespace exit:', result.returncode)
assert result.returncode == 0, result.stdout + result.stderr
print('PASS: scope, reviewed sources, preserved prior evidence, exact raw captures, remaining whitespace')
