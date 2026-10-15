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

test('small flow duration text has readable contrast on both card themes',t=>{
 const dom=new JSDOM('<body></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://synthetic.invalid/',virtualConsole:new VirtualConsole()});
 dom.window.ResizeObserver=class{observe(){}disconnect(){}};dom.window.eval(fs.readFileSync('ha-trace-viewer.js','utf8'));
 const card=dom.window.document.createElement('ha-trace-viewer');card.setConfig({show_support:false});dom.window.document.body.append(card);t.after(()=>{card.remove();dom.window.close();});
 const graphic=dom.window.document.createElement('div');graphic.innerHTML=card._renderFlowGraph([{category:'trigger',status:'success',description:'Trigger',icon:'',duration:10},{category:'action',status:'success',description:'Action',icon:'',duration:220}]);
 const rgb=color=>color.startsWith('#')?color.slice(1).match(/../g).map(v=>parseInt(v,16)):(color.match(/[\d.]+/g)||[]).map(Number);
 const luminance=color=>color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 // jsdom does not resolve CSS variables in SVG paint. Supply two explicit theme
 // palettes and resolve the renderer's selected color using normal CSS fallback.
 for(const theme of [{base:'#f4f5f7',text:'#1e293b',secondary:'#64748b'},{base:'#111318',text:'#e2e8f0',secondary:'#94a3b8'}]){
  const tokens={'--bento-text':theme.text,'--bento-text-secondary':theme.secondary};
  for(const node of [...graphic.querySelectorAll('text')].filter(n=>['10ms','220ms'].includes(n.textContent))){
   let rect=node.previousElementSibling;while(rect&&rect.tagName.toLowerCase()!=='rect')rect=rect.previousElementSibling;
   const paint=node.getAttribute('fill'),variable=paint.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/);let color=variable?(tokens[variable[1]]||variable[2]):paint;if(color==='currentColor')color=theme.text;assert.ok(color,'paint must resolve');
   const foreground=rgb(color),layer=rgb(rect.getAttribute('fill')),base=rgb(theme.base),alpha=layer[3]??1,background=layer.slice(0,3).map((v,i)=>v*alpha+base[i]*(1-alpha));const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert.ok(ratio>=4.5,`${node.textContent} on ${theme.base}: contrast ${ratio}`);
  }
 }
});
