// Independent residual HTTP matrix; Node built-ins, synthetic localhost only.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.env.PRODUCT_ROOT||process.cwd();
const proofDir=path.resolve('.agents/run/task-centred-architecture/verifications/issue-33-last-review');
const prefix=process.env.RESULT_PREFIX||'candidate';
const {startFakeGitHub,makeIssue}=await import(path.resolve(root,'web/tests/fake-github.mjs'));
const {startBoard,HttpSession}=await import(path.resolve(root,'web/tests/helpers.mjs'));
const results=[],logs=[];
function record(name,pass,detail){results.push({name,pass,...detail});console.log(`${pass?'PASS':'FAIL'} ${name} ${JSON.stringify(detail)}`);}
const fake=await startFakeGitHub({issues:[makeIssue({number:1,body:'## Overview\nOriginal\n',labels:['status:todo']})]});
const board=await startBoard(fake);
const client=new HttpSession(board.url);await client.login();
try {
  const cases=[
    ['genericObject',{message:'Gateway lost upstream'},false],
    ['html','<h1>Gateway lost upstream</h1>',false,true],
    ['malformed','{"message":',false,true],
    ['null',null,false],
    ['string','Gateway lost upstream',false],
    ['number',42,false],
    ['array',[],false],
    ['arrayObjects',[{message:'Gateway lost upstream'}],false],
    ['genericErrorsEmpty',{message:'Gateway lost upstream',errors:[]},false],
    ['genericErrorsStrings',{message:'Gateway lost upstream',errors:['connection reset']},false],
    ['gatewayValidationWords',{message:'Gateway validation failed while relaying committed response'},false],
    ['githubValidation',{message:'Validation Failed',errors:[{resource:'Issue',field:'body',code:'invalid'}]},true],
  ];
  for(const [name,payload,precommit,raw] of cases){
    const detail=await client.request('/api/issues/1');
    const marker='Committed '+name;
    fake.setPatchHook((issue,patch,req,res)=>{
      if(!precommit)issue.body=patch.body;
      res.writeHead(422,{'content-type':name==='html'?'text/html':'application/json'});
      res.end(raw?payload:JSON.stringify(payload));
    });
    const before=fake.patchCalls.length;
    const response=await client.request('/api/issues/1/section',{method:'PUT',body:{sectionId:'overview',text:marker,fingerprint:detail.json.issue.fingerprint}});
    const patches=fake.patchCalls.length-before;
    const committed=fake.findIssue(1).body.includes(marker);
    const expected=precommit?{status:400,error:'invalid_request'}:{status:502,error:'write_outcome_unknown'};
    record('F2.'+name,response.status===expected.status&&response.json?.error===expected.error&&patches===1&&committed===!precommit,{payload,expected,status:response.status,body:response.json,patches,committed});
  }
  logs.push(...board.logs);
}finally{await board.app.close();await fake.close();}
const questions={
  fourSpacesOnly:{body:'## Open Questions\n\n    - [ ] Code?\n',texts:[]},
  tabOnly:{body:'## Open Questions\n\n\t- [ ] Code?\n',texts:[]},
  spaceTabOnly:{body:'## Open Questions\n\n \t- [ ] Code?\n',texts:[]},
  twoSpacesTabOnly:{body:'## Open Questions\n\n  \t- [ ] Code?\n',texts:[]},
  threeSpacesTabOnly:{body:'## Open Questions\n\n   \t- [ ] Code?\n',texts:[]},
  nestedCode:{body:'## Open Questions\n- Parent list\n\n      - [ ] Nested code?\n',texts:[]},
  realBeforeAfter:{body:'## Open Questions\n- [ ] Before?\n\n    - [ ] Four-space code?\n\n\t- [ ] Tab code?\n\n- [ ] After?\n',texts:['Before?','After?'],target:1},
  realNestedContinuation:{body:'## Open Questions\n- [ ] First?\n  continuation without a checkbox\n  - [ ] Nested real?\n    continuation four spaces\n- [ ] Last?\n',texts:['First?','Nested real?','Last?'],target:1},
  nestedCodeAndReal:{body:'## Open Questions\n- Parent list\n\n      - [ ] Nested code?\n\n- [ ] Last?\n',texts:['Last?'],target:0},
  crlf:{body:'## Open Questions\r\n- [x] Completed? *(Answer: yes)*\r\n\r\n    - [ ] Code?\r\n\r\n  - [ ] Nested real?\r\n',texts:['Completed? *(Answer: yes)*','Nested real?'],target:0},
};
for(const [name,{body,texts,target}]of Object.entries(questions)){
  const f=await startFakeGitHub({issues:[makeIssue({number:1,body})]});
  const b=await startBoard(f);const c=new HttpSession(b.url);await c.login();
  try{
    const list=await c.request('/api/board'),detail=await c.request('/api/issues/1');
    const views=detail.json.issue.openQuestions;
    const count=list.json.issues[0].counts.openQuestions;
    const match=JSON.stringify(views.map(q=>q.text))===JSON.stringify(texts)&&count.total===texts.length;
    record('F3.projection.'+name,match,{count,views,expectedTexts:texts,body});
    // A code-only target uses 0; mixed fixture uses out-of-range source slot.
    const refuseIndex=target===undefined?0:views.length;
    const before=f.patchCalls.length;
    const refused=await c.request(`/api/issues/1/questions/${refuseIndex}/answer`,{method:'POST',body:{answer:'must refuse code',fingerprint:detail.json.issue.fingerprint}});
    record('F3.refusal.'+name,refused.status===400&&refused.json?.error==='invalid_edit'&&f.patchCalls.length===before&&f.findIssue(1).body===body,{index:refuseIndex,status:refused.status,response:refused.json,patches:f.patchCalls.length-before,unchanged:f.findIssue(1).body===body,body:f.findIssue(1).body});
    if(target!==undefined){
      const response=await c.request(`/api/issues/1/questions/${target}/answer`,{method:'POST',body:{answer:'exact nested answer',fingerprint:detail.json.issue.fingerprint}});
      const after=f.findIssue(1).body;
      const expected=body.replace(name==='crlf'?'  - [ ] Nested real?':name==='realNestedContinuation'?'  - [ ] Nested real?':name==='nestedCodeAndReal'?'- [ ] Last?':'- [ ] After?',name==='crlf'||name==='realNestedContinuation'?'  - [x] Nested real? *(Answer: exact nested answer)*':name==='nestedCodeAndReal'?'- [x] Last? *(Answer: exact nested answer)*':'- [x] After? *(Answer: exact nested answer)*');
      record('F3.realTarget.'+name,response.status===200&&after===expected&&f.patchCalls.length===before+1,{status:response.status,patches:f.patchCalls.length-before,body:after,expected});
    }
    logs.push(...b.logs);
  }finally{await b.app.close();await f.close();}
}
await mkdir(proofDir,{recursive:true});
await writeFile(path.join(proofDir,prefix+'-residual-http.json'),JSON.stringify({results,logs,summary:{total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length}},null,2)+'\n');
process.exitCode=results.some(r=>!r.pass)?1:0;
