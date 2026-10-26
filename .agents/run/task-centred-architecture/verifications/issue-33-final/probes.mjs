import assert from 'node:assert/strict';
import http from 'node:http';
import {setTimeout as sleep} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import {startFakeGitHub, makeIssue} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/tests/fake-github.mjs';
import {startBoard, HttpSession, BOARD_PASSWORD} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/tests/helpers.mjs';
import {GitHubClient} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/server/github.ts';
import {SessionStore, LoginRateLimiter} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/server/auth.ts';
import {findSections, replaceSectionText} from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/server/sections.ts';
const out=[];
const record=(name,data)=>{out.push({name,...data});console.log(JSON.stringify(out.at(-1)));};
const body='## Overview\nBefore\n\n## Open Questions\n- [ ] Original question?\n\n## Human Tasks\n- [ ] Keep\n';
const fake=await startFakeGitHub({issues:[makeIssue({number:1,body,labels:['status:todo','phase:execution','attention:needs-decision','bug']})]});
let mode='normal', patches=0;
const proxy=http.createServer(async(req,res)=>{
  const data=[]; for await(const chunk of req) data.push(chunk);
  const response=await fetch(fake.url+req.url,{method:req.method,headers:{authorization:`Bearer ${fake.token}`,'content-type':'application/json'},body:req.method==='PATCH'?Buffer.concat(data):undefined});
  const text=await response.text();
  if(req.method==='PATCH') {
    patches++;
    if(mode==='truncated'){res.writeHead(200,{'content-type':'application/json','content-length':String(Buffer.byteLength(text)+100)});res.write(text.slice(0,8));setTimeout(()=>res.destroy(),25);return;}
    if(mode==='timeout'){res.writeHead(200,{'content-type':'application/json'});res.write('[');return;}
    if(mode==='parse'){res.writeHead(200,{'content-type':'application/json'});res.end('{bad');return;}
    if(mode==='gateway'){res.writeHead(502,{'content-type':'text/html'});res.end('<h1>Bad gateway</h1>');return;}
    if(mode==='postsend422'){res.writeHead(422,{'content-type':'text/html'});res.end('<h1>Gateway lost upstream</h1>');return;}
  }
  res.writeHead(response.status,{'content-type':'application/json'});res.end(text);
});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
const board=await startBoard(fake,{githubApiBase:`http://127.0.0.1:${proxy.address().port}`,env:{BOARD_BASE_URL:'https://board.example.test',BOARD_TRUST_PROXY:'true'}});
const owner=new HttpSession(board.url); await owner.login();
try {
 for(mode of ['truncated','parse','gateway','timeout','postsend422']){
  const loaded=await owner.request('/api/issues/1'); const before=patches;
  const r=await owner.request('/api/issues/1/section',{method:'PUT',body:{sectionId:'overview',text:'Committed '+mode,fingerprint:loaded.json.issue.fingerprint}});
  record('R1 '+mode,{status:r.status,error:r.json?.error,message:r.json?.message,patches:patches-before,committed:fake.findIssue(1).body.includes('Committed '+mode)});
 }
 mode='normal';
 const loaded=await owner.request('/api/issues/1');
 fake.mutateIssue(1,i=>{i.body=i.body.replace('Original question?','Changed question?')});
 const before=patches;
 const stale=await owner.request('/api/issues/1/questions/0/answer',{method:'POST',body:{answer:'Yes',fingerprint:loaded.json.issue.fingerprint}});
 assert.equal(stale.status,409); assert.equal(patches,before);
 record('stale question',{status:stale.status,newText:stale.json.issue.openQuestions[0].text,patches:patches-before});
 const fresh=await owner.request('/api/issues/1');
 for(const [name,options] of [
  ['missing csrf',{csrf:false}],['wrong csrf',{csrf:false,headers:{'x-csrf-token':'wrong'}}],['evil origin',{headers:{origin:'https://evil.test'}}],['evil referer',{headers:{referer:'https://evil.test/'}}],
 ]){
  const r=await owner.request('/api/issues/1/status',{method:'POST',body:{status:'status:done',fingerprint:fresh.json.issue.fingerprint},...options});assert.equal(r.status,403);record(name,{status:r.status});
 }
 const other=new HttpSession(board.url);await other.login();
 const cross=await owner.request('/api/issues/1/status',{method:'POST',body:{status:'status:done',fingerprint:fresh.json.issue.fingerprint},csrf:false,headers:{'x-csrf-token':other.csrf}});assert.equal(cross.status,403);record('cross session csrf',{status:cross.status});
 const forged=new HttpSession(board.url);forged.cookie='board_session=fake.signed';const fr=await forged.request('/api/board');assert.equal(fr.status,401);record('forged cookie',{status:fr.status});
 for(const path of ['/api/board?repo=other/repo','/repos/other/repo/issues','/%2e%2e/server/config.ts','/..%2fserver%2fconfig.ts','/%00']){const r=await owner.request(path);assert.ok([400,404].includes(r.status));record('path boundary',{path,status:r.status});}
 const content=await Promise.all(['/','/app.js','/api/board','/api/issues/1'].map(p=>owner.request(p)));
 assert.ok(content.every(r=>!r.text.includes(fake.token)&&!r.text.includes(BOARD_PASSWORD)));assert.ok(!board.logs.join('\n').includes(fake.token));record('credential boundaries',{noTokenOrPassword:true,unknownRepoHits:fake.state.unknownRepoHits});
 const savedCookie=other.cookie;await other.logout();other.cookie=savedCookie;const replay=await other.request('/api/board');assert.equal(replay.status,401);record('logout replay',{status:replay.status});
 // Slow-body, abort, global occupancy, distributed queue admission.
 const slow=http.request(board.url+'/api/session',{method:'POST',headers:{'content-length':1000},agent:false});slow.on('error',()=>{});slow.write('{"password":');await sleep(100);
 const occupied=await new HttpSession(board.url).login();const usable=await owner.request('/api/board');await sleep(2150);const recovered=await new HttpSession(board.url).login();
 assert.equal(occupied.status,429);assert.equal(usable.status,200);assert.equal(recovered.status,200);record('R2 slow body',{during:occupied.status,authenticated:usable.status,after2250ms:recovered.status});slow.destroy();
 const slowAbort=http.request(board.url+'/api/session',{method:'POST',headers:{'content-length':1000},agent:false});slowAbort.on('error',()=>{});slowAbort.write('{');await sleep(50);slowAbort.destroy();await sleep(50);const afterAbort=await new HttpSession(board.url).login();assert.equal(afterAbort.status,200);record('R2 abort',{status:afterAbort.status});
 const raw=(ip,password)=>new Promise(resolve=>{const req=http.request(board.url+'/api/session',{method:'POST',localAddress:ip,agent:false,headers:{'content-type':'application/json'}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,retry:res.headers['retry-after'],body:JSON.parse(data)}));});req.on('error',e=>resolve({error:e.message}));req.end(JSON.stringify({password}));});
 const flood=Promise.all(Array.from({length:200},(_,i)=>raw(`127.0.1.${i+1}`,'wrong password')));await sleep(20);const underFlood=await owner.request('/api/board');const attempts=await flood;
 const counts={};for(const r of attempts)counts[r.status]=(counts[r.status]??0)+1;
 assert.equal(underFlood.status,200);assert.ok(counts[429]>0);assert.ok(attempts.every(r=>[401,429].includes(r.status)));record('R2 200 distinct socket peers',{counts,authenticatedDuring:underFlood.status,retryGuidance:attempts.filter(r=>r.status===429).every(r=>Number(r.retry)>0)});
 const starts=[];for(let i=0;i<12;i++){const q=http.request(board.url+'/api/session',{method:'POST',localAddress:`127.0.2.${i+1}`,agent:false,headers:{'content-length':1000}},res=>{starts.push(res.statusCode);res.resume()});q.on('error',()=>{});q.write('{');starts.push(q);}
 await sleep(100);const authFlood=await owner.request('/api/board');const rejected=starts.filter(x=>typeof x==='number');await sleep(2150);record('R2 12 slow peers',{earlyRejected:rejected,authenticated:authFlood.status,postDeadline:(await raw('127.0.2.1',BOARD_PASSWORD)).status});for(const q of starts)if(typeof q!=='number')q.destroy();
 const wrong=[];for(let i=0;i<6;i++){const r=await owner.request('/api/session',{method:'POST',csrf:false,body:{password:'wrong'},headers:{'x-forwarded-for':`192.0.2.${i}`,forwarded:`for=192.0.2.${i}`}});wrong.push(r.status);}assert.deepEqual(wrong,[401,401,401,401,401,429]);record('R3 env true still ignores headers',{statuses:wrong});
}finally{await board.app.close();proxy.closeAllConnections();await new Promise(r=>proxy.close(r));await fake.close();}
for(const marker of ['```','~~~~','````']){
 const b=`## Overview\nIntro\n${marker}text\nexample\n${marker}not-a-closing-fence\n## Still code\nexample\n${marker}\n\n## Human Tasks\n- [ ] keep\n`;
 assert.deepEqual(findSections(b).map(s=>s.title),['Overview','Human Tasks']);assert.equal(replaceSectionText(b,'overview','NEW'),'## Overview\nNEW\n\n## Human Tasks\n- [ ] keep\n');
}record('R4 marker grammar',{suffixesRemainInFence:true});
const store=new SessionStore({secret:'s'.repeat(48),maxSessions:2});const a=store.create(), b=store.create();store.get(a.cookieValue);const c=store.create();assert.ok(store.get(a.cookieValue));assert.equal(store.get(b.cookieValue),null);assert.ok(store.get(c.cookieValue));record('R6 LRU',{retainedUsedA:true,evictedUnusedB:true,size:store.size});
let now=0;const limiter=new LoginRateLimiter({now:()=>now});for(let i=0;i<100000;i++)for(let j=0;j<5;j++)limiter.recordFailure(String(i));assert.equal(limiter.size,1000);const before=limiter.check('99999');now=60000;const after=limiter.check('99999');assert.equal(after.allowed,true);record('R2 bounded limiter',{size:1000,before,after});
const crlfFake=await startFakeGitHub({issues:[makeIssue({number:1,body:'## Overview\r\n\r\nOriginal\r\n\r\n## Human Tasks\r\n- [ ] Keep\r\n'})]});const crlfBoard=await startBoard(crlfFake);try{const s=new HttpSession(crlfBoard.url);await s.login();const d=await s.request('/api/issues/1');const r=await s.request('/api/issues/1/section',{method:'PUT',body:{sectionId:'overview',text:'Changed\nsecond line',fingerprint:d.json.issue.fingerprint}});assert.equal(r.status,200);assert.ok(crlfFake.findIssue(1).body.endsWith('## Human Tasks\r\n- [ ] Keep\r\n'));record('R7 CRLF',{status:r.status,text:r.json.issue.editableSections[0].text,patches:crlfFake.patchCalls.length,preservedHumanTasks:true});}finally{await crlfBoard.app.close();await crlfFake.close();}
// R8 uses real HTTP, not a custom fetch. First validate Link, then same-origin redirect.
let redirectMode=false;const paths=[];const api=http.createServer((req,res)=>{paths.push({path:req.url,hasToken:req.headers.authorization==='Bearer synthetic-redirect-token'});res.setHeader('content-type','application/json');if(req.url.startsWith('/repos/owner/repo/issues')){if(redirectMode){res.writeHead(302,{location:'/repos/other/repo/issues'});res.end();}else{res.setHeader('link',`<http://127.0.0.1:${api.address().port}/repos/other/repo/issues?page=2>; rel="next"`);res.end('[{"number":1}]');}}else res.end('[{"number":2,"title":"Other repository"}]');});await new Promise(r=>api.listen(0,'127.0.0.1',r));try{const client=new GitHubClient({apiBase:`http://127.0.0.1:${api.address().port}`,token:'synthetic-redirect-token',repo:{owner:'owner',name:'repo',full:'owner/repo'}});await assert.rejects(()=>client.listIssues(),/repository path/);record('R8 Link path',{paths:[...paths],rejected:true});paths.length=0;redirectMode=true;const r=await client.listIssues();record('R8 same origin redirect',{paths,returned:r.items});}finally{api.closeAllConnections();await new Promise(r=>api.close(r));}
await writeFile('/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/verifications/issue-33-final/probes.json',JSON.stringify(out,null,2)+'\n');
