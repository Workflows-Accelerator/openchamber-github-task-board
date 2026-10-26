// #37 adaptation: qualified paths/output only; original assertions preserved.
// Source-derived R2/R3 hostile variants, actual localhost HTTP routes only.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.env.PRODUCT_ROOT || process.cwd();
const prefix = process.env.RESULT_PREFIX || 'additional';
const proofDir = path.resolve('.agents/run/task-centred-architecture/verifications/issue-37-review');
const { startFakeGitHub, makeIssue } = await import(path.resolve(root, 'web/tests/fake-github.mjs'));
const { startBoard, HttpSession } = await import(path.resolve(root, 'web/tests/helpers.mjs'));
const { parseWebOpenQuestions } = await import(path.resolve(root, 'web/server/board.ts'));
const results = [], logs = [];
function record(name, pass, detail) {
  results.push({ name, pass, ...detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
}
const validation = { resource: 'Issue', field: 'body', code: 'invalid' };
const r2Cases = [
  ['lowerCase', {message:'validation failed',errors:[validation]}],
  ['upperCase', {message:'VALIDATION FAILED',errors:[validation]}],
  ['prefix', {message:'Gateway Validation Failed',errors:[validation]}],
  ['suffix', {message:'Validation Failed while relaying committed response',errors:[validation]}],
  ['trailingSpace', {message:'Validation Failed ',errors:[validation]}],
  ['messageObject', {message:{},errors:[validation]}],
  ['errorsObject', {message:'Validation Failed',errors:validation}],
  ['transportErrorObjects', {message:'Gateway lost upstream',errors:[{code:'ECONNRESET',message:'connection reset'}]}],
  ['genericWithShapedErrors', {message:'Gateway lost upstream',errors:[validation]}],
  ['partialShaped', {message:'Validation Failed',errors:[{resource:'Issue',code:'invalid'}]}],
  ['unrecognizedCode', {message:'Validation Failed',errors:[{...validation,code:'timeout'}]}],
  ['mixedShapedAndNull', {message:'Validation Failed',errors:[validation,null]}],
  ['emptyErrors', {message:'Validation Failed',errors:[]}],
  ['stringErrors', {message:'Validation Failed',errors:['connection reset']}],
  ['html422', '<h1>Validation failed while relaying</h1>', false, true],
  ['malformed422', '{"message":"Validation Failed",', false, true],
  ['scalar422', 42],
  ['null422', null],
  ['array422', [validation]],
  ...['missing','missing_field','invalid','already_exists','unprocessable','custom'].map(code => ['github.'+code, {message:'Validation Failed',errors:[{...validation,code}]}, true]),
];
const original = '## Overview\nOriginal\n\n## Open Questions\n- [ ] Real?\n';
const f = await startFakeGitHub({issues:[makeIssue({number:1,body:original,labels:['status:todo']})]});
const b = await startBoard(f), c = new HttpSession(b.url); await c.login();
try {
  for (const kind of ['section','question','status']) for (const [name,payload,definitive=false,raw=false] of r2Cases) {
    f.setPatchHook(null);
    f.mutateIssue(1, i => {i.body=original;i.labels=[{name:'status:todo'}];});
    const d=await c.request('/api/repos/owner/repo/issues/1');
    const marker='Committed '+kind+'/'+name;
    let hookEvent;
    const before=f.patchCalls.length;
    f.setPatchHook((issue,patch,req,res)=>{
      if(!definitive) {
        if(patch.body!==undefined)issue.body=patch.body;
        if(patch.labels!==undefined)issue.labels=patch.labels.map(name=>({name}));
      }
      hookEvent={method:req.method,committed:!definitive,payload,patch};
      res.writeHead(422, {'content-type':name==='html422'?'text/html':'application/json'});
      res.end(raw?payload:JSON.stringify(payload));
    });
    const route=kind==='section'?'/section':kind==='question'?'/questions/0/answer':'/status';
    const response=await c.request('/api/repos/owner/repo/issues/1'+route,{method:kind==='section'?'PUT':'POST',body:{fingerprint:d.json.issue.fingerprint,sectionId:'overview',text:marker,answer:marker,status:'status:in-review'}});
    const patches=f.patchCalls.length-before;
    const committed=kind==='status'?f.findIssue(1).labels.some(l=>l.name==='status:in-review'):f.findIssue(1).body.includes(marker);
    record('R2.'+kind+'/'+name,response.status===(definitive?400:502)&&response.json?.error===(definitive?'invalid_request':'write_outcome_unknown')&&patches===1&&committed===!definitive,{status:response.status,response:response.json,patches,committed,hookEvent});
  }
  // Unchanged trusted precommit and explicit upstream rejection mappings.
  for(const [status,payload,headers,expected,error] of [
    [401,{message:'Bad credentials'},{},502,'github_unauthorized'],
    [403,{message:'Forbidden'},{},502,'github_forbidden'],
    [404,{message:'Not Found'},{},404,'not_found'],
    [403,{message:'API rate limit exceeded'},{'x-ratelimit-remaining':'0'},503,'github_rate_limited'],
    [429,{message:'Rate limit'},{},503,'github_rate_limited'],
    [412,{message:'Precondition Failed'},{},409,'conflict'],
  ]) {
    f.setPatchHook(null);f.mutateIssue(1,i=>{i.body=original;i.labels=[{name:'status:todo'}];});
    const d=await c.request('/api/repos/owner/repo/issues/1');const before=f.patchCalls.length;
    f.setPatchHook(()=>({status,payload,headers}));
    const response=await c.request('/api/repos/owner/repo/issues/1/section',{method:'PUT',body:{sectionId:'overview',text:'Denied',fingerprint:d.json.issue.fingerprint}});
    record('R2.preserved.'+status+(headers['x-ratelimit-remaining']?'rate':''),response.status===expected&&response.json?.error===error&&f.patchCalls.length===before+1&&f.findIssue(1).body===original,{status:response.status,response:response.json,patches:f.patchCalls.length-before,unchanged:f.findIssue(1).body===original});
  }
  f.setPatchHook(null);
  const d=await c.request('/api/repos/owner/repo/issues/1');
  for(const [name,route,body] of [
    ['invalidSection','/section',{sectionId:'human-tasks',text:'Refuse'}],
    ['emptyAnswer','/questions/0/answer',{answer:''}],
    ['badStatus','/status',{status:'invalid'}],
    ['noChange','/section',{sectionId:'overview',text:'Original'}],
  ]) {
    const before=f.patchCalls.length;
    const response=await c.request('/api/repos/owner/repo/issues/1'+route,{method:route==='/section'?'PUT':'POST',body:{...body,fingerprint:d.json.issue.fingerprint}});
    record('R2.precommit.'+name,response.status===400&&response.json?.error==='invalid_edit'&&f.patchCalls.length===before,{status:response.status,response:response.json,patches:f.patchCalls.length-before});
  }
  logs.push(...b.logs);
} finally {await b.app.close();await f.close();}
// Tab stops: first tab after zero to three spaces always reaches column four.
// Extra tabs, mixed suffixes and nested-parent contexts must not offer code.
const indents=['\t\t',' \t\t','  \t \t','   \t\t','\t  \t','    \t','     \t  ','      \t','  \t  ','   \t \t '];
for(const [index,indent] of indents.entries()) for(const nested of [false,true]) {
  const body='## Open Questions\r\n'+(nested?'- Parent list\r\n':'')+'\r\n'+indent+'- [ ] Code?\r\n';
  const fake=await startFakeGitHub({issues:[makeIssue({number:1,body})]});
  const board=await startBoard(fake),client=new HttpSession(board.url);await client.login();
  try {
    const list=await client.request('/api/repos/owner/repo/board'),d=await client.request('/api/repos/owner/repo/issues/1');
    const scanner=parseWebOpenQuestions(body);
    record(`R3.projection.${index}/${nested}`,scanner.length===0&&d.json.issue.openQuestions.length===0&&list.json.issues[0].counts.openQuestions.total===0,{indent,nested,scanner,detail:d.json.issue.openQuestions,count:list.json.issues[0].counts.openQuestions});
    const response=await client.request('/api/repos/owner/repo/issues/1/questions/0/answer',{method:'POST',body:{answer:'Must not mutate',fingerprint:d.json.issue.fingerprint}});
    record(`R3.refusal.${index}/${nested}`,response.status===400&&response.json?.error==='invalid_edit'&&fake.patchCalls.length===0&&fake.findIssue(1).body===body,{status:response.status,response:response.json,patches:fake.patchCalls.length,unchanged:fake.findIssue(1).body===body});
    logs.push(...board.logs);
  } finally {await board.app.close();await fake.close();}
}
// Each true nested list marker remains answerable, with exact CRLF target/offset.
for(const marker of ['-','*','+','1.']) {
  const body=`\uFEFF## Open Questions\r\n- [x] Done? *(Answer: yes)*\r\n- [ ] Same?\r\n\r\n  \t\t- [ ] Code?\r\n\r\n  ${marker} [ ] Same?\r\n    continuation\r\n- [ ] Last?\r\n`;
  const fake=await startFakeGitHub({issues:[makeIssue({number:1,body})]});
  const board=await startBoard(fake),client=new HttpSession(board.url);await client.login();
  try {
    const d=await client.request('/api/repos/owner/repo/issues/1');
    const response=await client.request('/api/repos/owner/repo/issues/1/questions/1/answer',{method:'POST',body:{answer:'Nested exact',fingerprint:d.json.issue.fingerprint}});
    const expected=body.replace(`  ${marker} [ ] Same?`,`  ${marker} [x] Same? *(Answer: Nested exact)*`);
    record('R3.realNested.'+marker,response.status===200&&fake.patchCalls.length===1&&fake.findIssue(1).body===expected&&JSON.stringify(d.json.issue.openQuestions.map(q=>q.answerIndex))==='[null,0,1,2]',{status:response.status,patches:fake.patchCalls.length,body:fake.findIssue(1).body,expected,views:d.json.issue.openQuestions});
    logs.push(...board.logs);
  } finally {await board.app.close();await fake.close();}
}
await mkdir(proofDir,{recursive:true});
const summary={total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
await writeFile(path.join(proofDir,prefix+'-http.json'),JSON.stringify({results,logs,summary},null,2)+'\n');
console.log(JSON.stringify(summary));
process.exitCode=summary.failed?1:0;
