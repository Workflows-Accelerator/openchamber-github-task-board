// Independent targeted review of a1225f0 (D39 bounded R1/R2 correction).
// Written for this review; no assertion copied from the builder's targeted.mjs.
// Local synthetic fixtures only. Every number is read from the live DOM/state.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalPreview, spreadPreview, login, selectAll, setCase, chromium, CHROME, sleep } from './fixture-helpers.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const out = {
  browser: null, reviewedApplication: 'a1225f0', dispatchHead: 'b07dd94',
  r1: [], truthOtherDirection: [], filterLimit: [], filterComplete: [],
  r2: [], geometry: [], breakpoint: [], failures: [],
  errors: [], console: [], csp: [],
};
const write = () => fs.writeFileSync(path.join(OUT, 'targeted-review.json'), JSON.stringify(out, null, 2) + '\n');
const fail = (label, details) => { out.failures.push({ label, details }); };
const check = (value, label, details) => { if (!value) fail(label, details); };
const near = (a, b, eps = 0.001) => Math.abs(a - b) <= eps;
const same = (a, b) => near(a.panX, b.panX) && near(a.panY, b.panY) && near(a.scale, b.scale);
const round = (n) => Math.round(n * 1000) / 1000;
const overlap = (a, b) => Boolean(a && b && a.x < b.right - 0.5 && a.right > b.x + 0.5 && a.y < b.bottom - 0.5 && a.bottom > b.y + 0.5);

async function settle(page) {
  await page.waitForFunction(() => !window.__taskBoard.state.canvasAnimating, null, { timeout: 8000 });
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))); });
  await sleep(60);
}

const V = () => {
  const s = window.__taskBoard.state;
  return {
    panX: s.canvasPanX, panY: s.canvasPanY, scale: s.canvasScale,
    pending: s.canvasFitPending, filterView: s.filterView,
    stored: localStorage.getItem('tb_canvas_filter_view'),
    focus: s.dependencyFocus, returnView: s.dependencyFocusReturn,
    filters: (s.viewState.filters || []).slice(), search: s.searchQuery,
    dependencyFocusLimited: s.dependencyFocusLimited,
    dependencyFocusFloored: s.dependencyFocusFloored,
    canvasFitLimited: s.canvasFitLimited, canvasFitFloored: s.canvasFitFloored,
  };
};

// One measurement pass: viewport, card rects/containment, labels, legend,
// filter-rail warning, both Show all controls. Containment is computed per card
// against the visible canvas region, not inferred from the zoom read-out.
const READ = () => {
  const app = window.__taskBoard;
  const st = app.state;
  const vpEl = document.getElementById('canvas-viewport');
  const vp = vpEl.getBoundingClientRect();
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const rectOf = (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  const hitOf = (n) => {
    const r = n.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return Boolean(h) && (h === n || n.contains(h));
  };
  const contained = (r) => r.x >= vp.x - 0.5 && r.right <= vp.right + 0.5 && r.y >= vp.y - 0.5 && r.bottom <= vp.bottom + 0.5;
  const intersects = (r) => r.x < vp.right - 0.5 && r.right > vp.x + 0.5 && r.y < vp.bottom - 0.5 && r.bottom > vp.y + 0.5;
  const outside = (r) => !intersects(r);
  const cards = Array.from(document.querySelectorAll('.canvas-card')).map((card) => {
    const r = rectOf(card);
    const title = card.querySelector('.canvas-card-title');
    return {
      key: card.getAttribute('data-issue-key'),
      role: ['selected', 'blocker', 'dependent', 'unrelated'].find((n) => card.classList.contains('dependency-' + n)) || null,
      rect: { x: r3(r.x), y: r3(r.y), width: r3(r.width), height: r3(r.height), right: r3(r.right), bottom: r3(r.bottom) },
      rawRect: r,
      contained: contained(r),
      intersectsViewport: intersects(r),
      fullyOutside: outside(r),
      effectiveTitlePx: title ? r3(parseFloat(getComputedStyle(title).fontSize) * st.canvasScale) : null,
    };
  });
  const labels = Array.from(document.querySelectorAll('.dependency-wire-label')).map((label) => {
    const r = rectOf(label);
    const b = label.getAttribute('data-blocker-key');
    const t = label.getAttribute('data-target-key');
    const find = (key) => cards.find((c) => c.key && key && c.key.toLowerCase() === key.toLowerCase());
    const bc = find(b), tc = find(t);
    return {
      text: label.textContent,
      hidden: getComputedStyle(label).visibility === 'hidden',
      rect: { x: r3(r.x), y: r3(r.y), width: r3(r.width), height: r3(r.height), right: r3(r.right), bottom: r3(r.bottom) },
      rawRect: r,
      blockerKey: b, targetKey: t,
      blockerFullyOutside: bc ? bc.fullyOutside : true,
      targetFullyOutside: tc ? tc.fullyOutside : true,
      bothEndpointsInView: Boolean(bc && tc && bc.intersectsViewport && tc.intersectsViewport),
    };
  });
  const legend = document.getElementById('dependency-legend');
  const legendRect = legend.hidden ? null : rectOf(legend);
  const legendNotes = Array.from(legend.querySelectorAll('.legend-offscreen')).map((n) => ({ text: n.textContent, rect: rectOf(n), hidden: n.hidden || getComputedStyle(n).visibility === 'hidden', hit: hitOf(n) }));
  const legendShowAll = legend.querySelector('.legend-show-all');
  const legendShowAllRect = legendShowAll ? rectOf(legendShowAll) : null;
  const barWarning = document.getElementById('canvas-fit-limit');
  const barWarningRect = barWarning && !barWarning.hidden ? rectOf(barWarning) : null;
  const barShowAll = document.getElementById('canvas-show-all');
  const barShowAllRect = barShowAll && !barShowAll.hidden ? rectOf(barShowAll) : null;
  return {
    exactView: { panX: st.canvasPanX, panY: st.canvasPanY, scale: st.canvasScale },
    scale: r3(st.canvasScale),
    viewport: { x: r3(vp.x), y: r3(vp.y), width: r3(vp.width), height: r3(vp.height), right: r3(vp.right), bottom: r3(vp.bottom) },
    dependencyFocus: st.dependencyFocus,
    dependencyFocusLimited: Boolean(st.dependencyFocusLimited),
    dependencyFocusFloored: Boolean(st.dependencyFocusFloored),
    canvasFitLimited: Boolean(st.canvasFitLimited),
    canvasFitFloored: Boolean(st.canvasFitFloored),
    cards,
    labels,
    legend: {
      hidden: legend.hidden,
      text: legend.textContent,
      rect: legendRect,
      notes: legendNotes,
      showAllPresent: Boolean(legendShowAll),
      showAllVisible: Boolean(legendShowAll && legendShowAllRect && legendShowAllRect.width > 0 && legendShowAllRect.height > 0),
      showAllText: legendShowAll ? legendShowAll.textContent : null,
      showAllRect: legendShowAllRect,
      showAllHit: legendShowAll ? hitOf(legendShowAll) : false,
    },
    barWarning: barWarning ? {
      present: true, hidden: barWarning.hidden, text: barWarning.textContent,
      visible: Boolean(barWarningRect && barWarningRect.width > 0 && barWarningRect.height > 0),
      rect: barWarningRect, hit: barWarningRect ? hitOf(barWarning) : false,
    } : { present: false },
    barShowAll: barShowAll ? {
      text: barShowAll.textContent,
      visible: Boolean(barShowAllRect && barShowAllRect.width > 0 && barShowAllRect.height > 0),
      rect: barShowAllRect, hit: barShowAllRect ? hitOf(barShowAll) : false,
    } : null,
    applied: (st.viewState.filters || []).slice(),
  };
};

async function fresh(browser, url, width, height, theme, lang) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__reviewCsp = []; window.__reviewUnhandled = [];
    addEventListener('securitypolicyviolation', (e) => window.__reviewCsp.push(e.violatedDirective));
    addEventListener('unhandledrejection', (e) => window.__reviewUnhandled.push(String(e.reason)));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => out.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') out.console.push(m.text()); });
  await login(page, url, 5);
  await selectAll(page);
  await setCase(page, width, height, theme, lang);
  return { context, page };
}

async function exposeCard(page, number = 2) {
  await settle(page);
  await page.evaluate((n) => {
    const a = window.__taskBoard;
    const c = document.querySelector('.canvas-card[data-issue-key="chamberos/platform#' + n + '"]');
    a.state.canvasScale = 1;
    a.state.canvasPanX = 24 - c.offsetLeft;
    a.state.canvasPanY = 50 - c.offsetTop;
    a.updateCanvasTransform();
  }, number);
  await sleep(40);
}

async function openFilter(page, tokens) {
  await page.click('#applied-filter-btn');
  await page.waitForFunction(() => document.getElementById('board-sheet').open, null, { timeout: 5000 });
  for (const token of tokens) await page.click(`[data-filter="${token}"]`);
  await page.click('#sheet-apply');
  await page.waitForFunction(() => !document.getElementById('board-sheet').open, null, { timeout: 5000 });
  await settle(page);
}

const expected = {
  dependency: {
    en: 'Zoom limit reached. Some linked tasks remain outside this view. Pan the canvas to see them.',
    fr: 'Limite de zoom atteinte. Des tâches liées restent hors de cette vue. Déplacez le canevas pour les voir.',
  },
  filter: {
    en: 'Zoom limit reached. Some tasks remain outside this view. Pan the canvas to see them.',
    fr: 'Limite de zoom atteinte. Des tâches restent hors de cette vue. Déplacez le canevas pour les voir.',
  },
};

// Evaluate the explicit full fit of a dependency group. Returns the classified
// result so the caller can assert both directions with the same measured data.
function classifyExplicit(prefix, tag, read, lang) {
  const roles = read.cards.filter((c) => c.role && c.role !== 'unrelated');
  const missing = roles.filter((c) => !c.contained);
  const selected = roles.find((c) => c.role === 'selected');
  const visibleLabels = read.labels.filter((l) => !l.hidden);
  const misleading = visibleLabels.filter((l) => l.blockerFullyOutside || l.targetFullyOutside);
  const limitNote = read.legend.notes.find((n) => !n.hidden);
  const info = {
    prefix, tag, scale: read.scale, missing: missing.map((c) => ({ key: c.key, role: c.role, fullyOutside: c.fullyOutside, contained: c.contained })),
    selectedContained: selected ? selected.contained : null,
    selectedRect: selected ? selected.rect : null,
    limitNote: limitNote || null,
    noteOverlapsSelected: Boolean(limitNote && selected && overlap(limitNote.rect, selected.rect)),
    noteOverlapsAnyCard: Boolean(limitNote && read.cards.some((c) => overlap(limitNote.rect, c.rect))),
    legendOverlapsSelected: Boolean(read.legend.rect && selected && overlap(read.legend.rect, selected.rect)),
    legendOverlapsAnyCard: Boolean(read.legend.rect && read.cards.some((c) => overlap(read.legend.rect, c.rect))),
    visibleLabelCount: visibleLabels.length,
    misleadingLabels: misleading.map((l) => ({ text: l.text, blocker: l.blockerKey, target: l.targetKey })),
    legendShowAllVisible: read.legend.showAllVisible,
    barShowAllVisible: Boolean(read.barShowAll && read.barShowAll.visible),
    stateLimited: read.dependencyFocusLimited,
  };
  if (missing.length) {
    check(near(read.scale, 0.2), `${prefix} incomplete full fit sits exactly on the 0.2 bound`, { tag, info });
    check(Boolean(limitNote), `${prefix} incomplete full fit keeps an honest limit message`, { tag, info });
    check(Boolean(limitNote) && limitNote.text === expected.dependency[lang], `${prefix} limit message is the expected ${lang} sentence`, { tag, info, text: limitNote && limitNote.text });
    check(Boolean(limitNote) && limitNote.rect.width > 0 && limitNote.rect.height > 0, `${prefix} limit message has real bounds`, { tag, info });
    check(Boolean(limitNote) && read.legend.rect && limitNote.rect.x >= read.legend.rect.x - 0.5 && limitNote.rect.right <= read.legend.rect.right + 0.5, `${prefix} limit message inside legend bounds`, { tag, info });
    check(Boolean(limitNote) && limitNote.hit, `${prefix} limit message hit-testable`, { tag, info });
    check(!info.noteOverlapsSelected, `${prefix} limit message does not cover the selected card`, { tag, info });
    check(!info.noteOverlapsAnyCard, `${prefix} limit message does not cover any card`, { tag, info });
    check(!info.legendOverlapsSelected, `${prefix} legend does not cover the selected card`, { tag, info });
    check(!info.legendShowAllVisible && !info.barShowAllVisible, `${prefix} no Show all control invites a pointless repeat`, { tag, info });
    check(info.stateLimited, `${prefix} state records the incomplete full fit`, { tag, info });
    check(misleading.length === 0, `${prefix} no visible label while an endpoint is fully off screen`, { tag, info });
    check(read.labels.filter((l) => l.hidden).every((l) => l.blockerFullyOutside || l.targetFullyOutside), `${prefix} hidden labels only where an endpoint is fully off screen`, { tag, labels: read.labels });
  } else {
    check(!limitNote, `${prefix} complete full fit shows no limit message`, { tag, info });
    check(!read.dependencyFocusLimited, `${prefix} complete full fit is not flagged limited`, { tag, info });
    check(roles.every((c) => c.contained), `${prefix} complete full fit contains every neighbourhood card`, { tag, info });
    check(!info.legendShowAllVisible && !info.barShowAllVisible, `${prefix} complete full fit keeps no Show all action`, { tag, info });
  }
  return info;
}

async function r1Case(browser, name, server, width, height, theme, lang) {
  const tag = `${name}-${width}-${lang}-${theme}`;
  const { context, page } = await fresh(browser, server.url, width, height, theme, lang);
  try {
    await exposeCard(page);
    const beforeFocus = await page.evaluate(V);
    await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
    await settle(page);
    const auto = await page.evaluate(READ);
    const roles = auto.cards.filter((c) => c.role && c.role !== 'unrelated');
    const selected = roles.find((c) => c.role === 'selected');
    const autoInfo = {
      tag, scale: auto.scale, floored: auto.dependencyFocusFloored, limited: auto.dependencyFocusLimited,
      selectedContained: selected ? selected.contained : null,
      selectedEffectiveTitlePx: selected ? selected.effectiveTitlePx : null,
      note: auto.legend.notes.map((n) => n.text), showAllVisible: auto.legend.showAllVisible,
      visibleLabels: auto.labels.filter((l) => !l.hidden).length,
      misleadingLabels: auto.labels.filter((l) => !l.hidden && (l.blockerFullyOutside || l.targetFullyOutside)).length,
    };
    out.r1.push({ kind: 'automatic', ...autoInfo });
    check(auto.scale >= 0.55 - 0.0005, `${tag} automatic framing respects the readable floor`, autoInfo);
    check(selected && selected.contained, `${tag} automatic framing contains the selected card`, autoInfo);
    check(selected && (selected.effectiveTitlePx === null || selected.effectiveTitlePx >= 8.0), `${tag} automatic selected title readable`, autoInfo);
    check(auto.labels.filter((l) => !l.hidden).every((l) => !l.blockerFullyOutside && !l.targetFullyOutside), `${tag} automatic labels are honest`, autoInfo);
    if (auto.dependencyFocusFloored) {
      check(auto.legend.notes.length > 0 && auto.legend.showAllVisible, `${tag} floored automatic framing announces missing neighbours and offers the full fit`, autoInfo);
    } else {
      check(auto.legend.notes.length === 0 && !auto.legend.showAllVisible, `${tag} complete automatic framing shows no limit or action`, autoInfo);
    }

    let explicit = null;
    if (auto.legend.showAllVisible) {
      await page.click('#dependency-legend .legend-show-all');
      await settle(page);
      const read = await page.evaluate(READ);
      explicit = classifyExplicit('R1 dependency', tag, read, lang);
      out.r1.push({ kind: 'explicit', ...autoInfo, explicit });
      await page.screenshot({ path: path.join(SHOTS, `r1-focus-explicit-${tag}.png`) });
      // No-op guard: invoking the action again must not move the view.
      const v0 = await page.evaluate(V);
      await page.evaluate(() => window.__taskBoard.showAllCanvas());
      await settle(page);
      const v1 = await page.evaluate(V);
      check(same(v0, v1), `${tag} repeated full fit at the same bound is a no-op`, { v0, v1 });
      // Geometry of the message against every card, at this width and theme.
      const geo = await page.evaluate(READ);
      const note = geo.legend.notes.find((n) => !n.hidden);
      if (note) {
        check(!geo.cards.some((c) => overlap(note.rect, c.rect)), `${tag} no card is covered by the limit message`, { note: note.rect, cards: geo.cards.map((c) => c.rect) });
      }
      if (explicit.missing.length === 0) {
        out.truthOtherDirection.push({ tag, scale: explicit.scale, missing: 0, note: explicit.limitNote, allContained: true, legendShowAll: explicit.legendShowAllVisible });
      }
    }
    // Dependency-only close returns to the exact pre-focus viewport.
    await page.click('#dependency-legend .legend-head button');
    await settle(page);
    const afterClose = await page.evaluate(V);
    check(same(afterClose, beforeFocus) && !afterClose.focus && afterClose.filterView === null && afterClose.stored === null && !afterClose.pending,
      `${tag} closing dependency focus restores the exact entry viewport`, { beforeFocus, afterClose });

    // Filter path: priority:high, then a deliberately over-wide filtered group
    // on a phone to exercise the filtered full-fit limit.
    await openFilter(page, ['priority:high']);
    const filtered = await page.evaluate(READ);
    const filteredInfo = {
      tag, scale: filtered.scale, floored: filtered.canvasFitFloored, limited: filtered.canvasFitLimited,
      showAllVisible: Boolean(filtered.barShowAll && filtered.barShowAll.visible), cards: filtered.cards.length,
      contained: filtered.cards.filter((c) => c.contained).length,
    };
    out.r1.push({ kind: 'filtered', ...filteredInfo });
    if (filtered.barShowAll && filtered.barShowAll.visible) {
      await page.click('#canvas-show-all');
      await settle(page);
      const after = await page.evaluate(READ);
      const missing = after.cards.filter((c) => !c.contained);
      const warn = after.barWarning;
      const info = {
        tag, scale: after.scale, cards: after.cards.length, missing: missing.map((c) => ({ key: c.key, fullyOutside: c.fullyOutside })),
        warning: warn.visible ? warn.text : null, warningHit: warn.hit, stateLimited: after.canvasFitLimited,
        barShowAllVisible: Boolean(after.barShowAll && after.barShowAll.visible),
        overlapsCard: warn.rect ? after.cards.some((c) => overlap(warn.rect, c.rect)) : false,
        overlapsViewport: warn.rect ? overlap(warn.rect, after.viewport) : false,
      };
      out.filterLimit.push({ kind: 'priority-high', ...info });
      if (missing.length) {
        check(near(after.scale, 0.2), `${tag} filtered full-fit limit sits exactly on 0.2`, info);
        check(warn.visible && warn.text === expected.filter[lang], `${tag} filtered full-fit shows the expected ${lang} limit sentence`, info);
        check(warn.hit, `${tag} filtered limit message hit-testable`, info);
        check(!info.overlapsCard && !info.overlapsViewport, `${tag} filtered limit message does not cover cards or the canvas`, info);
        check(!info.barShowAllVisible, `${tag} filtered limit hides the Show all control`, info);
        check(after.canvasFitLimited, `${tag} filtered limit recorded in state`, info);
        const v0 = await page.evaluate(V);
        await page.evaluate(() => window.__taskBoard.showAllCanvas());
        await settle(page);
        const v1 = await page.evaluate(V);
        check(same(v0, v1), `${tag} repeated filtered full fit is a no-op`, { v0, v1 });
      } else {
        check(!warn.visible, `${tag} complete filtered full fit shows no limit message`, info);
        check(!after.canvasFitLimited, `${tag} complete filtered full fit not flagged limited`, info);
        check(!info.barShowAllVisible, `${tag} complete filtered full fit hides Show all`, info);
        out.filterComplete.push({ kind: 'priority-high', ...info, allContained: true });
      }
    }

    // A filtered group that genuinely cannot fit at 0.2 on a phone.
    if (name === 'spread' && width <= 390) {
      await openFilter(page, ['priority:high']); // toggle it off again
      await openFilter(page, ['stage:todo']);
      const pre = await page.evaluate(READ);
      check(Boolean(pre.barShowAll && pre.barShowAll.visible), `${tag} over-wide filtered group offers Show all`, pre);
      if (pre.barShowAll && pre.barShowAll.visible) {
        await page.click('#canvas-show-all');
        await settle(page);
        const after = await page.evaluate(READ);
        const missing = after.cards.filter((c) => !c.contained);
        const warn = after.barWarning;
        const info = {
          tag, scale: after.scale, cards: after.cards.length, missing: missing.map((c) => ({ key: c.key, fullyOutside: c.fullyOutside })),
          warning: warn.visible ? warn.text : null, warningHit: warn.hit, stateLimited: after.canvasFitLimited,
          barShowAllVisible: Boolean(after.barShowAll && after.barShowAll.visible),
          overlapsCard: warn.rect ? after.cards.some((c) => overlap(warn.rect, c.rect)) : false,
          overlapsViewport: warn.rect ? overlap(warn.rect, after.viewport) : false,
        };
        out.filterLimit.push({ kind: 'stage-todo', ...info });
        check(missing.length > 0, `${tag} stage:todo filtered group genuinely exceeds the 0.2 bound`, info);
        check(near(after.scale, 0.2), `${tag} stage:todo filtered limit sits exactly on 0.2`, info);
        check(warn.visible && warn.text === expected.filter[lang], `${tag} stage:todo filtered limit message truthful and localized`, info);
        check(warn.hit, `${tag} stage:todo limit message hit-testable`, info);
        check(!info.overlapsCard && !info.overlapsViewport, `${tag} stage:todo limit message does not cover cards or the canvas`, info);
        check(!info.barShowAllVisible, `${tag} stage:todo limit hides Show all`, info);
        check(after.canvasFitLimited, `${tag} stage:todo limit recorded in state`, info);
        await page.screenshot({ path: path.join(SHOTS, `filter-limit-${tag}.png`) });
      }
    }
    out.csp.push(...await page.evaluate(() => window.__reviewCsp));
    check((await page.evaluate(() => window.__reviewUnhandled.length)) === 0, `${tag} no unhandled rejection`, { tag });
  } finally {
    await context.close();
  }
}

// ---- R2: independently driven interleavings with exact viewport equality ----
const A = { panX: 123.125, panY: -47.875, scale: 0.873 };
const B = { panX: -201.625, panY: 93.375, scale: 1.237 };
const put = (page, view) => page.evaluate((v) => {
  const a = window.__taskBoard;
  a.state.canvasPanX = v.panX; a.state.canvasPanY = v.panY; a.state.canvasScale = v.scale;
  a.updateCanvasTransform();
}, view);

async function r2Scenario(browser, server, width, scenario) {
  const height = width <= 390 ? 800 : 900;
  const { context, page } = await fresh(browser, server.url, width, height, 'light', 'en');
  const record = { width, scenario, start: null, steps: [], end: null };
  try {
    // Start from a clean filter memory, then set an exact fractional viewport.
    await page.evaluate(() => { localStorage.removeItem('tb_canvas_filter_view'); });
    await put(page, A);
    await page.evaluate(() => window.__taskBoard.rememberView());
    await sleep(120);
    record.start = await page.evaluate(V);
    check(!record.start.filterView && record.start.stored === null && !record.start.pending, `${width} ${scenario} clean start`, record.start);

    if (scenario === 'dependency-only') {
      await exposeCard(page);
      const before = await page.evaluate(V);
      await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
      await settle(page);
      record.steps.push({ focus: await page.evaluate(V) });
      await page.click('#dependency-legend .legend-head button');
      await settle(page);
      record.end = await page.evaluate(V);
      check(same(record.end, before) && !record.end.focus && !record.end.pending && record.end.filterView === null && record.end.stored === null,
        `${width} dependency-only enter/exit returns exactly`, record);
    }

    if (scenario === 'clear-under-focus-second-cycle') {
      await openFilter(page, ['priority:high']);
      record.steps.push({ filtered: await page.evaluate(V) });
      check(same(record.steps[0].filtered.filterView, A) && record.steps[0].filtered.stored !== null, `${width} clear-under-focus filter captures A`, record.steps[0]);
      await exposeCard(page);
      await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
      await settle(page);
      record.steps.push({ focused: await page.evaluate(V) });
      await page.click('#filter-chips .filter-chip');
      await settle(page);
      const cleared = await page.evaluate(V);
      record.steps.push({ clearedWhileFocused: cleared });
      check(cleared.pending === true, `${width} clear-under-focus keeps the filter request deferred while focus owns the view`, record.steps.at(-1));
      check(same(cleared.filterView, A) && cleared.stored !== null, `${width} clear-under-focus does not consume the saved return early`, record.steps.at(-1));
      check(Boolean(cleared.focus), `${width} clear-under-focus keeps focus active`, record.steps.at(-1));
      await page.click('#dependency-legend .legend-head button');
      await settle(page);
      record.end = await page.evaluate(V);
      check(same(record.end, A) && record.end.filterView === null && record.end.stored === null && !record.end.pending && !record.end.focus,
        `${width} clear-under-focus returns exactly to A and consumes its memory`, record);
      // Second cycle with a distinct start must use the new start, not A.
      await put(page, B);
      await page.evaluate(() => window.__taskBoard.rememberView());
      await openFilter(page, ['priority:high']);
      await page.click('#filter-chips .filter-chip');
      await settle(page);
      record.secondEnd = await page.evaluate(V);
      check(same(record.secondEnd, B) && record.secondEnd.filterView === null && record.secondEnd.stored === null && !record.secondEnd.pending,
        `${width} second cycle after interleaving returns to its own B`, record.secondEnd);
    }

    if (scenario === 'change-filter-without-clearing') {
      await openFilter(page, ['priority:high']);
      record.steps.push({ filtered: await page.evaluate(V) });
      await exposeCard(page);
      await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
      await settle(page);
      await openFilter(page, ['stage:in-progress']);
      await page.locator('#filter-chips .filter-chip').filter({ hasText: 'High' }).click();
      await settle(page);
      const during = await page.evaluate(V);
      record.steps.push({ duringChange: during });
      check(during.pending === true && during.filters.length === 1, `${width} filter change under focus keeps the request pending`, during);
      await page.click('#dependency-legend .legend-head button');
      await settle(page);
      const afterClose = await page.evaluate(V);
      record.steps.push({ afterClose: afterClose });
      check(!afterClose.pending && Boolean(afterClose.dependencyFocus) === false, `${width} filter change: closing focus consumes the pending reframe`, afterClose);
      check(same(afterClose.filterView, A) && afterClose.stored !== null, `${width} filter change: A is still the remembered return`, afterClose);
      await page.click('#filter-chips .filter-chip');
      await settle(page);
      record.end = await page.evaluate(V);
      check(same(record.end, A) && record.end.filterView === null && record.end.stored === null && !record.end.pending,
        `${width} filter change then clear returns exactly to A`, record);
    }

    if (scenario === 'exit-with-filter-active-then-clear') {
      await openFilter(page, ['priority:high']);
      const filtered = await page.evaluate(V);
      record.steps.push({ filtered });
      await exposeCard(page);
      const preFocus = await page.evaluate(V);
      record.steps.push({ preFocus });
      await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
      await settle(page);
      await page.click('#dependency-legend .legend-head button');
      await settle(page);
      const afterClose = await page.evaluate(V);
      record.steps.push({ afterClose });
      check(!afterClose.focus && !afterClose.pending && same(afterClose, preFocus), `${width} exit focus with a filter returns to the view immediately before focus`, { preFocus, afterClose });
      check(same(afterClose.filterView, A) && afterClose.stored !== null, `${width} exit focus keeps the original return view`, afterClose);
      await page.click('#filter-chips .filter-chip');
      await settle(page);
      record.end = await page.evaluate(V);
      check(same(record.end, A) && record.end.filterView === null && record.end.stored === null && !record.end.pending,
        `${width} clearing after a filtered exit returns exactly to A`, record);
    }

    if (scenario === 'list-clear-reload-canvas') {
      await openFilter(page, ['priority:high']);
      await page.evaluate(() => document.getElementById('nav-list').click());
      await sleep(250);
      await page.click('#filter-chips .filter-chip');
      await sleep(250);
      const clearedInList = await page.evaluate(V);
      record.steps.push({ clearedInList });
      check(clearedInList.pending === true && same(clearedInList.filterView, A) && clearedInList.stored !== null,
        `${width} clearing in List keeps the pending return`, clearedInList);
      await page.reload();
      await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length && !window.__taskBoard.state.boardLoad, null, { timeout: 20000 });
      await page.evaluate(() => document.getElementById('nav-canvas').click());
      await settle(page);
      record.end = await page.evaluate(V);
      check(same(record.end, A) && record.end.filterView === null && record.end.stored === null && !record.end.pending,
        `${width} List clear survives reload and restores A on Canvas`, record);
    }

    if (scenario === 'search-only') {
      await page.evaluate(() => {
        const s = document.getElementById('board-search');
        s.value = 'Wire';
        s.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await sleep(350);
      const searching = await page.evaluate(V);
      record.steps.push({ searching });
      check(searching.filterView === null && searching.stored === null, `${width} search alone never captures a filter return`, searching);
      check(near(searching.panX, A.panX) && near(searching.panY, A.panY) && near(searching.scale, A.scale), `${width} search alone never moves the canvas`, searching);
      await page.evaluate(() => window.__taskBoard.setSearchQuery(''));
      await sleep(250);
      record.end = await page.evaluate(V);
      check(same(record.end, A) && !record.end.pending && record.end.filterView === null, `${width} clearing search keeps the exact view`, record);
    }

    if (scenario === 'filter-during-focus') {
      await exposeCard(page);
      const preFocus = await page.evaluate(V);
      await page.click('.canvas-card[data-issue-key="chamberos/platform#2"] .card-dependency-focus');
      await settle(page);
      const focused = await page.evaluate(V);
      record.steps.push({ preFocus, focused });
      await openFilter(page, ['priority:high']);
      const during = await page.evaluate(V);
      record.steps.push({ filterDuringFocus: during });
      check(same(during.filterView, preFocus) && during.stored !== null, `${width} first filter during focus captures the pre-focus view`, { preFocus, during });
      check(during.pending === true, `${width} first filter during focus stays deferred`, during);
      await page.click('#dependency-legend .legend-head button');
      await settle(page);
      const afterClose = await page.evaluate(V);
      record.steps.push({ afterClose });
      check(!afterClose.focus && !afterClose.pending, `${width} closing focus consumes the deferred filter frame`, afterClose);
      check(same(afterClose.filterView, preFocus) && afterClose.stored !== null, `${width} pre-focus view survives the focused filter`, afterClose);
      await page.click('#filter-chips .filter-chip');
      await settle(page);
      record.end = await page.evaluate(V);
      check(same(record.end, preFocus) && record.end.filterView === null && record.end.stored === null && !record.end.pending,
        `${width} clearing the focused filter returns exactly to the pre-focus view`, record);
    }
    check([record.end.panX, record.end.panY, record.end.scale].every(Number.isFinite), `${width} ${scenario} final viewport finite`, record.end);
    out.r2.push(record);
    await page.screenshot({ path: path.join(SHOTS, `r2-${scenario}-${width}.png`) });
  } catch (error) {
    fail(`${width} ${scenario} interrupted`, String(error.stack || error));
    out.r2.push({ ...record, error: String(error.stack || error) });
  } finally {
    await context.close();
  }
}

// ---- 768/769 responsive boundary for the review scope ----
async function breakpoint(browser, server) {
  const { context, page } = await fresh(browser, server.url, 1280, 900, 'light', 'en');
  try {
    await page.evaluate(() => localStorage.setItem('tb_sidebar_collapsed', '1'));
    await page.reload();
    await page.waitForFunction(() => window.__taskBoard?.state?.board?.issues?.length, null, { timeout: 20000 });
    for (const width of [768, 769, 768, 769]) {
      await page.setViewportSize({ width, height: 900 });
      await sleep(300);
      const compactBefore = width === 768
        ? await page.locator('#sidebar-toggle-btn-compact').evaluate((b) => {
          const q = b.getBoundingClientRect();
          const h = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
          return { x: q.x, y: q.y, width: q.width, height: q.height, hit: h === b || b.contains(h) };
        })
        : null;
      if (width === 768) await page.click('#sidebar-toggle-btn-compact');
      await sleep(180);
      const data = await page.evaluate(([w]) => {
        const s = document.getElementById('app-sidebar').getBoundingClientRect();
        const b = document.getElementById(w === 768 ? 'sidebar-toggle-btn-compact' : 'sidebar-toggle-btn') || document.getElementById('sidebar-toggle-btn');
        const q = b.getBoundingClientRect();
        const h = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
        return {
          width: innerWidth,
          sidebar: { x: s.x, width: s.width, right: s.right },
          toggle: { x: q.x, y: q.y, width: q.width, height: q.height, hit: h === b || b.contains(h), label: b.getAttribute('aria-label') },
          compactDisplay: getComputedStyle(document.getElementById('sidebar-toggle-btn-compact')).display,
        };
      }, [width]);
      data.compactBeforeOpen = compactBefore;
      out.breakpoint.push(data);
      check(width === 768
        ? data.sidebar.x === 0 && Math.abs(data.sidebar.width - 280) < 1 && compactBefore.hit && compactBefore.width >= 44 && compactBefore.height >= 44
        : Math.abs(data.sidebar.width - 56) < 1 && data.toggle.hit && data.toggle.label === 'Expand sidebar',
      `breakpoint ${width}`, data);
      if (width === 768) await page.mouse.click(740, 500);
    }
  } finally { await context.close(); }
}

let browser;
const servers = [];
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  out.browser = await browser.version();
  const normal = await normalPreview();
  const spread = await spreadPreview();
  servers.push(normal, spread);

  const matrix = [];
  for (const width of [360, 390, 768, 769, 1280]) {
    const height = width <= 390 ? 800 : 900;
    for (const lang of ['en', 'fr']) for (const theme of ['light', 'dark']) matrix.push({ width, height, lang, theme });
  }
  const limit = Number(process.env.CASE_LIMIT || 0);
  let index = 0;
  for (const [name, server] of [['normal', normal], ['spread', spread]]) {
    for (const c of matrix) {
      if (limit && index++ >= limit) break;
      console.log('case', name, c.width, c.lang, c.theme);
      await r1Case(browser, name, server, c.width, c.height, c.theme, c.lang);
    }
  }
  await breakpoint(browser, normal);
  for (const width of [360, 1280]) {
    for (const scenario of ['dependency-only', 'clear-under-focus-second-cycle', 'change-filter-without-clearing', 'exit-with-filter-active-then-clear', 'list-clear-reload-canvas', 'search-only', 'filter-during-focus']) {
      console.log('r2', width, scenario);
      await r2Scenario(browser, normal, width, scenario);
    }
  }
  check(!out.errors.length && !out.console.length && !out.csp.length, 'zero unexpected browser diagnostics', { errors: out.errors, console: out.console, csp: out.csp });
} catch (error) {
  fail('probe interrupted', String(error.stack || error));
} finally {
  if (browser) await browser.close();
  for (const s of servers) await s.close();
  write();
}
const summary = {
  r1AutomaticExplicit: out.r1.length,
  r1Cases: out.r1.length,
  truthOtherDirection: out.truthOtherDirection.length,
  filterLimit: out.filterLimit.length,
  filterComplete: out.filterComplete.length,
  r2: out.r2.length,
  breakpoint: out.breakpoint.length,
  failures: out.failures.length,
  browser: out.browser,
};
console.log(JSON.stringify({ summary, failureLabels: out.failures.map((f) => f.label) }, null, 2));
process.exitCode = out.failures.length ? 1 : 0;
