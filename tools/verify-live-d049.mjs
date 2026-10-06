// QA-only branch. Never merge. No product or original suite changes.
// Browser documents are loaded directly from official Pages. The existing CDP
// helper's local server is an unused sentinel; a browser localhost request fails.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { d049Smoke } from './smoke-d049.mjs';
import { verifyD048Fixture } from './smoke-d048.mjs';

export const SITE='https://lijiabao1998.github.io/GlimmerTown3D-lab/';
export const RELEASE='71bf40db307663c2713ec6a83c2aa4c327e5c7ca';
export const APPROVED='960b3e329717d7895bf788f0e095b1efee1dcc82';
export const APPROVED_TREE='32226116bbe345d3415a00f309d9b851a3c8651f';
export const EXPECTED='68d825da457c2f64dec5b72da04fbda0dac131fbe8ff9f00b785f1a21f6bb000';
const BRANCH='claude/d049-live-verification',ORIGIN=new URL(SITE).origin;
const OUT=path.join(ROOT,'scratch/live-d049'),SHOTS=path.join(ROOT,'scratch/shots'),J=JSON.stringify;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
// Approved candidate evidence: run 37541181110, artifact 11450621175.
export const APPROVED_SHOTS={
  "D049-unsupported-after-360x740.png": "4b0c45dcc824afdde0b3082cdb81e687674b442eda2ede8d317a1462fb006121",
  "D049-rejected-after-360x740.png": "5561ec25fe9d81ef7dccc16dd3b40f4f84d1fa5e4ce790930eef3b4bc86a79b2",
  "D049-ready-after-412x860.png": "d7cbe8a5c3935d9a8a6d8baa2c1389bef7c59b553619842d49d58e6c7e3912d1",
  "D049-success-after-412x860.png": "609128dd9fd797dd5479a810f63fc0e29bc89aa596dfcd5eef9f54fda83e0884",
  "D049-pending-after-412x860.png": "c8cd6ae9af6313822b9599c738ca5bd2ad41bc651edf4b29d88a26c27b61e76a",
  "D049-reopened-after-412x860.png": "d7cbe8a5c3935d9a8a6d8baa2c1389bef7c59b553619842d49d58e6c7e3912d1"
};

// The unchanged suite only recognizes localhost in its asset allowlist. Adapt
// that read-only representation alone; retain independently checked raw CDP URLs.
export function compatRequestUrl(raw){
  if(/^(data:|blob:|about:)/.test(raw))return raw;
  try{const u=new URL(raw);return u.origin===ORIGIN?`http://127.0.0.1:8311${u.pathname}${u.search}${u.hash}`:raw;}catch{return raw;}
}
export function unexpectedRequests(requests){
  return requests.filter(raw=>{
    if(raw==='about:blank'||raw.startsWith('data:'))return false;
    try{return new URL(raw).origin!==ORIGIN;}catch{return true;}
  });
}
export function assertOfficialDocument(frame,expectedUrl){
  const u=new URL(frame.url);
  assert.equal(u.origin+u.pathname,SITE,'document is not official Pages');
  if(expectedUrl!==undefined)assert.equal(frame.url,expectedUrl,'redirect or query substitution');
}
export function localPreflight(){
  if(process.env.GITHUB_REF)assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH,'QA must not run on another branch');
  else assert.equal(git('branch','--show-current'),BRANCH,'isolated QA branch required');
  assert.equal(process.env.D049_SMOKE_ONLY??'','','all D049 sections must run');
  assert.equal(git('rev-parse',APPROVED+'^{tree}'),APPROVED_TREE);
  assert.equal(git('rev-parse',RELEASE+'^{tree}'),APPROVED_TREE,'release tree equals image-approved tree');
  git('diff','--exit-code',RELEASE,'--','.',':(exclude).github/workflows/ci.yml',':(exclude)tools/verify-live-d049.mjs');
  const extra=git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean).filter(f=>f!=='tools/verify-live-d049.mjs');
  assert.deepEqual(extra,[],'no unexpected untracked source/test files');
  const localSha256=hash(fs.readFileSync(path.join(ROOT,'dist/index.html')));
  assert.equal(localSha256,EXPECTED,'local build must equal image-approved HTML');
  // Exercise adapters against disallowed/local/look-alike URLs without navigation.
  const allowed=[SITE,SITE+'?sample=seed516&clean=1',ORIGIN+'/favicon.ico','data:image/png;base64,AA==','blob:'+SITE+'test','about:blank'];
  assert.deepEqual(unexpectedRequests(allowed),[]);
  const denied=['http://127.0.0.1:8311/','https://example.com/','https://lijiabao1998.github.io.evil.example/','blob:https://example.com/id','not a URL'];
  assert.deepEqual(unexpectedRequests(denied),denied);
  for(const u of denied)assert.equal(compatRequestUrl(u),u);
  assert.equal(compatRequestUrl(SITE+'?x=1'),'http://127.0.0.1:8311/GlimmerTown3D-lab/?x=1');
  assertOfficialDocument({url:SITE},SITE);
  assert.throws(()=>assertOfficialDocument({url:SITE+'?changed=1'},SITE));
  assert.throws(()=>assertOfficialDocument({url:ORIGIN+'/GlimmerTown-lab/'},SITE));
  return {localSha256,approvedTree:APPROVED_TREE,fixture:verifyD048Fixture()};
}

// A second, read-only CDP connection records raw network events, including
// redirectResponse. It does not intercept or substitute any browser traffic.
// Only the Node-side CDP metadata discovery touches localhost, never the page.
async function observeRawNetwork(page,port,session){
  const {targetInfo}=await page.send('Target.getTargetInfo');
  const devPort=port+1000+page.chrome.tries-1;
  const targets=await (await fetch(`http://127.0.0.1:${devPort}/json/list`)).json();
  const target=targets.find(t=>t.id===targetInfo.targetId&&t.type==='page');
  assert.ok(target?.webSocketDebuggerUrl,'same-page CDP observer endpoint');
  const endpoint=new URL(target.webSocketDebuggerUrl);
  assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.port,String(devPort));assert.equal(endpoint.protocol,'ws:');
  const ws=new WebSocket(endpoint.href),pending=new Map();let next=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id&&pending.has(message.id)){
      const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
      message.error?reject(new Error(message.error.message)):resolve(message.result);return;
    }
    const p=message.params;
    if(message.method==='Network.requestWillBeSent'){
      session.networkRequests.push({url:p.request.url,type:p.type,frameId:p.frameId,loaderId:p.loaderId,requestId:p.requestId});
      if(p.redirectResponse)session.redirects.push({from:p.redirectResponse.url,to:p.request.url,status:p.redirectResponse.status});
    }
    if(message.method==='Network.responseReceived'&&p.type==='Document')session.documentResponses.push({url:p.response.url,status:p.response.status,mime:p.response.mimeType,frameId:p.frameId,loaderId:p.loaderId,fromServiceWorker:!!p.response.fromServiceWorker});
    if(message.method==='Page.frameNavigated'&&p.frame.parentId)session.childFrames.push({id:p.frame.id,parentId:p.frame.parentId,url:p.frame.url});
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(J({id,method,params}));});
  await send('Network.enable');await send('Page.enable');
  return {flush:()=>send('Runtime.evaluate',{expression:'0',returnByValue:true}),close:()=>ws.close()};
}

export async function verifyLiveD049(){
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
  const report={site:SITE,release:RELEASE,approved:APPROVED,approvedTree:APPROVED_TREE,expectedSha256:EXPECTED,
    mode:'Official GitHub Pages; Chrome + SwiftShader, real trusted CDP touch at 360x740/412x860 and desktop keyboard; not Android hardware',
    unchangedSuite:'d049Smoke all sections: portraits, native keyboard, Clipboard availability/errors, duplicate/stale session interleavings, exact code/save/history, 20-day no-reload paired trajectory',
    requestAdapter:'Only suite-facing request-list strings normalize official origin to localhost. Actual requests/redirect events, navigation, documents, and screenshot pixels are not rewritten.',
    isolation:'Fresh disposable browser profiles contain synthetic local save fixtures. No server data, accounts, external sharing, or deployment actions.',
    faultInjection:'Every session uses a test-only navigator.clipboard substitute for resolved/rejected/deferred writes, absent API/method, getter failure and synchronous throw. Storage quota errors and pagehide/pageshow events are explicitly injected. This verifies production UI handling on the official site, not native OS Clipboard integration or real device Back.',
    checks:[],suiteChecks:[],sessions:[],documentHashes:[],screenshots:[]};
  const write=()=>{report.passed=report.checks.filter(c=>c.ok).length;report.failed=report.checks.filter(c=>!c.ok).length;fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');};
  const log=(ok,name,detail='')=>{report.checks.push({ok,name,detail});console.log(ok?'OK':'NG',name,detail);write();};
  const suiteLog=(ok,name,detail='')=>{report.suiteChecks.push({ok,name,detail});log(ok,name,detail);};
  let sequence=0;
  const liveBrowser=async(options,run)=>{
    const id=++sequence,port=8450+id*10;
    const session={id,documents:0,rawRequests:[],networkRequests:[],documentResponses:[],redirects:[],childFrames:[],errors:[]};report.sessions.push(session);
    try{
      await withBrowser({...options,port,root:path.join(OUT,'unused-host'),overlay:{'index.html':'<!doctype html><title>Unused QA sentinel</title>'}},async({page})=>{
        const observer=await observeRawNetwork(page,port,session),verified=new Set();let expectedUrl=null;
        await page.send('Network.setCacheDisabled',{cacheDisabled:true});
        await page.send('Network.setBypassServiceWorker',{bypass:true});
        const verifyDocument=async()=>{
          const tree=await page.send('Page.getFrameTree'),frame=tree.frameTree.frame;
          assert.equal(tree.frameTree.childFrames?.length??0,0,'no child documents permitted');
          assertOfficialDocument(frame,expectedUrl??undefined);
          if(verified.has(frame.loaderId))return frame;
          const resource=await page.send('Page.getResourceContent',{frameId:frame.id,url:frame.url});
          const bytes=Buffer.from(resource.content,resource.base64Encoded?'base64':'utf8'),sha256=hash(bytes);
          report.documentHashes.push({session:id,url:frame.url,loaderId:frame.loaderId,sha256,bytes:bytes.length});
          assert.equal(sha256,EXPECTED,'every actual loaded official document must match approved HTML');
          verified.add(frame.loaderId);session.documents++;write();return frame;
        };
        const open=async(query='')=>{
          expectedUrl=SITE+(query?'?'+query:'');
          const nav=await page.send('Page.navigate',{url:expectedUrl});
          assert.ok(!nav.errorText,nav.errorText);assert.ok(nav.loaderId,'a real document navigation must occur');
          let ready=false;
          for(const started=Date.now();Date.now()-started<30000;await sleep(150)){
            const tree=await page.send('Page.getFrameTree');
            if(tree.frameTree.frame.loaderId===nav.loaderId&&await page.evaluate('!!(window.__gt&&__gt.ready)').catch(()=>false)){ready=true;break;}
          }
          assert.ok(ready,`official page did not become ready: ${expectedUrl}`);
          await verifyDocument();await sleep(options.settle??900);
        };
        const livePage={...page,
          get requests(){return page.requests.map(compatRequestUrl);},
          evaluate:async expression=>{await verifyDocument();return page.evaluate(expression);},
          send:async(method,params={})=>{
            assert.notEqual(method,'Page.navigate','navigation must use official verified open wrapper');
            if(method.startsWith('Input.')||method==='Page.captureScreenshot'||method==='Runtime.evaluate')await verifyDocument();
            return page.send(method,params);
          },
        };
        try{await run({page:livePage,open});}
        finally{
          try{
            await verifyDocument();await observer.flush();
            // Drain the primary CDP session too, then snapshot errors/requests.
            // Capturing before these awaited barriers could miss a late error.
            await page.send('Runtime.evaluate',{expression:'0',returnByValue:true});
            session.rawRequests=[...page.requests];session.errors=[...page.errors];
            const unexpected=unexpectedRequests([...session.rawRequests,...session.networkRequests.map(r=>r.url)]);
            assert.deepEqual(session.redirects,[],'no HTTP redirects permitted');
            assert.deepEqual(session.childFrames,[],'no observed child-frame navigation permitted');
            assert.equal(session.documentResponses.length,session.documents,'every document response must be hashed');
            assert.ok(session.documentResponses.every(r=>r.status===200&&r.mime==='text/html'&&!r.fromServiceWorker),'all documents are real official HTTP 200 HTML, not service-worker substitutions');
            assert.deepEqual([...new Set(session.documentResponses.map(r=>r.loaderId))].sort(),[...verified].sort(),'hashes cover every loaded document loader');
            log(!unexpected.length&&!session.errors.length&&session.documents>0,`Live session ${id}: raw origins, every document, no redirects/frames/errors`,J({unexpected,documents:session.documents,requests:session.rawRequests.length,errors:session.errors}));
          }finally{observer.close();write();}
        }
      });
    }catch(error){log(false,`Live session ${id}: official navigation/document verification`,error.stack);}
  };
  try{
    report.localPreflight=localPreflight();log(true,'Approved product, fixtures, original suite/CDP helper and local build unchanged',J(report.localPreflight));
    // Refuse stale captures rather than count leftover screenshots as new evidence.
    const stale=fs.readdirSync(SHOTS).filter(name=>/^D049-.*\.png$/.test(name));assert.deepEqual(stale,[],'fresh live QA output required');
    const response=await fetch(SITE,{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200);assert.match(response.headers.get('content-type')??'',/text\/html/);
    const bytes=Buffer.from(await response.arrayBuffer());report.liveSha256=hash(bytes);report.liveBytes=bytes.length;
    assert.equal(report.liveSha256,EXPECTED,'approved release must be deployed before live tests');
    log(true,'Official HTTP 200 HTML matches approved release SHA256',EXPECTED);
    await d049Smoke(liveBrowser,suiteLog);
    assert.equal(report.sessions.length,6,'all six browsers must run');
    assert.deepEqual(report.sessions.map(s=>s.documents),[2,2,2,2,2,2],'exact unchanged-suite navigation coverage');
    assert.equal(report.documentHashes.length,12,'all twelve official documents hashed');
    assert.ok(report.documentHashes.every(d=>d.sha256===EXPECTED));
    assert.equal(report.suiteChecks.length,19,'all 19 unchanged D049 checks must report');
    assert.ok(report.suiteChecks.every(c=>c.ok),'all D049 checks must pass');
    const evidence=JSON.parse(fs.readFileSync(path.join(SHOTS,'D049-evidence.json'),'utf8'));
    assert.equal(evidence.base,'0605e477345652fba037a428ceff460e5bd8bb1f');assert.ok(evidence.rng?.pass);assert.equal(evidence.rng.digest,'5ce9dcb66f837b035f70e7cf7cd4f647316dbc1cfa2a344226130326f9bdc8e9');
    const files=fs.readdirSync(SHOTS).filter(name=>/^D049-.*\.png$/.test(name)).sort();
    assert.deepEqual(files,Object.keys(APPROVED_SHOTS).sort(),'six new expected images, no missing or stale images');
    for(const file of files){
      const actual=hash(fs.readFileSync(path.join(SHOTS,file))),approved=APPROVED_SHOTS[file];
      report.screenshots.push({file,sha256:actual,approvedSha256:approved,exactMatch:actual===approved});
      assert.equal(evidence.shots.find(s=>s.file===file)?.sha256,actual,'suite evidence agrees with actual screenshot bytes');
    }
    log(report.screenshots.every(s=>s.exactMatch),'Six actual-public-site screenshots exactly match user-approved candidate PNG bytes',J(report.screenshots));
    log(true,'Complete official rollout coverage: six fresh browsers, twelve approved documents, 19 suite checks, six images');
  }catch(error){log(false,'Live D049 verification',error.stack);}
  finally{write();}
  console.log(J({passed:report.passed,failed:report.failed,documents:report.documentHashes.length,sessions:report.sessions.length,site:SITE}));
  return report.failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--preflight'))console.log(J(localPreflight(),null,2));
  else process.exitCode=await verifyLiveD049();
}
