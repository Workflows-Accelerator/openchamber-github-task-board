import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {startFakeGitHub,makeIssue} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/tests/fake-github.mjs';
import {startBoard,HttpSession} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/tests/helpers.mjs';
const out=[];const rec=(name,r)=>{out.push({name,...r});console.log(JSON.stringify(out.at(-1)))};
const fake=await startFakeGitHub({issues:[makeIssue({number:1,body:'## Overview\nBefore\n\n## Open Questions\n- [ ] Question?\n\n## Human Tasks\n- [ ] Keep\n',labels:['status:todo','phase:execution','attention:needs-decision','bug']})]});
const board=await startBoard(fake);const s=new HttpSession(board.url);await s.login();
const detail=async()=>(await s.request('/api/issues/1')).json.issue;
try {
 let d=await detail();
 fake.setBeforePatchHook(issue=>{issue.body=issue.body.replace('Before','EXTERNAL COMMIT')});
 let r=await s.request('/api/issues/1/section',{method:'PUT',body:{sectionId:'overview',text:'LOCAL',fingerprint:d.fingerprint}});
 assert.equal(r.status,200);assert.ok(!fake.findIssue(1).body.includes('EXTERNAL COMMIT'));rec('accepted overwrite window',{status:r.status,localSurvived:true,externalLost:true,patches:fake.patchCalls.length});
 fake.setBeforePatchHook(null);
 d=await detail();fake.setPatchHook((issue,payload)=>{issue.body=payload.body.replace('    indented code','indented code');return {applyPayload:false}});
 r=await s.request('/api/issues/1/section',{method:'PUT',body:{sectionId:'overview',text:'    indented code',fingerprint:d.fingerprint}});
 rec('R7 indentation mismatch',{status:r.status,requested:'    indented code',readback:r.json.issue.editableSections[0].text,body:fake.findIssue(1).body});
 fake.setPatchHook(null);
 d=await detail();const before=fake.patchCalls.length;
 // In-process same-fingerprint contenders make one mutation, no replay.
 const pair=await Promise.all(['FIRST','SECOND'].map(text=>s.request('/api/issues/1/section',{method:'PUT',body:{sectionId:'overview',text,fingerprint:d.fingerprint}})));
 assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);assert.equal(fake.patchCalls.length,before+1);rec('board contenders',{statuses:pair.map(r=>r.status),patches:fake.patchCalls.length-before});
 d=await detail();r=await s.request('/api/issues/1/status',{method:'POST',body:{status:'status:done',fingerprint:d.fingerprint}});
 assert.equal(r.status,200);assert.ok(fake.findIssue(1).labels.some(l=>l.name==='phase:execution'));assert.ok(fake.findIssue(1).labels.some(l=>l.name==='attention:needs-decision'));assert.equal(fake.findIssue(1).state,'open');rec('human Done and independent attention',{status:r.status,state:fake.findIssue(1).state,labels:fake.findIssue(1).labels.map(l=>l.name)});
 // Shared question parser uses suffix fence toggling unlike remediated sections scanner.
 fake.mutateIssue(1,i=>{i.body='## Overview\nIntro\n\n## Open Questions\n```text\nexample\n```not-a-closing-fence\n- [ ] This is a code example, not an actionable question?\n```\n\n## Human Tasks\n- [ ] Keep\n'});
 d=await detail();rec('question fence projection',{questions:d.openQuestions});
 if(d.openQuestions.some(q=>q.answerIndex!==null)){
  const n=fake.patchCalls.length;r=await s.request('/api/issues/1/questions/0/answer',{method:'POST',body:{answer:'yes',fingerprint:d.fingerprint}});
  rec('question fence write',{status:r.status,patches:fake.patchCalls.length-n,body:fake.findIssue(1).body});
 }
}finally{await board.app.close();await fake.close();}
await writeFile('/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/verifications/issue-33-final/extra.json',JSON.stringify(out,null,2)+'\n');
