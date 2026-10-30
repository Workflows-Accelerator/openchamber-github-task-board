// Private stand-in for OS temporary directory: never inspect the actual default data store.
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub } from '../../../../web/tests/fake-github.mjs';
import { startBoard, HttpSession } from '../../../../web/tests/helpers.mjs';
const out=path.dirname(fileURLToPath(import.meta.url));
const directory=await mkdtemp(path.join(out,'data/isolation-'));
const original=process.env.TMPDIR;process.env.TMPDIR=directory;
const fake=await startFakeGitHub({repo:'owner/repo'});let first,second;
try {
 first=await startBoard(fake);second=await startBoard(fake);
 assert.notEqual(first.sessionFile,second.sessionFile);
 const a=new HttpSession(first.url),b=new HttpSession(second.url);await a.login();await b.login();
 assert.equal((await a.request('/api/project-names',{method:'PUT',body:{repository:'owner/repo',name:'Cross-fixture leak'}})).status,200);
 const observed=(await b.request('/api/project-names')).json.projectNames;
 assert.equal(observed['owner/repo'],'Cross-fixture leak');
 console.log(JSON.stringify({distinctSessionFiles:true,sharedRenameFile:path.join(directory,'project-names.json'),secondServerObserved:observed}));
} finally {if(first)await first.app.close();if(second)await second.app.close();await fake.close();if(original===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=original;await rm(directory,{recursive:true,force:true});}
