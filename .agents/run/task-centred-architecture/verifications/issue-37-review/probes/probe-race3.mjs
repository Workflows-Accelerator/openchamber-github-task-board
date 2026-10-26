import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { buildIssueDetail, buildBoardList } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/server/board.ts';
import { makeIssue } from '/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/tests/fake-github.mjs';
const repo=(n,id)=>({owner:'owner',name:n,full:'owner/'+n,id,archived:false,hasIssues:true});
const alpha=repo('alpha',101), beta=repo('beta',102);
const raw=(t='Same')=>makeIssue({number:1,title:t,body:'## Overview\nOriginal\n\n## Open Questions\n- [ ] Decide?\n',labels:['status:todo']});
const detail=r=>buildIssueDetail(raw(),r);
const board=r=>({scope:'repo',repository:r,repo:r.full,issues:buildBoardList([raw(r.name+' task')],r).issues,partial:false,complete:true,failures:[]});
const options=[{value:'status:todo',label:'Todo'},{value:'status:done',label:'Done'}];
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};
function node(){let text='';return {children:[],value:'',hidden:false,disabled:false,options:[],className:'',
 get textContent(){return text;},set textContent(v){text=v;this.children=[];},
 setAttribute(k,v){this[k]=v;if(k==='id')elements.set(v,this);},removeAttribute(k){delete this[k];},
 appendChild(c){this.children.push(c);},addEventListener(){},focus(){},querySelector(){return get('empty-p');}};}
let releaseWrite; const writeGate=new Promise(r=>{releaseWrite=r;});
const calls=[];
const context=vm.createContext({document:{getElementById:get,createElement:node},
 window:{setTimeout:f=>f(),setInterval(){},addEventListener(){},location:{hash:''},localStorage:{getItem:()=>null,setItem(){}}},
 fetch:async(path,request)=>{calls.push({path,method:request.method});
   if(path==='/api/repos') return {ok:true,status:200,text:async()=>JSON.stringify({fetchedAt:new Date().toISOString(),freshnessMs:60000,stale:false,discoveryFailed:false,error:null,visibleCount:2,repositories:[{...alpha,available:true,lastSeenAt:''},{...beta,available:true,lastSeenAt:''}]})};
   if(path==='/api/repos/owner/beta/board') return {ok:true,status:200,text:async()=>JSON.stringify(board(beta))};
   if(path.endsWith('/section')){ await writeGate; return {ok:true,status:200,text:async()=>JSON.stringify({issue:detail(alpha),statusOptions:options})}; }
   return {ok:true,status:200,text:async()=>JSON.stringify({issue:detail(alpha),statusOptions:options})};
 }});
const source=readFileSync('/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/web/public/app.js','utf8').replace('  boot();','  window.__app={state,loadBoard,saveOverview,renderBoard};');
vm.runInContext(source,context);
const app=context.window.__app;
app.state.detail=detail(alpha);app.state.statusOptions=options;app.state.board=board(alpha);app.state.selected='alpha';
get('overview-text').value='Changed';
console.log('BEFORE board', app.state.board && app.state.board.repo); const saving=app.saveOverview();
app.state.selected='owner/beta';
const loading=app.loadBoard();
releaseWrite();
await saving; await loading;
console.log('AFTER detail', app.state.detail && app.state.detail.number); const sel=app.state.repositories.repositories.find(r=>r.full===app.state.selected); console.log('SEL',JSON.stringify(sel)); console.log('REPOS',JSON.stringify(app.state.repositories)); console.log('NOTICE',get('notice').textContent,'EMPTY',get('empty-p').textContent); console.log(JSON.stringify({boardRepo:app.state.board&&app.state.board.repo, selected:app.state.selected, repoLabel:get('repo-label').textContent, refreshDisabled:get('refresh-btn').disabled, calls:calls.map(c=>c.method+' '+c.path)}));
