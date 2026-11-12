// Independent adversarial checks, application cd64af1. All writes are synthetic localhost writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalPreview, spreadPreview, READ, login, selectAll, setCase, chromium, CHROME, sleep } from './fixture-helpers.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.PROOF_PHASE || 'after');
const SHOTS = path.join(OUT, 'screenshots');
const out = { framing: [], storage: [], cycles: [], breakpoint: [], sheets: [], regressions: {}, errors: [], console: [], csp: [], failures: [] };
const write = () => fs.writeFileSync(path.join(OUT, 'independent-browser.json'), JSON.stringify(out, null, 2) + '\n');
const assert = (value, label, details) => { if (!value) out.failures.push({ label, details }); };
const shot = async (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const settle = async page => {
  await page.waitForFunction(() => !window.__taskBoard?.state.canvasAnimating, null, { timeout: 5000 });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))); });
};
const V = () => { const s = window.__taskBoard.state; return { panX: s.canvasPanX, panY: s.canvasPanY, scale: s.canvasScale, filterView: s.filterView, stored: localStorage.getItem('tb_canvas_filter_view'), filters: s.viewState.filters, pending: s.canvasFitPending, focus: s.dependencyFocus }; };
const exact = (a,b) => a.panX === b.panX && a.panY === b.panY && a.scale === b.scale;
async function startView(page, view = { panX: 123.125, panY: -47.875, scale: .873 }) {
  await settle(page);
  await page.evaluate(view => { const a = window.__taskBoard; a.state.canvasPanX = view.panX; a.state.canvasPanY = view.panY; a.state.canvasScale = view.scale; a.updateCanvasTransform(); }, view);
}
async function filter(page, token) {
  await page.click('#applied-filter-btn');
  await page.click('[data-filter="' + token + '"]');
  await page.click('#sheet-apply');
  await settle(page);
}
async function exposeCard(page, number = 2) {
  await settle(page);
  await page.evaluate(n => { const a = window.__taskBoard; const c = document.querySelector(`.canvas-card[data-issue-key="chamberos/platform#${n}"]`); a.state.canvasScale = 1; a.state.canvasPanX = 24 - c.offsetLeft; a.state.canvasPanY = 50 - c.offsetTop; a.updateCanvasTransform(); }, number);
}
const HIT = selector => { const n = document.querySelector(selector); if (!n) return null; const r = n.getBoundingClientRect(); const h = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2); return { text:n.textContent, width:r.width,height:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom, hit:!!h && (n===h||n.contains(h)), visible:!n.hidden&&r.width>0&&r.height>0, aria:n.getAttribute('aria-label') }; };
async function freshPage(browser, url, width=1280, lang='en', theme='light') {
  const context = await browser.newContext({ viewport:{width,height:width<=390?800:900},serviceWorkers:'block' });
  await context.addInitScript(() => {
    window.__reviewUnhandled=[]; window.__reviewCsp=[];
    addEventListener('unhandledrejection',e=>window.__reviewUnhandled.push(String(e.reason)));
    addEventListener('securitypolicyviolation',e=>window.__reviewCsp.push(e.violatedDirective));
  });
  const page = await context.newPage();
  page.on('pageerror',e=>out.errors.push(e.message));
  page.on('console',m=>{ if(m.type()==='error')out.console.push(m.text()); });
  await login(page,url,5);
  await selectAll(page);
  await setCase(page,width,width<=390?800:900,theme,lang);
  return { context,page };
}
async function framing(browser, preview, name) {
  const { context,page }=await freshPage(browser,preview.url);
  for(const width of [360,390,768,1280])for(const [lang,theme]of [['fr','light'],['fr','dark'],['en','light'],['en','dark']]) {
    await setCase(page,width,width<=390?800:900,theme,lang);
    await exposeCard(page);
    await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
    await settle(page);
    const auto=await page.evaluate(READ);
    const action=await page.evaluate(HIT,'#dependency-legend .legend-show-all');
    const selected=auto.cards.find(c=>c.role==='selected');
    assert(auto.scale>=.55&&selected?.inside&&selected.effectiveTitlePx>=8.8,`${name} automatic readable selected card`,{width,lang,theme,auto});
    assert(auto.labels.filter(l=>!l.hidden).every(l=>!l.anyEndpointFullyOutside),`${name} automatic labels honest`,{width,lang,theme,labels:auto.labels});
    const tag=`${name}-${width}-${theme}-${lang}`;
    await shot(page,`focus-${tag}`);
    let after=null;
    if(auto.dependencyFocusFloored) {
      assert(action?.visible&&action.hit&&action.height>=44&&action.x>=0&&action.right<=width&&action.y>=0&&action.bottom<=(width<=390?800:900),`${name} action visible`,{width,lang,theme,action});
      await page.click('#dependency-legend .legend-show-all');
      await settle(page);
      after=await page.evaluate(READ);
      await shot(page,`show-all-${tag}`);
      const neighbours=after.cards.filter(c=>c.role&&c.role!=='unrelated');
      const missing=neighbours.filter(c=>!c.inside);
      // Legacy all-contained expectation retained numerically; D39 permits a truthful minimum-zoom limit, not a fake geometric PASS.
      after.legacyAllContained = !missing.length;
      assert(!missing.length || (after.scale === .2 && /limit|limite/i.test(after.legend.text) && !after.legend.hasShowAll && !after.showAll.visible), `${name} D39 full fit or honest non-repeating zoom limit`, {width,lang,theme,missing:missing.map(c=>c.key),legend:after.legend});
      assert(!missing.length||after.legend.hasOffscreenNote,`${name} missing cards remain announced after full fit`,{width,lang,theme,scale:after.scale,missing:missing.map(c=>c.key),legend:after.legend});
      assert(after.labels.filter(l=>!l.hidden).every(l=>!l.anyEndpointFullyOutside),`${name} labels honest after full fit`,{width,lang,theme,labels:after.labels});
    }
    out.framing.push({fixture:name,width,lang,theme,auto,action,after});
    write();
  }
  out.csp.push(...await page.evaluate(()=>window.__reviewCsp));
  await context.close();
}
async function sheetChecks(page) {
  for(const [width,theme,lang]of [[360,'light','fr'],[360,'dark','fr'],[1280,'light','en']]) {
    await setCase(page,width,width===360?800:900,theme,lang);
    for(const kind of ['filter','settings','sort']) {
      if(kind==='filter') await page.click('#applied-filter-btn');
      else if(kind==='settings') {
        if(width<=768)await page.click('#sidebar-toggle-btn-compact');
        await page.click('#settings-btn');
      } else await page.evaluate(()=>window.__taskBoard.openSheet('sort',document.getElementById('applied-filter-btn')));
      await settle(page);
      const before=await page.evaluate(()=>({x:scrollX,y:scrollY,locked:document.body.classList.contains('sheet-open')}));
      const controls=page.locator('#board-sheet button, #board-sheet input, #board-sheet select, #board-sheet textarea');
      const first=controls.first(), last=controls.last();
      await last.focus(); await page.keyboard.press('Tab');
      const forward=await first.evaluate(n=>document.activeElement===n);
      await page.keyboard.press('Shift+Tab');
      const backward=await last.evaluate(n=>document.activeElement===n);
      const sizes=await controls.evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();const s=getComputedStyle(n);return{text:n.textContent,id:n.id,width:r.width,height:r.height,border:s.borderTopWidth,radius:s.borderTopLeftRadius,font:s.fontFamily,pressed:n.getAttribute('aria-pressed')};}));
      await page.locator('#sheet-content').evaluate(n=>n.scrollTop=n.scrollHeight);
      await page.mouse.wheel(0,1000);
      await sleep(50);
      const scroll=await page.evaluate(()=>({x:scrollX,y:scrollY,locked:document.body.classList.contains('sheet-open')}));
      if(kind==='settings')await page.locator('.rename-project .button').first().scrollIntoViewIfNeeded();
      else await page.locator('#sheet-content').evaluate(n=>n.scrollTop=0);
      await shot(page,`${kind}-${width}-${theme}-${lang}`);
      await page.keyboard.press('Escape');
      await sleep(50);
      const closed=await page.evaluate(()=>({open:document.getElementById('board-sheet').open,lock:document.body.classList.contains('sheet-open'),focus:document.activeElement.id}));
      const entry={width,theme,lang,kind,before,forward,backward,sizes,scroll,closed};
      out.sheets.push(entry);
      assert(forward&&backward&&before.locked&&scroll.locked&&scroll.y===before.y&&!closed.open&&!closed.lock,`sheet keyboard/lock ${kind}`,entry);
      if(kind==='sort')assert(sizes.filter(s=>s.pressed!==null).every(s=>s.height>=44&&s.border==='1px'&&s.radius==='8px'), 'D4 Sort styling',entry);
      if(kind==='settings')assert(sizes.filter(s=>s.text=== (lang==='fr'?'Enregistrer le nom':'Save name')).every(s=>s.height>=44),'D6 rename height',entry);
      // Closing the sheet leaves its original sidebar opener open; dismiss that
      // drawer explicitly before exercising unrelated board controls.
      if(width<=768 && await page.evaluate(()=>document.body.classList.contains('sidebar-open'))) await page.mouse.click(width-20,400);
      // Real backdrop pointer and real close-button paths.
      await page.click('#applied-filter-btn'); await settle(page); await page.mouse.click(2,2);
      assert(await page.evaluate(()=>!document.getElementById('board-sheet').open),'backdrop closes sheet');
      await page.click('#applied-filter-btn'); await settle(page); await page.click('#sheet-close');
      assert(await page.evaluate(()=>!document.getElementById('board-sheet').open),'button closes sheet');
    }
  }
}
async function cyclesAndStorage(page) {
  await setCase(page,1280,900,'light','en');
  for(const [cycle,view]of [[1,{panX:123.125,panY:-47.875,scale:.873}],[2,{panX:-201.625,panY:93.375,scale:1.237}]]) {
    await startView(page,view); await filter(page,'priority:high');
    const applied=await page.evaluate(V);
    await page.click('#filter-chips .filter-chip'); await settle(page);
    const cleared=await page.evaluate(V);
    out.cycles.push({cycle,view,applied,cleared});
    assert(exact(cleared,view)&&!cleared.filterView&&cleared.stored===null,'second filter cycle consumes its own return view',{cycle,view,applied,cleared});
  }
  // Definite invalid JSON, non-finite values and out-of-range scale must not poison rendering.
  for(const raw of ['{','{"panX":1e999,"panY":0,"scale":1}','{"panX":0,"panY":0,"scale":9}','{"panX":0,"panY":0,"scale":0.1}','{"panX":0,"panY":0,"scale":"0.8"}','{"panX":0,"panY":0,"scale":0.2}','{"panX":0,"panY":0,"scale":2.5}']) {
    await page.evaluate(raw=>{localStorage.setItem('tb_canvas_filter_view',raw);localStorage.setItem('openchamber_web_view_state',JSON.stringify({view:'simple',filters:['priority:high'],sort:'priority'}));},raw);
    await page.reload();
    await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length&&!window.__taskBoard.state.boardLoad);
    const read=await page.evaluate(V);
    const expected=raw.includes('"scale":0.2')||raw.includes('"scale":2.5');
    out.storage.push({raw,read});
    assert(expected ? read.filterView?.scale===JSON.parse(raw).scale : read.filterView===null&&read.stored===null,'stored return viewport finite/range validation',{raw,read});
  }
  await setCase(page,1280,900,'light','en');
  // Interleaving dependency focus and filters was absent from earlier proofs.
  await startView(page);
  const original=await page.evaluate(V);
  await exposeCard(page); const preFilter=await page.evaluate(V);
  await filter(page,'priority:high');
  await exposeCard(page);
  await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus'); await settle(page);
  await page.click('#filter-chips .filter-chip'); await settle(page);
  const clearedWhileFocused=await page.evaluate(V);
  await page.click('#dependency-legend .legend-head button'); await settle(page);
  const afterFocusClose=await page.evaluate(V);
  await shot(page,'filter-cleared-during-focus-1280-light-en');
  out.focusFilter={original,preFilter,clearedWhileFocused,afterFocusClose};
  assert(exact(afterFocusClose,preFilter)&&afterFocusClose.filterView===null&&afterFocusClose.stored===null,'clearing filters during focus eventually restores return viewport',out.focusFilter);
  // End the poisoned cycle for subsequent unrelated checks using a fresh reset only.
}
async function breakpoint(page) {
  await page.evaluate(()=>localStorage.setItem('tb_sidebar_collapsed','1')); await page.reload();
  await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length);
  for(const width of [768,769,768,769]) {
    await page.setViewportSize({width,height:900}); await sleep(300);
    if(width===768)await page.click('#sidebar-toggle-btn-compact');
    const data=await page.evaluate(()=>{const s=document.getElementById('app-sidebar').getBoundingClientRect();const b=document.getElementById('sidebar-toggle-btn');return{width:innerWidth,sidebar:{x:s.x,width:s.width},aria:b.getAttribute('aria-label'),compact:getComputedStyle(document.getElementById('sidebar-toggle-btn-compact')).display,expanded:b.getAttribute('aria-expanded')};});
    out.breakpoint.push(data);
    assert(width===768?data.sidebar.width===280:data.sidebar.width===56&&data.aria==='Expand sidebar','768/769 collapsed breakpoint',data);
    if(width===768)await page.mouse.click(740,500);
  }
}
async function regression(browser, preview) {
  const {context,page}=await freshPage(browser,preview.url);
  await setCase(page,1280,900,'light','en'); await exposeCard(page);
  const card=page.locator('.canvas-card[data-issue-key="chamberos/platform#2"]');
  const position=()=>card.evaluate(n=>({x:parseFloat(n.style.left),y:parseFloat(n.style.top)}));
  async function drag(dx,dy) {const b=await card.boundingBox();await page.mouse.move(b.x+100,b.y+24);await page.mouse.down();await page.mouse.move(b.x+100+dx,b.y+24+dy,{steps:10});await page.mouse.up();}
  const before=await position(); const saved=page.waitForResponse(r=>r.url().endsWith('/issues/2/canvas')&&r.request().method()==='PUT');
  await drag(63,47); const response=await saved; const payload=await response.json(); await sleep(400);
  const moved=await position();await page.reload();await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length);
  await page.evaluate(()=>document.getElementById('nav-canvas').click()); const reloaded=await position();
  out.regressions.drag={before,moved,reloaded,status:response.status(),payload};
  assert(response.ok()&&moved.x===before.x+63&&moved.y===before.y+47&&exact({...moved,panX:moved.x,panY:moved.y,scale:1},{panX:reloaded.x,panY:reloaded.y,scale:1}),'real pointer drag persists across reload',out.regressions.drag);
  await exposeCard(page);
  let refusals=0;
  await page.route('**/api/repos/chamberos/platform/issues/2/canvas',route=>{refusals++;return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'github_forbidden',message:'Review fixture refusal'})});});
  const beforeRefusal=await position();const consoleStart=out.console.length;
  await drag(60,40);await page.waitForFunction(()=>{let n=document.getElementById('notice');return !n.hidden&&n.classList.contains('error');}); await sleep(400);
  const afterRefusal=await position();
  const notice=await page.locator('#notice').textContent();const unhandled=await page.evaluate(()=>window.__reviewUnhandled);
  out.regressions.refusal={beforeRefusal,afterRefusal,refusals,notice,unhandled,expectedResourceDiagnostics:out.console.splice(consoleStart)};
  assert(refusals===1&&beforeRefusal.x===afterRefusal.x&&beforeRefusal.y===afterRefusal.y&&/not saved/i.test(notice)&&unhandled.length===0,'D7 refused drag rollback without unhandled rejection',out.regressions.refusal);
  assert(out.regressions.refusal.expectedResourceDiagnostics.every(s=>s==='Failed to load resource: the server responded with a status of 403 (Forbidden)'),'only exact injected 403 diagnostic allowed',out.regressions.refusal);
  await shot(page,'drag-refused-1280-light-en');await page.unroute('**/api/repos/chamberos/platform/issues/2/canvas');
  // Keyboard activation reaches drawer, status control writes real synthetic server.
  await card.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.getElementById('detail-view').hidden);
  const selects=await page.locator('#detail-view select').evaluateAll(ns=>ns.map(n=>({id:n.id,options:Array.from(n.options).map(o=>({value:o.value,text:o.text}))})));
  out.regressions.drawerSelects=selects;
  const status=selects.find(s=>s.options.some(o=>o.value==='status:todo'));
  if(status) {
    const result=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/issues/2/status'));
    await page.selectOption('#'+status.id,'status:todo');await page.click('#apply-status');const r=await result;await sleep(400);
    out.regressions.status={status:r.status(),value:await page.locator('#'+status.id).inputValue(),body:await r.json()};
    assert(r.ok()&&out.regressions.status.value==='status:todo','status change via drawer',out.regressions.status);
  } else assert(false,'status change control missing',selects);
  await page.click('#back-btn');
  await page.reload();await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length);
  out.regressions.statusAfterReload=await page.evaluate(()=>window.__taskBoard.state.board.issues.find(i=>i.number===2&&i.repository.full==='chamberos/platform').effectiveStage);
  assert(out.regressions.statusAfterReload==='todo','status persists after reload',out.regressions.statusAfterReload);
  // Force Markdown note rendering in existing note fixture, never change production source.
  await page.evaluate(()=>{const a=window.__taskBoard;const i=a.state.board.issues.find(i=>i.number===1);i.canvas.notes[0].text='### Review note\n**Bold** and [link](https://example.com)';a.renderBoard();});
  const note=await page.evaluate(()=>({h3:document.querySelector('#canvas-notes h3')?.textContent,strong:document.querySelector('#canvas-notes strong')?.textContent,notesZ:getComputedStyle(document.getElementById('canvas-notes')).zIndex,cardsZ:getComputedStyle(document.getElementById('canvas-cards')).zIndex}));
  out.regressions.note=note;
  assert(note.h3==='Review note'&&note.strong==='Bold'&&Number(note.notesZ)<Number(note.cardsZ),'Markdown notes under task cards',note);
  await page.emulateMedia({reducedMotion:'reduce'});await exposeCard(page);await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
  const early=await page.evaluate(V);await sleep(500);const late=await page.evaluate(V);
  out.regressions.reducedMotion={early,late};assert(exact(early,late),'reduced motion has no delayed viewport motion',out.regressions.reducedMotion);
  out.csp.push(...await page.evaluate(()=>window.__reviewCsp));await context.close();
}
let browser;const servers=[];
try {
  browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox']});
  out.browserVersion=await browser.version();
  const normal=await normalPreview(),spread=await spreadPreview();servers.push(normal,spread);
  await framing(browser,normal,'normal');await framing(browser,spread,'spread');
  const {context,page}=await freshPage(browser,normal.url);
  await sheetChecks(page);await cyclesAndStorage(page);await breakpoint(page);
  out.csp.push(...await page.evaluate(()=>window.__reviewCsp));await context.close();
  const isolated=await normalPreview();servers.push(isolated);await regression(browser,isolated);
  assert(!out.errors.length&&!out.csp.length&&!out.console.length,'zero unexpected browser diagnostics',{errors:out.errors,csp:out.csp,console:out.console});
} catch(error) { out.fatal=String(error.stack||error);out.failures.push({label:'verification interrupted',details:out.fatal}); }
finally { if(browser)await browser.close();for(const s of servers)await s.close();write(); }
console.log(JSON.stringify({browser:out.browserVersion,framingCases:out.framing.length,storageCases:out.storage.length,failures:out.failures.map(f=>({label:f.label,details:f.details})),fatal:out.fatal},null,2));
process.exitCode=out.failures.length?1:0;
