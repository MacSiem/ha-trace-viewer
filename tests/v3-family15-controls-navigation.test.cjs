const SOURCE="ha-trace-viewer.js";
const TAG="ha-trace-viewer";
const NAV=".det-tabs";
const ATTR="data-dtab";
const STATE="detailTab";
const DRAFT_ID="autoSearch";
// Source-only regression proposal. Owner executes on frozen source through FIFO.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
function fixture(){
 const dom=new JSDOM('<body><button id="outside">Outside</button></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://synthetic.invalid/',virtualConsole:new VirtualConsole()});
 const observers=[];
 dom.window.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}observe(target){this.targets.add(target);}disconnect(){this.targets.clear();}};
 dom.window.eval(readFileSync(SOURCE,'utf8'));
 const card=dom.window.document.createElement(TAG);dom.window.document.body.append(card);
 const calls=[];
 card._hass={language:'en',user:{id:'synthetic-admin',is_admin:true},states:{},themes:{},callWS:async message=>{calls.push(message);return [];}};card._lang='en';
 card.config={show_support:false};card.traceDetail={trace:{automationName:'Synthetic',timestamp:new Date(),status:'success',duration:17},steps:[],changedVars:[{step:'trigger/0',variable:'synthetic',value:'safe'}],rawData:{example:'safe'},configYaml:'alias: Synthetic',relatedEntities:[]};
 card.render();
 const native=()=>[...card.shadowRoot.querySelectorAll(NAV+' button['+ATTR+']')];
 const picker=()=>card.shadowRoot.getElementById('ha-tools-tab-picker');
 const resize=width=>{const nav=card.shadowRoot.querySelector(NAV);const target=nav.parentElement;
  const observer=observers.find(o=>o.targets.has(target));assert.ok(observer,'actual navigation container is observed');
  observer.callback([{target,contentRect:{width}}]);};
 const choose=value=>{const select=picker();select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
 return {dom,card,calls,observers,native,picker,resize,choose};
}
test('all current navigation options reuse real handlers, selected panes and labels',()=>{
 const f=fixture();try{
  const expected=['timeline','related','changes','config','json'];
  assert.deepEqual(f.native().map(b=>b.getAttribute(ATTR)),expected);
  const select=f.picker();assert.ok(select);assert.ok(select.labels.length,'native associated label');
  assert.deepEqual([...select.options].map(o=>o.value),expected);
  assert.deepEqual([...select.options].map(o=>o.textContent),f.native().map(b=>b.getAttribute('aria-label')||b.textContent.trim()));
  const reads=f.calls.length;
  for(const value of expected){f.choose(value);assert.equal(f.card[STATE],value);assert.equal(f.picker().value,value);assert.ok(f.card.shadowRoot.getElementById('tp-'+value));}
  const invalid=f.dom.window.document.createElement('option');invalid.value='foreign';f.picker().append(invalid);
  f.choose('foreign');assert.equal(f.card[STATE],expected.at(-1));assert.equal(f.picker().value,expected.at(-1));
  assert.equal(f.calls.length,reads,'navigation does not introduce API reads or writes');
 }finally{f.card.remove();f.dom.window.close();}
});
test('available navigation width transfers focus, retaining drafts and caret without rebuilding content',()=>{
 const f=fixture();try{
  const reads=f.calls.length,first=f.native()[0];first.focus();f.resize(260);
  assert.equal(f.card.shadowRoot.querySelector(NAV).hidden,true);assert.equal(f.card.shadowRoot.activeElement,f.picker());
  f.resize(320);assert.equal(f.card.shadowRoot.querySelector(NAV).hidden,false);assert.equal(f.card.shadowRoot.activeElement,f.native()[0]);

  const input=f.card.shadowRoot.getElementById(DRAFT_ID);input.value='synthetic unsubmitted draft';input.focus();input.setSelectionRange(2,8,'backward');
  f.resize(260);f.resize(900);
  assert.equal(f.card.shadowRoot.getElementById(DRAFT_ID),input);assert.equal(f.card.shadowRoot.activeElement,input);
  assert.equal(input.value,'synthetic unsubmitted draft');assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,8);assert.equal(input.selectionDirection,'backward');
  f.card.render();const restored=f.card.shadowRoot.getElementById(DRAFT_ID);
  assert.equal(restored.value,'synthetic unsubmitted draft');assert.equal(f.card.shadowRoot.activeElement,restored);assert.equal(restored.selectionStart,2);assert.equal(restored.selectionEnd,8);assert.equal(restored.selectionDirection,'backward');
  assert.equal(f.calls.length,reads);
  f.resize(260);f.picker().focus();f.card._lang='pl';f.card._hass.language='pl';f.card.render();
  assert.equal(f.card.shadowRoot.activeElement,f.picker());assert.equal(f.picker().labels[0].textContent.trim(),'Zakładka');
  assert.deepEqual([...f.picker().options].map(o=>o.textContent),f.native().map(b=>b.getAttribute('aria-label')||b.textContent.trim()));
  f.dom.window.document.getElementById('outside').focus();f.card.render();assert.equal(f.dom.window.document.activeElement.id,'outside');
 }finally{f.card.remove();assert.equal(f.observers.some(o=>o.targets.size),false,'all resize observers clean up on detach');f.dom.window.close();}
});
test('active picker follows native navigation and no detached containers remain observed after rerenders',()=>{
 const f=fixture();try{
  f.resize(260);f.choose(['timeline','related','changes','config','json'][1]);f.native()[2].click();assert.equal(f.picker().value,['timeline','related','changes','config','json'][2]);
  const current=f.card.shadowRoot.querySelector(NAV).parentElement;
  for(const observer of f.observers)for(const target of observer.targets)assert.ok(target===f.card||target===current);
  f.card._hass.user.is_admin=false;f.card.render();assert.equal(f.picker(),null);assert.equal(f.card.shadowRoot.querySelector('[data-dtab]'),null);
 }finally{f.card.remove();assert.equal(f.observers.some(o=>o.targets.size),false);f.dom.window.close();}
});
test('every visible form field has a native label or accessible name, and editor preserves unknown config',()=>{
 const f=fixture();try{
  for(const input of f.card.shadowRoot.querySelectorAll('input,select,textarea'))assert.ok(input.labels?.length||input.getAttribute('aria-label')||input.getAttribute('aria-labelledby'),input.outerHTML);
  const editor=f.dom.window.document.createElement(TAG+'-editor');editor.setConfig({title:'Synthetic',unknown_setting:{keep:true}});f.dom.window.document.body.append(editor);
  const input=editor.shadowRoot.getElementById('cf_title');assert.ok(input.labels.length||input.getAttribute('aria-label'));
  let changed;editor.addEventListener('config-changed',e=>changed=e.detail.config);input.value='Revised';input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
  assert.equal(changed.title,'Revised');assert.equal(changed.unknown_setting.keep,true);
 }finally{f.card.remove();f.dom.window.close();}
});

test('existing trace and automation selections use named native checkbox labels',()=>{
 const f=fixture();try{f.card.selectMode=true;f.card.automations=[{entity:'automation.synthetic',name:'Synthetic automation',status:'stopped',lastTriggered:null}];f.card.render();
 const checkbox=f.card.shadowRoot.querySelector('[data-autocheck]');assert.equal(checkbox.type,'checkbox');assert.equal(checkbox.labels.length,1);assert.ok(checkbox.getAttribute('aria-label'));checkbox.labels[0].click();assert.equal(f.card.selectedAutoIds.has('automation.synthetic'),true);assert.equal(f.calls.length,0);
 }finally{f.card.remove();f.dom.window.close();}
});


test('automation selection works with Enter/Space, ignores key repeats and retains row focus',()=>{
 const f=fixture();try{f.card.selectMode=true;f.card.automations=[{entity:'automation.synthetic',name:'Synthetic automation',status:'stopped',lastTriggered:null,triggerCount:0}];f.card.render();const row=()=>f.card.shadowRoot.querySelector('.auto-item');row().focus();row().dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  assert.equal(f.card.selectedAutoIds.has('automation.synthetic'),true);assert.equal(row().getAttribute('role'),'button');assert.equal(row().tabIndex,0);assert.equal(row().getAttribute('aria-pressed'),'true');assert.equal(f.card.shadowRoot.activeElement,row());
  row().dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true,repeat:true}));assert.equal(f.card.selectedAutoIds.has('automation.synthetic'),true);
  f.card._lang='pl';f.card.render();assert.equal(f.card.shadowRoot.activeElement,row());row().dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));assert.equal(f.card.selectedAutoIds.has('automation.synthetic'),false);assert.equal(row().getAttribute('aria-pressed'),'false');assert.equal(f.calls.length,0);
 }finally{f.card.remove();f.dom.window.close()}
});
test('trace keyboard activation loads exactly one real detail and nested comparison keys do not activate the row',async()=>{
 const f=fixture();try{f.card.traceDetail=null;const trace={id:'synthetic-run',item_id:'synthetic-item',automationName:'Synthetic',timestamp:new f.dom.window.Date('2026-01-01T00:00:00Z'),status:'success',duration:10,trigger:'state',lastStep:'action/0'};f.card.selectedAutomation='automation.synthetic';f.card.traces=[trace];f.card._allFlatTraces=[trace];f.card._hass.callWS=async message=>{f.calls.push(message);return {trace:{},config:{alias:'Synthetic'}}};f.card.render();const row=()=>f.card.shadowRoot.querySelector('.tr-item');row().focus();row().dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].type,'trace/get');assert.equal(f.calls[0].run_id,'synthetic-run');assert.equal(f.card.selectedTrace,'synthetic-run');assert.equal(f.card.shadowRoot.activeElement,row());assert.match(row().getAttribute('aria-label'),/Synthetic/);
  const compare=row().querySelector('[data-compare-run]');compare.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));compare.click();assert.equal(f.calls.length,1);assert.equal(f.card._comparisonRuns.size,1);
 }finally{f.card.remove();f.dom.window.close()}
});
test('group headers expose expanded state and keyboard toggles without API requests',()=>{
 const f=fixture();try{f.card.viewMode='all-traces';f.card.groupBy='automation';f.card.timeRange='all';f.card._allFlatTraces=[{id:'synthetic-run',item_id:'synthetic-item',automationName:'Synthetic',timestamp:new f.dom.window.Date('2026-01-01T00:00:00Z'),status:'success',duration:10,trigger:'state'}];f.card.render();const header=f.card.shadowRoot.querySelector('.tgroup-h');assert.ok(header);header.focus();header.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(header.parentElement.classList.contains('collapsed'),true);assert.equal(header.getAttribute('aria-expanded'),'false');header.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true}));assert.equal(header.parentElement.classList.contains('collapsed'),false);assert.equal(header.getAttribute('aria-expanded'),'true');assert.equal(f.calls.length,0);
 }finally{f.card.remove();f.dom.window.close()}
});
