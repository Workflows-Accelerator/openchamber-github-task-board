import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub,makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard,HttpSession } from '../../../../web/tests/helpers.mjs';
const out=path.dirname(fileURLToPath(import.meta.url)),data=await mkdtemp(path.join(out,'data/order-body-'));
const raw='## Overview\r\nOriginal\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 2000 -->';
const fake=await startFakeGitHub({honorIfMatch:true,issues:[makeIssue({number:1,title:'Draft',body:raw,labels:['status:draft']})]});let board;
try {
 board=await startBoard(fake,{sessionFilePath:path.join(data,'sessions.json')});const a=new HttpSession(board.url),b=new HttpSession(board.url);await a.login();await b.login();
 const ep='/api/repos/owner/repo/issues/1',detail=async()=> (await a.request(ep)).json.issue;
 const security=[];for(const client of [new HttpSession(board.url),a]){const result=await client.request('/api/repos/owner/repo/issues',{method:'POST',csrf:false,body:{title:'Refuse'}});security.push(result.status);}assert.deepEqual(security,[401,403]);
 console.log(JSON.stringify({name:'create security',statuses:security}));
 const section=await a.request(ep+'/section',{method:'PUT',body:{fingerprint:(await detail()).fingerprint,sectionId:'overview',text:'Changed overview'}});
 assert.equal(section.status,200);assert.equal(fake.findIssue(1).body.includes('<!-- board-order: 42 -->'),false);
 console.log(JSON.stringify({name:'section edit destroys fenced marker elsewhere',status:section.status,before:raw,after:fake.findIssue(1).body}));
 fake.mutateIssue(1,i=>{i.body='Idea\n\n<!-- board-order: 2000 -->'});
 let lo=1000,hi=2000,successfulWrites=0,last;
 while(successfulWrites<100){const result=await a.request(ep+'/order',{method:'PUT',body:{fingerprint:(await detail()).fingerprint,previous:lo,next:hi}});last=result;if(result.status!==200)break;hi=result.json.issue.order;successfulWrites++;}
 assert.equal(successfulWrites,53);assert.equal(last.status,409);
 console.log(JSON.stringify({name:'real repeated reorder writes exhaust precision',successfulWrites,lastStatus:last.status,previous:lo,next:hi,payload:last.json}));
 // Distinct sessions with the same observed boundary independently produce identical ranks.
 fake.repositories[0].issues=[makeIssue({number:1,title:'First moving',body:'Idea\n\n<!-- board-order: 3000 -->',labels:['status:draft']}),makeIssue({number:2,title:'Second moving',body:'Idea\n\n<!-- board-order: 4000 -->',labels:['status:draft']})];
 const fa=(await detail()).fingerprint,fb=(await b.request('/api/repos/owner/repo/issues/2')).json.issue.fingerprint;
 const moves=await Promise.all([a.request(ep+'/order',{method:'PUT',body:{fingerprint:fa,previous:1000,next:2000}}),b.request('/api/repos/owner/repo/issues/2/order',{method:'PUT',body:{fingerprint:fb,previous:1000,next:2000}})]);
 assert.deepEqual(moves.map(x=>x.status),[200,200]);assert.deepEqual(moves.map(x=>x.json.issue.order),[1500,1500]);
 console.log(JSON.stringify({name:'two independent sessions collide',statuses:moves.map(x=>x.status),orders:moves.map(x=>x.json.issue.order)}));
 // Existing, undisplayed web Align Drafts endpoint still mutates without observed fingerprint.
 const align=await a.request('/api/repos/owner/repo/issues/batch-align',{method:'POST',body:{}});
 assert.equal(align.status,200);console.log(JSON.stringify({name:'extension-only align still exposed by web API',status:align.status,alignedCount:align.json.alignedCount,patches:fake.patchCalls.slice(-2).map(p=>Object.keys(p.payload))}));
}finally{if(board)await board.app.close();await fake.close();await rm(data,{recursive:true,force:true});}
