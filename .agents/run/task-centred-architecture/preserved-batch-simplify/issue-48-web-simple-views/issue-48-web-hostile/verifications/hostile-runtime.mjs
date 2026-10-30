import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, HttpSession, BOARD_PASSWORD } from '../../../../web/tests/helpers.mjs';
import { parseOrderMarker, setOrderMarker, stripOrderMarker, midpointOrder, buildBoardListItem } from '../../../../web/server/board.ts';
import { chromium } from '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const out=path.dirname(fileURLToPath(import.meta.url));
const data=await mkdtemp(path.join(out,'data/hostile-'));
const results=[], errors=[], screenshots=[];
function record(name, value) { results.push({name, ...value}); console.log(JSON.stringify({name,...value})); }
const draft=(number,title,order=null,body='Idea')=>makeIssue({number,title,body:order===null?body:body+'\n\n<!-- board-order: '+order+' -->',labels:['status:draft'],repo:'owner/alpha'});
const fake=await startFakeGitHub({ honorIfMatch:true, repositories:[{repo:'owner/alpha',issues:[draft(1,'A'),draft(2,'B'),draft(3,'C')]},{repo:'owner/beta',issues:[makeIssue({number:1,title:'Beta human',labels:['status:todo'],body:'## Overview\nOriginal beta\n\n## Human Tasks\n- [ ] Approve beta\n\n## Open Questions\n- [ ] Decide beta?\n',repo:'owner/beta'})]}] });
let board,browser;
try {
 board=await startBoard(fake,{sessionFilePath:path.join(data,'sessions.json')});
 const client=new HttpSession(board.url); assert.equal((await client.login()).status,200);
 const ep='/api/repos/owner/alpha/issues/1';
 const get=async(url=ep)=>(await client.request(url)).json.issue;
 // Every new mutation must fail safely before dispatch.
 const mutationCases=[['/api/project-names',{repository:'owner/alpha',name:'My Work'}], [ep+'/draft',{title:'Changed',description:'Idea'}], [ep+'/order',{previous:null,next:1000}], [ep+'/move',{target:'owner/beta'}]];
 const security=[];
 for(const [url,body] of mutationCases) {
  const full={fingerprint:(await get()).fingerprint,...body};
  const anonymous=await new HttpSession(board.url).request(url,{method:'PUT',body:full});
  const noCsrf=await client.request(url,{method:'PUT',csrf:false,body:full});
  const forbidden=await client.request(url==='/api/project-names'?url:url.replace('owner/alpha','owner/unknown'),{method:'PUT',body:url==='/api/project-names'?{repository:'owner/unknown',name:'X'}:full});
  assert.equal(anonymous.status,401);assert.equal(noCsrf.status,403);assert.equal(forbidden.status,400);
  security.push({route:url,anonymous:anonymous.status,noCsrf:noCsrf.status,unlisted:forbidden.status});
 }
 record('new mutation security',{security,unknownGitHubHits:fake.state.unknownRepoHits.length});
 const old=(await get()).fingerprint;
 fake.mutateIssue(1,x=>{x.title='Other device'});
 for(const suffix of ['draft','order','move']) assert.equal((await client.request(ep+'/'+suffix,{method:'PUT',body:{fingerprint:old,title:'Overwrite',description:'x',previous:null,next:1000,target:'owner/beta'}})).status,409);
 record('stale target rejected',{routes:3,status:409});
 // Move creates a replacement and closes a historical issue.
 const moving=await client.request(ep+'/move',{method:'PUT',body:{fingerprint:(await get()).fingerprint,target:'owner/beta'}});
 assert.equal(moving.status,200);assert.equal(fake.findIssue(1).state,'closed');
 record('unapproved destructive project move',{status:moving.status,sourceState:fake.findIssue(1).state,targetTitle:fake.findIssue(2,'owner/beta').title,methods:fake.requests.filter(r=>r.method!=='GET').map(r=>r.method+' '+r.path)});
 // Byte-preserving marker semantics, real declared graph syntax.
 const raw='## Overview\r\nOriginal\r\n\r\n## Notes\r\n```md\r\n<!-- board-order: 42 -->\r\n```\r\n\r\n## Overview\r\nKeep second heading  \r\n<!-- board-ordering: 7 -->\r\n\r\n<!-- board-order: 1000 -->';
 fake.repositories[0].issues=[draft(1,'Fenced sample',null,raw)];
 const rewritten=await client.request(ep+'/order',{method:'PUT',body:{fingerprint:(await get()).fingerprint,previous:1000,next:2000}});
 const persisted=fake.findIssue(1).body;
 assert.equal(rewritten.status,200);assert.equal(persisted.includes('<!-- board-order: 42 -->'),false);
 record('marker destroys fenced source',{status:rewritten.status,before:raw,after:persisted});
 const whitespace='Keep this hard break  \r\n\r\n';
 record('marker strips non-marker trailing bytes',{before:whitespace,after:setOrderMarker(whitespace,1000)});
 record('dependency parser',{declaredChecklist:buildBoardListItem(draft(1,'dep',null,'- [ ] Blocked by #2')).dependencies,fencedFalseEdge:buildBoardListItem(draft(1,'dep',null,'```md\nDepends on #2\n```')).dependencies});
 const names=[];
 for(const body of [{repository:'../escape',name:'X'},{repository:'owner/alpha',name:'<script>'},{repository:'__proto__',name:'X'}]) names.push((await client.request('/api/project-names',{method:'PUT',body})).status);
 await Promise.all(['alpha','beta'].map((repo,i)=>client.request('/api/project-names',{method:'PUT',body:{repository:'owner/'+repo,name:i?'Second':'First'}})));
 const stored=JSON.parse(await readFile(path.join(data,'project-names.json'),'utf8'));
 assert.equal(stored['owner/alpha'],'First');assert.equal(stored['owner/beta'],'Second');
 record('rename validation and same-process concurrent distinct keys',{invalidStatuses:names,keys:Object.keys(stored)});
 // Precision eventually makes insertion impossible, rather than rebalancing.
 let lo=1000,hi=2000,n=0;
 while(n<2000) {const mid=midpointOrder(lo,hi);if(!(mid>lo&&mid<hi))break;hi=mid;n++;}
 fake.repositories[0].issues=[draft(1,'Precision',1500)];
 const precision=await client.request(ep+'/order',{method:'PUT',body:{fingerprint:(await get()).fingerprint,previous:lo,next:hi}});
 assert.equal(precision.status,409);
 record('midpoint exhaustion',{successfulBisections:n,previous:lo,next:hi,status:precision.status,payload:precision.json});
 // Neighbour changes are not part of conflict checking.
 fake.repositories[0].issues=[draft(1,'A',1000),draft(2,'B',2000),draft(3,'C',3000)];
 const cfp=(await get('/api/repos/owner/alpha/issues/3')).fingerprint;
 const neighbour=await client.request('/api/repos/owner/alpha/issues/2/order',{method:'PUT',body:{fingerprint:(await get('/api/repos/owner/alpha/issues/2')).fingerprint,previous:3000,next:null}});
 const staleNeighbour=await client.request('/api/repos/owner/alpha/issues/3/order',{method:'PUT',body:{fingerprint:cfp,previous:1000,next:2000}});
 record('two devices stale neighbour accepted',{neighbourStatus:neighbour.status,staleNeighbourStatus:staleNeighbour.status,orders:fake.repositories[0].issues.map(i=>[i.title,parseOrderMarker(i.body)])});
 // Remove the intentionally created move target before independent browser fixtures.
 fake.repositories[1].issues=fake.repositories[1].issues.filter(i=>i.number===1);
 browser=await chromium.launch({executablePath:'/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await page.locator('#password').fill(BOARD_PASSWORD);await page.locator('#login-btn').click();await page.locator('#board-view').waitFor({state:'visible'});
 async function reset(rows,view={view:'simple',filters:['stage:draft'],sort:'manual'}) {
   fake.repositories[0].issues=rows;
   await page.evaluate(v=>{window.__taskBoard.state.viewState=v;window.__taskBoard.state.draftEdits.clear();},view);
   await page.locator('#refresh-btn').click();await page.waitForFunction(()=>!window.__taskBoard.state.boardLoads);
 }
 const titles=()=>page.locator('.draft-title').evaluateAll(nodes=>nodes.map(n=>n.value));
 async function shot(name) {const file=path.join(out,'screenshots',name+'.png');await page.screenshot({path:file,fullPage:false});screenshots.push(file);return file;}
 // Same filters and sorts across all renderers, not only direct function tests.
 fake.repositories[0].issues=[makeIssue({number:1,title:'Filtered urgent',labels:['status:todo','priority:urgent'],body:'## Human Tasks\n- [ ] Urgent human action\n',repo:'owner/alpha'}),makeIssue({number:2,title:'Filtered low',labels:['status:todo','priority:low'],body:'## Open Questions\n- [ ] Low question?\n',repo:'owner/alpha'})];
 await page.locator('#refresh-btn').click();await page.waitForFunction(()=>!window.__taskBoard.state.boardLoads);
 const combinations=[];
 for(const view of ['simple','cards','kanban','graph','pending'])for(const sort of ['priority','updated','created','manual']) {
   await page.evaluate(({view,sort})=>{window.__taskBoard.state.viewState={view,sort,filters:['human','questions','stage:todo','project:owner/alpha']};window.__taskBoard.renderBoard();},{view,sort});
   const rendered=await page.locator('#task-list .task-title').allTextContents();
   const expected=(sort==='created'||sort==='updated')?['Filtered low','Filtered urgent']:['Filtered urgent','Filtered low'];
   assert.deepEqual(rendered,expected);combinations.push({view,sort,rendered});
 }
 record('shared filter and sort rendering',{combinations:combinations.length,results:combinations});
 // Downward move all unmarked, marked before unmarked, and equal markers.
 for(const [name,rows,title] of [
  ['all unmarked',[draft(1,'A'),draft(2,'B'),draft(3,'C')],'A'],
  ['marked into unmarked',[draft(1,'A',1000),draft(2,'B'),draft(3,'C')],'A'],
  ['equal markers',[draft(1,'A',1000),draft(2,'B',1000),draft(3,'C',1000)],'A']
 ]) {
  await reset(rows);const before=await titles(),writes=fake.patchCalls.length;
  await page.getByRole('button',{name:'Move down: '+title,exact:true}).click();
  await page.waitForFunction(()=>!window.__taskBoard.state.draftBusy);
  const after=await titles();assert.deepEqual(after,before);assert.equal(fake.patchCalls.length,writes);
  record('downward reorder refusal: '+name,{before,after,writes:fake.patchCalls.length-writes,notice:await page.locator('#notice').innerText(),screenshot:await shot('reorder-'+name.replaceAll(' ','-'))});
 }
 await reset([draft(1,'A',1000),draft(2,'B',2000),draft(3,'C',3000)]);
 await page.getByRole('textbox',{name:'Title: B',exact:true}).fill('UNSAVED B');
 await page.getByRole('button',{name:'Move up: B',exact:true}).click();await page.waitForFunction(()=>!window.__taskBoard.state.draftBusy);
 assert.equal((await titles()).includes('UNSAVED B'),false);
 record('reorder erases unsaved inline title',{visibleTitles:await titles(),persistedTitle:fake.findIssue(2).title,bufferCount:await page.evaluate(()=>window.__taskBoard.state.draftEdits.size)});
 // Refresh attaches buffered edits to a new fingerprint, bypassing their observed revision.
 await reset([draft(1,'Original',1000,'Old description')]);
 await page.getByRole('textbox',{name:'Description: Original',exact:true}).fill('My unsaved description');
 fake.mutateIssue(1,i=>{i.body='Other device description\n\n<!-- board-order: 1000 -->'});
 await page.locator('#refresh-btn').click();await page.waitForFunction(()=>!window.__taskBoard.state.boardLoads);
 const buffered=await page.getByRole('textbox',{name:'Description: Original',exact:true}).inputValue();
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!window.__taskBoard.state.draftBusy);
 assert.ok(fake.findIssue(1).body.includes('My unsaved description'));
 record('refresh silently rebases old inline edits',{buffered,persisted:fake.findIssue(1).body,conflictNotice:await page.locator('#notice').innerText()});
 // Offline queue persisted through reload, then actual HTTP create succeeds but browser loses response.
 await reset([draft(1,'Existing',1000)]);
 await page.evaluate(()=>window.__taskBoard.saveToOfflineQueue('Lost response','owner/alpha','Keep description',2000));
 let posts=0;
 await page.route('**/api/repos/owner/alpha/issues',async route=>{if(route.request().method()!=='POST')return route.continue();posts++;await route.fetch();await route.abort('connectionfailed');});
 await page.evaluate(()=>window.__taskBoard.syncOfflineDrafts());
 const queuedAfterLoss=await page.evaluate(()=>window.__taskBoard.getOfflineDrafts());
 assert.equal(fake.repositories[0].issues.filter(i=>i.title==='Lost response').length,1);assert.equal(queuedAfterLoss.length,1);
 await page.unroute('**/api/repos/owner/alpha/issues');
 await page.reload();await page.locator('#board-view').waitFor({state:'visible'});await page.waitForFunction(()=>!localStorage.getItem('openchamber_offline_drafts'));
 assert.equal(fake.repositories[0].issues.filter(i=>i.title==='Lost response').length,2);
 record('response loss auto-retry duplicates',{firstActualCreates:posts,queueAfterLoss:queuedAfterLoss.map(d=>({title:d.title,description:d.description,order:d.order})),afterReloadCopies:fake.repositories[0].issues.filter(i=>i.title==='Lost response').map(i=>({number:i.number,body:i.body}))});
 // Partial reconnection: first accepted, second committed with response lost, third left queued.
 await page.evaluate(()=>{const a=window.__taskBoard;['Partial one','Partial two','Partial three'].forEach((t,i)=>a.saveToOfflineQueue(t,'owner/alpha','Description '+i,5000+i*1000));});
 let requests=0;
 await page.route('**/api/repos/owner/alpha/issues',async route=>{if(route.request().method()!=='POST')return route.continue();requests++;if(requests===2){await route.fetch();return route.abort('connectionfailed');}return route.continue();});
 await page.evaluate(()=>window.__taskBoard.syncOfflineDrafts());
 const remaining=await page.evaluate(()=>window.__taskBoard.getOfflineDrafts().map(d=>d.title));
 await page.unroute('**/api/repos/owner/alpha/issues');
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>!localStorage.getItem('openchamber_offline_drafts'));
 record('partial reconnection duplicates committed second item',{remainingAfterLoss:remaining,copies:['Partial one','Partial two','Partial three'].map(title=>({title,count:fake.repositories[0].issues.filter(i=>i.title===title).length}))});
 // Editable queued item while sync is in flight loses a same-ID update.
 await reset([draft(1,'Existing',1000)]);
 await page.evaluate(()=>window.__taskBoard.saveToOfflineQueue('In flight','owner/alpha','Old queued description',2000));
 let release,started;const waiting=new Promise(r=>started=r), gate=new Promise(r=>release=r);
 await page.route('**/api/repos/owner/alpha/issues',async route=>{if(route.request().method()!=='POST')return route.continue();started();await gate;await route.continue();});
 const syncing=page.evaluate(()=>window.__taskBoard.syncOfflineDrafts());await waiting;
 const offline=page.locator('.draft-row-offline');await offline.locator('.draft-description').fill('New during sync');await offline.getByRole('button',{name:'Save',exact:true}).click();
 const editedQueue=await page.evaluate(()=>window.__taskBoard.getOfflineDrafts()[0].description);
 release();await syncing;await page.unroute('**/api/repos/owner/alpha/issues');
 record('editing queued item during sync loses edit',{editedQueue,persisted:fake.repositories[0].issues.find(i=>i.title==='In flight').body,remaining:await page.evaluate(()=>window.__taskBoard.getOfflineDrafts().length)});
 // Duplicate offline title is silently discarded even if description differs.
 await context.setOffline(true);
 await page.locator('#quick-add-input').fill('Same title');await page.locator('#quick-add-description').fill('First description');await page.locator('#quick-add-input').press('Enter');
 await page.locator('#quick-add-input').fill('Same title');await page.locator('#quick-add-description').fill('Second description');await page.locator('#quick-add-input').press('Enter');
 record('offline repeated title silently dropped',{queue:await page.evaluate(()=>window.__taskBoard.getOfflineDrafts().map(d=>({title:d.title,description:d.description}))),input:await page.locator('#quick-add-input').inputValue()});
 await page.evaluate(()=>window.__taskBoard.saveOfflineDrafts([]));await context.setOffline(false);
 // Pending items source remains answerable through drawer, human task has no complete affordance.
 await reset([], {view:'pending',filters:[],sort:'priority'});
 const pendingShot=await shot('hostile-pending-360');
 await page.getByRole('button').filter({hasText:'Beta human'}).click();await page.locator('#detail-view').waitFor({state:'visible'});
 const humanControls=await page.locator('#human-list input, #human-list button').count();
 await page.locator('#answer-0').fill('Yes beta');await page.getByRole('button',{name:'Answer',exact:true}).click();await page.waitForFunction(()=>!window.__taskBoard.state.busy);
 record('pending answer works, human completion absent',{humanControls,questionAnswered:fake.findIssue(1,'owner/beta').body.includes('Answer: Yes beta'),screenshot:pendingShot});
 await page.locator('#back-btn').click();
 // Same-number Mark Done updates first board row, not the correct repository.
 await reset([makeIssue({number:1,title:'Alpha same number',labels:['status:todo'],body:'## Overview\nAlpha\n',repo:'owner/alpha'})],{view:'simple',filters:[],sort:'priority'});
 await page.getByRole('button').filter({hasText:'Beta human'}).click();await page.locator('#detail-view').waitFor({state:'visible'});
 await page.locator('#mark-done-btn').click();await page.waitForFunction(()=>window.__taskBoard.state.detail?.state==='closed');
 const stateRows=await page.evaluate(()=>window.__taskBoard.state.board.issues.filter(i=>i.number===1).map(i=>({repository:i.repository.full,state:i.state,status:i.statusLabel})));
 assert.equal(stateRows.find(i=>i.repository==='owner/alpha').state,'closed');assert.equal(fake.findIssue(1).state,'open');
 record('Mark Done same-number wrong board row',{client:stateRows,server:[{repository:'owner/alpha',state:fake.findIssue(1).state},{repository:'owner/beta',state:fake.findIssue(1,'owner/beta').state}]});
 await page.locator('#back-btn').click();
 // Checked=false HTML attribute means unchecked tasks are rendered checked.
 await reset([makeIssue({number:1,title:'Checklist',labels:['status:todo'],body:'## Overview\nOriginal\n\n## Acceptance Criteria\n- [ ] Must remain unchecked\n\n## Human Tasks\n- [ ] Human action\n',repo:'owner/alpha'})],{view:'simple',filters:[],sort:'priority'});
 await page.getByRole('button').filter({hasText:'Checklist'}).click();await page.locator('#detail-view').waitFor({state:'visible'});
 const checked=await page.locator('#ac-list input').first().isChecked();
 record('unchecked checklist rendered checked',{checked,rawBody:fake.findIssue(1).body});
 // Detail edits are erased by checkbox path, which never remembers draft.
 await page.locator('#overview-text').fill('Unsaved overview');
 await page.evaluate(()=>window.__taskBoard.toggleChecklistItem(window.__taskBoard.state.detail.acceptanceCriteria[0],true,true));
 record('checklist rerender loses unsaved overview',{visibleOverview:await page.locator('#overview-text').inputValue()});
 await shot('hostile-drawer-360');
 // Phone quick-add target choice is visible, but multi-line inspiration clipped.
 await page.locator('#back-btn').click();await reset([draft(1,'Long description',1000,'Line one\nLine two\nLine three')]);
 const dimensions=await page.getByRole('textbox',{name:'Description: Long description',exact:true}).evaluate(n=>({clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,value:n.value}));
 await shot('hostile-multiline-description-360');
 record('description lines clipped',{dimensions,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 record('browser health',{pageErrors:errors,screenshots:screenshots.length});
 await writeFile(path.join(out,'runtime-results.json'),JSON.stringify({results,pageErrors:errors,screenshots},null,2));
} finally {if(browser)await browser.close();if(board)await board.app.close();await fake.close();await rm(data,{recursive:true,force:true});}
