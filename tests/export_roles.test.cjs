const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const installNativeDialog=require('./helpers/native-dialog.cjs');
function fixture(){
 const dom=new JSDOM('',{runScripts:'outside-only',url:'http://qa.invalid',virtualConsole:new VirtualConsole()});
 installNativeDialog(dom.window);
 dom.window.ResizeObserver=class{observe(){}disconnect(){}};
 dom.window.Blob=Blob;let download;
 dom.window.URL.createObjectURL=b=>{download=b;return 'blob:qa';};dom.window.URL.revokeObjectURL=()=>{};
 dom.window.HTMLAnchorElement.prototype.click=function(){};
 dom.window.eval(fs.readFileSync('ha-trace-viewer.js','utf8'));
 const card=dom.window.document.createElement('ha-trace-viewer');card.setConfig({});dom.window.document.body.append(card);
 const hass={language:'en',user:{id:'admin',is_admin:true},connection:{connected:true},states:{},themes:{},callWS:async()=>[]};card._hass=hass;
 const raw={item_id:'private-item',run_id:'private-run',domain:'automation',state:'stopped',timestamp:{start:'2026-01-01T00:00:00Z',finish:'2026-01-01T00:00:00.010Z'},script_execution:'finished'};
 const trace={id:raw.run_id,item_id:raw.item_id,automationName:'=1+1',timestamp:new Date(raw.timestamp.start),status:'success',duration:10,trigger:'say "hi", now\nnext',lastStep:'action/0',raw};
 card.traces=[trace];card._allFlatTraces=[trace];card._storedDetails['private-item::private-run']={config:{token:'QA_SENTINEL'},trace:{'action/0':[{timestamp:'2026-01-01T00:00:00Z',changed_variables:{secret:'QA_SENTINEL'}}]}};
 return {dom,card,hass,raw,trace,download:()=>download,close:()=>{card.remove();dom.window.close();}};
}
test('role change invalidates pending global trace refresh before persistence',async()=>{const f=fixture();try{let finish;f.card._hass.callWS=()=>new Promise(r=>finish=r);const pending=f.card.updateAutomationData();f.card.hass={...f.hass,user:{id:'household',is_admin:false}};finish([f.raw]);await pending;assert.equal(f.card._allTraces.length,0);assert.doesNotMatch(f.dom.window.localStorage.getItem('ha-tools-trace-viewer-stored')||'',/private-run/);}finally{f.close();}});
test('out of order trace detail cannot overwrite latest selection',async()=>{const f=fixture();try{const other={...f.trace,id:'b'};f.card.traces.push(other);const resolves={};f.card._hass.callWS=m=>new Promise(r=>resolves[m.run_id]=r);const a=f.card.onTraceClick('private-run');const b=f.card.onTraceClick('b');resolves.b({trace:{}});await b;resolves['private-run']({trace:{}});await a;assert.equal(f.card.traceDetail.trace.id,'b');}finally{f.close();}});
test('first trace request renders loading and per-automation failures offer retry',async()=>{const f=fixture();try{let finish;f.card._hass.callWS=()=>new Promise(r=>finish=r);const pending=f.card.updateAutomationData();assert.match(f.card.shadowRoot.textContent,/Loading/);finish([]);await pending;f.card._rawAutomations=[{entity:'automation.qa',automationId:'qa',name:'QA'}];f.card.selectedAutomation='automation.qa';f.card._hass.callWS=async()=>{throw Error('offline');};await f.card._loadTraces('automation.qa');assert.match(f.card.shadowRoot.textContent,/Could not load/);assert(f.card.shadowRoot.querySelector('[data-retry]'));}finally{f.close();}});

test('standalone settings explain storage and retain page size on reopen',()=>{const f=fixture();try{f.card.render();f.card.shadowRoot.getElementById('goToSettingsBtn').click();assert.match(f.card.shadowRoot.textContent,/this browser on this device/);const select=f.card.shadowRoot.getElementById('settingsPageSize');select.value='50';select.dispatchEvent(new f.dom.window.Event('change'));assert.equal(f.card.tracePageSize,50);assert.equal(f.dom.window.localStorage.getItem('ha-tools-trace-viewer-pageSize'),'50');f.card.shadowRoot.getElementById('closeTraceSettings').click();assert.equal(f.card.shadowRoot.getElementById('settingsPageSize'),null);}finally{f.close();}});

test('view change cancels list loading without leaving a spinner',async()=>{const f=fixture();try{let finish;f.card._rawAutomations=[{entity:'automation.qa',automationId:'qa',name:'QA'}];f.card.selectedAutomation='automation.qa';f.card._hass.callWS=()=>new Promise(r=>finish=r);const pending=f.card._loadTraces('automation.qa');const view=f.card.shadowRoot.getElementById('viewSel');view.value='all-traces';view.dispatchEvent(new f.dom.window.Event('change'));finish([]);await pending;assert.equal(f.card._loadingSelected,false);assert.doesNotMatch(f.card.shadowRoot.textContent,/Loading traces/);}finally{f.close();}});
test('reconnecting during detail loading clears canceled selection and allows another selection',async()=>{const f=fixture();try{let finish;f.card._hass.callWS=m=>m.type==='trace/get'?new Promise(r=>finish=r):Promise.resolve([]);const pending=f.card.onTraceClick(f.trace.id);f.card.remove();f.dom.window.document.body.append(f.card);finish({trace:{}});await pending;await new Promise(r=>setImmediate(r));assert.equal(f.card.selectedTrace,null);assert.doesNotMatch(f.card.shadowRoot.textContent,/Loading trace detail/);f.card._allFlatTraces=[f.trace];f.card._hass.callWS=async()=>({trace:{}});await f.card.onTraceClick(f.trace.id);assert.equal(f.card.traceDetail.trace.id,f.trace.id);}finally{f.close();}});
test('reconnecting retains completed trace details',async()=>{const f=fixture();try{f.card._hass.callWS=async m=>m.type==='trace/get'?{trace:{}}:[];await f.card.onTraceClick(f.trace.id);const detail=f.card.traceDetail;f.card.remove();f.dom.window.document.body.append(f.card);await new Promise(r=>setImmediate(r));assert.equal(f.card.selectedTrace,f.trace.id);assert.equal(f.card.traceDetail,detail);}finally{f.close();}});

// W6 supersedes raw/unredacted and immediate-download assertions. Private opt-in
// permits only reviewed labels/IDs/times; never configuration or variable values.
const settled=()=>new Promise(resolve=>setImmediate(resolve));
const dialog=f=>f.card.shadowRoot.querySelector('[data-ha-tools-export]')?.shadowRoot;
const field=(f,key)=>dialog(f)?.querySelector(`[data-export="${key}"]`);
async function openExport(f,format='json',selected=false){f.card.render();f.card._export(format,selected);await settled();}
async function privatePreview(f){field(f,'private').click();field(f,'refresh').click();await settled();}
for(const format of ['json','csv']) test(`W6 ${format}: explicit Save hands off exact preview, no reads or retry`,async()=>{
 const f=fixture();try{let reads=0;f.card._hass.callWS=async()=>{reads++;throw Error('unexpected');};
 await openExport(f,format);assert.equal(f.download(),undefined);assert.equal(field(f,'private').checked,false);
 const preview=field(f,'preview').textContent;assert(preview.length>0);assert.doesNotMatch(preview,/QA_SENTINEL|private-item|private-run|2026-01-01|=1\+1|say/);
 field(f,'save').click();await settled();assert.equal(await f.download().text(),preview);assert.equal(reads,0);assert.equal(field(f,'save').disabled,true);
 }finally{f.close();}
});
test('W6 private opt-in allows only reviewed metadata and CSV formula defense',async()=>{
 const f=fixture();try{await openExport(f,'csv');await privatePreview(f);const content=field(f,'preview').textContent;
 assert.match(content,/"'=1\+1"/);assert.match(content,/private-run/);assert.doesNotMatch(content,/QA_SENTINEL|say|changed_variables|private-item/);
 field(f,'cancel').click();await openExport(f);assert.equal(field(f,'private').checked,false);
 }finally{f.close();}
});
test('W6 missing timestamps/details stay null with partial metadata inside the file',async()=>{
 const f=fixture();try{f.trace.raw={...f.raw,timestamp:{start:f.raw.timestamp.start,finish:null}};f.trace.duration=0;
 await openExport(f);const data=JSON.parse(field(f,'preview').textContent);assert.equal(data.status,'partial');
 assert.equal(data.records[0].duration_ms,null);assert.equal(data.records[0].detail.step_count,null);assert.equal(data.records[0].detail.status,'unavailable');assert(data.source_limit.length);
 }finally{f.close();}
});
test('W6 all and selected preserve current scope; grouped export retains same-name groups separately',async()=>{
 const f=fixture();try{const other={...f.trace,id:'other-run',item_id:'other-item',raw:{...f.raw,run_id:'other-run',item_id:'other-item'}};
 f.card.traces=[f.trace,other];f.card.selectedTraceIds.add(other.id);await openExport(f,'json',true);
 let data=JSON.parse(field(f,'preview').textContent);assert.equal(data.scope,'selected');assert.equal(data.record_count,1);
 field(f,'cancel').click();await openExport(f);assert.equal(JSON.parse(field(f,'preview').textContent).record_count,2);field(f,'cancel').click();
 f.card._rawAutomations=[{entity:'automation.a',automationId:f.raw.item_id,name:'__proto__'},{entity:'automation.b',automationId:other.item_id,name:'__proto__'}];
 f.card.selectedAutoIds=new Set(['automation.a','automation.b']);f.card._traceMap={[f.raw.item_id]:{traces:[f.raw]},[other.item_id]:{traces:[other.raw]}};
 f.card._exportMultiAuto('json');await settled();await privatePreview(f);data=JSON.parse(field(f,'preview').textContent);
 assert.equal(data.scope,'automations');assert.equal(data.groups.length,2);assert.equal(data.record_count,2);assert.equal(data.groups[0].records.length,1);assert.equal(data.groups[1].records.length,1);
 }finally{f.close();}
});
for(const kind of ['filter','selection','locale','source','access','role','identity','connection','offline']) test(`W6 ${kind} invalidates bytes and consent`,async()=>{
 const f=fixture();try{await openExport(f);await privatePreview(f);assert(field(f,'preview').textContent);
 if(kind==='filter')f.card.searchQuery='changed';
 if(kind==='selection')f.card.selectedTraceIds.add(f.trace.id);
 if(kind==='locale')f.card._lang='pl';
 if(kind==='source')f.card.traces=[{...f.trace}];
 if(kind==='access')f.card._accessEpoch++;
 if(kind==='role')f.card._hass.user={id:'admin',is_admin:false};
 if(kind==='identity')f.card._hass.user={id:'other',is_admin:true};
 if(kind==='connection')f.card._hass.connection={connected:true};
 if(kind==='offline')f.dom.window.dispatchEvent(new f.dom.window.Event('offline'));
 f.card.render();assert.equal(field(f,'preview')?.textContent||'','');assert.equal(field(f,'private')?.checked||false,false);
 field(f,'save')?.click();await settled();assert.equal(f.download(),undefined);
 }finally{f.close();}
});
test('W6 native repaint retains connected modal, frozen bytes, filename and caret; cancel restores current opener',async()=>{
 const f=fixture();try{await openExport(f);const host=f.card.shadowRoot.querySelector('[data-ha-tools-export]'),input=field(f,'filename'),native=dialog(f).querySelector('dialog');
 assert(native);assert(native.open);assert(native.matches(':modal'));
 input.value='my-draft.json';input.dispatchEvent(new f.dom.window.Event('input'));field(f,'refresh').click();await settled();
 const frozen=field(f,'preview').textContent;assert(frozen.length);input.focus();input.setSelectionRange(3,6);
 const observer=new f.dom.window.MutationObserver(()=>{});observer.observe(f.card.shadowRoot,{childList:true});const surface=f.card._cardSurface,oldToolbar=surface.querySelector('#expBtn');
 f.card.render();const removed=observer.takeRecords().some(change=>Array.from(change.removedNodes).some(node=>node===host||node.contains?.(host)));observer.disconnect();
 assert.equal(removed,false);assert.equal(oldToolbar.isConnected,false);assert.equal(f.card._cardSurface,surface);
 assert.equal(f.card.shadowRoot.querySelector('[data-ha-tools-export]'),host);assert(host.isConnected);assert.equal(dialog(f).querySelector('dialog'),native);assert(native.matches(':modal'));
 assert.equal(field(f,'filename'),input);assert.equal(input.value,'my-draft.json');assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,6);assert.equal(dialog(f).activeElement,input);
 assert.equal(field(f,'preview').textContent,frozen);assert.equal(f.download(),undefined);
 native.dispatchEvent(new f.dom.window.Event('cancel',{cancelable:true}));await settled();assert.equal(dialog(f),undefined);assert.equal(native.open,false);assert.equal(f.card.shadowRoot.activeElement.id,'expBtn');
 await openExport(f);assert(dialog(f).querySelector('dialog').matches(':modal'));assert.equal(field(f,'private').checked,false);assert.equal(f.download(),undefined);
 }finally{f.close();}
});
test('W6 disconnect aborts preview and late completion cannot download or reopen',async()=>{
 const f=fixture();try{let finish;f.card._buildExportPayload=()=>new Promise(resolve=>{finish=resolve;});await openExport(f);f.card.remove();
 finish({serialized:'late',confirmed:true,sourceConfirmed:true,status:'success',included:['test'],excluded:['test'],sourceLimit:'test'});await settled();assert.equal(dialog(f),undefined);assert.equal(f.download(),undefined);
 }finally{f.close();}
});
test('W6 unresolved handoff remains latched across cancel and reopen',async()=>{
 const f=fixture();try{let finish,writes=0;f.card._performExportDownload=()=>{writes++;return new Promise(resolve=>{finish=resolve;});};
 await openExport(f);field(f,'save').click();field(f,'cancel').click();f.card._export('json',false);await settled();assert.equal(field(f,'save').disabled,true);assert.equal(field(f,'refresh').disabled,true);
 field(f,'save').click();assert.equal(writes,1);finish({outcome:'unknown'});await settled();assert.equal(field(f,'save').disabled,true);assert.equal(f.download(),undefined);
 }finally{f.close();}
});

test('W6 closing an expired comparison returns focus to the surviving export toolbar', async t => {
 const f=fixture();t.after(f.close);const {card}=f;card.render();
 const opener=card._exportOpener('comparison');
 opener.focus();
 assert.equal(card.shadowRoot.activeElement,card.shadowRoot.querySelector('#expBtn'));
});
