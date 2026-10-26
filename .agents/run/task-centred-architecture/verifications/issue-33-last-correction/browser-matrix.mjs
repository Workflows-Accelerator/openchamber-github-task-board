// Independent F1 browser proof. Real board and HTTP gateway; PATCH commits before
// reply is replaced. Product and prior proofs are read-only. Node built-ins only.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const root = process.env.PRODUCT_ROOT || process.cwd();
const proofDir = path.resolve('.agents/run/task-centred-architecture/verifications/issue-33-last-correction');
const prefix = process.env.RESULT_PREFIX || 'candidate';
await mkdir(path.join(proofDir, 'screenshots'), { recursive: true });
const { startFakeGitHub, makeIssue } = await import(path.resolve(root, 'web/tests/fake-github.mjs'));
const { startBoard, BOARD_PASSWORD } = await import(path.resolve(root, 'web/tests/helpers.mjs'));
const baseline = await readFile(path.join(proofDir, 'browser-baseline.mjs'), 'utf8');
const helper = baseline.slice(baseline.indexOf('class CDP {'), baseline.indexOf('function fixtures()'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CDP_PORT = Number(process.env.REVIEW_CDP_PORT || 9373);
const { CDP, ensureObscura } = new Function('WebSocket', 'fetch', 'spawn', 'CDP_PORT', 'sleep', helper + ';return {CDP,ensureObscura};')(WebSocket, fetch, spawn, CDP_PORT, sleep);
const initialBody = '## Overview\nInitial overview\n\n## Open Questions\n- [ ] Initial question?\n\n## Human Tasks\n- [ ] Keep human task\n';
const labels = ['status:todo', 'bug', 'attention:needs-decision', 'phase:execution'];
const fake = await startFakeGitHub({ issues: [makeIssue({number:1, title:'Protocol gateway probe', body:initialBody, labels})] });
const board = await startBoard(fake);
let mode = null;
const gatewayEvents = [];
const gateway = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const upstream = await fetch(board.url + req.url, {method:req.method, headers:{...req.headers, host:new URL(board.url).host}, body:['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)});
    const text = await upstream.text();
    if (['POST','PUT'].includes(req.method) && req.url.startsWith('/api/issues/') && mode) {
      const capture = mode; mode = null;
      const valid = JSON.parse(text);
      const replacement = capture.replace(structuredClone(valid));
      gatewayEvents.push({name:capture.name, method:req.method, path:req.url, originalStatus:upstream.status, patches:fake.patchCalls.length, replacement});
      res.writeHead(200, {'content-type':'application/json'});
      res.end(JSON.stringify(replacement));
    } else { res.writeHead(upstream.status, Object.fromEntries(upstream.headers)); res.end(text); }
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(r => gateway.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${gateway.address().port}`;
const browser = await ensureObscura();
const cdp = new CDP(`ws://127.0.0.1:${CDP_PORT}/devtools/browser`);
await cdp.open();
const target = await cdp.send('Target.createTarget', {url:'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId:target.targetId, flatten:true});
const send = (method, params) => cdp.send(method, params, sessionId);
await send('Page.enable'); await send('Runtime.enable');
async function ev(expression) {
  const r = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function wait(expression, label) {
  for (let i=0;i<180;i++) { if (await ev(expression)) return; await sleep(50); }
  throw new Error('wait timeout: '+label+' '+JSON.stringify(await ev('({url:location.href,text:document.body.innerText.slice(0,600)})')));
}
async function viewport(width) { await send('Emulation.setDeviceMetricsOverride', {width,height:width===360?800:900,deviceScaleFactor:1,mobile:width===360}); }
const screenshots=[];
async function shot(name) {
  const image = await send('Page.captureScreenshot', {format:'png'});
  const file=path.join(proofDir,'screenshots',prefix+'-'+name+'.png');
  await writeFile(file,Buffer.from(image.data,'base64')); screenshots.push(file);
}
const issueSet = (field,value) => p => {p.issue[field]=value;return p;};
const cases = [
  ['emptyObject', () => ({})],
  ['emptyIssue', () => ({issue:{}})],
  ['partialIssue', () => ({issue:{number:1}})],
  ['null', () => null],
  ['scalar', () => 'gateway reply'],
  ['array', () => []],
  ['wrongIdentity', issueSet('number',2)],
  ['missingFingerprint', p => {delete p.issue.fingerprint;return p;}],
  ['missingTitle', p => {delete p.issue.title;return p;}],
  ['missingState', p => {delete p.issue.state;return p;}],
  ['missingUpdatedAt', p => {delete p.issue.updatedAt;return p;}],
  ['missingStatusLabel', p => {delete p.issue.statusLabel;return p;}],
  ['wrongStatusLabel', issueSet('statusLabel',{})],
  ['wrongSectionsArray', issueSet('editableSections',{})],
  ['wrongQuestionsArray', issueSet('openQuestions',{})],
  ['wrongHumanArray', issueSet('humanTasks',{})],
  ['wrongAcceptanceArray', issueSet('acceptanceCriteria',{})],
  ['wrongSubtasksArray', issueSet('subtasks',{})],
  ['wrongOptionsArray', p => {p.statusOptions={};return p;}],
  ['nullSectionEntry', issueSet('editableSections',[null])],
  ['partialSectionEntry', issueSet('editableSections',[{}])],
  ['scalarQuestionEntry', issueSet('openQuestions',[42])],
  ['nullQuestionEntry', issueSet('openQuestions',[null])],
  ['partialQuestionEntry', issueSet('openQuestions',[{}])],
  ['nullHumanEntry', issueSet('humanTasks',[null])],
  ['nullOptionEntry', p => {p.statusOptions=[null];return p;}],
  ['partialOptionEntry', p => {p.statusOptions=[{}];return p;}],
  ['valid', p => p],
];
const results=[];
try {
  await viewport(1280);
  await send('Page.navigate',{url});
  await wait('document.getElementById("login-form")','login');
  await ev(`document.getElementById('password').value=${JSON.stringify(BOARD_PASSWORD)};document.getElementById('login-form').requestSubmit()`);
  await wait('document.querySelector(".task-row")','board');
  let id=0;
  for (const kind of ['section','question','status']) for (const [name,replace] of cases) {
    fake.mutateIssue(1, issue => {issue.body=initialBody;issue.title='Protocol gateway probe';issue.labels=labels.map(name=>({name,color:'ededed'}));});
    await send('Page.navigate',{url:`${url}/?case=${++id}#/issue/1`});
    await wait('document.getElementById("detail-view") && !document.getElementById("detail-view").hidden && document.getElementById("overview-text").value === "Initial overview" && document.getElementById("answer-0")',kind+'/'+name+' detail');
    const overviewDraft=`Local overview draft ${kind}/${name}`;
    const answerDraft=`Local answer draft ${kind}/${name}`;
    await ev(`document.getElementById('overview-text').value=${JSON.stringify(overviewDraft)};document.getElementById('answer-0').value=${JSON.stringify(answerDraft)};document.getElementById('status-select').value='status:in-review'`);
    const before=await ev(`({title:document.getElementById('detail-title').textContent,meta:document.getElementById('detail-meta').textContent,questions:document.getElementById('question-list').innerText,human:document.getElementById('human-list').innerText,overview:document.getElementById('overview-text').value,answer:document.getElementById('answer-0').value,status:document.getElementById('status-select').value})`);
    const patchBefore=fake.patchCalls.length;
    const gatewayBefore=gatewayEvents.length;
    mode={name:kind+'/'+name,replace};
    await ev(kind==='section' ? `document.getElementById('save-overview').click()` : kind==='question' ? `document.getElementById('question-list').querySelector('.question-actions button').click()` : `document.getElementById('apply-status').click()`);
    for (let i=0;i<180 && gatewayEvents.length===gatewayBefore;i++) await sleep(30);
    await sleep(300);
    const after=await ev(`({title:document.getElementById('detail-title').textContent,meta:document.getElementById('detail-meta').textContent,questions:document.getElementById('question-list').innerText,human:document.getElementById('human-list').innerText,overview:document.getElementById('overview-text').value,answer:document.getElementById('answer-0')?.value ?? null,status:document.getElementById('status-select').value,save:document.getElementById('save-status').textContent,notice:document.getElementById('notice').textContent,announcer:document.getElementById('announcer').textContent,overviewHidden:document.getElementById('overview-text').hidden,body:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth})`);
    const issue=fake.findIssue(1);
    const committed=kind==='section'?issue.body.includes(overviewDraft):kind==='question'?issue.body.includes('*(Answer: '+answerDraft+')*'):issue.labels.some(l=>l.name==='status:in-review');
    const patches=fake.patchCalls.length-patchBefore;
    const text=kind==='section'?after.save:after.notice;
    const unknown=/outcome unknown/i.test(text)&&/refresh/i.test(text);
    const preserved=['title','meta','questions','human','overview','answer','status'].every(k=>before[k]===after[k]);
    const rawException=/Cannot read|not a function|TypeError/.test(text);
    const originalStatus=gatewayEvents.at(-1)?.originalStatus;
    const pass=committed && patches===1 && originalStatus===200 && (name==='valid' ? !rawException && !unknown && (kind==='section'?after.save==='Saved just now.':kind==='question'?after.announcer==='Answer saved.':after.announcer==='Status updated.') : unknown && preserved && !rawException);
    results.push({kind,name,pass,unknown,preserved,rawException,patches,committed,originalStatus,text,before,after});
    if (['emptyIssue','wrongStatusLabel','nullOptionEntry','partialSectionEntry','valid'].includes(name)) {
      await shot(kind+'-'+name+'-desktop');
      if (name!=='valid') {await viewport(360);await shot(kind+'-'+name+'-360');await viewport(1280);}
    }
    console.log(`${pass?'PASS':'FAIL'} ${kind}/${name} patches=${patches} committed=${committed} unknown=${unknown} preserved=${preserved} text=${JSON.stringify(text)}`);
  }
} finally {
  const runtimeEvents=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Runtime.consoleAPICalled');
  await writeFile(path.join(proofDir,prefix+'-browser-matrix.json'),JSON.stringify({prefix,results,screenshots,gatewayEvents,boardLogs:board.logs,runtimeEvents,summary:{total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length}},null,2)+'\n');
  await send('Target.closeTarget',{targetId:target.targetId}).catch(()=>{});cdp.close();
  gateway.closeAllConnections();await new Promise(r=>gateway.close(r));await board.app.close();await fake.close();
  if(browser.started)process.kill(-browser.child.pid);
}
process.exitCode=results.some(r=>!r.pass)?1:0;
