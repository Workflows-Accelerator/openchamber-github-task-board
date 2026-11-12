import json,hashlib
from pathlib import Path
OUT=Path(__file__).resolve().parent.parent
def load(p):return json.loads((OUT/p).read_text())
before=load('before/independent-browser.json')
after=load('after-final/independent-browser.json')
completion_before=load('before/completion-browser-corrected.json')
completion_after=load('after-final/completion-browser-corrected.json')
targeted=load('targeted.json')
r1=[]
for a,b in zip(before['framing'],after['framing']):
    def metrics(x):
        a=x['auto'];e=x['after']
        return {'automaticScale':a['scale'],'selectedInside':all(c['inside'] for c in a['cards'] if c['role']=='selected'),'minimumSelectedTitlePx':min(c['effectiveTitlePx'] for c in a['cards'] if c['role']=='selected'),'explicitScale':e['scale'] if e else None,'explicitMissing':[c['key'] for c in e['cards'] if c['role'] and c['role']!='unrelated' and not c['inside']] if e else [],'explicitWarning':e['legend']['hasOffscreenNote'] if e else None,'explicitShowAll':e['legend']['hasShowAll'] if e else None,'explicitMisleadingLabels':[l['text'] for l in e['labels'] if not l['hidden'] and l['anyEndpointFullyOutside']] if e else [],'legacyAllContained':e.get('legacyAllContained') if e else None}
    r1.append({k:b[k] for k in ['fixture','width','lang','theme']}|{'before':metrics(a),'after':metrics(b)})
summary={'browser':after['browserVersion'],'r1':{'cases':r1,'caseCount':len(r1),'afterFailures':after['failures'],'legacyAllContainedFalseCases':[dict(fixture=x['fixture'],width=x['width'],lang=x['lang'],theme=x['theme']) for x in r1 if x['after']['legacyAllContained'] is False],'legacyDisposition':'D39 accepts incomplete at 0.2 only with truthful visible zoom-limit feedback and hidden absent-endpoint labels. legacyAllContained=false is NOT geometric PASS.'},'r2':{'before':completion_before['focusFilter'],'after':completion_after['focusFilter'],'targetedCases':targeted['r2'],'caseCount':len(targeted['r2']),'completionFailures':completion_after['failures']},'geometry':{'caseCount':len(targeted['r1']),'failures':targeted['failures']},'suites':{name:load('smoke/smoke.json') if name=='smoke' else None for name in ['smoke']},'source':load('tested-source.json')}
(OUT/'measurements-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'r1Cases':len(r1),'r1LegacyGeometricFalse':len(summary['r1']['legacyAllContainedFalseCases']),'targetedR1':len(targeted['r1']),'targetedR2':len(targeted['r2']),'afterIndependentFailures':len(after['failures']),'afterCompletionFailures':len(completion_after['failures']),'targetedFailures':len(targeted['failures']),'smokeSections':len(summary['suites']['smoke']),'smokeFailures':sum(x['verdict']!='PASS' for x in summary['suites']['smoke'])},indent=2))
