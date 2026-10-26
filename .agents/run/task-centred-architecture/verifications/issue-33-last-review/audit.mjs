// Assertions over actual saved records, including observational legacy runner.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const proofDir=path.resolve('.agents/run/task-centred-architecture/verifications/issue-33-last-review');
const previous=path.resolve('.agents/run/task-centred-architecture/verifications/issue-33-residual-review');
const read=async name=>JSON.parse(await readFile(path.join(proofDir,name+'.json'),'utf8'));
const sha=text=>createHash('sha256').update(text).digest('hex');
const summary={programEquality:[],matrices:[],browser:[],logs:[],gates:{},focused:{}};
for(const name of ['browser-matrix.mjs','residual-http.mjs','browser-gateway.mjs','browser-baseline.mjs','probes.mjs']) {
  const before=await readFile(path.join(previous,name),'utf8'),after=await readFile(path.join(proofDir,name),'utf8');
  assert.equal(after,before.replaceAll('issue-33-residual-review','issue-33-last-review'),name+' only artifact path relocation');
  summary.programEquality.push({name,original:sha(before),current:sha(after),onlyArtifactRelocation:true});
}
for(const [name,total,passed] of [
  ['candidate-browser-matrix',84,84],['old-browser-matrix',84,51],
  ['additional-browser-matrix',117,117],['old-additional-browser-matrix',117,39],
  ['candidate-residual-http',36,36],['old-residual-http',36,27],
  ['additional-http',129,129],['old-additional-http',129,63],
]) {
  const data=await read(name);
  assert.equal(data.results.length,total,name);
  assert.equal(data.results.filter(r=>r.pass).length,passed,name);
  if(name.includes('browser')) {
    assert(data.results.every(r=>r.patches===1&&r.committed&&r.originalStatus===200),name+' one committed PATCH with valid board reply');
    assert.equal(data.runtimeEvents.length,0,name+' runtime events');
    if(!name.startsWith('old')) {
      const invalid=data.results.filter(r=>!r.name.startsWith('valid'));
      assert(invalid.every(r=>r.unknown&&r.preserved&&!r.rawException),name+' UNKNOWN plus exact view/drafts retained');
      assert(data.results.every(r=>!r.after.overflow),name+' desktop overflow');
      summary.browser.push({name,invalid:invalid.length,valid:total-invalid.length,screenshots:data.screenshots.length,runtimeEvents:0,oneCommittedPatchEveryCase:true});
    }
  }
  summary.matrices.push({name,total,passed,failed:total-passed});
}
const gateway=await read('browser-gateway');
assert.equal(gateway.results.length,19);
assert(gateway.results.every(r=>r.committed&&r.patches===1&&/outcome unknown/i.test(r.text)&&/refresh/i.test(r.text)), 'all legacy gateway records really UNKNOWN/refresh and committed once');
assert.equal(gateway.runtimeEvents.length,0);
const baseline=await read('browser-verification');
assert.equal(baseline.checks.length,32);assert(baseline.checks.every(r=>r.pass));assert.equal(baseline.runtimeEvents.length,0);
const preserved=await read('candidate-probes');
assert.equal(preserved.results.length,28);assert(preserved.results.every(r=>r.pass));
summary.legacy={gateway:19,baseline:32,preserved:28,gatewayScreenshots:gateway.screenshots.length,baselineScreenshots:baseline.screenshots.length};
for(const name of ['candidate-browser-matrix','additional-browser-matrix','browser-gateway','browser-verification','candidate-residual-http','additional-http']) {
  const data=await read(name);const logs=data.boardLogs||data.logs;
  assert(logs.length>0,name+' log records');
  for(const line of logs) {
    assert(/^(GET|PUT|POST|DELETE) \/[^ ]* \d{3} \d+ms$|^write issue=\d+ fields=(body|labels)$/.test(line),name+' unexpected log format '+line);
    assert(!/ghp_|board_session=|Bearer|csrf|correct horse|exception|TypeError/i.test(line),name+' credential or exception');
  }
  summary.logs.push({name,lines:logs.length,unexpectedFormats:0,credentialOrExceptionText:0});
}
for(const [name,total,passed] of [['web-tests.log',338,338],['root-tests.log',466,466],['focused.log',230,230],['old-focused.log',230,28]]) {
  const text=await readFile(path.join(proofDir,name),'utf8');
  assert(text.includes('# tests '+total));assert(text.includes('# pass '+passed));assert(text.includes('# fail '+(total-passed)));assert(text.includes('# skipped 0'));assert(text.includes('# cancelled 0'));
  summary.focused[name]={total,passed,failed:total-passed};
}
for(const name of ['gates-exits.log','matrix-exits.log','old-exits.log','additional-exits.log','additional-http-exits.log']) {
  summary.gates[name]=await readFile(path.join(proofDir,name),'utf8');
}
summary.bundleHashes=await readFile(path.join(proofDir,'hashes.log'),'utf8');
await writeFile(path.join(proofDir,'audit.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
