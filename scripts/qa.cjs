#!/usr/bin/env node
// Local-only orchestration. No live services, accounts or inherited DB URLs are used.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const C=require('./local-qa/core.cjs'),{select}=require('./local-qa/selection.cjs'),PG=require('./local-qa/postgres.cjs');
const ROOT=path.resolve(__dirname,'..'),NODE=process.execPath,PY=path.join(ROOT,'.venv/bin/python');
const ROOT_CONFIG=fs.readdirSync(ROOT,{withFileTypes:true}).filter(f=>f.isFile()&&!f.name.startsWith('.')&&!/^state\.json/.test(f.name)&&!/(credentials|accounts|secrets|token)/i.test(f.name)).map(f=>f.name);
const COMMON=['scripts/qa.cjs','scripts/local-qa','tests/local_qa.test.cjs','scripts/visual-qa/case-cache.cjs',...ROOT_CONFIG];
const CONFIG=['package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts'];
function options(argv){const o={mode:argv[0],jobs:2,verbose:false,force:false};if(!['quick','affected','full'].includes(o.mode))throw Error('Use quick, affected or full.');for(let i=1;i<argv.length;i++){const a=argv[i];if(a==='--verbose')o.verbose=true;else if(a==='--no-cache')o.force=true;else if(a==='--jobs'){o.jobs=Number(argv[++i]);if(!Number.isInteger(o.jobs)||o.jobs<1||o.jobs>4)throw Error('--jobs must be 1–4');}else if(a==='--base'){o.base=argv[++i];if(!o.base)throw Error('--base needs a Git commit/ref');}else throw Error('Unknown QA option.');}return o;}
function browserPath(){if(process.env.CHROMIUM_PATH)return path.resolve(process.env.CHROMIUM_PATH);try{const p=require('playwright').chromium.executablePath();if(fs.existsSync(p))return p;}catch{}const cache=path.join(os.homedir(),'.cache/ms-playwright');for(const n of fs.existsSync(cache)?fs.readdirSync(cache).sort().reverse():[])if(/^chromium-\d+$/.test(n))for(const sub of ['chrome-linux64/chrome','chrome-linux/chrome']){const p=path.join(cache,n,sub);if(fs.existsSync(p))return p;}return null;}
function jobsFor(plan){
 const pyInputs=['starz','game_data','persistent_data','campaign_data','migrations','alembic.ini','pyproject.toml','requirements.lock','tests'];
 const frontInputs=['frontend','tests',...CONFIG];
 const jobs={
  runner:{inputs:COMMON,command:[NODE,'--test','tests/local_qa.test.cjs'],format:'tap'},
  typecheck:{inputs:frontInputs,command:[NODE,'node_modules/typescript/bin/tsc','--noEmit']},
  frontend:{inputs:frontInputs,command:[NODE,'node_modules/vitest/vitest.mjs','run','--config','vitest.config.ts','--maxWorkers=4','--testTimeout=15000','--reporter=json','--outputFile=@report@',...plan.tests],format:'vitest',resource:'render'},
  assets:{inputs:[...frontInputs,'docs/design'],command:[NODE,'--test','tests/planet_visual.test.cjs','tests/asset_registry.test.cjs','tests/asset_files.test.cjs','tests/icon_system.test.cjs'],format:'tap'},
  'backend-unit':{inputs:pyInputs,command:[PY,'scripts/local-qa/python_checks.py','unit','@report@'],format:'python'},
  'backend-db':{inputs:pyInputs,command:[PY,'scripts/local-qa/python_checks.py','db','@report@'],format:'python',database:true,timeout:240000},
  content:{inputs:pyInputs,command:[PY,'scripts/local-qa/python_checks.py','content','@report@'],format:'python'},
  skills:{inputs:['.agents','AGENTS.md','docs','scripts/validate_agent_skills.py','tests/visual-qa/skills_test.py'],command:[PY,'-m','unittest','discover','-s','tests/visual-qa','-p','skills_test.py','-v'],format:'unittest'},
  'browser-check':{inputs:['scripts/visual-qa','tests/visual-qa/checks.test.cjs',...CONFIG],command:[NODE,'--test','tests/visual-qa/checks.test.cjs'],format:'tap',resource:'render'},
  build:{inputs:frontInputs,command:[NODE,'--input-type=module','-e',"import {build} from 'vite'; await build({configFile:'vite.config.ts',envDir:false,envPrefix:'STARZ_PUBLIC_QA_',build:{outDir:process.argv[1],emptyOutDir:true}})",'@dist@'],requires:['typecheck'],artifact:'dist'},
  visual:{inputs:[...frontInputs,...pyInputs,'scripts/visual-qa','scripts/visual-qa.cjs'],command:[NODE,'scripts/visual-qa.cjs'],requires:['build','browser-check','content'],format:'visual',resource:'render',timeout:900000,selection:plan.views,cacheEnv:{STARZ_QA_VIEWS:plan.views.join(','),STARZ_QA_MASTER_FLOW:'1'},artifact:'visual'},
  diff:{inputs:[],command:['git','diff','--check','HEAD'],uncached:true}
 };
 return plan.groups.map(id=>({id,...jobs[id],inputs:[...COMMON,...jobs[id].inputs]}));
}
function environments(jobs,browser){
 const ids=new Set(jobs.map(j=>j.id)),nodeNeeded=[...ids].some(id=>['frontend','assets','typecheck','build','browser-check','visual'].includes(id));
 const pyNeeded=[...ids].some(id=>['backend-unit','backend-db','content','skills','visual'].includes(id));
 const nodeTree=nodeNeeded?C.tree(ROOT,['node_modules']):{digest:'',cacheable:true}; const node=nodeTree.digest;
 let python='',pythonCacheable=true;if(pyNeeded){try{const site=C.capture(PY,['-c','import sysconfig;print(sysconfig.get_paths()["purelib"])']);const data=C.tree(path.dirname(site),[path.basename(site)]);python=data.digest+C.capture(PY,['--version']);pythonCacheable=data.cacheable;}catch{python='unavailable';}}
 const chromeTree=[...ids].some(id=>['browser-check','visual'].includes(id))?(browser&&fs.existsSync(browser)?C.tree(path.dirname(browser),['.']):{digest:'unavailable',cacheable:true}):{digest:'',cacheable:true};const chrome=chromeTree.digest;
 const postgres=ids.has('backend-db')?PG.identity():'';
 const runtime={node:process.version,nodeBinary:C.tree(path.dirname(NODE),[path.basename(NODE)]).digest,platform:process.platform,arch:process.arch,os:os.release(),root:ROOT};
 return Object.fromEntries(jobs.map(j=>[j.id,{...runtime,cacheable:nodeTree.cacheable&&pythonCacheable&&chromeTree.cacheable,node:['runner','diff','backend-unit','backend-db','content','skills'].includes(j.id)?'':node,python:['backend-unit','backend-db','content','skills','visual'].includes(j.id)?python:'',chrome:['browser-check','visual'].includes(j.id)?chrome:'',postgres:j.database?postgres:''}]));
}
function parseResult(job,report,log,exit){
 if(exit.timedOut)throw Error(`Check timed out after ${job.timeout??120000}ms.`);
 if(['python','vitest','visual'].includes(job.format)){
  if(!fs.existsSync(report))throw Error('Required structured report missing; inspect full log.');
  const r=JSON.parse(fs.readFileSync(report));
  if(job.format==='python')return r;
  if(job.format==='vitest')return {passed:r.numPassedTests,failed:r.numFailedTests,skipped:r.numPendingTests,checks:0,names:r.testResults.flatMap(f=>f.assertionResults.filter(t=>t.status==='failed').map(t=>t.fullName))};
  const bad=r.results.filter(c=>c.findings.length||c.errors.length||c.navigation.some(n=>!n.passed));
  if(r.fatal||r.results.length!==r.expectedCases||r.security.length)throw Error('Visual matrix incomplete or security boundary failed.');
  return {passed:r.results.length-bad.length,failed:bad.length,checks:0,skipped:0,cachedCases:r.reusedCases??0,executedCases:r.results.length-(r.reusedCases??0),names:bad.map(c=>`${c.view}/${c.state}/${c.viewport.width}x${c.viewport.height}`)};
 }
 const text=fs.readFileSync(log,'utf8');
 if(job.format==='tap'){const pass=text.match(/^# pass (\d+)/m),fail=text.match(/^# fail (\d+)/m);if(!pass||!fail)throw Error('TAP totals missing.');return {passed:Number(pass[1]),failed:Number(fail[1]),checks:0,skipped:Number(text.match(/^# skipped (\d+)/m)?.[1]??0),names:[...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(m=>m[1])};}
 if(job.format==='unittest'){const total=text.match(/Ran (\d+) tests?/);if(!total)throw Error('unittest totals missing.');const names=[...text.matchAll(/^(?:FAIL|ERROR): (.+)$/gm)].map(m=>m[1]);return {passed:Number(total[1])-names.length,failed:names.length,checks:0,skipped:0,names};}
 return {passed:0,checks:exit.code?0:1,failed:0,skipped:0,names:[]};
}
async function runJob(job,context,results){
 const {runDir,cacheDir,environment,env,browser,force,verbose,active}=context;
 const root=context.root??ROOT;
 const source=C.tree(root,job.inputs),key=C.fingerprint(job,source,environment),cacheFile=path.join(cacheDir,job.id+'-'+key+'.json');
 if(!force&&!job.uncached&&source.cacheable&&environment.cacheable!==false){const hit=C.readCache(cacheFile,key);if(hit)return {...hit,cached:true};}
 fs.rmSync(cacheFile,{force:true});const partialCacheFile=path.join(cacheDir,'visual-cases-'+key+'.json');const log=path.join(runDir,job.id+'.log'),report=path.join(runDir,job.id+'.json'),dist=path.join(runDir,'dist'),visual=path.join(runDir,'visual');
 const command=job.command.map(a=>a.replaceAll('@report@',report).replaceAll('@dist@',dist));
 const childEnv={...env,...job.cacheEnv};if(browser)childEnv.CHROMIUM_PATH=browser;
 if(job.id==='visual'){childEnv.STARZ_QA_OUTPUT=visual;childEnv.STARZ_QA_BUILD_DIR=results.get('build').artifactPath;const partial=!force&&source.cacheable&&environment.cacheable!==false?C.readCache(partialCacheFile,key):null;if(partial)childEnv.STARZ_QA_REUSE_RESULTS=path.join(partial.artifactPath,'results.json');}
 let data,exit,error;const start=performance.now();
 try{
  const perform=async(extra={},secrets=[])=>executeAndParse(extra,secrets);
  async function executeAndParse(extra,secrets){const e=await C.execute(command,{cwd:root,env:{...childEnv,...extra},log,timeout:job.timeout??120000,verbose,secrets,active});const p=job.format==='visual'?path.join(visual,'results.json'):report;const d=parseResult(job,p,log,e);return {exit:e,data:d};}
  ({exit,data}=job.database?await PG.temporaryDatabase(path.basename(runDir),{cwd:ROOT,log,verbose,active},perform):await perform());
  if(exit.code||data.failed)error='Required check failed; inspect log.';
  if(C.tree(root,job.inputs).digest!==source.digest)error='Inputs changed during validation; result not reusable.';
 }catch(e){error=e.message;if(!fs.existsSync(log))fs.writeFileSync(log,error+'\n');}
 const artifactPath=job.artifact==='dist'?dist:job.artifact==='visual'?visual:undefined;
 const result={id:job.id,status:error?'FAIL':'PASS',...(data??{passed:0,failed:0,checks:0,skipped:0,names:[job.id]}),error,seconds:Number(((performance.now()-start)/1000).toFixed(3)),key,sourceDigest:source.digest,log,cacheFile,partialCacheFile,cached:false,artifactPath,artifacts:[]};
 const validPartial=job.id==='visual'&&data&&data.passed>0&&C.tree(root,job.inputs).digest===source.digest;
 if(result.status==='PASS'||validPartial){
  for(const p of [artifactPath,fs.existsSync(report)?report:undefined].filter(Boolean))result.artifacts.push({path:p,digest:C.tree(fs.statSync(p).isDirectory()?p:path.dirname(p),fs.statSync(p).isDirectory()?['.']:[path.basename(p)]).digest,file:fs.statSync(p).isFile()});
  if(!job.uncached&&source.cacheable&&environment.cacheable!==false){if(result.status==='PASS')C.saveCache(cacheFile,result);if(validPartial)C.saveCache(partialCacheFile,result);}
 }
 return result;
}
async function main(argv){
 let o,release,runDir;const started=performance.now(),active=new Set();let interrupted=false;
 const stop=()=>{interrupted=true;for(const c of active)C.kill(c);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  o=options(argv);console.log(`QA ${o.mode}`);release=C.acquireLock(path.join(ROOT,'.qa/lock'));
  runDir=path.join(ROOT,'.qa/runs',new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid);fs.mkdirSync(runDir,{recursive:true});
  let last;try{last=JSON.parse(fs.readFileSync(path.join(ROOT,'.qa/validated.json'))).head;}catch{}
  const ref=o.base??last??'HEAD',base=C.capture('git',['rev-parse','--verify','--end-of-options',ref+'^{commit}'],{cwd:ROOT});
  const changes=C.changedFiles(ROOT,base),plan=select(o.mode,o.mode==='affected'&&!last&&!o.base?null:changes),jobs=jobsFor(plan),browser=browserPath();
  if(o.verbose)console.log(JSON.stringify({groups:plan.groups,tests:plan.tests,views:plan.views}));
  const before=environments(jobs,browser),env=C.cleanEnv(),context={runDir,cacheDir:path.join(ROOT,'.qa/cache'),env,browser,force:o.force,verbose:o.verbose,active};
  const results=await C.schedule(jobs,(job,done)=>runJob(job,{...context,environment:before[job.id]},done),{limit:o.jobs,aborted:()=>interrupted});
  const after=environments(jobs,browser);
  for(const r of results){const job=jobs.find(j=>j.id===r.id);if(r.status==='PASS'&&(JSON.stringify(before[r.id])!==JSON.stringify(after[r.id])||C.tree(ROOT,job.inputs).digest!==r.sourceDigest)){r.status='FAIL';r.error='Inputs/dependencies changed during run; cached result invalidated.';r.passed=r.checks=0;if(r.cacheFile)fs.rmSync(r.cacheFile,{force:true});if(r.partialCacheFile)fs.rmSync(r.partialCacheFile,{force:true});}}
  const failures=results.filter(r=>r.status==='FAIL'),totals=results.reduce((a,r)=>({passed:a.passed+r.passed,failed:a.failed+r.failed,checks:a.checks+r.checks,skipped:a.skipped+r.skipped}),{passed:0,failed:0,checks:0,skipped:0});
  const code=interrupted?130:failures.length?1:0,seconds=Number(((performance.now()-started)/1000).toFixed(3));
  const summary={mode:o.mode,exit:code,seconds,selection:plan,totals,cachedGroups:results.filter(r=>r.cached).length,results};fs.writeFileSync(path.join(runDir,'summary.json'),JSON.stringify(summary,null,2));
  if(!code&&o.mode!=='quick')C.saveCache(path.join(ROOT,'.qa/validated.json'),{head:C.capture('git',['rev-parse','HEAD'],{cwd:ROOT})});
  console.log(`Passed: ${totals.passed} tests + ${totals.checks} checks; failed groups: ${failures.length}; failed tests: ${totals.failed}; skipped: ${totals.skipped}; cache: ${summary.cachedGroups}/${results.length}`);
  for(const r of failures){console.log(`FAIL ${r.id}: ${(r.error??'Test failed').slice(0,150)}`);for(const name of r.names.slice(0,12))console.log(`  ${name}`);if(r.log)console.log(`  Log: ${path.relative(ROOT,r.log)}`);}
  console.log(`Logs: ${path.relative(ROOT,runDir)} (${seconds}s)`);console.log(`Exit: ${code}`);return code;
 }catch(e){console.log(`FAIL: ${e.message}`);if(runDir)console.log('Logs: '+path.relative(ROOT,runDir));console.log('Exit: 2');return 2;}
 finally{release?.();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
module.exports={main,options,jobsFor,runJob};
if(require.main===module)main(process.argv.slice(2)).then(code=>{process.exitCode=code;});
