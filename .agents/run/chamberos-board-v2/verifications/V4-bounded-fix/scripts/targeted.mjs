// Fresh D39 geometry and return-view adversaries. Local synthetic fixtures only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalPreview, spreadPreview, login, selectAll, setCase, READ, chromium, CHROME } from './fixture-helpers.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = { r1: [], r2: [], failures: [], errors: [], console: [], csp: [] };
const check = (value, label, details) => { if (!value) out.failures.push({ label, details }); };
const settle = async page => { await page.waitForFunction(() => !window.__taskBoard.state.canvasAnimating); await page.evaluate(async () => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))); };
const V = () => { const s = window.__taskBoard.state; return { panX: s.canvasPanX, panY: s.canvasPanY, scale: s.canvasScale, pending: s.canvasFitPending, filterView: s.filterView, stored: localStorage.getItem('tb_canvas_filter_view'), focus: s.dependencyFocus, returnView: s.dependencyFocusReturn, filters: s.viewState.filters, search: s.searchQuery }; };
const same = (a,b) => a.panX === b.panX && a.panY === b.panY && a.scale === b.scale;
const A = { panX:123.125, panY:-47.875, scale:.873 }, B = { panX:-201.625, panY:93.375, scale:1.237 };
const put = (page, view) => page.evaluate(v => { const a=window.__taskBoard; a.state.canvasPanX=v.panX; a.state.canvasPanY=v.panY; a.state.canvasScale=v.scale; a.updateCanvasTransform(); }, view);
async function filter(page, tokens) { await page.click('#applied-filter-btn'); for(const t of tokens) await page.click(`[data-filter="${t}"]`); await page.click('#sheet-apply'); await settle(page); }
async function focus(page) {
  // Explicitly pan the selected card into reach, then click its real action.
  await page.evaluate(() => { const a=window.__taskBoard, c=document.querySelector('.canvas-card[data-issue-key="chamberos/platform#2"]'); a.state.canvasScale=1; a.state.canvasPanX=20-c.offsetLeft; a.state.canvasPanY=30-c.offsetTop; a.updateCanvasTransform(); });
  const before = await page.evaluate(V);
  await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus'); await settle(page); return before;
}
async function close(page) { await page.click('#dependency-legend .legend-head button'); await settle(page); }
async function fresh(browser, url, width, lang='en', theme='light') {
  const context=await browser.newContext({ viewport:{width,height:width===360?800:900}, serviceWorkers:'block' });
  await context.addInitScript(() => { window.__csp=[];window.__unhandled=[];addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));addEventListener('unhandledrejection',e=>window.__unhandled.push(String(e.reason))); });
  const page=await context.newPage();page.on('pageerror',e=>out.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')out.console.push(m.text());});
  await login(page,url,5);await selectAll(page);await setCase(page,width,width===360?800:900,theme,lang);return {context,page};
}
const GEO = () => {
  const a=window.__taskBoard, vp=document.getElementById('canvas-viewport').getBoundingClientRect();
  const rect=n=>{const r=n.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height,hit:!!h&&(h===n||n.contains(h)),text:n.textContent};};
  const legend=document.getElementById('dependency-legend'), hud=document.getElementById('canvas-controls'), warning=document.querySelector('#dependency-legend .legend-offscreen')||document.getElementById('canvas-fit-limit');
  const lg=legend.hidden?null:rect(legend), hd=rect(hud), warn=warning&&!warning.hidden?rect(warning):null;
  const selected=document.querySelector('.dependency-selected');const sel=selected?rect(selected):null;
  const overlap=(a,b)=>a&&b&&a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
  const cards=Array.from(document.querySelectorAll('.canvas-card')).filter(c=>!a.state.dependencyFocus||!c.classList.contains('dependency-unrelated')).map(c=>{const r=rect(c);return {key:c.dataset.issueKey,rect:r,underLegend:!!overlap(r,lg),underHud:!!overlap(r,hd),inside:r.x>=vp.x-.5&&r.right<=vp.right+.5&&r.y>=vp.y-.5&&r.bottom<=vp.bottom+.5};});
  return {legend:lg,hud:hd,warning:warn,selected:sel,selectedCovered:!!(overlap(sel,lg)||overlap(sel,hd)),cards,limit:a.state.dependencyFocusLimited,filterLimit:a.state.canvasFitLimited,scale:a.state.canvasScale};
};
let browser;const servers=[];
try {
  browser=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox']});out.browser=await browser.version();
  const normal=await normalPreview(),spread=await spreadPreview();servers.push(normal,spread);
  for(const [name,server] of [['normal',normal],['spread',spread]]) for(const width of [360,390,768,1280]) for(const lang of ['en','fr']) for(const theme of ['light','dark']) {
    const {context,page}=await fresh(browser,server.url,width,lang,theme);
    await focus(page);const automatic=await page.evaluate(READ);const autoGeometry=await page.evaluate(GEO);
    check(automatic.scale>=.55&&!autoGeometry.selectedCovered, 'automatic readable focus clears legend/HUD',{name,width,lang,theme,automatic,autoGeometry});
    let explicit=null;
    if(automatic.legend.hasShowAll) { await page.click('#dependency-legend .legend-show-all');await settle(page);explicit={read:await page.evaluate(READ),geometry:await page.evaluate(GEO)};
      const g=explicit.geometry,missing=g.cards.filter(c=>!c.inside||c.underLegend||c.underHud);
      check(missing.length?g.scale===.2&&g.limit&&g.warning?.hit&&!g.selectedCovered&&!explicit.read.legend.hasShowAll:!g.limit,'D39 geometry: contained or visible truthful limit without overlap',{name,width,lang,theme,explicit});
      if(missing.length){const v=await page.evaluate(V);await page.evaluate(()=>window.__taskBoard.showAllCanvas());await settle(page);check(same(v,await page.evaluate(V)),'no repeated no-op full-fit',{name,width,lang,theme});}
    }
    await close(page);await filter(page,['priority:high']);const filtered=await page.evaluate(READ);let filteredExplicit=null;
    if(filtered.showAll.visible){await page.click('#canvas-show-all');await settle(page);filteredExplicit={read:await page.evaluate(READ),geometry:await page.evaluate(GEO)};const g=filteredExplicit.geometry;const missing=g.cards.filter(c=>!c.inside||c.underHud);
      check(missing.length?g.scale===.2&&g.filterLimit&&g.warning?.hit&&!filteredExplicit.read.showAll.visible:!g.filterLimit,'filtered full-fit truthfulness',{name,width,lang,theme,filteredExplicit});
    }
    out.r1.push({name,width,lang,theme,automatic,autoGeometry,explicit,filtered,filteredExplicit});
    out.csp.push(...await page.evaluate(()=>window.__csp));check(!(await page.evaluate(()=>window.__unhandled.length)),'no unhandled R1');await context.close();
  }
  for(const width of [360,1280]) for(const scenario of ['clear-focus-second-cycle','change-remaining','list-reload','search','dependency-only','filter-during-focus']) {
    const {context,page}=await fresh(browser,normal.url,width);await put(page,A);const entry={width,scenario,start:await page.evaluate(V)};
    if(scenario==='dependency-only') {const before=await focus(page);await close(page);entry.end=await page.evaluate(V);check(same(before,entry.end)&&!entry.end.pending&&!entry.end.filterView,'dependency-only return unchanged',entry);}
    else if(scenario==='filter-during-focus') {const before=await focus(page);await filter(page,['priority:high']);entry.during=await page.evaluate(V);check(same(entry.during.filterView,before)&&entry.during.pending,'filter under focus remembers pre-focus',entry);await close(page);await page.click('#filter-chips .filter-chip');await settle(page);entry.end=await page.evaluate(V);check(same(entry.end,before)&&!entry.end.filterView&&entry.end.stored===null&&!entry.end.pending,'filter begun during focus consumes return',entry);}
    else {
      await filter(page,['priority:high']);entry.filtered=await page.evaluate(V);await focus(page);
      if(scenario==='change-remaining') {await filter(page,['stage:in-progress']);await page.locator('#filter-chips .filter-chip').filter({hasText:'High'}).click();await settle(page);entry.during=await page.evaluate(V);check(entry.during.pending&&entry.during.filters.length===1,'pending retained while filter changes under focus',entry);await close(page);entry.afterClose=await page.evaluate(V);check(!entry.afterClose.pending&&entry.afterClose.filterView!==null,'remaining filter framed at focus exit',entry);await page.click('#filter-chips .filter-chip');}
      else if(scenario==='list-reload') {await page.evaluate(()=>window.__taskBoard.switchView('list'));await page.click('#filter-chips .filter-chip');entry.during=await page.evaluate(V);await page.reload();await page.waitForFunction(()=>window.__taskBoard?.state.board?.issues.length&&!window.__taskBoard.state.boardLoad);await page.evaluate(()=>window.__taskBoard.switchView('canvas'));}
      else if(scenario==='search') {await page.evaluate(()=>window.__taskBoard.setSearchQuery('Wire'));await page.click('#filter-chips .filter-chip');await close(page);entry.searching=await page.evaluate(V);check(entry.searching.filterView!==null,'search keeps original return until search cleared',entry);await page.evaluate(()=>window.__taskBoard.setSearchQuery(''));}
      else {await page.click('#filter-chips .filter-chip');await settle(page);entry.during=await page.evaluate(V);check(entry.during.pending,'clear cannot consume pending while focused',entry);await close(page);}
      await settle(page);entry.end=await page.evaluate(V);check(same(entry.end,A)&&entry.end.filterView===null&&entry.end.stored===null&&!entry.end.pending&&!entry.end.focus,'exact original return and state consumed',entry);
      if(scenario==='clear-focus-second-cycle'){await put(page,B);await filter(page,['priority:high']);await page.click('#filter-chips .filter-chip');await settle(page);entry.secondEnd=await page.evaluate(V);check(same(entry.secondEnd,B)&&entry.secondEnd.filterView===null&&entry.secondEnd.stored===null&&!entry.secondEnd.pending,'second cycle uses its distinct return',entry);}
    }
    await page.screenshot({path:path.join(OUT,'after/screenshots',`r2-${scenario}-${width}.png`)});check([entry.end.panX,entry.end.panY,entry.end.scale].every(Number.isFinite),'finite return',entry);out.r2.push(entry);out.csp.push(...await page.evaluate(()=>window.__csp));check(!(await page.evaluate(()=>window.__unhandled.length)),'no unhandled R2');await context.close();
  }
  check(!out.errors.length&&!out.console.length&&!out.csp.length,'zero browser diagnostics',{errors:out.errors,console:out.console,csp:out.csp});
} catch(e) {out.fatal=String(e.stack||e);out.failures.push({label:'targeted interrupted',details:out.fatal});}
finally {if(browser)await browser.close();for(const s of servers)await s.close();fs.writeFileSync(path.join(OUT,'targeted.json'),JSON.stringify(out,null,2)+'\n');}
console.log(JSON.stringify({browser:out.browser,r1Cases:out.r1.length,r2Cases:out.r2.length,failures:out.failures,fatal:out.fatal},null,2));process.exitCode=out.failures.length?1:0;
