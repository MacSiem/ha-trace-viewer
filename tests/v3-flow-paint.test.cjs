const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
test('flow duration paint resolves from the standalone card theme instead of an undefined external token',t=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://synthetic.invalid/',virtualConsole:new VirtualConsole()});
 dom.window.ResizeObserver=class{observe(){}disconnect(){}};
 dom.window.eval(fs.readFileSync('ha-trace-viewer.js','utf8'));
 const card=dom.window.document.createElement('ha-trace-viewer');card.setConfig({show_support:false});dom.window.document.body.append(card);
 t.after(()=>{card.remove();dom.window.close();});
 const root=card.shadowRoot;
 const variables=new Set([...root.querySelectorAll('style')].flatMap(style=>[...style.textContent.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map(match=>match[1])));
 const graphic=dom.window.document.createElement('div');graphic.innerHTML=card._renderFlowGraph([
  {category:'trigger',status:'success',description:'Synthetic trigger',icon:'',duration:10},
  {category:'action',status:'success',description:'Synthetic action',icon:'',duration:220}
 ]);
 const durations=[...graphic.querySelectorAll('text')].filter(node=>['10ms','220ms'].includes(node.textContent));assert.equal(durations.length,2);
 for(const node of durations){
  const paint=node.getAttribute('fill');assert.ok(paint,'duration needs explicit paint');
  for(const match of paint.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]*))?\)/g)){
   assert.ok(variables.has(match[1])||match[2]?.trim(),`unresolved duration paint ${paint} defaults to black in SVG`);
  }
 }
});
