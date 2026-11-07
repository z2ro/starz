// Only complete, isolated fixture runs can donate successful cases; failures always execute.
const fs=require('node:fs'),path=require('node:path');
const caseKey=c=>`${c.view??c.profile.id}/${c.state??c.stateName}/${c.viewport?.width??c.width}x${c.viewport?.height??c.height}`;
function successfulCases(root,report){
 if(!report)return new Map();
 const file=fs.realpathSync(report),base=fs.realpathSync(path.join(root,'.qa/runs'))+path.sep;
 if(!file.startsWith(base))throw Error('Case reuse must stay under local QA runs.');
 const r=JSON.parse(fs.readFileSync(file));
 if(!r.fixtureOnly||r.usesDatabase!==false||r.fatal||r.security.length||r.results.length!==r.expectedCases)throw Error('Only complete isolated fixture reports can be reused.');
 return new Map(r.results.filter(c=>!c.findings.length&&!c.errors.length&&c.navigation.every(n=>n.passed)).map(c=>[caseKey(c),{result:c,directory:path.dirname(file)}]));
}
function copyCase(entry,output){
 const name=entry.result.screenshot;
 if(path.basename(name)!==name||!name.endsWith('.png'))throw Error('Invalid cached screenshot path.');
 const source=fs.realpathSync(path.join(entry.directory,name));
 if(!source.startsWith(fs.realpathSync(entry.directory)+path.sep))throw Error('Cached screenshot escapes its QA directory.');
 fs.copyFileSync(source,path.join(output,name));
 return {...entry.result,cachedCase:true,cachedFrom:entry.directory};
}
module.exports={caseKey,successfulCases,copyCase};
