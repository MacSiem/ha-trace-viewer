const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
function fixture(t){
 const dom=new JSDOM('<body><button id="outside">Outside</button></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://synthetic.invalid/',virtualConsole:new VirtualConsole()});
 dom.window.ResizeObserver=class{observe(){}disconnect(){}};
 dom.window.eval(fs.readFileSync('ha-trace-viewer.js','utf8'));
 t.after(()=>dom.window.close());
 return dom;
}
test('Lovelace config echo retains title focus and backward caret without mutating unknown YAML',t=>{
 const dom=fixture(t),editor=dom.window.document.createElement('ha-trace-viewer-editor');
 const original=Object.freeze({title:'Original',show_support:false,unknown:Object.freeze({keep:true})});
 editor.setConfig(original);dom.window.document.body.append(editor);
 let changed;
 editor.addEventListener('config-changed',e=>{changed=e.detail.config;editor.setConfig(JSON.parse(JSON.stringify(changed)));});
 let input=editor.shadowRoot.getElementById('cf_title');input.focus();input.value='Źródło testowe';input.setSelectionRange(2,7,'backward');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 input=editor.shadowRoot.getElementById('cf_title');
 assert.equal(editor.shadowRoot.activeElement,input,'the title remains ready for the next typed character');
 assert.deepEqual([input.selectionStart,input.selectionEnd,input.selectionDirection],[2,7,'backward']);
 assert.equal(changed.title,'Źródło testowe');assert.equal(changed.unknown.keep,true);assert.equal(changed.show_support,false);assert.equal(original.title,'Original');
 input.value='';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(editor.shadowRoot.getElementById('cf_title').value,'','clearing the field must not inject a default while typing');
 const outside=dom.window.document.getElementById('outside');outside.focus();editor.setConfig({...changed,title:'External'});assert.equal(dom.window.document.activeElement,outside,'external updates do not steal focus');
});
test('editor follows HA language and keeps the same draft and selection across language updates',t=>{
 const dom=fixture(t),editor=dom.window.document.createElement('ha-trace-viewer-editor');
 editor.setConfig({title:'Draft',language:'en',unknown:{keep:true}});editor.hass={language:'pl-PL'};dom.window.document.body.append(editor);
 let input=editor.shadowRoot.getElementById('cf_title');assert.equal(input.labels[0].textContent,'Tytuł');
 input.focus();input.setSelectionRange(1,4,'backward');let changes=0;editor.addEventListener('config-changed',()=>changes++);
 editor.hass={language:'en'};input=editor.shadowRoot.getElementById('cf_title');assert.equal(input.labels[0].textContent,'Title');assert.equal(input.value,'Draft');assert.equal(editor.shadowRoot.activeElement,input);assert.deepEqual([input.selectionStart,input.selectionEnd,input.selectionDirection],[1,4,'backward']);assert.equal(changes,0);
});
async function populated(t){
 const dom=fixture(t),card=dom.window.document.createElement('ha-trace-viewer');card.setConfig({show_support:false});dom.window.document.body.append(card);
 const hass={language:'pl',user:{id:'synthetic-admin',is_admin:true},connection:{connected:true},themes:{},states:{'automation.synthetic':{state:'on',attributes:{id:'synthetic',friendly_name:'Synthetic',last_triggered:null}}},callWS:async()=>[{item_id:'synthetic',run_id:'one',state:'stopped',script_execution:'finished',timestamp:{start:'2026-10-15T00:00:00Z',finish:'2026-10-15T00:00:01Z'}}]};
 card.hass=hass;await new Promise(resolve=>setImmediate(resolve));t.after(()=>card.remove());return {dom,card,hass};
}
test('saved trace count follows the HA language without losing retained runs',async t=>{
 const {card,hass}=await populated(t);assert.equal(card.shadowRoot.getElementById('traceStorageInfo').textContent.trim(),'💾 Zapisane: 1');
 card.hass={...hass,language:'en'};assert.equal(card.shadowRoot.getElementById('traceStorageInfo').textContent.trim(),'💾 1 saved');
});
test('an automation without a recorded trigger has a Polish never label',async t=>{
 const {card}=await populated(t);const text=card.shadowRoot.querySelector('[data-auto-action="automation.synthetic"]').textContent;assert.match(text,/Nigdy/);assert.doesNotMatch(text,/Never/);
});
