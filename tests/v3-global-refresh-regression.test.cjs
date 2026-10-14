const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
function fixture(name='QA Alpha'){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error));
 const dom=new JSDOM('',{runScripts:'outside-only',url:'https://qa.invalid',virtualConsole:vc});
 dom.window.ResizeObserver=class{observe(){}disconnect(){}};
 dom.window.eval(fs.readFileSync('ha-trace-viewer.js','utf8'));
 const card=dom.window.document.createElement('ha-trace-viewer');card.setConfig({show_support:false});dom.window.document.body.append(card);
 card._hass={language:'en',user:{id:'admin',is_admin:true},connection:{connected:true},states:{'automation.alpha':{state:'on',attributes:{id:'a',friendly_name:name}}},callWS:async()=>[]};
 const raw=finished=>({item_id:'a',run_id:'r',domain:'automation',state:finished?'stopped':'running',script_execution:finished?'finished':'running',timestamp:{start:'2026-10-14T12:00:00Z',...(finished?{finish:'2026-10-14T12:00:01Z'}:{})}});
 return {dom,card,errors,raw,close(){card.remove();dom.window.close();}};
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
for(const olderError of [false,true])test(`global refresh preserves newer retained and visible result when older response arrives last; error=${olderError}`,async()=>{
 const f=fixture();try{
  const first=deferred(),second=deferred();let calls=0;f.card._hass.callWS=()=>++calls===1?first.promise:second.promise;
  f.card.viewMode='all-traces';const a=f.card.updateAutomationData(),b=f.card.updateAutomationData();
  second.resolve([f.raw(true)]);await b;
  if(olderError)first.reject(new Error('older request failed'));else first.resolve([f.raw(false)]);await a;
  assert.equal(f.card._fetchError,null,'older failure cannot replace a newer confirmed result');
  assert.equal(f.card._allFlatTraces.find(row=>row.id==='r').status,'success');
  assert.equal(f.card._storedTraces['a::r'].state,'stopped');
  assert.equal(JSON.parse(f.dom.window.localStorage.getItem('ha-tools-trace-viewer-stored'))['a::r'].state,'stopped');
  assert.ok(f.card.shadowRoot.querySelector('.tr-item.s-success[data-trace="r"]'),'visible row must retain completed status');
 }finally{f.close();}
});
test('older global refresh cannot replace a later per-automation refresh',async()=>{
 const f=fixture();try{
  await f.card.updateAutomationData();const global=deferred(),selected=deferred();
  f.card._hass.callWS=command=>command.item_id?selected.promise:global.promise;
  const a=f.card.updateAutomationData();f.card.selectedAutomation='automation.alpha';const b=f.card._loadTraces('automation.alpha');
  selected.resolve([f.raw(true)]);await b;global.resolve([f.raw(false)]);await a;
  assert.equal(f.card._storedTraces['a::r'].state,'stopped');
  assert.equal(f.card._allFlatTraces.find(row=>row.id==='r').status,'success');
 }finally{f.close();}
});
for(const name of ['constructor','__proto__','toString'])test(`actual automation name ${name} renders a grouped All Traces row`,async()=>{
 const f=fixture(name);try{
  f.card._hass.callWS=async()=>[f.raw(true)];await f.card.updateAutomationData();
  const view=f.card.shadowRoot.querySelector('#viewSel');view.value='all-traces';view.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));
  assert.equal(f.errors.length,0,'native view change must not throw through an inherited object key');
  assert.ok(f.card.shadowRoot.querySelector('.tr-item[data-trace="r"]'));
  assert.match(f.card.shadowRoot.querySelector('.tgroup-h').textContent,new RegExp(name));
 }finally{f.close();}
});
