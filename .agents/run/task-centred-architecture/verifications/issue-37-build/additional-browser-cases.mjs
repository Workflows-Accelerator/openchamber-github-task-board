// #37 adaptation: qualified paths/output only; original assertions preserved.
// Independent source-derived variants. Imported only by additional-browser.mjs.
// Every case runs through real HTTP board/gateway/browser, all three save paths.
export function extraCases(buildIssueDetail, makeIssue) {
  const set = (key, value) => p => { p.issue[key] = value; return p; };
  const change = (key, field, value) => p => { p.issue[key][0][field] = value; return p; };
  const remove = key => p => { delete p.issue[key]; return p; };
  const cases = [
    ['arrayIssue', p => { p.issue=[]; return p; }],
    ['booleanIdentity', set('number',true)],
    ['fractionalIdentity', set('number',1.5)],
    ['emptyFingerprint', set('fingerprint','')],
    ['objectFingerprint', set('fingerprint',{})],
    ['objectTitle', set('title',{})],
    ['invalidState', set('state','pending')],
    ['objectUpdatedAt', set('updatedAt',{})],
    ['missingPhase', remove('phase')],
    ['missingAttention', remove('attention')],
    ['nullPhase', set('phase',null)],
    ['objectAttention', set('attention',{})],
    ['sectionArrayEntry', set('editableSections',[[]])],
    ['sectionMissingId', p => {delete p.issue.editableSections[0].id;return p;}],
    ['sectionObjectText', change('editableSections','text',{})],
    ['sectionNullTitle', change('editableSections','title',null)],
    ['questionStringText', set('openQuestions',[{index:0,answerIndex:0,completed:false,text:42}])],
    ['questionStringCompleted', set('openQuestions',[{index:0,answerIndex:0,completed:'false',text:'Question?'}])],
    ['questionMissingSourceIndex', set('openQuestions',[{answerIndex:0,completed:false,text:'Question?'}])],
    ['questionNonSequentialIndex', set('openQuestions',[{index:0,answerIndex:2,completed:false,text:'Question?'}])],
    ['questionAnsweredRoutable', set('openQuestions',[{index:0,answerIndex:0,completed:true,text:'Done?'}])],
    ['questionOpenNullRoute', set('openQuestions',[{index:0,answerIndex:null,completed:false,text:'Question?'}])],
    ['questionDuplicateRoutes', set('openQuestions',[{index:0,answerIndex:0,completed:false,text:'One?'},{index:1,answerIndex:0,completed:false,text:'Two?'}])],
    ['humanStringCompleted', set('humanTasks',[{text:'Human',completed:'false'}])],
    ['humanObjectText', set('humanTasks',[{text:{},completed:false}])],
    ['humanArrayEntry', set('humanTasks',[[]])],
    ['acceptancePartial', set('acceptanceCriteria',[{}])],
    ['subtaskStringCompleted', set('subtasks',[{text:'Subtask',completed:'false'}])],
    ['nestedOptionsFallback', p => {p.issue.statusOptions=p.statusOptions;delete p.statusOptions;return p;}],
    ['optionObjectValue', p => {p.statusOptions[0].value={};return p;}],
    ['optionNullLabel', p => {p.statusOptions[0].label=null;return p;}],
    ['optionArrayEntry', p => {p.statusOptions=[[]];return p;}],
  ];
  const bodies = [
    '',
    '## Open Questions\n- [x] Done? *(Answer: yes)*\n- [ ] Open?\n  continuation\n  - [ ] Nested?\n',
    '## Overview\n\n## Human Tasks\n- [ ] Keep\n- [x] Finished\n\n## Acceptance Criteria\n- [x] Accepted\n\n## Subtasks\n- [ ] Work\n',
    '\uFEFFIntro\r\n\r\n## Open Questions\r\n- [x] Done?\r\n- [ ] First?\r\n- [x] Also done?\r\n- [ ] Last?\r\n',
    '## Overview\nBefore\n\n## Open Questions\n~~~text\n- [ ] Fenced?\n~~~\n \t- [ ] Mixed code?\n- [ ] Actual?\n',
  ];
  for (const [index,body] of bodies.entries()) {
    cases.push(['validProducer'+index, p => ({...p,issue:buildIssueDetail(makeIssue({number:1,body,state:index===2?'closed':'open',labels:index%2?['status:todo','phase:execution','attention:needs-decision']:[],updated_at:index===0?null:'2026-10-20T10:00:00Z'}), p.issue.repository)})]);
  }
  cases.push(['validNullableEmpty', p => {Object.assign(p.issue,{title:'',statusLabel:null,updatedAt:null,phase:'',attention:'',editableSections:[],openQuestions:[],humanTasks:[],acceptanceCriteria:[],subtasks:[]});p.statusOptions=[];return p;}]);
  cases.push(['validUnusedFieldsAbsent', p => {for(const key of ['htmlUrl','body','labels','column','createdAt','testPlan'])delete p.issue[key];delete p.savedAt;return p;}]);
  return cases;
}
