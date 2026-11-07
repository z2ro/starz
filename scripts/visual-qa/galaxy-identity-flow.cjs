const assert=require('node:assert/strict'),path=require('node:path');
const data=require('../../tests/fixtures/galaxyIdentity.json');
const {inspectLayout}=require('./checks.cjs');
async function galaxyIdentityFlow(page,{output,fixture}){
 const original=structuredClone(fixture),mobile=page.viewportSize().width===390,results=[];
 const main=async()=>{if(mobile)await page.getByRole('tab',{name:'Mapa',exact:true}).click();};
 const detail=async()=>{if(mobile)await page.getByRole('tab',{name:'Sistema e missão',exact:true}).click();};
 const fits=async()=>{const inspecting=mobile&&await page.getByRole('tab',{name:'Sistema e missão',exact:true}).getAttribute('aria-selected')==='true';const critical=mobile?(inspecting?['.travel-planner a.button']:['.spatial-toolbar button']):['.travel-planner a.button','.spatial-toolbar button'];const r=await page.evaluate(inspectLayout,{critical,inspectors:['.galaxy-spatial-detail'],allowedScroll:[]});assert.deepEqual(r.findings,[]);};
 const capture=name=>page.screenshot({path:path.join(output,`identity-${page.viewportSize().width}x${page.viewportSize().height}-${name}.png`),timeout:20000});
 try{
  await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(20000);
  for(const [name,system] of Object.entries(data.systems)){
   fixture.state=structuredClone(original.state);fixture.universe=structuredClone(original.universe);
   fixture.state.planets=structuredClone(data.roster);fixture.state.active_planet={id:data.roster[0].id,planet_index:1,home:true};
   fixture.state.system={...fixture.state.system,name:'Asterion',x:-2,y:-1,planet:{...fixture.state.system.planet,name:'Nativa'}};
   fixture.state.population.total=100;fixture.state.fleets=[];
   fixture.universe.players=[{id:fixture.universe.empire_id,name:'STAGED IDENTITY',self:true,planets:data.roster.map(p=>({id:p.id,x:p.x,y:p.y,index:p.planet_index,home:p.home})),relation:{status:'self',proposal:null}}];
   fixture.galaxy={radius:2,center:[-2,-1],home:[-2,-1],systems:[system,{...system,id:'unknown',x:-1,y:-1,home:false,knowledge_level:'UNKNOWN',name:'SECRET_SYSTEM'}]};
   await page.reload();await page.locator('.px-view').waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.getByRole('button',{name:'Abrir sistema',exact:true}).click();await main();
   const host=page.locator('.orbital-host'),canvas=page.locator('.orbital-canvas');await canvas.waitFor();
   await page.waitForFunction(()=>Number(document.querySelector('.orbital-host')?.dataset.triangles)>0);
   assert.equal(await page.getByText('SECRET_SYSTEM',{exact:true}).count(),0);
   const generation=await host.getAttribute('data-generation-count'),node=await canvas.elementHandle();
   const first=system.planets[0],index=String(first.planet_index),label=page.locator(`.orbital-labels button[data-planet-index="${index}"]`);
   const point=await label.evaluate(el=>({x:Number(el.dataset.screenX),y:Number(el.dataset.screenY)})),box=await canvas.boundingBox();
   if(mobile){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+point.x,y:box.y+point.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else await page.mouse.click(box.x+point.x,box.y+point.y);
   await page.waitForFunction(()=>document.querySelector('.orbital-host')?.dataset.selectedPlanet!=='');
   const selector=page.getByRole('combobox',{name:'Selecionar planeta na órbita'});assert((await selector.inputValue())!=='','Mesh selection must update the shared selection');
   await selector.selectOption(index);await page.waitForFunction(i=>document.querySelector('.orbital-host')?.dataset.selectedPlanet===i,index);
   const expected=first.ownership==='OWNED'?'home':first.ownership==='UNCLAIMED'?'unclaimed':first.ownership==='OCCUPIED'?'occupied':'unknown';
   assert.equal(await label.getAttribute('data-ownership'),expected);
   assert((await label.innerText()).includes(first.name));
   if(name==='two'||name==='multiple')await selector.selectOption('1');
   await page.waitForTimeout(120);const selectedLabel=page.locator(`.orbital-labels button[data-planet-index="${await selector.inputValue()}"]`);assert(await selectedLabel.isVisible(),'Selected label must remain readable');await selectedLabel.press('Enter');await main();await page.waitForTimeout(150);await fits();await capture(name+'-orbital');
   const selected=await selector.inputValue();
   await page.mouse.move(box.x+20,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+50,box.y+box.height/2+10);await page.mouse.up();
   assert.equal(await selector.inputValue(),selected,'Camera must retain selected planet');
   await detail();await page.waitForTimeout(150);await fits();assert((await page.locator('.selected-planet-heading').innerText()).includes(system.planets.find(p=>String(p.planet_index)===selected).name));await capture(name+'-inspector');
   if(['occupied','unknown'].includes(name))assert.equal(await page.getByRole('button',{name:'Ver requisitos de colonização'}).count(),0);
   if(name==='one'){await page.getByRole('button',{name:'Ver requisitos de colonização'}).click();await page.getByRole('dialog',{name:'Colonização · Pelagos'}).waitFor();await page.keyboard.press('Escape');}
   assert.equal(await host.getAttribute('data-generation-count'),generation);assert(await node.evaluate(el=>el.isConnected));
   results.push({fixture:name,passed:true,selected,checks:['real mesh mouse/touch selection','shared selection','ownership','camera retains selection','no regeneration','readable labels and inspector']});
  }
 }finally{Object.assign(fixture,original);}
 return{kind:'galaxy-planet-identity',passed:true,fixtures:results};
}
module.exports={galaxyIdentityFlow};
