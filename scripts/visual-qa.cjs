// Builds/serves only temporary static output. No database or live account is accessed.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {launch}=require('./visual-qa/browser.cjs');
const {caseKey,successfulCases,copyCase}=require('./visual-qa/case-cache.cjs');
const {masterFlow}=require('./visual-qa/master-flow.cjs');
const {inspectLayout,exerciseNavigation,auditContentPages,inspectNavigationTargets}=require('./visual-qa/checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const pages=[
 {id:'planet',route:'planet',critical:['.planet-visual-toolbar button'],inspectors:['.planet-inspector']},
 {id:'overview',route:'universe',critical:['.strategy-planet-picker select','.strategy-world-dossier a.px-primary'],inspectors:['.strategy-world-dossier']},
 {id:'installations',route:'development',critical:['.ux-inspector .build-review button'],inspectors:['.ux-inspector']},
 {id:'research',route:'research',critical:['.research-inspector .build-review button'],inspectors:['.research-inspector']},
 {id:'defense',route:'defenses',critical:['.ux-inspector .build-review button'],inspectors:['.ux-inspector']},
 {id:'shipyard',route:'shipyard',critical:['.naval-inspector .action.primary'],inspectors:['.naval-inspector']},
 {id:'galaxy',route:'galaxy',critical:['.system-detail .travel-planner a.button'],inspectors:['.system-detail']},
 {id:'production',route:'economy',critical:['.economy-command > .tabs button'],inspectors:['.economy-detail']},
 {id:'missions',route:'fleets?plan=1',critical:[],inspectors:['.px-mission-planner']},
 {id:'fleets',route:'fleets',critical:[],inspectors:['.fleet-list']},
 {id:'colonies',route:'overview',critical:['.overview-command > .tabs button'],inspectors:[]},
 {id:'diplomacy',route:'relations',critical:[],inspectors:['.px-diplomacy']},
 {id:'market',route:'relations?tab=market',critical:[],inspectors:['.market-area']},
 {id:'reports',route:'relations?tab=reports',critical:[],inspectors:['.px-reports']},
];
const selectedPages=process.env.STARZ_QA_VIEWS?pages.filter(p=>process.env.STARZ_QA_VIEWS.split(',').includes(p.id)):pages;
const sizes=[[1672,941],[1920,1080],[1440,900],[1366,768],[390,844]];
const cases=['empty','populated'].flatMap(stateName=>sizes.flatMap(([width,height])=>selectedPages.map(profile=>({stateName,width,height,profile}))));
if(!process.env.STARZ_QA_VIEWS){
 for(const [width,height]of sizes)for(const mode of ['loading','error'])cases.push({stateName:'empty',width,height,profile:{id:mode,route:'universe',critical:[],inspectors:[]}});
 for(const height of [844,650])for(const id of ['menu','resources','help','operations'])cases.push({stateName:'populated',width:390,height,profile:{id,route:'universe',critical:[],inspectors:[]}});
}
for(const [width,height]of [[1093,614],[390,650]])for(const profile of selectedPages)cases.push({stateName:'populated',width,height,profile});
const runCases=process.env.STARZ_QA_CASE?cases.filter(c=>`${c.profile.id}-${c.stateName}-${c.width}`===process.env.STARZ_QA_CASE):cases;
if(!runCases.length)throw Error('No matching QA cases.');
const expectedCases=runCases.length;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2'};
async function main(){
 const fixtures=JSON.parse(execFileSync(process.env.STARZ_QA_PYTHON||path.join(ROOT,'.venv/bin/python'),[path.join(ROOT,'tests/visual-qa/fixtures.py')],{cwd:ROOT,encoding:'utf8',maxBuffer:5e6,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,LANG:'C.UTF-8',STARZ_PERSISTENT:'1'}}));
 const output=path.resolve(process.env.STARZ_QA_OUTPUT||path.join(ROOT,'qa-artifacts/design'));
 if(![path.join(ROOT,'qa-artifacts'),path.join(ROOT,'.qa/runs')].some(base=>(output===base||output.startsWith(base+path.sep))))throw Error('Keep sanitized QA artifacts under repo qa-artifacts/ or .qa/runs/.');
 await fs.mkdir(output,{recursive:true});const reused=process.env.STARZ_QA_BUILD_DIR;
 const temp=reused?await fs.realpath(path.resolve(reused)):await fs.mkdtemp(path.join(os.tmpdir(),'starz-design-qa-'));
 if(reused&&(!temp.startsWith(path.join(ROOT,'.qa/runs')+path.sep)||!await fs.stat(path.join(temp,'index.html')).then(s=>s.isFile())))throw Error('Reusable QA build must be a local .qa/runs/ artifact.');
 let server,browser;
 const results=[],security=[],reusable=successfulCases(ROOT,process.env.STARZ_QA_REUSE_RESULTS);let origin,fatal;
 try{
  if(!reused){const {build}=await import('vite');await build({configFile:path.join(ROOT,'vite.config.ts'),envDir:false,envPrefix:'STARZ_PUBLIC_QA_',build:{outDir:temp,emptyOutDir:true},logLevel:'error'});}
  server=http.createServer(async(req,res)=>{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
   try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const relative=pathname==='/'?'index.html':pathname.startsWith('/static/')?pathname.slice(8):'';
    const file=path.resolve(temp,relative);
    if(!relative||!file.startsWith(temp+path.sep)||relative.split('/').some(p=>p.startsWith('.'))){res.writeHead(404).end();return;}
    const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:data);
   }catch{res.writeHead(404).end();}
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  browser=await launch();
  for(const {stateName,width,height,profile} of runCases){
   const hit=reusable.get(caseKey({stateName,width,height,profile}));if(hit){results.push(copyCase(hit,output));continue;}
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:width===1093?1.25:1,serviceWorkers:'block'});const page=await context.newPage(),errors=[];
   let reviewSnapshots=null;
   page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){security.push({code:'unexpected-network',origin:url.origin});await route.abort();await page.close();return;}
    if(!url.pathname.startsWith('/api/')){await route.continue();return;}
    if(request.method()!=='GET'){security.push({code:'blocked-api-mutation',path:url.pathname});await route.fulfill({status:403,json:{detail:'Visual QA forbids gameplay mutations.'}});return;}
    if(url.pathname==='/api/state'&&profile.id==='error'){await route.fulfill({status:503,json:{detail:'STAGED API FAILURE'}});return;}
    if(url.pathname==='/api/state'&&profile.id==='loading')await new Promise(resolve=>setTimeout(resolve,3000));
    const f=fixtures[stateName];const responses={'/api/config':{persistent:true},'/api/auth/me':{username:'VISUAL_QA_FIXTURE',empire_id:f.universe.empire_id},'/api/catalog':fixtures.catalog,'/api/state':reviewSnapshots?.[url.searchParams.get('planet_id')??f.state.active_planet.id]??f.state,'/api/universe':f.universe,'/api/galaxy':f.galaxy};
    if(!(url.pathname in responses)){security.push({code:'unhandled-api',path:url.pathname});await route.fulfill({status:404,json:{detail:'No QA fixture for this endpoint.'}});return;}
    if(!page.isClosed())await route.fulfill({json:responses[url.pathname]});
   });
   await context.routeWebSocket('**/*',socket=>{security.push({code:'unexpected-websocket',origin:new URL(socket.url()).origin});socket.close();});
   await page.clock.install({time:new Date(fixtures.now*1000)});
   await page.goto(origin+'/#/'+profile.route);await page.locator(profile.id==='loading'?'.boot':profile.id==='error'?'.fatal':'.px-view').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
   // Select actual contextual subviews, without posting any paid action.
   if(width===390){
    if(profile.id==='overview')await page.getByRole('tab',{name:'Situação e ordens',exact:true}).click();
    if(profile.id==='installations')await page.getByRole('tab',{name:'Ampliação',exact:true}).click();
    if(profile.id==='research')await page.getByRole('tab',{name:'Pesquisa e plano',exact:true}).click();
    if(profile.id==='defense')await page.getByRole('tab',{name:'Detalhe e construção',exact:true}).click();
    if(profile.id==='shipyard')await page.getByRole('tab',{name:'Montagem',exact:true}).click();
    if(profile.id==='galaxy')await page.getByRole('tab',{name:'Sistema e missão',exact:true}).click();
   }
   if(profile.id==='menu')await page.getByRole('button',{name:'Todos os setores',exact:true}).click();
   if(profile.id==='resources')await page.getByRole('button',{name:/Produção e detalhes dos recursos/}).click();
   if(profile.id==='help')await page.getByRole('button',{name:'Ajuda',exact:true}).click();
   if(profile.id==='operations')await page.getByRole('button',{name:/Operações ·/}).click();
   await page.waitForTimeout(150);
   if(profile.id==='galaxy'){const next=page.locator('.system-detail > .content-pages > nav [data-qa-next]');for(let n=0;n<20&&await next.count()&&!await next.isDisabled()&&!await page.locator('.system-detail .travel-planner a.button').isVisible();n++)await next.click();}
   const reviews=page.getByRole('button',{name:'Revisar',exact:true});for(const review of await reviews.all())if(await review.isVisible())await review.click();
   const dialogs=page.locator('dialog[open]');const scope=await dialogs.count()?dialogs.last():page;const full=scope.locator('button:visible').filter({hasText:/^Abrir .* em tela cheia/});if(await full.count()&&await full.first().isVisible())await full.first().click();
   await page.waitForTimeout(100);
   const check=await page.evaluate(inspectLayout,{...profile,allowedScroll:['.map-pan']});
   if(profile.id==='menu'){const targets=await page.evaluate(inspectNavigationTargets);check.findings.push(...targets.findings);check.touchTargets=targets.targets;}
   let navigation=[];
   try{
    navigation=await exerciseNavigation(page,{...profile,allowedScroll:['.map-pan']},stateName==='populated'&&width===390&&height===844?async(group,tab)=>page.screenshot({path:path.join(output,`${profile.id}-populated-390x844-tab-${group}-${tab}.png`),fullPage:false}):undefined);check.findings.push(...navigation.flatMap(n=>n.findings??[]));
    const reading=await auditContentPages(page,{...profile,allowedScroll:['.map-pan']});check.findings.push(...reading.findings);navigation.push(...reading.results);
    for(const selector of await page.locator('dialog[open]').count()?[]:profile.inspectors){for(const summary of await page.locator(selector+' details > summary').all()){
     if(!await summary.isVisible()||await summary.evaluate(el=>el.parentElement.open))continue;
     await summary.click();await page.waitForTimeout(100);const expanded=await page.evaluate(inspectLayout,{...profile,allowedScroll:['.map-pan']});check.findings.push(...expanded.findings.map(f=>({...f,phase:'expanded-inspector'})));await summary.click();
    }}
    if(profile.id==='reports'&&stateName==='populated'){const report=page.locator('.defense-battle > button:visible').first();if(await report.count()){await report.click();await page.waitForTimeout(100);const reading=await auditContentPages(page,{...profile,allowedScroll:['.map-pan']});check.findings.push(...reading.findings);navigation.push(...reading.results);}}
   }catch(e){errors.push('Interaction check: '+e.message);}

   const screenshot=`${profile.id}-${stateName}-${width}x${height}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:false});
   if(profile.id==='menu'){try{
    const dialog=page.getByRole('dialog',{name:'Setores do império'}),toggle=page.getByRole('button',{name:'Todos os setores',exact:true});
    await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await dialog.waitFor({state:'detached'});
    const target=await toggle.boundingBox();if(!target||target.width<44||target.height<44)throw Error('Menu opener must be at least 44px');
    await toggle.focus();await page.keyboard.press('Enter');await dialog.waitFor();
    await dialog.getByRole('link',{name:'Instalações',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#/development');await dialog.waitFor({state:'detached'});
    navigation.push({kind:'mobile-menu',passed:true,checks:['close/reopen','44px opener','keyboard navigation to Installations']});
   }catch(e){errors.push('Mobile menu flow: '+e.message);}}
   if(process.env.STARZ_QA_MASTER_FLOW==='1'&&profile.id==='overview'&&stateName==='populated'&&((width===1672&&height===941)||(width===390&&height===844))){try{navigation.push(await masterFlow(page,{fixture:fixtures[stateName],updateSnapshots:value=>{reviewSnapshots=value;},output:{origin,path:path.join(output,`master-flow-${width}x${height}.png`)}}));}catch(e){errors.push('Master interaction flow: '+e.message);}}
   results.push({view:profile.id,state:stateName,...check,navigation,errors,screenshot});await context.close();
   if(security.length)throw Error('Security boundary triggered; stopped. Inspect sanitized security findings.');
  }
 }catch(e){fatal=e.message;throw e;}finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));if(!reused)await fs.rm(temp,{recursive:true,force:true});
  const failures=results.reduce((n,r)=>n+r.findings.length+r.errors.length+r.navigation.filter(t=>!t.passed).length,0);
  const status=fatal||results.length!==expectedCases?(results.length?'INCOMPLETE':'NOT_RUN'):failures||security.length?'FAIL':'MEASURED_CHECKS_PASS_VISUAL_REVIEW_PENDING';
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify({status,fatal,expectedCases,reusedCases:results.filter(r=>r.cachedCase).length,fixtureOnly:true,usesDatabase:false,security,results},null,2));
  console.log(`${results.length} staged viewport checks; ${failures} findings; ${security.length} security events. Screenshots require manual review: ${output}`);
  if(fatal||results.length!==expectedCases||failures||security.length)process.exitCode=1;
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
