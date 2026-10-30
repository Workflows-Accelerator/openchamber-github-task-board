import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';

const root = process.cwd();
const out = root + '/.agents/run/issue-48-panel-correction/verifications';
const repo = 'acme/openchamber-github-task-board';
const other = 'acme/very-long-project-name-for-narrow-layout';

function data(mode) {
  const issues = [
    { number: 1, title: 'First unmarked idea', body: 'Inspiration one', labels: ['status:draft', 'priority:important'] },
    { number: 2, title: 'Second unmarked idea', body: '', labels: ['status:draft'] },
    { number: 3, title: 'Third unmarked idea', body: 'Inspiration three', labels: ['status:draft', 'priority:useful'] },
    {
      number: 4,
      title: 'Choose the next step',
      body: '### Human Tasks:\n- [ ] Inspect the preview\n\n### Open Questions:\n- [ ] Which colour should we use?',
      labels: ['status:needs-human', 'attention:needs-decision', 'priority:critical'],
    },
    { number: 5, title: 'Review toolbar', body: 'Review details', labels: ['status:in-review', 'attention:needs-review'] },
    { number: 6, title: 'Completed task', body: 'Done context', labels: ['status:done'] },
    { number: 1, repo: other, title: 'Other project same issue number', body: 'Other inspiration', labels: ['status:draft'] },
  ];
  if (mode === 'marked') {
    for (const i of issues) {
      if ((i.repo || repo) === repo && i.number <= 3) {
        i.body += '\n\n<!-- board-order: ' + i.number * 1000 + ' -->';
      }
    }
  }
  if (mode === 'fences') {
    issues[0].body =
      'Sample:\r\n```html\r\n<!-- board-order: 777 -->\r\n```\r\n\r\n\r\n### Human Tasks:\r\n- [ ] Keep this\r\n\r\n<!-- board-order: 1000 -->';
  }
  return issues.map((i, idx) => ({
    ...i,
    repo: i.repo || repo,
    node_id: 'ISSUE_' + idx,
    state: 'open',
    labels: i.labels.map((name) => ({ name })),
    created_at: `2026-10-0${idx + 1}T10:00:00Z`,
    updated_at: `2026-10-1${idx + 1}T10:00:00Z`,
    html_url: `https://github.com/${i.repo || repo}/issues/${i.number}`,
    user: { login: 'fixture' },
  }));
}

function fixture(mode) {
  return `<!doctype html><script>
const repo=${JSON.stringify(repo)}, other=${JSON.stringify(other)};
window.items=${JSON.stringify(data(mode))};window.calls=[];window.controls={};window.pending=[];window.confirms=[];
const storage=new Map();
window.addEventListener('message',event=>{
 const m=event.data;if(m?.channel!=='openchamber.sdk')return;calls.push(m);
 const reply=(payload,ok=true,error)=>event.source.postMessage({channel:'openchamber.sdk',v:1,type:'result',id:m.id,ok,payload,error,code:ok?undefined:'HOST_REJECTED'},'*');
 if(m.type==='hello'){event.source.postMessage({channel:'openchamber.sdk',v:1,type:'ready',payload:{surface:'panel',directory:'/fixture/task-board',session:null,connection:{status:'connected'},settings:{repo},features:{deviceStorage:true},theme:{mode:'dark',tokens:{font:'sans',foreground:'#eeeeee',background:'#111214'}}}},'*');return;}
 if(!m.id)return;const p=m.payload||{};
 if(m.type==='storage'){if(p.op==='set')storage.set(p.key,p.value);reply({storage:true,op:p.op,key:p.key,found:storage.has(p.key),value:storage.get(p.key)});return;}
 if(m.type==='workspace-read'){reply(p.kind==='projects'?{kind:'projects',state:'ready',projects:[{id:'one',name:'One',directory:'/fixture/task-board'},{id:'two',name:'Two',directory:'/fixture/other'}]}:p.kind==='sessions'?{kind:'sessions',state:'ready',projectId:p.projectId,coverage:[],sessions:[]}:{kind:'worktrees',state:'ready',projectId:p.projectId,worktrees:[]});return;}
 if(m.type==='file-read'){reply({content:p.path?.endsWith('/.git/config')?'[remote "origin"]\\n url = https://github.com/'+(p.path.includes('/other/')?other:repo)+'.git\\n':''});return;}
 if(m.type==='confirm'){confirms.push(p);reply({confirmed:false});return;}
 if(m.type==='request'){
  const payload=p.body?JSON.parse(p.body):{}, r=/^\\/repos\\/([^/]+\\/[^/]+)(?:\\/|$)/.exec(p.path)?.[1];
  const send=(body,status=200)=>reply({status,headers:{etag:'"fixture-v1"'},body:JSON.stringify(body)});
  if(p.path==='/graphql'){
   if(controls.lostTransfer){reply(null,false,'Synthetic response lost');return;}
   const movedItem = items.find(x=>x.repo===repo&&x.number===1);
   if(movedItem){movedItem.repo=other;movedItem.number=19;movedItem.html_url='https://github.com/'+other+'/issues/19';}
   send({data:{transferIssue:{issue:{number:19,url:'https://github.com/'+other+'/issues/19',repository:{nameWithOwner:other}}}}});return;
  }
  if(p.method==='POST'&&p.path.endsWith('/issues')){if(controls.failCreate){send({},422);return;}const i={...items[0],...payload,repo:r,number:50,html_url:'https://github.com/'+r+'/issues/50',labels:payload.labels.map(name=>({name}))};items.push(i);send(i,201);return;}
  const n=/\\/issues\\/(\\d+)$/.exec(p.path)?.[1];
  if(n){let i=items.find(x=>x.repo===r&&x.number===Number(n));
   if(p.method==='PATCH'){
    if(controls.failPatch){send({},422);return;}
    if(controls.concurrentBody){i.body+='\\nRemote change AFTER fresh GET';controls.concurrentBody=false;}
    if(controls.holdPatch){pending.push(()=>{Object.assign(i,payload);send(i);});return;}
    Object.assign(i,payload);send(i);return;
   }send(i||{});return;
  }
  if(p.path.split('?')[0].endsWith('/issues')){send(items.filter(x=>x.repo===r));return;}
  if(/^\\/repos\\/[^/]+\\/[^/]+$/.test(p.path)){send({node_id:'REPO_TARGET'});return;}
  send([]);return;
 }
 reply({});
});
</script><style>body{margin:0;background:#111214}iframe{width:100%;height:100vh;border:0;display:block}</style><iframe src='/panel/index.html'></iframe>`;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/') {
    res.setHeader('content-type', 'text/html');
    res.end(fixture(u.searchParams.get('mode')));
    return;
  }
  if (['/panel/index.html', '/panel/main.js'].includes(u.pathname)) {
    res.setHeader('content-type', u.pathname.endsWith('html') ? 'text/html' : 'text/javascript');
    res.end(fs.readFileSync(root + u.pathname));
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: '/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  args: ['--no-sandbox'],
});

const results = [];
const errors = [];
const consoles = [];

async function open(mode = 'unmarked', width = 980, height = 780) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.route('**/*', (r) => (r.request().url().startsWith('http://127.0.0.1:') ? r.continue() : r.abort()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoles.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
  const f = page.frames().find((fr) => fr.url().includes('/panel/index.html'));
  await f.locator('.simple-row').first().waitFor();
  await page.waitForTimeout(180);
  return { page, f };
}

const pause = (page) => page.waitForTimeout(140);
const view = async (f, id) => {
  await f.locator('#btnViewSelect').click();
  await f.locator('#viewOpt' + id).click();
};
const filter = async (f, token) => {
  await f.locator('#btnFilterToggle').click();
  const popoverBox = await f.locator('#filterPopover').boundingBox();
  const chip = f.locator('[data-filter="' + token + '"]');
  const chipBox = await chip.boundingBox();
  const vw = f.page().viewportSize().width;
  assert.ok(popoverBox.x >= 0, `H1: filterPopover x=${popoverBox.x} must be >= 0 at width=${vw}`);
  assert.ok(popoverBox.x + popoverBox.width <= vw, `H1: filterPopover right=${popoverBox.x + popoverBox.width} must be <= ${vw}`);
  assert.ok(chipBox.x >= 0, `H1: chip ${token} x=${chipBox.x} must be >= 0 at width=${vw}`);
  if (vw === 360 && token === 'stage:draft') {
    results.push({ check: 'H1-filter-clamped-360', token, chipBox, popoverBox });
    await snap(f.page(), 'filter-popover-360');
  }
  await chip.click();
  await f.locator('#btnFilterToggle').click();
};
const rows = (f) => f.locator('.simple-row');
const row = (f, n, r = repo) => f.locator('[data-draft-key="' + r + '#' + n + '"]');
const mutations = (page) =>
  page.evaluate(() => calls.filter((c) => c.type === 'request' && c.payload.method !== 'GET').map((c) => c.payload));
const snap = async (page, name) => {
  await page.screenshot({ path: out + '/screenshots/' + name + '.png' });
};

try {
  // 1. Render all 5 views across 980x780, 390x844, and 360x780 viewports + verify H1 & M1
  let { page, f } = await open();
  for (const [width, height] of [
    [980, 780],
    [390, 844],
    [360, 780],
  ]) {
    await page.setViewportSize({ width, height });
    const viewsToCapture = width === 390 ? ['Simple'] : ['Simple', 'Cards', 'Kanban', 'Graph', 'Pending'];
    for (const id of viewsToCapture) {
      await view(f, id);
      await snap(page, id.toLowerCase() + '-' + width);
      results.push({ check: 'render-' + id, width, layout: await f.locator('body').getAttribute('data-layout') });
    }
    await view(f, 'Simple');
    await filter(f, 'stage:draft');
    await f.locator('#selectSort').selectOption('manual');
    await snap(page, 'draft-' + width);
    const geometry = await f.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      add: document.querySelector('.simple-add').getBoundingClientRect().toJSON(),
      touchButtons: [...document.querySelectorAll('.simple-row .simple-move-btn')].map((b) => ({
        text: b.textContent,
        label: b.getAttribute('aria-label'),
        disabled: b.disabled,
      })),
    }));
    assert.ok(geometry.touchButtons.length >= 6, 'M1: each editable draft row must render Move Up and Move Down buttons');
    results.push({ check: 'draft-geometry', width, geometry });
    await f.locator('#activeFilters').getByRole('button', { name: 'Clear', exact: true }).click();
  }

  // 2. C1: Unmarked downward reorder succeeds via lazy neighbour marker initialization
  await page.setViewportSize({ width: 980, height: 780 });
  await filter(f, 'stage:draft');
  await f.locator('#selectSort').selectOption('manual');
  await row(f, 1).focus();
  await row(f, 1).press('Alt+ArrowDown');
  await pause(page);
  const unmarkedDownMutations = await mutations(page);
  const unmarkedDownTitles = await rows(f).locator('input.simple-title').evaluateAll((es) => es.map((e) => e.value));
  assert.deepEqual(
    unmarkedDownTitles,
    ['Second unmarked idea', 'First unmarked idea', 'Third unmarked idea'],
    'C1: unmarked draft #1 moves down past #2'
  );
  assert.equal(unmarkedDownMutations.length, 2, 'C1: lazily initializes #2 (1000) and #1 (2000) without touching #3');
  results.push({
    check: 'C1-unmarked-down',
    mutations: unmarkedDownMutations,
    titles: unmarkedDownTitles,
  });
  await snap(page, 'unmarked-down-reordered');

  // 3. M1: Clicking Move Up button on row #1 moves it back to the top
  await row(f, 1).locator('.simple-move-up').click();
  await pause(page);
  const afterMoveUpButton = await rows(f).locator('input.simple-title').evaluateAll((es) => es.map((e) => e.value));
  assert.deepEqual(
    afterMoveUpButton,
    ['First unmarked idea', 'Second unmarked idea', 'Third unmarked idea'],
    'M1: clicking .simple-move-up reorders draft #1 back to top'
  );
  results.push({ check: 'M1-move-up-button', titles: afterMoveUpButton });

  // 4. M2(b): Editing draft title and pressing Tab moves focus to that row's description textarea
  await row(f, 1).locator('input.simple-title').fill('Renamed with keyboard');
  await row(f, 1).locator('input.simple-title').press('Tab');
  await pause(page);
  const tabFocus = await f.evaluate(() => ({
    tag: document.activeElement?.tagName,
    label: document.activeElement?.getAttribute('aria-label'),
  }));
  assert.equal(tabFocus.tag, 'TEXTAREA', 'M2: Tab from .simple-title focuses .simple-description');
  assert.equal(tabFocus.label, 'Description for draft #1');
  results.push({ check: 'M2-title-tab-focus', focus: tabFocus });

  // 5. C2 (D55): Saved-draft project change requires confirmation; Cancel does 0 network calls and resets select
  await f.locator('#btnRepoSelect').click();
  await f.locator('.all-projects-option').click();
  await pause(page);
  const dialogs = [];
  let acceptDialog = false;
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    if (acceptDialog) await d.accept();
    else await d.dismiss();
  });
  const mutationsBeforeCancel = (await mutations(page)).length;
  const requestsBeforeCancel = await page.evaluate(() => calls.filter((c) => c.type === 'request').length);
  await row(f, 1).locator('select.simple-project').selectOption(other);
  await pause(page);
  const requestsAfterCancel = await page.evaluate(() => calls.filter((c) => c.type === 'request').length);
  const selectValueAfterCancel = await row(f, 1).locator('select.simple-project').inputValue();
  assert.equal(dialogs.length, 1, 'C2: confirm dialog shown before transfer');
  assert.equal(requestsAfterCancel, requestsBeforeCancel, 'C2: Cancel makes 0 network requests');
  assert.equal(selectValueAfterCancel, repo, 'C2: Cancel resets select value to source repo');
  results.push({
    check: 'C2-saved-project-change-cancel',
    dialogs: [...dialogs],
    requestsDelta: requestsAfterCancel - requestsBeforeCancel,
    selectValueAfterCancel,
    mutationsDelta: (await mutations(page)).length - mutationsBeforeCancel,
  });

  // 6. C2 (D55): Confirmed transfer moves issue via GraphQL transferIssue; ambiguous failure locks unconfirmed
  acceptDialog = true;
  await row(f, 1).locator('select.simple-project').selectOption(other);
  await pause(page);
  assert.equal(dialogs.length, 2, 'C2: second transfer attempt prompts confirm');
  const transferredRowCount = await row(f, 19, other).count();
  assert.equal(transferredRowCount, 1, 'C2: confirmed transfer updates row to other#19');

  await page.evaluate(() => {
    controls.lostTransfer = true;
  });
  await row(f, 2, repo).locator('select.simple-project').selectOption(other);
  await pause(page);
  const row2Unconfirmed = await row(f, 2, repo).evaluate((el) => ({
    hasClass: el.classList.contains('simple-row-unconfirmed'),
    hasBadge: Boolean(el.querySelector('.badge-unconfirmed')),
    selectDisabled: Boolean(el.querySelector('select.simple-project')?.disabled),
    titleDisabled: Boolean(el.querySelector('input.simple-title')?.disabled),
  }));
  assert.equal(row2Unconfirmed.hasClass, true, 'C2: ambiguous GraphQL failure marks row unconfirmed');
  assert.equal(row2Unconfirmed.hasBadge, true, 'C2: unconfirmed badge shown');
  assert.equal(row2Unconfirmed.selectDisabled, true, 'C2: select disabled while unconfirmed');
  results.push({ check: 'C2-confirmed-and-unconfirmed-lock', transferredRowCount, row2Unconfirmed });
  await snap(page, 'transfer-confirmed-and-unconfirmed-locked');
  await page.close();

  // 7. H3: Cross-project Graph view preserves colliding #1 issues across repositories
  ({ page, f } = await open());
  await f.locator('#btnRepoSelect').click();
  await f.locator('.all-projects-option').click();
  await pause(page);
  const listTitles = await rows(f).locator('.simple-title').allTextContents();
  await view(f, 'Graph');
  await pause(page);
  const graphTitles = await f.locator('.graph-card-title').allTextContents();
  assert.equal(graphTitles.length, 7, 'H3: all 7 issues across both repos render in All Projects Graph view');
  assert.ok(graphTitles.includes('First unmarked idea'), 'H3: repo 1 #1 is present in Graph view');
  assert.ok(graphTitles.includes('Other project same issue number'), 'H3: repo 2 #1 is present in Graph view');
  results.push({ check: 'H3-graph-same-number', listTitles, graphTitles });
  await snap(page, 'graph-all-projects-both-visible');
  await page.close();

  // 8. C1 (first-gesture switch to Manual order) + M2(c) (failed description PATCH keeps text)
  ({ page, f } = await open('marked'));
  await filter(f, 'stage:draft');
  // In priority sort, #1 (important) is index 0, #3 (useful) is index 1, #2 (normal) is index 2.
  // Pressing Alt+ArrowUp on #3 switches Sort to Manual order AND moves #3 above #1 on the FIRST gesture!
  await row(f, 3).focus();
  await row(f, 3).press('Alt+ArrowUp');
  await pause(page);
  assert.equal(await f.locator('#selectSort').inputValue(), 'manual', 'C1: switches #selectSort to manual');
  const titlesAfterFirstGesture = await rows(f).locator('input.simple-title').evaluateAll((es) => es.map((e) => e.value));
  assert.equal(titlesAfterFirstGesture[0], 'Third unmarked idea', 'C1: #3 moves to top on the first gesture');
  await row(f, 1).dragTo(row(f, 2));
  await pause(page);
  await f.locator('#draftCaptureTitle').fill('Captured twice-Enter guarded');
  await f.locator('#draftCaptureTitle').press('Shift+Enter');
  await f.locator('#draftCaptureDescription').fill('Inspiration only');
  await f.locator('#draftCaptureDescription').press('Enter');
  await pause(page);
  const calls = await page.evaluate(() => window.calls);
  const sessionCalls = calls.filter((c) => /session.*start|start.*session/.test(c.type));
  assert.equal(sessionCalls.length, 0, 'Quick capture never starts an AI session');
  results.push({
    check: 'C1-marked-first-gesture-and-create',
    titlesAfterFirstGesture,
    mutations: await mutations(page),
    sessionCalls,
  });

  await page.evaluate(() => (controls.failCreate = true));
  await f.locator('#draftCaptureTitle').fill('Keep offline idea');
  await f.locator('#draftCaptureTitle').press('Enter');
  await pause(page);
  assert.equal(await f.locator('#draftCaptureTitle').inputValue(), 'Keep offline idea');

  await page.evaluate(() => (controls.failPatch = true));
  await row(f, 2).locator('textarea').fill('DO NOT LOSE THIS EDIT');
  await row(f, 2).locator('textarea').press('Enter');
  await pause(page);
  const failedDescVal = await row(f, 2).locator('textarea').inputValue();
  assert.equal(failedDescVal, 'DO NOT LOSE THIS EDIT', 'M2: failed description PATCH preserves unsaved text');
  results.push({
    check: 'M2-failed-description-value',
    value: failedDescVal,
    toasts: await page.evaluate(() => calls.filter((c) => c.type === 'toast').map((c) => c.payload)),
  });
  await snap(page, 'failed-description-preserved');
  await page.close();

  // 9. M2(a): Browser refresh with focused unsaved inline edit preserves typing without spurious write
  ({ page, f } = await open());
  await filter(f, 'stage:draft');
  await row(f, 1).locator('textarea').fill('UNSAVED TYPING');
  await f.locator('#btnRefresh').evaluate((el) => el.click());
  await pause(page);
  const refreshTypingVal = await row(f, 1).locator('textarea').inputValue();
  const refreshTypingMutations = await mutations(page);
  assert.equal(refreshTypingVal, 'UNSAVED TYPING', 'M2: refresh during typing preserves unsaved textarea value');
  assert.equal(refreshTypingMutations.length, 0, 'M2: refresh during typing does not fire spurious PATCH');
  results.push({ check: 'M2-refresh-during-typing', value: refreshTypingVal, mutations: refreshTypingMutations });
  await page.close();

  // 10. Question inline answer & Pending human task completion
  ({ page, f } = await open());
  await filter(f, 'questions');
  await f.locator('.btn-inline-answer').first().click();
  await snap(page, 'question-answer-open');
  const answer = f.locator('#questionsViewContainer .input-inline-answer').first();
  await answer.fill('Use blue');
  const send = f.locator('#questionsViewContainer button').filter({ hasText: /Submit|Save|Send/ }).first();
  if (await send.count()) await send.click();
  await pause(page);
  results.push({ check: 'question-saved', mutations: await mutations(page) });
  await f.locator('#activeFilters').getByRole('button', { name: 'Clear', exact: true }).click();
  await view(f, 'Pending');
  const checkbox = f.locator('.human-todo-item input[type=checkbox]').first();
  if (await checkbox.count()) {
    await checkbox.check();
    await pause(page);
  }
  results.push({ check: 'pending-completion', mutations: await mutations(page) });
  await page.close();

  // 11. H2: Fenced board-order example and CRLF line endings preserved
  ({ page, f } = await open('fences'));
  await filter(f, 'stage:draft');
  const fencedTextareaVal = await row(f, 1).locator('textarea').inputValue();
  assert.ok(fencedTextareaVal.includes('<!-- board-order: 777 -->'), 'H2: fenced board-order example is preserved in textarea');
  assert.ok(!fencedTextareaVal.includes('<!-- board-order: 1000 -->'), 'H2: terminal board-order marker is hidden in textarea');
  // Blurring without editing must not PATCH due to CRLF->LF normalization
  await row(f, 1).locator('textarea').focus();
  await row(f, 1).locator('textarea').evaluate((el) => el.blur());
  await pause(page);
  assert.equal((await mutations(page)).length, 0, 'H2: CRLF-normalized blur without edit performs 0 PATCHes');
  // Editing and saving preserves CRLF, fenced marker, and terminal marker
  await row(f, 1).locator('textarea').fill(fencedTextareaVal.replace('Keep this', 'Keep this updated'));
  await row(f, 1).locator('textarea').press('Enter');
  await pause(page);
  const remoteFencedBody = await page.evaluate(() => items[0].body);
  assert.ok(remoteFencedBody.includes('\r\n'), 'H2: CRLF line endings preserved on save');
  assert.ok(remoteFencedBody.includes('<!-- board-order: 777 -->'), 'H2: fenced marker preserved on save');
  assert.ok(remoteFencedBody.endsWith('\r\n\r\n<!-- board-order: 1000 -->'), 'H2: terminal marker preserved with CRLF');
  results.push({ check: 'H2-fenced-inline-body', value: fencedTextareaVal, remote: remoteFencedBody });
  await snap(page, 'fenced-sample-preserved');
  await page.close();

  assert.equal(errors.length, 0, `Expected 0 pageErrors, got: ${JSON.stringify(errors)}`);
  results.push({ check: 'runtime-errors', pageErrors: errors, console: consoles });
  fs.writeFileSync(out + '/logs/browser-results.json', JSON.stringify(results, null, 2));
  console.log('ALL BROWSER CHECKS PASSED:', results.length);
} catch (error) {
  fs.writeFileSync(out + '/logs/browser-partial.json', JSON.stringify({ results, errors, consoles, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
