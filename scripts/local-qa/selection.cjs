const map=require('./dependencies.json');
const ALL=['runner','typecheck','frontend','assets','backend-unit','backend-db','content','skills','browser-check','build','visual','diff'];
const FRONT=['typecheck','frontend','assets','content','build','browser-check','visual'];
function select(mode,changes){
 const groups=new Set(['runner','diff']),tests=new Set(),views=new Set();let allTests=false,allViews=false,broad=false;
 const add=xs=>xs.forEach(x=>groups.add(x));
 const front=()=>{add(FRONT);allTests=allViews=true;};
 if(mode==='full'||changes===null||changes.length===0){add(ALL);allTests=allViews=broad=true;}
 else for(const p of changes){
  if(map.scratch.some(root=>p.startsWith(root))||/(^|\/)\.env($|\.)/.test(p))continue;
  if(p==='AGENTS.md'||p.startsWith('.agents/')){groups.add('skills');continue;}
  if(p.startsWith('docs/')){groups.add('skills');if(p.startsWith('docs/design/references/'))front();continue;}
  if(p==='README.md'||p==='.gitignore')continue;
  if(p.startsWith('frontend/')){
   const rule=map.frontendModules.find(r=>p.startsWith(r.prefix));
   if(rule&&!map.sharedFrontend.some(prefix=>p.startsWith(prefix))){add(FRONT);rule.tests.forEach(t=>tests.add(t));rule.views.forEach(v=>views.add(v));}
   else front();
  }else if(/^tests\/[^/]+\.test\.tsx$/.test(p)){add(FRONT);tests.add(p);allViews=true;}
  else if(p.startsWith('starz/')||p.startsWith('migrations/')||/^(game_data|persistent_data|campaign_data)\//.test(p)){add(ALL);allTests=allViews=broad=true;}
  else {add(ALL);allTests=allViews=broad=true;}
 }
 if(mode==='quick')for(const id of ['backend-db','browser-check','build','visual'])groups.delete(id);
 return {groups:ALL.filter(x=>groups.has(x)),tests:allTests?[]:[...tests].sort(),views:allViews?[]:[...views].sort(),broad};
}
module.exports={select,ALL};
