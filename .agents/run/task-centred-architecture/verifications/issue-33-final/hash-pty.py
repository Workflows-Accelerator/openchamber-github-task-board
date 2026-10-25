import os, pty, select, subprocess, time, json
from pathlib import Path
root=Path('/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board')
proof=root/'.agents/run/task-centred-architecture/verifications/issue-33-final'
password=b'synthetic-prompt-password-42'
master,slave=pty.openpty()
env={k:v for k,v in os.environ.items() if k!='BOARD_PASSWORD'}
p=subprocess.Popen(['node','web/tools/hash-password.mjs'],cwd=root,stdin=slave,stdout=slave,stderr=slave,env=env,close_fds=True)
os.close(slave)
transcript=b''
end=time.time()+8
while b'Enter board password:' not in transcript and time.time()<end:
 if select.select([master],[],[],.2)[0]:transcript+=os.read(master,4096)
os.write(master,password+b'\n')
while time.time()<end:
 if select.select([master],[],[],.1)[0]:
  try:transcript+=os.read(master,4096)
  except OSError:break
 if p.poll() is not None:break
exitcode=p.wait(timeout=3)
os.close(master)
assert exitcode==0,(exitcode,transcript)
assert password not in transcript,transcript
assert b'scrypt$' in transcript,transcript
hashvalue=next(line.strip() for line in transcript.decode().splitlines() if line.startswith('scrypt$'))
verify=subprocess.run(['node','--input-type=module','-e',"import {verifyPassword} from './web/server/config.ts'; let d='';for await(const c of process.stdin)d+=c;const [password,hash]=JSON.parse(d);if(!verifyPassword(password,hash))process.exit(1)"],cwd=root,input=json.dumps([password.decode(),hashvalue]),text=True,capture_output=True)
assert verify.returncode==0,verify.stderr
# Also execute the documented hidden-shell-input environment-file workflow in a disposable directory.
work=Path('/tmp/opencode/issue33-final')
cmd=f'''umask 077 && read -rs P && printf 'BOARD_PASSWORD_HASH=%s\\n' "$(printf '%s' "$P" | node {root}/web/tools/hash-password.mjs)" > {work}/synthetic.env.board && unset P'''
shell=subprocess.run(['bash','-c',cmd],env=env,input=password+b'\n',capture_output=True)
assert shell.returncode==0,shell.stderr
file=work/'synthetic.env.board'
assert file.stat().st_mode & 0o777==0o600
result={'node':'v22.23.3','ptyExit':exitcode,'passwordEchoed':False,'hashVerified':True,'documentedShellExit':shell.returncode,'environmentFileMode':oct(file.stat().st_mode & 0o777),'passwordInCommand':password.decode() in cmd,'passwordInOutput':password in shell.stdout+shell.stderr}
(proof/'hash-pty.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
file.unlink()
