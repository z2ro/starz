const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const ignored=p=>/(^|\/)(\.git|__pycache__|\.pytest_cache|\.vite|\.vite-temp|\.cache)(\/|$)/.test(p)||/(^|\/)\.env($|\.)/.test(p)||p.endsWith('.pyc')||/^frontend\/dist(\/|$)/.test(p);
function tree(root,entries){
 const h=crypto.createHash('sha256');let cacheable=true;
 function visit(relative){if(ignored(relative))return;const file=path.resolve(root,relative);h.update(relative+'\0');let s;try{s=fs.lstatSync(file);}catch{h.update('missing');return;}
  if(s.isSymbolicLink()){const target=fs.readlinkSync(file);h.update('link:'+target);const resolved=fs.realpathSync(file);if(!resolved.startsWith(path.resolve(root)+path.sep)){cacheable=false;return;}if(fs.statSync(resolved).isFile())h.update(fs.readFileSync(resolved));else cacheable=false;}
  else if(s.isDirectory())for(const name of fs.readdirSync(file).sort())visit(path.posix.join(relative,name));
  else if(s.isFile())h.update(fs.readFileSync(file));
 }
 for(const entry of [...new Set(entries)].sort())visit(entry);
 return {digest:h.digest('hex'),cacheable};
}
function cleanEnv(){const env={};for(const k of ['PATH','HOME','LANG','USER','TMPDIR','XDG_RUNTIME_DIR','DISPLAY'])if(process.env[k])env[k]=process.env[k];return env;}
function capture(command,args,options={}){
 const r=spawnSync(command,args,{encoding:'utf8',timeout:15000,env:cleanEnv(),...options});
 if(r.error||r.status!==0)throw Error(`${path.basename(command)} unavailable or unsuccessful`);
 return r.stdout.trim();
}
function changedFiles(root,base){
 const tracked=[['diff','--no-renames','--name-only','-z',base,'--'],['diff','--cached','--no-renames','--name-only','-z','--']].flatMap(args=>capture('git',args,{cwd:root}).split('\0'));
 const untracked=capture('git',['ls-files','--others','--exclude-standard','-z'],{cwd:root}).split('\0');
 return [...new Set([...tracked,...untracked].filter(Boolean))].sort();
}
function fingerprint(job,source,environment){return hash(JSON.stringify({schema:1,id:job.id,command:job.cacheCommand??job.command,env:job.cacheEnv??{},selection:job.selection??[],source:source.digest,environment}));}
function kill(child,signal='SIGTERM'){try{process.kill(process.platform==='win32'?child.pid:-child.pid,signal);}catch{}}
async function execute(command,{cwd,env,log,timeout=120000,verbose=false,secrets=[],active=new Set()}){
 fs.mkdirSync(path.dirname(log),{recursive:true});const stream=fs.createWriteStream(log);let pending='',timedOut=false;
 const write=line=>{for(const secret of secrets)if(secret)line=line.split(secret).join('[REDACTED]');stream.write(line);if(verbose)process.stdout.write(line);};
 const child=spawn(command[0],command.slice(1),{cwd,env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});active.add(child);
 const consume=chunk=>{pending+=chunk.toString();let at;while((at=pending.indexOf('\n'))>=0){write(pending.slice(0,at+1));pending=pending.slice(at+1);}};
 child.stdout.on('data',consume);child.stderr.on('data',consume);
 let force;const timer=setTimeout(()=>{timedOut=true;kill(child);force=setTimeout(()=>kill(child,'SIGKILL'),2000);force.unref();},timeout);
 const result=await new Promise(resolve=>{child.once('error',error=>{write(error.message+'\n');resolve({code:1});});child.once('close',(code,signal)=>resolve({code:code??1,signal}));});
 clearTimeout(timer);clearTimeout(force);active.delete(child);if(pending)write(pending);await new Promise(resolve=>stream.end(resolve));
 return {...result,timedOut};
}
function readCache(file,key){try{const r=JSON.parse(fs.readFileSync(file));if(r.key!==key||!fs.existsSync(r.log))return null;for(const a of r.artifacts??[]){const current=tree(a.file?path.dirname(a.path):a.path,a.file?[path.basename(a.path)]:['.']);if(!current.cacheable||current.digest!==a.digest)return null;}return r;}catch{return null;}}
function saveCache(file,result){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+process.pid;fs.writeFileSync(temp,JSON.stringify(result,null,2));fs.renameSync(temp,file);}
async function schedule(jobs,run,{limit=2,aborted=()=>false}={}){
 const results=new Map(),pending=[...jobs],active=new Map();
 while(pending.length||active.size){
  for(let i=0;i<pending.length&&active.size<limit;){const j=pending[i],deps=j.requires??[];
   if(deps.some(d=>!results.has(d))){i++;continue;}
   if(aborted()||deps.some(d=>results.get(d).status==='FAIL')){pending.splice(i,1);results.set(j.id,{id:j.id,status:'FAIL',failed:0,checks:0,passed:0,skipped:0,names:[j.id],error:aborted()?'Interrupted':'Required dependency failed'});continue;}
   if(j.resource&&[...active.values()].some(a=>a.resource===j.resource)){i++;continue;}
   pending.splice(i,1);const task=Promise.resolve().then(()=>run(j,results)).catch(e=>({id:j.id,status:'FAIL',passed:0,failed:0,checks:0,skipped:0,names:[j.id],error:e.message}));active.set(j.id,{resource:j.resource,task});
  }
  if(!active.size){if(pending.length)throw Error('Invalid QA dependency graph');break;}
  const done=await Promise.race([...active].map(async([id,a])=>({id,result:await a.task})));active.delete(done.id);results.set(done.id,done.result);
 }
 return [...results.values()];
}
function acquireLock(directory){
 fs.mkdirSync(path.dirname(directory),{recursive:true});
 try{fs.mkdirSync(directory);}catch(error){if(error.code!=='EEXIST')throw error;let old;try{old=JSON.parse(fs.readFileSync(path.join(directory,'owner.json')));}catch{throw Error('QA lock exists; verify its owner before removing it.');}
  try{process.kill(old.pid,0);throw Error('Another local QA run is active.');}catch(e){if(e.code!=='ESRCH')throw e;}
  fs.rmSync(directory,{recursive:true});fs.mkdirSync(directory);
 }
 fs.writeFileSync(path.join(directory,'owner.json'),JSON.stringify({pid:process.pid}));return()=>fs.rmSync(directory,{recursive:true,force:true});
}
module.exports={hash,tree,cleanEnv,capture,changedFiles,fingerprint,execute,schedule,readCache,saveCache,acquireLock,kill};
