// W6 supplemental cases written after the runtime source draft; not RED evidence.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const installNativeDialog=require('./helpers/native-dialog.cjs');
function setup(t){
 const dom=new JSDOM('',{runScripts:'outside-only',url:'http://qa.invalid',virtualConsole:new VirtualConsole()});
 installNativeDialog(dom.window);
 dom.window.ResizeObserver=class{observe(){}disconnect(){}};dom.window.Blob=Blob;
 const downloads=[];dom.window.URL.createObjectURL=b=>{downloads.push(b);return 'blob:fixture';};dom.window.URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
 dom.window.eval(fs.readFileSync(path.join(__dirname,'../ha-trace-viewer.js'),'utf8'));
 const card=dom.window.document.createElement('ha-trace-viewer');dom.window.document.body.append(card);
 let reads=0;const listeners=new Map();card._hass={user:{id:'admin',is_admin:true},connection:{connected:true,addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}},states:{},callWS:async()=>{reads++;return [];}};
 card._lang='en';card.viewMode='all-traces';
 const raw={domain:'automation',state:'stopped',item_id:'source-id',run_id:'run-private',script_execution:'finished',timestamp:{start:'2026-01-01T00:00:00Z',finish:'2026-01-01T00:00:01Z'}};
 const row={id:raw.run_id,item_id:raw.item_id,automationName:'=1+1',timestamp:new Date(raw.timestamp.start),finishTime:new Date(raw.timestamp.finish),duration:1000,status:'success',trigger:'PRIVATE_TRIGGER',raw};
 card.traces=[row];card._allFlatTraces=[row];card.render();
 t.after(()=>{card.remove();dom.window.close();});
 const field=key=>card.shadowRoot.querySelector('[data-ha-tools-export]')?.shadowRoot.querySelector(`[data-export="${key}"]`);
 return {dom,card,row,raw,field,downloads,listeners,reads:()=>reads};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const privateFields of [false,true])test(`current normalized details retain safe diagnostics with private=${privateFields}`,async t=>{
 const f=setup(t);f.card.traceDetail={trace:f.row,rawData:{...f.raw,config:{password:'PASSWORD_CANARY',user:'USER_CANARY',url:'ADDRESS_CANARY'},context:{user_id:'USER_CANARY'},trace:{'secret_path/0':[{path:'secret_path/0',timestamp:'2026-01-01T00:00:00.100Z',changed_variables:{api_token:'TOKEN_CANARY',person:'USER_CANARY',address:'ADDRESS_CANARY'}}]}}};
 f.card._comparisonDetailSourceEpoch=f.card._comparisonSourceEpoch;
 f.card._export('json',false);await flush();if(privateFields){f.field('private').click();f.field('refresh').click();await flush();}
 const text=f.field('preview').textContent,data=JSON.parse(text);assert.equal(data.status,'success');assert.equal(data.records[0].duration_ms,1000);assert.equal(data.records[0].detail.step_count,1);assert.equal(data.records[0].detail.nodes[0].offset_ms,100);
 assert.doesNotMatch(text,/PASSWORD_CANARY|TOKEN_CANARY|USER_CANARY|ADDRESS_CANARY|secret_path|PRIVATE_TRIGGER/);assert.equal(f.reads(),0);
 if(privateFields)assert.equal(data.records[0].run_id,'run-private');else assert.equal(data.records[0].run_id,'Run 1');
});
for(const [scope,format]of [['all','json'],['all','csv'],['selected','json'],['selected','csv'],['automations','json'],['automations','csv']])test(`W6 scope ${scope} preserves ${format} and counts`,async t=>{
 const f=setup(t);f.card.selectedTraceIds.add(f.row.id);f.card.selectedAutoIds.add('automation.selected');f.card._rawAutomations=[{entity:'automation.selected',automationId:f.raw.item_id,name:'Selected'}];f.card._traceMap={[f.raw.item_id]:{traces:[f.raw]}};
 if(scope==='automations')f.card._exportMultiAuto(format);else f.card._export(format,scope==='selected');await flush();
 const text=f.field('preview').textContent;assert(text.length);if(format==='json'){const data=JSON.parse(text);assert.equal(data.scope,scope);assert.equal(data.record_count,1);}else{assert.match(text,/record_count/);assert.match(text,new RegExp('"'+scope+'"'));assert.match(text,/partial/);}
 f.field('save').click();await flush();assert.equal(f.downloads.length,1);assert.equal(await f.downloads[0].text(),text);assert.equal(f.reads(),0);
});
test('format/filename changes consume preview until valid explicit refresh',async t=>{
 const f=setup(t);f.card._export('json',false);await flush();f.field('format').value='csv';f.field('format').dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.field('save').disabled,true);
 f.field('refresh').click();await flush();assert.equal(f.field('preview').textContent,'');assert.equal(f.downloads.length,0);
 f.field('filename').value='../bad.csv';f.field('filename').dispatchEvent(new f.dom.window.Event('input'));f.field('refresh').click();await flush();assert.equal(f.field('save').disabled,true);
 f.field('filename').value='review.csv';f.field('filename').dispatchEvent(new f.dom.window.Event('input'));f.field('refresh').click();await flush();assert.equal(f.field('save').disabled,false);assert.match(f.field('preview').textContent,/report_status/);
});
test('connection event cancels pending preview; later result cannot restore bytes',async t=>{
 const f=setup(t);let finish,signal;f.card._buildExportPayload=request=>{signal=request.signal;return new Promise(resolve=>{finish=resolve;});};
 f.card._export('json',false);await flush();f.listeners.get('disconnected')();assert.equal(signal.aborted,true);
 finish({serialized:'STALE',confirmed:true,sourceConfirmed:true,status:'success',included:['test'],excluded:['test'],sourceLimit:'test'});await flush();assert.equal(f.field('preview').textContent,'');assert.equal(f.field('save').disabled,true);assert.equal(f.downloads.length,0);
});
test('Save rechecks access even without repaint',async t=>{
 const f=setup(t);f.card._export('json',false);await flush();f.card._accessEpoch++;f.field('save').click();await flush();assert.equal(f.downloads.length,0);assert.equal(f.field('preview').textContent,'');
});
test('preview timeout is bounded and has no automatic retry',async t=>{
 const f=setup(t);const original=f.dom.window.setTimeout;f.dom.window.setTimeout=(fn,ms,...args)=>original(fn,ms===10000?0:ms,...args);
 let builds=0,finish;f.card._buildExportPayload=()=>{builds++;return new Promise(resolve=>{finish=resolve;});};f.card._export('json',false);
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(f.field('save').disabled,true);assert.match(f.field('message').textContent,/10 seconds/);assert.equal(builds,1);
 finish({serialized:'LATE',confirmed:true,sourceConfirmed:true,status:'success',included:['test'],excluded:['test'],sourceLimit:'test'});await flush();assert.equal(f.field('preview').textContent,'');assert.equal(f.downloads.length,0);
});
test('CSV quotes and formula defense cover strings while preserving numeric deltas',t=>{
 const f=setup(t);for(const value of ['=1+1',' +1','-1','@call','\tvalue','\nvalue'])assert.equal(f.card._csvCell(value),'"\''+value+'"');
 assert.equal(f.card._csvCell('say "hi", now\nnext'),'"say ""hi"", now\nnext"');assert.equal(f.card._csvCell(-20),'-20');
});


test('CSV formula guard handles invisible prefixes without changing ordinary labels',t=>{
 const f=setup(t);
 for(const value of ['\u200B=1+1','\u200E+2','\u2060-3','\u202E@SUM(1,1)','\u200B \t=9']){
  assert.equal(f.card._csvCell(value),'"\''+value+'"');
 }
 assert.equal(f.card._csvCell('\u200BOrdinary'),'"\u200BOrdinary"');
 assert.equal(f.card._csvCell(-20),'-20');
});
test('active private CSV preview protects a formula-looking automation label',async t=>{
 const f=setup(t);
 f.row.automationName='\u200B=1+1';
 f.card._export('csv',false);await flush();
 f.field('private').click();f.field('refresh').click();await flush();
 const preview=f.field('preview').textContent;
 assert(preview.includes('"\'\u200B=1+1"'),'quoted private metadata must receive a leading apostrophe');
 assert.equal(f.reads(),0,'export preview is local only');
});
