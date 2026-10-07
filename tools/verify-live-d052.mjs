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
import { d052Smoke } from './smoke-d052.mjs';
import { d052FixtureManifest, D052_MODES } from './d052-scenes.mjs';

export const SITE='https://lijiabao1998.github.io/GlimmerTown3D-lab/';
export const RELEASE='39bfa913ac2e955490448ef52c2f587f9c237101';
export const APPROVED='b984e6914a536e0c0040898ac12748521e335e7e';
export const APPROVED_TREE='ea1e5662d927e778a6946bd6f2ce12e9ca72d4dd';
export const EXPECTED='4c3c4e05a2ab5cbdde1b7055593ca8531c0ac7814c7049e6522a6ea4825cb075';
const BRANCH='claude/d052-live-verification',ORIGIN=new URL(SITE).origin;
const OUT=path.join(ROOT,'scratch/live-d052'),SHOTS=path.join(ROOT,'scratch/shots'),J=JSON.stringify;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
// Candidate evidence: full PR run 37630455795, artifact 11487863076.
// Twelve before/after originals approved by the owner on 2026-10-07.
export const APPROVED_SHOTS={
  "D052-after-paid-c6-hud-360.png": "bfe68085fd4cd67369a06e80cb3810212d4e67fafebec2f9f2e1cf59bf0bd956",
  "D052-after-eco-reg-capacity-412.png": "268ac25e18baa946278f32fe7282126005dea0354df47648eac5f1d413631ad6",
  "D052-after-budget-limit-360.png": "778c9a8c932969f1435ef44e3bd5f19f52f304ccf695c69c805a5b3b3138403e",
  "D052-after-free-resume-412.png": "600c4c6b5c201864b8327a28d9ebec25f13b7221efcc5fce3352de48ce79ec77",
  "D052-after-population-lock-360.png": "429034b1f9a8a3d2841163f5bd02234cd1b8607efca30c0a48abd724d0f98d97",
  "D052-after-research-completion-412.png": "b29e7d3088c0c156681d5a9600311a9c41768258e3b61b32cdc8a22d80513c63"
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
  assert.match(RELEASE,/^[0-9a-f]{40}$/,'pin the image-approved deployed merge before running');
  if(process.env.GITHUB_REF)assert.equal(process.env.GITHUB_REF,'refs/heads/'+BRANCH,'QA must not run on another branch');
  else assert.equal(git('branch','--show-current'),BRANCH,'isolated QA branch required');
  assert.equal(process.env.D052_SMOKE_ONLY??'','','all D052 sections must run');
  assert.equal(git('rev-parse',APPROVED+'^{tree}'),APPROVED_TREE);
  assert.equal(git('rev-parse',RELEASE+'^{tree}'),APPROVED_TREE,'release tree equals image-approved tree');
  git('diff','--exit-code',RELEASE,'--','.',':(exclude).github/workflows/ci.yml',':(exclude)tools/verify-live-d052.mjs');
  const extra=git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean).filter(f=>f!=='tools/verify-live-d052.mjs');
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
  return {localSha256,approvedTree:APPROVED_TREE,fixtures:D052_MODES.map(d052FixtureManifest)};
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

export async function verifyLiveD052(){
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
  const report={site:SITE,release:RELEASE,approved:APPROVED,approvedTree:APPROVED_TREE,expectedSha256:EXPECTED,
    mode:'Official GitHub Pages; Chrome + SwiftShader, real trusted CDP touch at 360x740/412x860 and desktop keyboard; not Android hardware',
    unchangedSuite:'d052Smoke all sections: six fixed comparisons; paid/free/rejected actions, quota/fallback saves and reload; budget limits; true held touch across daily updates and offer reorder/removal/cancellation; actual play, keyboard and 12-day paired trajectory',
    startupReadiness:'Before the first hash of each navigation, one inert boot-readiness expression !!(window.__gt&&__gt.ready) may be polled. Every suite read, input and capture runs only after the actual loaded document hash is verified.',
    requestAdapter:'Only suite-facing request-list strings normalize official origin to localhost. Actual requests/redirect events, navigation, documents, and screenshot pixels are not rewritten.',
    isolation:'Fresh disposable browser profiles contain synthetic local save fixtures. No server data, accounts, external sharing, or deployment actions.',
    faultInjection:'Synthetic local save fixtures, event/storage probes and fixed camera. Controlled localStorage quota failure and IndexedDB block test existing recovery/fallback. Long-panel scrollIntoView is test positioning; buttons use trusted CDP touch/mouse or native keys, including held native press/release/cancel. Daily advances use the real simulator, with a separate normal-play animation check. Clipboard outcomes and confirmation decisions are not injected; device Back and Android hardware are not tested.',
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
            // Boot readiness only; all suite reads/input/capture are hash-gated below.
            if(tree.frameTree.frame.loaderId===nav.loaderId&&await page.evaluate('!!(window.__gt&&__gt.ready)').catch(()=>false)){ready=true;break;}
          }
          assert.ok(ready,`official page did not become ready: ${expectedUrl}`);
          await verifyDocument();await sleep(options.settle??900);
        };
        const livePage={...page,
          get requests(){return page.requests.map(compatRequestUrl);},
          evaluate:async expression=>{
            await verifyDocument();return page.evaluate(expression);
          },
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
    const stale=fs.readdirSync(SHOTS).filter(name=>/^D052-.*\.png$/.test(name));assert.deepEqual(stale,[],'fresh live QA output required');
    const response=await fetch(SITE,{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200);assert.match(response.headers.get('content-type')??'',/text\/html/);
    const bytes=Buffer.from(await response.arrayBuffer());report.liveSha256=hash(bytes);report.liveBytes=bytes.length;
    assert.equal(report.liveSha256,EXPECTED,'approved release must be deployed before live tests');
    log(true,'Official HTTP 200 HTML matches approved release SHA256',EXPECTED);
    await d052Smoke(liveBrowser,suiteLog);
    assert.equal(report.sessions.length,20,'all twenty browsers must run');
    assert.deepEqual(report.sessions.map(s=>s.documents),[2,2,2,2,2,2,3,3,3,6,2,2,2,4,4,4,2,4,2,2],'exact unchanged-suite navigation coverage');
    assert.equal(report.documentHashes.length,55,'all fifty-five official documents hashed');
    assert.ok(report.documentHashes.every(d=>d.sha256===EXPECTED));
    assert.equal(report.suiteChecks.length,73,'all 73 unchanged D052 checks must report');
    assert.ok(report.suiteChecks.every(c=>c.ok),'all D052 checks must pass');
    const evidence=JSON.parse(fs.readFileSync(path.join(SHOTS,'D052-evidence.json'),'utf8'));
    assert.equal(evidence.sessions.length,20);assert.equal(evidence.checks.length,73);assert.ok(evidence.checks.every(c=>c.ok));assert.equal(evidence.trajectory?.days,12);assert.equal(evidence.trajectory?.snapshots,13);assert.equal(evidence.trajectory.sha256,'5cbb326aa5a4089907c6d795a0c315def6eda69423e7d409e8d40120ff45fbcc');
    assert.equal(evidence.captureCases.length,6);assert.ok(evidence.captureCases.every(c=>c.passed&&c.fixture.baseline.commit==='c1ac6154bf77306b374a740901f98d8708a96478'));
    const files=fs.readdirSync(SHOTS).filter(name=>/^D052-.*\.png$/.test(name)).sort();
    assert.deepEqual(files,Object.keys(APPROVED_SHOTS).sort(),'six new expected images, no missing or stale images');
    for(const file of files){
      const actual=hash(fs.readFileSync(path.join(SHOTS,file))),approved=APPROVED_SHOTS[file];
      report.screenshots.push({file,sha256:actual,approvedSha256:approved,exactMatch:actual===approved});
      assert.equal(evidence.shots.find(s=>s.filename===file)?.sha256,actual,'suite evidence agrees with actual screenshot bytes');
    }
    log(report.screenshots.every(s=>s.exactMatch),'Six actual-public-site screenshots exactly match user-approved candidate PNG bytes',J(report.screenshots));
    log(true,'Complete official rollout coverage: twenty fresh browsers, fifty-five approved documents, 73 suite checks, six images');
  }catch(error){log(false,'Live D052 verification',error.stack);}
  finally{write();}
  console.log(J({passed:report.passed,failed:report.failed,documents:report.documentHashes.length,sessions:report.sessions.length,site:SITE}));
  return report.failed?1:0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--preflight'))console.log(J(localPreflight(),null,2));
  else process.exitCode=await verifyLiveD052();
}
