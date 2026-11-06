// Builds/serves only temporary static output. No database or live account is accessed.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {launch}=require('./visual-qa/browser.cjs');
const {inspectLayout,exerciseNavigation}=require('./visual-qa/checks.cjs');
const ROOT=path.resolve(__dirname,'..');
const pages=[
 {id:'overview',route:'universe',critical:['.strategy-planet-picker select','.strategy-world-dossier a.px-primary'],inspectors:['.strategy-world-dossier']},
 {id:'installations',route:'development',critical:['.ux-inspector > button'],inspectors:['.ux-inspector']},
 {id:'research',route:'research',critical:['.research-inspector > button'],inspectors:['.research-inspector']},
 {id:'defense',route:'defenses',critical:['.ux-inspector > button'],inspectors:['.ux-inspector']},
 {id:'shipyard',route:'shipyard',critical:['.naval-inspector .action.primary'],inspectors:['.naval-inspector']},
 {id:'galaxy',route:'galaxy',critical:['.system-detail .travel-planner a.button'],inspectors:['.system-detail']},
];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2'};
async function main(){
 const fixtures=JSON.parse(execFileSync(process.env.STARZ_QA_PYTHON||path.join(ROOT,'.venv/bin/python'),[path.join(ROOT,'tests/visual-qa/fixtures.py')],{cwd:ROOT,encoding:'utf8',maxBuffer:5e6,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,LANG:'C.UTF-8',STARZ_PERSISTENT:'1'}}));
 const output=path.resolve(process.env.STARZ_QA_OUTPUT||path.join(ROOT,'qa-artifacts/design'));
 if(output!==path.join(ROOT,'qa-artifacts')&&!output.startsWith(path.join(ROOT,'qa-artifacts')+path.sep))throw Error('Keep sanitized QA artifacts under repo qa-artifacts/.');
 await fs.mkdir(output,{recursive:true});const temp=await fs.mkdtemp(path.join(os.tmpdir(),'starz-design-qa-'));let server,browser;
 const results=[],security=[];let origin,fatal;
 try{
  const {build}=await import('vite');await build({configFile:path.join(ROOT,'vite.config.ts'),envDir:false,envPrefix:'STARZ_PUBLIC_QA_',build:{outDir:temp,emptyOutDir:true},logLevel:'error'});
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
  for(const stateName of ['empty','populated'])for(const [width,height] of [[1920,1080],[1366,768],[390,844]])for(const profile of pages){
   const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});const page=await context.newPage(),errors=[];
   page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){security.push({code:'unexpected-network',origin:url.origin});await route.abort();await page.close();return;}
    if(!url.pathname.startsWith('/api/')){await route.continue();return;}
    if(request.method()!=='GET'){security.push({code:'blocked-api-mutation',path:url.pathname});await route.fulfill({status:403,json:{detail:'Visual QA forbids gameplay mutations.'}});return;}
    const f=fixtures[stateName];const responses={'/api/config':{persistent:true},'/api/auth/me':{username:'VISUAL_QA_FIXTURE',empire_id:f.universe.empire_id},'/api/catalog':fixtures.catalog,'/api/state':f.state,'/api/universe':f.universe,'/api/galaxy':f.galaxy};
    if(!(url.pathname in responses)){security.push({code:'unhandled-api',path:url.pathname});await route.fulfill({status:404,json:{detail:'No QA fixture for this endpoint.'}});return;}
    await route.fulfill({json:responses[url.pathname]});
   });
   await context.routeWebSocket('**/*',socket=>{security.push({code:'unexpected-websocket',origin:new URL(socket.url()).origin});socket.close();});
   await page.clock.install({time:new Date(fixtures.now*1000)});
   await page.goto(origin+'/#/'+profile.route);await page.locator('.px-view').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
   // Select actual contextual subviews, without posting any paid action.
   if(width===390){
    if(profile.id==='overview')await page.getByRole('tab',{name:'Situação e ordens',exact:true}).click();
    if(profile.id==='installations')await page.getByRole('tab',{name:'Ampliação',exact:true}).click();
    if(profile.id==='research')await page.getByRole('tab',{name:'Pesquisa e plano',exact:true}).click();
    if(profile.id==='defense')await page.getByRole('tab',{name:'Detalhe e construção',exact:true}).click();
    if(profile.id==='shipyard')await page.getByRole('tab',{name:'Montagem',exact:true}).click();
    if(profile.id==='galaxy')await page.getByRole('tab',{name:'Sistema e missão',exact:true}).click();
   }
   await page.waitForTimeout(150);
   const check=await page.evaluate(inspectLayout,{...profile,allowedScroll:['.map-pan']});
   let navigation=[];
   try{
    navigation=await exerciseNavigation(page);
    for(const selector of profile.inspectors){for(const summary of await page.locator(selector+' details > summary').all()){
     if(!await summary.isVisible()||await summary.evaluate(el=>el.parentElement.open))continue;
     await summary.click();const expanded=await page.evaluate(inspectLayout,{...profile,allowedScroll:['.map-pan']});check.findings.push(...expanded.findings.map(f=>({...f,phase:'expanded-inspector'})));await summary.click();
    }}
   }catch(e){errors.push('Interaction check: '+e.message);}
   const screenshot=`${profile.id}-${stateName}-${width}.png`;await page.screenshot({path:path.join(output,screenshot),fullPage:false});
   results.push({view:profile.id,state:stateName,...check,navigation,errors,screenshot});await context.close();
   if(security.length)throw Error('Security boundary triggered; stopped. Inspect sanitized security findings.');
  }
 }catch(e){fatal=e.message;throw e;}finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(temp,{recursive:true,force:true});
  const failures=results.reduce((n,r)=>n+r.findings.length+r.errors.length+r.navigation.filter(t=>!t.passed).length,0);
  const status=fatal||results.length!==36?(results.length?'INCOMPLETE':'NOT_RUN'):failures||security.length?'FAIL':'MEASURED_CHECKS_PASS_VISUAL_REVIEW_PENDING';
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify({status,fatal,expectedCases:36,fixtureOnly:true,usesDatabase:false,security,results},null,2));
  console.log(`${results.length} staged viewport checks; ${failures} findings; ${security.length} security events. Screenshots require manual review: ${output}`);
  if(fatal||results.length!==36||failures||security.length)process.exitCode=1;
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
