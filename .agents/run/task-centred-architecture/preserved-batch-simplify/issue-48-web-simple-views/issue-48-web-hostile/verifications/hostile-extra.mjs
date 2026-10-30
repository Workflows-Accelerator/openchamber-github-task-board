import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startFakeGitHub, makeIssue } from '../../../../web/tests/fake-github.mjs';
import { startBoard, BOARD_PASSWORD } from '../../../../web/tests/helpers.mjs';
import { chromium } from '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const out=path.dirname(fileURLToPath(import.meta.url)),data=await mkdtemp(path.join(out,'data/extra-'));
const results=[],errors=[];const record=(name,value)=>{results.push({name,...value});console.log(JSON.stringify({name,...value}));};
const issue=(title,repo='owner/alpha')=>makeIssue({number:1,title,labels:['status:todo'],body:'## Overview\nOriginal\n\n## Acceptance Criteria\n- [x] Toggle this\n\n## Open Questions\n- [ ] Pick [a] First or [b] Second?\n',repo});
const fake=await startFakeGitHub({honorIfMatch:true,repositories:[{repo:'owner/alpha',issues:[issue('Alpha')]},{repo:'owner/beta',issues:[issue('Beta','owner/beta')]}]});
let board,browser;
try {
 board=await startBoard(fake,{sessionFilePath:path.join(data,'sessions.json')});
 browser=await chromium.launch({executablePath:'/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
 let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await page.locator('#password').fill(BOARD_PASSWORD);await page.locator('#login-btn').click();await page.locator('#board-view').waitFor({state:'visible'});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 // Cold offline launch has cached assets but requires online /api/session to expose local queue.
 await page.evaluate(()=>{window.__taskBoard.state.viewState={view:'simple',filters:['stage:draft'],sort:'manual'};window.__taskBoard.saveToOfflineQueue('Cold offline idea','owner/alpha','Saved before reload',1000);});
 await context.setOffline(true);await page.reload();await page.locator('#login-view').waitFor({state:'visible'});
 record('offline reload hides persisted queue',{serviceWorkerControlled:await page.evaluate(()=>!!navigator.serviceWorker.controller),loginError:await page.locator('#login-error').innerText(),offlineRows:await page.locator('.draft-row-offline').count(),persisted:await page.evaluate(()=>JSON.parse(localStorage.openchamber_offline_drafts).map(d=>({title:d.title,description:d.description,order:d.order}))),screenshot:path.join(out,'screenshots/cold-offline-reload.png')});
 await page.screenshot({path:path.join(out,'screenshots/cold-offline-reload.png')});
 await context.close();
 const routedContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 page=await routedContext.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(board.url);await page.locator('#password').fill(BOARD_PASSWORD);await page.locator('#login-btn').click();await page.locator('#board-view').waitFor({state:'visible'});
 // Delayed Mark Done completion replaces a different open drawer without a generation guard.
 await page.evaluate(()=>{window.__taskBoard.state.viewState={view:'simple',filters:[],sort:'priority'};window.__taskBoard.renderBoard();});
 await page.getByRole('button').filter({hasText:'Alpha'}).click();await page.locator('#detail-view').waitFor({state:'visible'});
 let release,started;const gate=new Promise(r=>release=r),waiting=new Promise(r=>started=r);
 await page.route('**/api/repos/owner/alpha/issues/1',async route=>{if(route.request().method()!=='PATCH')return route.continue();const response=await route.fetch();started();await gate;await route.fulfill({response});});
 await page.locator('#mark-done-btn').click();await waiting;await page.locator('#back-btn').click();
 await page.getByRole('button').filter({hasText:'Beta'}).click();await page.waitForFunction(()=>window.__taskBoard.state.detail?.repository.full==='owner/beta');
 release();await page.waitForFunction(()=>window.__taskBoard.state.detail?.repository.full==='owner/alpha');
 record('late Mark Done completion replaces Beta drawer',{visibleTitle:await page.locator('#detail-title').innerText(),detailRepository:await page.evaluate(()=>window.__taskBoard.state.detail.repository.full),urlHash:await page.evaluate(()=>location.hash)});
 await page.unroute('**/api/repos/owner/alpha/issues/1');await page.locator('#back-btn').click();
 // Real drawer checkbox, then unsaved overview loss on a genuine changed checkbox.
 await page.getByRole('button').filter({hasText:'Beta'}).click();await page.waitForFunction(()=>window.__taskBoard.state.detail?.repository.full==='owner/beta');
 await page.locator('#overview-text').fill('Unsaved from real checkbox');await page.locator('#ac-list input').first().uncheck();
 await page.waitForFunction(()=>window.__taskBoard.state.detail.acceptanceCriteria[0].completed===false);
 record('real checkbox erases typed overview',{overview:await page.locator('#overview-text').inputValue(),checkboxChecked:await page.locator('#ac-list input').first().isChecked(),serverBody:fake.findIssue(1,'owner/beta').body});
 const smallTargets=await page.locator('#detail-view button:visible').evaluateAll(nodes=>nodes.map(n=>({label:n.textContent,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})).filter(n=>n.height<44||n.width<44));
 record('drawer touch targets',{smallTargets});
 // Focus must return to source task when drawer closes.
 await page.locator('#back-btn').click();const focus=await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,hidden:!!document.activeElement.closest('[hidden]')}));
 record('drawer close focus',{focus});
 // Empty/error/partial refresh states.
 await page.evaluate(()=>{window.__taskBoard.state.viewState={view:'simple',filters:['stage:draft'],sort:'manual'};window.__taskBoard.renderBoard();});
 fake.setRepoFailing('owner/beta',true);await page.locator('#refresh-btn').click();await page.waitForFunction(()=>!window.__taskBoard.state.boardLoads);
 await page.evaluate(()=>{window.__taskBoard.state.viewState.filters=[];window.__taskBoard.renderBoard();});
 const partialTitles=await page.locator('#task-list .task-title').allTextContents();
 assert.deepEqual(partialTitles,['Alpha']);assert.equal(await page.locator('#empty-state').isVisible(),false);
 record('partial refresh keeps successful repository rows',{titles:partialTitles,emptyVisible:await page.locator('#empty-state').isVisible()});
 await page.evaluate(()=>{window.__taskBoard.state.viewState.filters=['stage:draft'];window.__taskBoard.renderBoard();});
 record('partial refresh state',{partial:await page.evaluate(()=>window.__taskBoard.state.board.partial),scopeText:await page.locator('#scope-status').innerText(),emptyText:await page.locator('#empty-state').innerText(),addVisible:await page.locator('#quick-add-form').isVisible()});
 fake.setRepoFailing('owner/alpha',true);await page.locator('#refresh-btn').click();await page.waitForFunction(()=>!window.__taskBoard.state.boardLoads);
 record('all repo requests fail',{partial:await page.evaluate(()=>window.__taskBoard.state.board.partial),emptyText:await page.locator('#empty-state').innerText()});
 record('browser health',{pageErrors:errors});await writeFile(path.join(out,'extra-results.json'),JSON.stringify({results,pageErrors:errors},null,2));
} finally {if(browser)await browser.close();if(board)await board.app.close();await fake.close();await rm(data,{recursive:true,force:true});}
