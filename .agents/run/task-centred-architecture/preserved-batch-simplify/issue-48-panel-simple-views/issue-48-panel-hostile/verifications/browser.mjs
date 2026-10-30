import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from '/workspace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const root = process.cwd(), out = root + '/.agents/run/issue-48-panel-hostile/verifications';
const repo = 'acme/openchamber-github-task-board', other = 'acme/very-long-project-name-for-narrow-layout';
function data(mode) {
  const issues = [
    {number:1,title:'First unmarked idea',body:'Inspiration one',labels:['status:draft','priority:important']},
    {number:2,title:'Second unmarked idea',body:'',labels:['status:draft']},
    {number:3,title:'Third unmarked idea',body:'Inspiration three',labels:['status:draft','priority:useful']},
    {number:4,title:'Choose the next step',body:'### Human Tasks:\n- [ ] Inspect the preview\n\n### Open Questions:\n- [ ] Which colour should we use?',labels:['status:needs-human','attention:needs-decision','priority:critical']},
    {number:5,title:'Review toolbar',body:'Review details',labels:['status:in-review','attention:needs-review']},
    {number:6,title:'Completed task',body:'Done context',labels:['status:done']},
    {number:1,repo:other,title:'Other project same issue number',body:'Other inspiration',labels:['status:draft']}
  ];
  if(mode==='marked') for(const i of issues) if(i.number<=3) i.body += '\n\n<!-- board-order: '+(i.number*1000)+' -->';
  if(mode==='fences') issues[0].body='Sample:\r\n```html\r\n<!-- board-order: 777 -->\r\n```\r\n\r\n\r\n### Human Tasks:\r\n- [ ] Keep this\r\n\r\n<!-- board-order: 1000 -->';
  return issues.map((i,idx)=>({...i,repo:i.repo||repo,node_id:'ISSUE_'+idx,state:'open',labels:i.labels.map(name=>({name})),created_at:`2026-10-0${idx+1}T10:00:00Z`,updated_at:`2026-10-1${idx+1}T10:00:00Z`,html_url:`https://github.com/${i.repo||repo}/issues/${i.number}`,user:{login:'fixture'}}));
}
function fixture(mode) {return `<!doctype html><script>
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
  if(p.path==='/graphql'){if(controls.lostTransfer){reply(null,false,'Synthetic response lost');return;}send({data:{transferIssue:{issue:{number:19,url:'https://github.com/'+other+'/issues/19',repository:{nameWithOwner:other}}}}});return;}
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
</script><style>body{margin:0;background:#111214}iframe{width:100%;height:100vh;border:0;display:block}</style><iframe src='/panel/index.html'></iframe>`;}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/'){res.setHeader('content-type','text/html');res.end(fixture(u.searchParams.get('mode')));return;}
 if(['/panel/index.html','/panel/main.js'].includes(u.pathname)){res.setHeader('content-type',u.pathname.endsWith('html')?'text/html':'text/javascript');res.end(fs.readFileSync(root+u.pathname));return;}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});
const results=[], errors=[], consoles=[];
async function open(mode='unmarked',width=980){const page=await browser.newPage({viewport:{width,height:780}});await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')consoles.push(m.text());});await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);const f=page.frames().find(f=>f.url().includes('/panel/index.html'));await f.locator('.simple-row').first().waitFor();await page.waitForTimeout(180);return {page,f};}
const pause=page=>page.waitForTimeout(130);
const view=async(f,id)=>{await f.locator('#btnViewSelect').click();await f.locator('#viewOpt'+id).click();};
const filter=async(f,token)=>{await f.locator('#btnFilterToggle').click();const chip=f.locator('[data-filter="'+token+'"]');const box=await chip.boundingBox();if(box.x<0){results.push({check:'filter-offscreen',token,box,popover:await f.locator('#filterPopover').boundingBox()});await snap(f.page(),'filter-offscreen-'+f.page().viewportSize().width);await chip.focus();await chip.press('Enter');}else await chip.click();await f.locator('#btnFilterToggle').click();};
const rows=f=>f.locator('.simple-row');
const row=(f,n,r=repo)=>f.locator('[data-draft-key="'+r+'#'+n+'"]');
const mutations=page=>page.evaluate(()=>calls.filter(c=>c.type==='request'&&c.payload.method!=='GET').map(c=>c.payload));
const snap=async(page,name)=>{await page.screenshot({path:out+'/screenshots/'+name+'.png'});};
try {
 // Independently render every surface, both widths, including synthetic All Projects collisions.
 let {page,f}=await open();
 for(const width of [980,360]){
  await page.setViewportSize({width,height:780});
  for(const id of ['Simple','Cards','Kanban','Graph','Pending']){await view(f,id);await snap(page,id.toLowerCase()+'-'+width);results.push({check:'render-'+id,width,layout:await f.locator('body').getAttribute('data-layout')});}
  await view(f,'Simple');await filter(f,'stage:draft');await f.locator('#selectSort').selectOption('manual');await snap(page,'draft-'+width);
  results.push({check:'draft-geometry',width,geometry:await f.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,add:document.querySelector('.simple-add').getBoundingClientRect().toJSON(),touchButtons:[...document.querySelectorAll('.simple-row button')].map(b=>b.textContent)}))});
  await f.locator('#activeFilters').getByRole('button',{name:'Clear',exact:true}).click();
 }
 // All-unmarked: first draft down one cannot be represented, no write.
 await filter(f,'stage:draft');await f.locator('#selectSort').selectOption('manual');await row(f,1).focus();await row(f,1).press('Alt+ArrowDown');await pause(page);
 results.push({check:'unmarked-down',mutations:await mutations(page),titles:await rows(f).locator('input.simple-title').evaluateAll(es=>es.map(e=>e.value)),toasts:await page.evaluate(()=>calls.filter(c=>c.type==='toast').map(c=>c.payload))});
 await snap(page,'unmarked-down-refused');
 // Saved title edits lose focus on Tab and abandon adjacent draft contents during render.
 await row(f,1).locator('input').fill('Renamed with keyboard');await row(f,1).locator('input').press('Tab');await pause(page);
 results.push({check:'title-tab-focus',focus:await f.evaluate(()=>({tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label')}))});
 // No actual confirm: select saved draft project while browser would cancel every dialog.
 await f.locator('#btnRepoSelect').click();await f.locator('.all-projects-option').click();await pause(page);
 const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 await row(f,1).locator('select').selectOption(other);await pause(page);
 results.push({check:'saved-project-change-with-cancel-policy',dialogs,hostConfirms:await page.evaluate(()=>confirms),mutations:await mutations(page)});
 await page.close();
 // Cross-project graph collision: two #1 issues are present in list but only one Graph node.
 ({page,f}=await open());await f.locator('#btnRepoSelect').click();await f.locator('.all-projects-option').click();await pause(page);
 const listTitles=await rows(f).locator('.simple-title').allTextContents();await view(f,'Graph');
 results.push({check:'graph-same-number',listTitles,graphTitles:await f.locator('.graph-card-title').allTextContents()});await snap(page,'graph-all-projects-collision');await page.close();
 // Positive marked reorder, explicit visible switch to Manual, drag, capture/description/no-session.
 ({page,f}=await open('marked'));await filter(f,'stage:draft');await row(f,3).focus();await row(f,3).press('Alt+ArrowUp');await pause(page);
 assert.equal(await f.locator('#selectSort').inputValue(),'manual');await row(f,3).press('Alt+ArrowUp');await pause(page);await row(f,1).dragTo(row(f,2));await pause(page);
 await f.locator('#draftCaptureTitle').fill('Captured twice-Enter guarded');await f.locator('#draftCaptureTitle').press('Shift+Enter');await f.locator('#draftCaptureDescription').fill('Inspiration only');await f.locator('#draftCaptureDescription').press('Enter');await pause(page);
 const calls=await page.evaluate(()=>window.calls);results.push({check:'marked-reorder-and-create',mutations:await mutations(page),sessionCalls:calls.filter(c=>/session.*start|start.*session/.test(c.type))});
 // Offline creation keeps contents, description PATCH rejection discards user's edit.
 await page.evaluate(()=>controls.failCreate=true);await f.locator('#draftCaptureTitle').fill('Keep offline idea');await f.locator('#draftCaptureTitle').press('Enter');await pause(page);assert.equal(await f.locator('#draftCaptureTitle').inputValue(),'Keep offline idea');
 await page.evaluate(()=>controls.failPatch=true);await row(f,2).locator('textarea').fill('DO NOT LOSE THIS EDIT');await row(f,2).locator('textarea').press('Enter');await pause(page);
 results.push({check:'failed-description-value',value:await row(f,2).locator('textarea').inputValue(),toasts:await page.evaluate(()=>calls.filter(c=>c.type==='toast').map(c=>c.payload))});await snap(page,'failed-description-discarded');await page.close();
 // Browser refresh with focused unsaved inline edit destroys it without blur saving.
 ({page,f}=await open());await filter(f,'stage:draft');await row(f,1).locator('textarea').fill('UNSAVED TYPING');
 // Trigger actual refresh button via DOM click without changing focus (same as scheduled render).
 await f.locator('#btnRefresh').evaluate(el=>el.click());await pause(page);
 results.push({check:'refresh-during-typing',value:await row(f,1).locator('textarea').inputValue(),mutations:await mutations(page)});await page.close();
 // Question answer remains actionable from simple filter; Pending completion is a body write not Done.
 ({page,f}=await open());await filter(f,'questions');await f.locator('.btn-inline-answer').first().click();
 results.push({check:'question-answer-controls',textareas:await f.locator('#questionsViewContainer textarea').count(),buttons:await f.locator('#questionsViewContainer button').allTextContents()});await snap(page,'question-answer-open');
 const answer=f.locator('#questionsViewContainer .input-inline-answer').first();await answer.fill('Use blue');
 const send=f.locator('#questionsViewContainer button').filter({hasText:/Submit|Save|Send/}).first();if(await send.count())await send.click();await pause(page);
 results.push({check:'question-saved',mutations:await mutations(page)});
 await f.locator('#activeFilters').getByRole('button',{name:'Clear',exact:true}).click();await view(f,'Pending');
 const checkbox=f.locator('.human-todo-item input[type=checkbox]').first();if(await checkbox.count()){await checkbox.check();await pause(page);}
 results.push({check:'pending-completion',mutations:await mutations(page)});await page.close();
 // Fenced example is missing from visible textarea before any writes.
 ({page,f}=await open('fences'));await filter(f,'stage:draft');results.push({check:'fenced-inline-body',value:await row(f,1).locator('textarea').inputValue(),remote:await page.evaluate(()=>items[0].body)});await snap(page,'fenced-sample-stripped');await page.close();
 results.push({check:'runtime-errors',pageErrors:errors,console:consoles});
 fs.writeFileSync(out+'/logs/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} catch(error){fs.writeFileSync(out+'/logs/browser-partial.json',JSON.stringify({results,errors,consoles},null,2));throw error;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
