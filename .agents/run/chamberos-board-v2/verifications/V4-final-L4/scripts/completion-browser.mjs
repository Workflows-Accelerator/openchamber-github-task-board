// Completes interrupted independent probe without replacing first-run evidence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalPreview, login, selectAll, setCase, chromium, CHROME, sleep, READ } from './fixture-helpers.mjs';
const OUT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out={failures:[],pageErrors:[],console:[],csp:[],patches:[]};
const assert=(v,label,details)=>{if(!v)out.failures.push({label,details});};
const V=()=>{const s=window.__taskBoard.state;return {panX:s.canvasPanX,panY:s.canvasPanY,scale:s.canvasScale,filterView:s.filterView,stored:localStorage.getItem('tb_canvas_filter_view'),pending:s.canvasFitPending,focus:s.dependencyFocus,returnView:s.dependencyFocusReturn};};
const same=(a,b)=>a.panX===b.panX&&a.panY===b.panY&&a.scale===b.scale;
const settle=async page=>{await page.waitForFunction(()=>!window.__taskBoard.state.canvasAnimating);await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});};
const shot=async(page,name)=>page.screenshot({path:path.join(OUT,'screenshots',name+'.png')});
let browser,server;
try {
 server=await normalPreview();browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 await context.addInitScript(()=>{window.__unhandled=[];window.__csp=[];addEventListener('unhandledrejection',e=>window.__unhandled.push(String(e.reason)));addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));});
 const page=await context.newPage();page.on('pageerror',e=>out.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')out.console.push(m.text());});
 page.on('response',async r=>{if(r.request().method()==='PATCH')out.patches.push({url:r.url(),status:r.status(),body:await r.text()});});
 await login(page,server.url,5);await selectAll(page);await setCase(page,1280,900,'light','en');await settle(page);
 const card=page.locator('.canvas-card[data-issue-key="chamberos/platform#2"]');
 const pos=()=>card.evaluate(n=>({x:parseFloat(n.style.left),y:parseFloat(n.style.top)}));
 async function drag(dx,dy){const b=await card.boundingBox();out.dragHit=await page.evaluate(({x,y})=>({x,y,tag:document.elementFromPoint(x,y)?.outerHTML}),{x:b.x+100,y:b.y+28});await page.mouse.move(b.x+100,b.y+28);await page.mouse.down();for(let i=1;i<=8;i++)await page.mouse.move(b.x+100+dx*i/8,b.y+28+dy*i/8);await page.mouse.up();}
 const before=await pos();await shot(page,'successful-drag-before-1280-light-en');await drag(63,47);
 await page.waitForFunction(()=>{const c=document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]');return c&&!c.classList.contains('is-dragging');});await sleep(600);
 const moved=await pos();await shot(page,'successful-drag-after-1280-light-en');
 await page.reload();await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length&&!window.__taskBoard.state.boardLoad);await page.evaluate(()=>document.getElementById('nav-canvas').click());
 const reloaded=await pos();out.drag={before,moved,reloaded,patchCount:out.patches.length};
 assert(moved.x===before.x+63&&moved.y===before.y+47&&reloaded.x===moved.x&&reloaded.y===moved.y&&out.patches.some(p=>p.status===200),'real pointer drag persists',out.drag);
 await shot(page,'successful-drag-reloaded-1280-light-en');
 await setCase(page,1280,900,'light','en');await settle(page);
 let refused=0;await page.route('**/api/repos/chamberos/platform/issues/2/canvas',route=>{refused++;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'github_forbidden',message:'Synthetic review refusal'})});});
 const refusalBefore=await pos(),consoleStart=out.console.length;await drag(60,40);
 await page.waitForFunction(()=>{const n=document.getElementById('notice');return n&&!n.hidden&&/not saved|Could not save/i.test(n.textContent);},null,{timeout:10000});await sleep(500);
 const refusalAfter=await pos();out.refusal={before:refusalBefore,after:refusalAfter,refused,notice:await page.locator('#notice').textContent(),unhandled:await page.evaluate(()=>window.__unhandled),expectedConsole:out.console.splice(consoleStart)};
 assert(refused===1&&refusalBefore.x===refusalAfter.x&&refusalBefore.y===refusalAfter.y&&out.refusal.unhandled.length===0,'refused drag rollback without unhandled rejection',out.refusal);
 assert(out.refusal.expectedConsole.every(x=>x==='Failed to load resource: the server responded with a status of 403 (Forbidden)'),'only injected resource diagnostic',out.refusal);
 await shot(page,'refused-drag-completion-1280-light-en');await page.unroute('**/api/repos/chamberos/platform/issues/2/canvas');
 await card.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.getElementById('detail-view').hidden);
 const focused=await card.evaluate(n=>({role:n.getAttribute('role'),tabindex:n.tabIndex}));
 await page.selectOption('#status-select','status:todo');await page.waitForFunction(()=>window.__taskBoard.state.detail?.statusLabel==='status:todo');await sleep(200);
 out.status={focused,value:await page.locator('#status-select').inputValue()};await shot(page,'status-changed-1280-light-en');await page.click('#back-btn');
 await page.reload();await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length&&!window.__taskBoard.state.boardLoad);
 out.status.reloaded=await page.evaluate(()=>{const i=window.__taskBoard.state.board.issues.find(i=>i.number===2&&i.repository.full==='chamberos/platform');return{status:i.statusLabel,stage:i.effectiveStage};});
 assert(out.status.value==='status:todo'&&out.status.reloaded.status==='status:todo'&&out.status.reloaded.stage==='todo','keyboard card activation and status reload',out.status);
 await page.evaluate(()=>{const a=window.__taskBoard;const i=a.state.board.issues.find(i=>i.number===1);i.canvas.notes[0].text='### Review note\n**Bold** and [link](https://example.com)';a.renderBoard();});
 out.note=await page.evaluate(()=>({h3:document.querySelector('#canvas-notes h3')?.textContent,strong:document.querySelector('#canvas-notes strong')?.textContent,notesZ:getComputedStyle(document.getElementById('canvas-notes')).zIndex,cardsZ:getComputedStyle(document.getElementById('canvas-cards')).zIndex}));
 assert(out.note.h3==='Review note'&&out.note.strong==='Bold'&&Number(out.note.notesZ)<Number(out.note.cardsZ),'Markdown note under cards',out.note);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__taskBoard.selectDependencyCard(window.__taskBoard.state.board.issues.find(i=>i.number===2)));
 const early=await page.evaluate(V);await sleep(500);const late=await page.evaluate(V);out.reducedMotion={early,late};assert(same(early,late),'reduced motion instant focus',out.reducedMotion);await page.emulateMedia({reducedMotion:null});
 // Independent clean filter/focus interleaving with distinct return and filtered views.
 await setCase(page,1280,900,'light','en');await settle(page);
 await page.evaluate(()=>{const a=window.__taskBoard;a.state.canvasPanX=123.125;a.state.canvasPanY=-47.875;a.state.canvasScale=.873;localStorage.removeItem('tb_canvas_filter_view');a.updateCanvasTransform();});
 const original=await page.evaluate(V);
 await page.click('#applied-filter-btn');await page.click('[data-filter="priority:high"]');await page.click('#sheet-apply');await settle(page);
 const filtered=await page.evaluate(V);await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');await settle(page);
 await page.click('#filter-chips .filter-chip');await settle(page);const cleared=await page.evaluate(V);
 await page.click('#dependency-legend .legend-head button');await settle(page);const closed=await page.evaluate(V);await shot(page,'focus-filter-interleave-clean-1280-light-en');
 // A second ordinary cycle must capture NEW viewport, not the stale first one.
 await page.evaluate(()=>{const a=window.__taskBoard;a.state.canvasPanX=-201.625;a.state.canvasPanY=93.375;a.state.canvasScale=1.237;a.updateCanvasTransform();});
 const secondStart=await page.evaluate(V);await page.click('#applied-filter-btn');await page.click('[data-filter="priority:high"]');await page.click('#sheet-apply');await settle(page);await page.click('#filter-chips .filter-chip');await settle(page);const secondEnd=await page.evaluate(V);
 out.focusFilter={original,filtered,cleared,closed,secondStart,secondEnd};
 assert(same(closed,original)&&closed.filterView===null&&closed.stored===null,'clear during focus returns original and consumes saved view',out.focusFilter);
 assert(same(secondStart,secondEnd),'second cycle after interleaving uses fresh return viewport',out.focusFilter);
 // Let breakpoint transition settle before measuring actual hit targets.
 await page.evaluate(()=>localStorage.setItem('tb_sidebar_collapsed','1'));await page.reload();await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length);
 out.breakpoint=[];
 for(const width of [768,769,768,769]){
  await page.setViewportSize({width,height:900});await sleep(200);
  if(width===768){await page.click('#sidebar-toggle-btn-compact');await sleep(200);}
  const data=await page.evaluate(()=>{const s=document.getElementById('app-sidebar'),b=document.getElementById(innerWidth===768?'sidebar-toggle-btn-compact':'sidebar-toggle-btn'),r=s.getBoundingClientRect(),q=b.getBoundingClientRect(),h=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return{width:innerWidth,sidebar:{x:r.x,width:r.width,right:r.right},toggle:{x:q.x,y:q.y,width:q.width,height:q.height,hit:h===b||b.contains(h),label:b.getAttribute('aria-label')},open:document.body.classList.contains('sidebar-open')};});
  out.breakpoint.push(data);assert(width===768?data.sidebar.x===0&&data.sidebar.width===280&&data.toggle.hit:data.sidebar.width===56&&data.toggle.hit&&data.toggle.label==='Expand sidebar','settled 768/769 breakpoint',data);
  if(width===768){await page.mouse.click(740,500);await sleep(200);}
 }
 out.csp=await page.evaluate(()=>window.__csp);
 assert(!out.pageErrors.length&&!out.console.length&&!out.csp.length,'zero unexpected browser diagnostics',out);
 await context.close();
}catch(error){out.fatal=String(error.stack||error);out.failures.push({label:'completion interrupted',details:out.fatal});}
finally{if(browser)await browser.close();if(server)await server.close();fs.writeFileSync(path.join(OUT,'completion-browser.json'),JSON.stringify(out,null,2)+'\n');}
console.log(JSON.stringify({failures:out.failures,fatal:out.fatal},null,2));process.exitCode=out.failures.length?1:0;
