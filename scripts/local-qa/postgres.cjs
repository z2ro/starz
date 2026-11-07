const crypto=require('node:crypto');
const {capture,execute,cleanEnv}=require('./core.cjs');
const IMAGE='postgres:17-alpine';
function identity(){try{return capture('docker',['image','inspect',IMAGE,'--format','{{.Id}}']);}catch{return 'unavailable';}}
async function temporaryDatabase(runId,options,call){
 const name='starz-qa-'+runId.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(-48),password=crypto.randomBytes(24).toString('hex');
 const env={...cleanEnv(),POSTGRES_PASSWORD:password,POSTGRES_USER:'starz_qa',POSTGRES_DB:'starz_qa'};
 try{
  const start=await execute(['docker','run','--pull=never','--rm','-d','--name',name,'--label','starz.local-qa='+runId,'--tmpfs','/var/lib/postgresql/data:rw','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD','-e','POSTGRES_USER','-e','POSTGRES_DB',IMAGE],{...options,env,log:options.log+'.start',timeout:30000});
  if(start.code)throw Error('Disposable PostgreSQL could not start; local postgres:17-alpine image/Docker required.');
  const deadline=Date.now()+30000;let ready=false;
  while(Date.now()<deadline){try{capture('docker',['exec',name,'pg_isready','-U','starz_qa','-d','starz_qa']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
  if(!ready)throw Error('Disposable PostgreSQL readiness timeout.');
  const ports=JSON.parse(capture('docker',['inspect',name,'--format','{{json .NetworkSettings.Ports}}']));const port=ports['5432/tcp'][0];if(port.HostIp!=='127.0.0.1')throw Error('QA database must bind only loopback.');
  const url=`postgresql+psycopg://starz_qa:${password}@127.0.0.1:${port.HostPort}/starz_qa`;
  return await call({TEST_DATABASE_URL:url,PERSISTENT_TEST_DATABASE_URL:url,CAMPAIGN_TEST_DATABASE_URL:url},[password,url]);
 }finally{
  // Only the exact container created for this run can be removed; never Compose projects/volumes.
  let label;try{label=capture('docker',['inspect',name,'--format','{{index .Config.Labels "starz.local-qa"}}']);}catch{}
  if(label===runId)capture('docker',['rm','-f',name]);
 }
}
module.exports={identity,temporaryDatabase};
