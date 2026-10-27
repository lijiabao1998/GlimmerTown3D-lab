import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStartup } from '../src/ui/startup.ts';
export async function startupGuards() {
  const names = ['window','document','location','requestAnimationFrame','KeyboardEvent'];
  const saved = names.map(k => [k, Object.getOwnPropertyDescriptor(globalThis,k)]);
  const setup = (search='') => {
    const nodes = Object.fromEntries(['root','status','enter','retry'].map(k=>[k,{hidden:k==='retry',disabled:k==='enter',dataset:{},textContent:'',setAttribute(){},addEventListener(){},focus(){globalThis.document.activeElement=this;}}]));
    globalThis.KeyboardEvent=class {constructor(key,shiftKey=false){this.key=key;this.shiftKey=shiftKey;this.target=nodes.root;}preventDefault(){this.prevented=true;}stopImmediatePropagation(){this.stopped=true;}};
    nodes.root.querySelectorAll=()=>[nodes.enter,nodes.retry];
    nodes.enter.getClientRects=()=>nodes.root.dataset.phase==='welcome'?[1]:[];
    nodes.retry.getClientRects=()=>nodes.retry.hidden?[]:[1];
    nodes.root.querySelector = s=>nodes[s.replace('#startup-','')];
    nodes.root.contains = n=>Object.values(nodes).includes(n);
    const events = new Map(); let paints=0, reloads=0;
    globalThis.document={querySelector:()=>nodes.root,activeElement:null};
    globalThis.window={addEventListener:(t,f)=>events.set(t,f),removeEventListener:t=>events.delete(t)};
    globalThis.location={search,reload:()=>reloads++};
    globalThis.requestAnimationFrame=f=>{paints++;queueMicrotask(f);};
    return {nodes,events,paints:()=>paints,reloads:()=>reloads};
  };
  try {
    let env=setup(), calls=0;
    const startup=createStartup();
    await startup.start(async stage=>{calls++;await stage('actual-stage');});
    assert.equal(calls,0);assert.equal(env.nodes.root.dataset.phase,'welcome');assert.equal(env.nodes.enter.disabled,false);
    env.nodes.enter.onclick();env.nodes.enter.onclick();
    for(let i=0;i<30;i++) await Promise.resolve();
    assert.equal(calls,1);assert.equal(env.nodes.root.hidden,true);assert.equal(env.events.size,0);assert.ok(env.paints()>=6);
    env=setup('?sample=starter');calls=0;
    await createStartup().start(async()=>{calls++;});assert.equal(calls,1);assert.equal(env.nodes.root.hidden,true);
    env=setup('?mode=history');const errorLog=console.error;console.error=()=>{};
    try {await createStartup().start(async()=>{throw new Error('intentional boot failure');});} finally {console.error=errorLog;}
    assert.equal(env.nodes.root.dataset.phase,'error');assert.equal(env.nodes.retry.hidden,false);assert.notEqual(env.nodes.root.hidden,true);assert.equal(env.events.size,6);
    for(const shift of [false,true]){const e=new KeyboardEvent('Tab',shift);env.events.get('keydown')(e);assert.equal(e.prevented,true);assert.equal(document.activeElement,env.nodes.retry);}
    const outside=new KeyboardEvent('x');outside.target={};env.events.get('keydown')(outside);assert.equal(outside.prevented,true);assert.equal(outside.stopped,true);
    env.nodes.retry.onclick();assert.equal(env.reloads(),1);
    const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
    assert.match(html,/prefers-reduced-motion: reduce/);assert.match(html,/safe-area-inset-bottom/);assert.match(html,/aria-live="polite"/);assert.match(html,/id="startup"/);assert.match(html,/noscript/);
    console.log('D091 PASS: idle welcome, once-only entry, painted stages, direct links, error shield/reload, reduced-motion/safe-area/static shell guards');
  } finally {for(const [k,d] of saved){if(d) Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await startupGuards();
