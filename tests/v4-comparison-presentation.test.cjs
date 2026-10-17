const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM, VirtualConsole} = require('jsdom');
const nativeDialog = require('./helpers/native-dialog.cjs');
process.env.TZ = 'Europe/Warsaw';
const stamp = ms => new Date(Date.UTC(2026,0,1) + ms).toISOString();
const row = (id, ms=0, item_id='a') => ({id,item_id,timestamp:new Date(stamp(ms)),automationName:`Automation ${item_id}`,automationEntity:`automation.${item_id}`,status:'success',duration:1000,trigger:'fixture',raw:{}});
const full = (id, entries=[['action/0',0]], item_id='a') => ({domain:'automation',item_id,run_id:id,state:'stopped',script_execution:'finished',timestamp:{start:stamp(0),finish:stamp(1000)},trace:Object.fromEntries(entries.map(([p,ms]) => [p,[{path:p,timestamp:stamp(ms)}]]))});
function fixture(t, rows=[row('old'),row('new',10000)], responder=req=>full(req.run_id)) {
  const dom=new JSDOM('',{runScripts:'outside-only',url:'http://qa.invalid',virtualConsole:new VirtualConsole()});
  nativeDialog(dom.window); dom.window.ResizeObserver=class {observe(){} disconnect(){}};
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  dom.window.eval(fs.readFileSync('ha-trace-viewer.js','utf8'));
  const card=dom.window.document.createElement('ha-trace-viewer');
  dom.window.document.body.append(card);
  const requests=[];
  card._hass={language:'en',locale:{time_format:'24'},config:{time_zone:'Asia/Tokyo'},user:{id:'admin',is_admin:true},connection:{connected:true},states:{},callWS:async req=>{requests.push(req);return responder(req);}};
  card._comparisonConnectionState=true;card._lang='en';card.viewMode='all-traces';card.groupBy='none';card.traces=rows;card._allFlatTraces=rows;card.render();
  t.after(()=>{card.remove();dom.window.close();});
  return {card,dom,rows,requests};
}
async function compare(f){f.rows.slice(0,2).forEach(r=>f.card._toggleComparisonRun(r));await f.card._compareSelectedRuns();}

test('two elapsed lanes retain true zero, gaps and Analyzer first difference above the point list',async t=>{
 const f=fixture(t,undefined,req=>full(req.run_id,req.run_id==='old'?[['stable/0',0],['removed/0',10],['later/0',100]]:[['stable/0',0],['added/0',20],['later/0',240]]));
 await compare(f);
 const root=f.card.shadowRoot,lanes=root.querySelectorAll('[data-comparison-lane]');
 assert.equal(lanes.length,2);
 assert.equal(lanes[0].querySelector('[data-path="stable/0"]').dataset.offsetMs,'0');
 assert.equal(lanes[1].querySelector('[data-path="later/0"]').dataset.offsetMs,'240');
 assert.equal(lanes[1].querySelector('[data-path="removed/0"]').hasAttribute('data-offset-ms'),false);
 assert.match(lanes[1].querySelector('[data-path="removed/0"]').textContent,/Not recorded/);
 assert.equal(lanes[0].querySelector('[data-path="added/0"]').hasAttribute('data-offset-ms'),false);
 const first=root.querySelector('[data-comparison-conclusion]');
 assert.match(first.textContent,/removed\/0/);
 assert.ok(first.compareDocumentPosition(root.querySelector('.comparison-points'))&4);
 assert.equal(root.querySelectorAll('[data-comparison-first="true"]').length,2);
 assert.match(root.querySelector('#comparisonFirstDifference').textContent,/removed\/0/);
 assert.equal(f.requests.length,2);
});

test('one missing capability keeps the available lane visible without fake zero or export',async t=>{
 const f=fixture(t,undefined,req=>{if(req.run_id==='new')throw {code:'not_found'};return full('old',[['action/0',75]]);});
 await compare(f);
 const root=f.card.shadowRoot;
 assert.equal(root.querySelectorAll('[data-comparison-lane]').length,2);
 assert.equal(root.querySelector('[data-comparison-lane="0"] [data-offset-ms]').dataset.offsetMs,'75');
 assert.equal(root.querySelector('[data-comparison-lane="1"] [data-offset-ms]'),null);
 assert.match(root.querySelector('[data-comparison-lane="1"]').textContent,/unavailable|No data/i);
 assert.equal(root.querySelector('#exportComparison'),null);
 assert.doesNotMatch(root.querySelector('[data-comparison-conclusion]').textContent,/identical/i);
});

test('previous retained run ignores filters and other automations and reuses bound current detail',async t=>{
 const rows=[row('new',30000),row('wrong',29000,'b'),row('previous',20000),row('older',10000),row('same-time',30000)];
 const f=fixture(t,rows);
 f.card.traceDetail=f.card._buildDetail(rows[0],full('new'));f.card._comparisonDetailSourceEpoch=f.card._comparisonSourceEpoch;
 f.card.traces=[rows[0]];f.card.searchQuery='hidden previous';f.card.render();
 const button=f.card.shadowRoot.querySelector('#comparePreviousTrace');assert.ok(button);assert.equal(button.disabled,false);
 assert.match(button.textContent,/previous retained run/i);
 button.click();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.requests.map(r=>r.run_id),['previous']);
 assert.deepEqual(Array.from(f.card._comparisonView.runs,r=>r.id),['previous','new']);
});

test('equal-time or unknown-date runs do not claim a previous retained run',t=>{
 const current=row('new',10000),unknown={...row('unknown'),timestamp:null};
 const f=fixture(t,[current,row('equal',10000),unknown,row('other',5000,'b')]);
 f.card.traceDetail=f.card._buildDetail(current,full('new'));f.card.render();
 const button=f.card.shadowRoot.querySelector('#comparePreviousTrace');assert.ok(button);assert.equal(button.disabled,true);
 assert.match(f.card.shadowRoot.textContent,/No earlier retained run/);assert.equal(f.requests.length,0);
});

test('friendly dates use system zone, explicit server/clock and DST offsets including epoch zero',t=>{
 const {card}=fixture(t);
 assert.match(card._fmtTime(new Date('2026-10-25T00:30:00Z')),/02:30.*GMT\+2/);
 assert.match(card._fmtTime(new Date('2026-10-25T01:30:00Z')),/02:30.*GMT\+1/);
 assert.match(card._fmtTime(new Date(0)),/1970/);
 assert.equal(card._fmtTime(null),'Date unavailable');
 card._hass.locale={time_zone:'server',time_format:'12'};
 assert.match(card._fmtTime(new Date('2026-10-25T00:30:00Z')),/09:30.*AM.*GMT\+9/i);
 card._hass.locale={language:'pl',time_format:'24'};card._lang='pl';
 assert.match(card._fmtDur(1500),/1,5/);
});

test('same hass profile mutation reformats loaded comparison without fetching or losing selection',async t=>{
 const f=fixture(t);await compare(f);
 f.card.updateAutomationData=async()=>{throw new Error('formatting must not fetch');};
 // Establish the setter formatting key, then mutate the same HA object as HA does.
 f.card.hass=f.card._hass;const pair=f.card._comparisonView;
 const before=f.card.shadowRoot.querySelector('#traceComparison time').textContent;
 f.card._hass.locale.time_zone='server';f.card._hass.locale.time_format='12';f.card.hass=f.card._hass;
 assert.notEqual(f.card.shadowRoot.querySelector('#traceComparison time').textContent,before);
 assert.equal(f.card._comparisonView,pair);assert.equal(f.card._comparisonRuns.size,2);assert.equal(f.requests.length,2);
});

test('names use numeric full HA locale without changing trace chronology',t=>{
 const {card}=fixture(t);card._hass.locale={language:'sv'};
 card._rawAutomations=['Å 2','Z 10','Z 2','A 1'].map(name=>({name,status:'success'}));card.sortBy='name';card.applyFiltersAndSort();
 assert.deepEqual(Array.from(card.automations,a=>a.name),['A 1','Z 2','Z 10','Å 2']);
});

test('single filter chip resets locally and returns focus to its control',t=>{
 const f=fixture(t);f.card.timeRange='7d';f.card.traceFilterResult='error';f.card.render();
 const chip=f.card.shadowRoot.querySelector('[data-reset-filter="result"]');assert.ok(chip);chip.click();
 assert.equal(f.card.traceFilterResult,'all');assert.equal(f.card.timeRange,'7d');assert.equal(f.requests.length,0);
 assert.equal(f.card.shadowRoot.activeElement.id,'resSel');
});

test('limits remain in closed disclosure while partial and coverage stay visible',async t=>{
 const f=fixture(t);await compare(f);const root=f.card.shadowRoot;
 const details=root.querySelector('[data-comparison-details]');assert.ok(details);assert.equal(details.open,false);
 assert.match(details.textContent,/20 ms.*25%/);assert.match(details.textContent,/variable values and configuration/);
 assert.match(root.querySelector('[data-comparison-coverage]').textContent,/2.*2/);
 assert.match(root.querySelector('[data-comparison-lane="0"] time').textContent,/2026/);
});

for (const missing of ['unavailable','empty']) test(`partial ${missing} preserves pagination to last available point`,async t=>{
 const entries=Array.from({length:60},(_,i)=>['action/'+i,i*10]);
 const f=fixture(t,undefined,req=>{
  if(req.run_id==='new') {if(missing==='unavailable')throw {code:'not_found'};return full('new',[]);}
  return full('old',entries);
 });await compare(f);
 const root=f.card.shadowRoot;
 assert.match(root.querySelector('#comparisonPageStatus').textContent,/1 \/ 2/);
 const next=root.querySelector('#comparisonNext');assert.ok(next);assert.equal(next.disabled,false);next.click();
 assert.equal(root.querySelector('[data-comparison-lane="0"] [data-path="action/59"]').dataset.offsetMs,'590');
 assert.equal(root.querySelectorAll('[data-comparison-lane="0"] [data-offset-ms]').length,10);
 assert.equal(root.querySelector('#exportComparison'),null);assert.equal(f.requests.length,2);
});

for(const language of ['en','pl']) test(`${language} point status labels preserve Analyzer pass/error/changed/skipped meanings`,async t=>{
 const f=fixture(t,undefined,req=>{
  const raw=full(req.run_id,[['pass/0',0],['error/0',10],['changed/0',20],['skipped/0',30]]);
  raw.trace['error/0'][0].error='Synthetic error';
  raw.trace['changed/0'][0].changed_variables={synthetic:'PRIVATE_VALUE_NOT_FOR_COMPARISON'};
  raw.trace['skipped/0'][0].result=false;return raw;
 });f.card._lang=language;await compare(f);
 const lane=f.card.shadowRoot.querySelector('[data-comparison-lane="0"]');
 const labels=language==='pl'?['Zapisany punkt','Błąd punktu','Zmiana zmiennych','Pominięty']:['Recorded point','Point error','Variables changed','Skipped'];
 ['pass','error','changed','skipped'].forEach((key,i)=>assert.ok(lane.querySelector(`[data-path="${key}/0"]`).textContent.includes(labels[i])));
 assert.doesNotMatch(lane.textContent,/Unconfirmed|Niepotwierdzony|PRIVATE_VALUE_NOT_FOR_COMPARISON/);
});

test('repeated path ordinals remain separate aligned points on both lanes',async t=>{
 const f=fixture(t,undefined,req=>{
  const raw=full(req.run_id,[['repeat/0',0]]);
  raw.trace['repeat/0'].push({path:'repeat/0',timestamp:stamp(req.run_id==='old'?100:240)});return raw;
 });await compare(f);
 const root=f.card.shadowRoot;
 assert.equal(root.querySelectorAll('[data-comparison-lane="0"] [data-path="repeat/0"]').length,2);
 assert.equal(root.querySelector('[data-comparison-lane="1"] [data-ordinal="1"]').dataset.offsetMs,'240');
 assert.match(root.querySelector('[data-comparison-conclusion]').textContent,/repeat\/0 #2.*140/);
});

test('date System follows browser language while HA labels remain Polish',t=>{
 const {card}=fixture(t);card._lang='pl';card._hass.language='pl';card._hass.locale={language:'pl',date_format:'system',time_format:'24'};
 assert.match(card._fmtTime(new Date('2026-01-15T12:00:00Z')),/Jan/);
 card._hass.locale.date_format='language';assert.match(card._fmtTime(new Date('2026-01-15T12:00:00Z')),/sty/);
});

test('changing full locale also reorders already loaded automation names without trace reads',t=>{
 const f=fixture(t);f.card.sortBy='name';f.card._hass.locale={language:'de'};
 f.card._rawAutomations=['Ä 2','Z 2','A 1'].map(name=>({name,status:'success'}));
 f.card.hass=f.card._hass;f.card.applyFiltersAndSort();
 assert.deepEqual(Array.from(f.card.automations,a=>a.name),['A 1','Ä 2','Z 2']);
 f.card._hass.locale.language='sv';f.card.hass=f.card._hass;
 assert.deepEqual(Array.from(f.card.automations,a=>a.name),['A 1','Z 2','Ä 2']);assert.equal(f.requests.length,0);
});

test('reset result locally reapplies complete retained selected bucket and keeps the loaded detail',t=>{
 const f=fixture(t);const auto={entity:'automation.a',automationId:'a',name:'Automation a'};
 f.card.viewMode='automations';f.card.selectedAutomation=auto.entity;f.card._rawAutomations=[auto];
 f.card._traceMap.a={traces:[{...full('retained'),script_execution:'finished'}]};
 f.card.traceFilterResult='error';f.card.traces=[];const detail=f.card._buildDetail(f.rows[1],full('new'));f.card.traceDetail=detail;f.card.render();
 f.card.shadowRoot.querySelector('[data-reset-filter="result"]').click();
 assert.equal(f.card.traces.length,1);assert.equal(f.card.traceDetail,detail);assert.equal(f.requests.length,0);
 assert.equal(f.card.shadowRoot.activeElement.id,'resSel');
});

test('two unavailable traces never draw a fabricated zero-time axis',async t=>{
 const f=fixture(t,undefined,()=>{throw {code:'not_found'};});await compare(f);
 const root=f.card.shadowRoot;
 assert.equal(root.querySelectorAll('[data-comparison-lane]').length,2);
 assert.equal(root.querySelectorAll('.comparison-axis, .comparison-instant').length,0);
 assert.equal(root.querySelectorAll('[data-offset-ms]').length,0);
});

test('completed comparison survives synchronous HA layout reparent without rereading traces',async t=>{
 const f=fixture(t);await compare(f);const {card,dom}=f;const result=card._comparisonView.result;
 card.updateAutomationData=async()=>{throw new Error('layout move must not refetch');};
 const target=dom.window.document.createElement('section');dom.window.document.body.append(target);
 target.append(card);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(card._comparisonRuns.size,2);assert.equal(card._comparisonView.result,result);
 assert.equal(card.shadowRoot.querySelectorAll('[data-comparison-lane]').length,2);
 assert.equal(card._comparisonExportable(),true);assert.equal(f.requests.length,2);
});

test('removal beyond the current layout task cannot resurrect its completed pair',async t=>{
 const f=fixture(t);await compare(f);f.card.updateAutomationData=async()=>{};
 f.card.remove();assert.equal(f.card._comparisonView,null);
 await new Promise(resolve=>f.dom.window.setTimeout(resolve,0));f.dom.window.document.body.append(f.card);
 assert.equal(f.card._comparisonView,null);assert.equal(f.card._comparisonRuns.size,0);
 assert.equal(f.card._comparisonExportable(),false);
});

test('layout move cannot carry a completed comparison across a role change',async t=>{
 const f=fixture(t);await compare(f);f.card.updateAutomationData=async()=>{};
 f.card.remove();f.card.hass={...f.card._hass,user:{id:'household',is_admin:false}};
 f.dom.window.document.body.append(f.card);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.card._comparisonRuns.size,0);assert.equal(f.card._comparisonView,null);
 assert.equal(f.card.shadowRoot.querySelector('#comparePreviousTrace'),null);
 assert.equal(f.card._comparisonExportable(),false);
});

for(const mode of ['automations','all-traces']) test(`search chip clears the visible ${mode} draft and keeps other filters`,t=>{
 const f=fixture(t);const {card,dom}=f;card.viewMode=mode;card.timeRange='7d';card.searchQuery='stale query';card.render();
 const id=mode==='automations'?'autoSearch':'trSearch';const input=card.shadowRoot.getElementById(id);
 input.value='stale query';input.focus();input.setSelectionRange(2,4);
 card.shadowRoot.querySelector('[data-reset-filter="search"]').click();
 assert.equal(card.searchQuery,'');assert.equal(card.shadowRoot.getElementById(id).value,'');
 assert.equal(card.timeRange,'7d');assert.equal(card.shadowRoot.activeElement.id,id);
 assert.equal(card.shadowRoot.querySelector('[data-reset-filter="search"]'),null);assert.equal(f.requests.length,0);
});

test('filter chip labels use a single separator without placeholder ellipses',t=>{
 const {card}=fixture(t);card.timeRange='7d';card.traceFilterResult='error';card.searchQuery='example';card.render();
 const chips=[...card.shadowRoot.querySelectorAll('[data-reset-filter]')];
 assert.equal(chips.length,3);for(const chip of chips)assert.doesNotMatch(chip.textContent,/::|\.\.\.:|…:/);
});


test('completed comparison survives HA reparent after a microtask with the same hass source',async t=>{
 const f=fixture(t);await compare(f);const {card,dom}=f;const result=card._comparisonView.result;
 card.updateAutomationData=async()=>{throw new Error('HA layout must not refetch');};
 card.remove();await Promise.resolve();card.hass={...card._hass};
 dom.window.document.body.append(card);await Promise.resolve();
 assert.equal(card._comparisonRuns.size,2);assert.equal(card._comparisonView.result,result);
 assert.equal(card.shadowRoot.querySelectorAll('[data-comparison-lane]').length,2);
 assert.equal(card._comparisonExportable(),true);assert.equal(f.requests.length,2);
});

test('offline then online while the same card is detached cannot revive a completed comparison',async t=>{
 const f=fixture(t);await compare(f);f.card.updateAutomationData=async()=>{};
 f.card.remove();f.dom.window.dispatchEvent(new f.dom.window.Event('offline'));
 f.dom.window.dispatchEvent(new f.dom.window.Event('online'));f.dom.window.document.body.append(f.card);
 assert.equal(f.card._comparisonRuns.size,0);assert.equal(f.card._comparisonView,null);
 assert.equal(f.card._comparisonExportable(),false);
});

test('connection disconnect then ready while detached cannot revive a completed comparison',async t=>{
 const f=fixture(t);const listeners=new Map();
 f.card._hass.connection={connected:true,addEventListener:(name,fn)=>listeners.set(name,fn),
   removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 f.card._ensureComparisonLifecycle();await compare(f);f.card.updateAutomationData=async()=>{};
 f.card.remove();f.card._hass.connection.connected=false;listeners.get('disconnected')?.();
 f.card._hass.connection.connected=true;listeners.get('ready')?.();f.dom.window.document.body.append(f.card);
 assert.equal(f.card._comparisonRuns.size,0);assert.equal(f.card._comparisonView,null);
 assert.equal(f.card._comparisonExportable(),false);
});
