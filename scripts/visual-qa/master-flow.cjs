// UI-only interaction proof with disposable snapshots, never live accounts or mutations.
const assert=require('node:assert/strict');
const {inspectLayout}=require('./checks.cjs');
async function masterFlow(page,{fixture,updateSnapshots,output}) {
 const home=structuredClone(fixture.state),homeId=home.active_planet.id;
 const row=home.planets.find(p=>p.id!==homeId);assert(row,'Populated review needs a second planet');
 const other=structuredClone(home);other.active_planet={id:row.id,planet_index:row.planet_index,home:false};other.system={...other.system,x:row.x,y:row.y,planet:{...other.system.planet,name:row.name}};other.population={...other.population,total:row.population_total};other.stocks.raw_ore=321;
 const snapshots={[homeId]:home,[row.id]:other};updateSnapshots(snapshots);
 const mobile=page.viewportSize().width===390;
 async function ready(){await page.locator('.master-ui').waitFor();await page.locator('.planet-procedural-stage canvas').waitFor({state:'attached'});}
 async function fits(){const r=await page.evaluate(inspectLayout,{critical:[],inspectors:[],allowedScroll:[]});assert.deepEqual(r.findings,[]);}
 async function dialog(button,title){await button.click();await page.getByRole('dialog',{name:title,exact:true}).waitFor();await page.waitForTimeout(180);await fits();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:title,exact:true}).waitFor({state:'detached'});}
 await ready();await dialog(page.getByRole('button',{name:'Produção e detalhes dos recursos'}),'Produção e estoques locais');
 await dialog(page.getByRole('button',{name:/^Registros/}),'Registros recentes');
 await dialog(page.getByRole('button',{name:'Ajuda',exact:true}),'Ajuda de comando');
 await dialog(page.getByRole('button',{name:/^Operações ·/}),'Operações em andamento');
 if(mobile){const tab=page.getByRole('tab',{name:'Planeta',exact:true});await tab.focus();await tab.press('Enter');}
 const image=page.getByRole('button',{name:'Imagem',exact:true});await image.focus();await image.press('Enter');assert.equal(await image.getAttribute('aria-pressed'),'true');await page.locator('.planet-procedural-stage canvas').waitFor({state:'detached'});
 await page.getByRole('button',{name:'Procedural',exact:true}).click();await ready();await fits();
 const canvas=await page.locator('.planet-procedural-stage canvas').elementHandle();assert(canvas);await canvas.evaluate(el=>el.dataset.reviewIdentity='retained');
 const key=await page.locator('.planet-procedural-stage').getAttribute('data-planet-key');home.stocks.raw_ore=12345;home.population.total+=1;home.planets.find(p=>p.id===homeId).population_total=home.population.total;await page.clock.fastForward(15001);
 await page.waitForFunction(()=>document.querySelector('.resource-raw_ore strong')?.textContent==='12.345');
 assert(await canvas.evaluate(el=>el.isConnected&&el.dataset.reviewIdentity==='retained'));assert.equal(await page.locator('.planet-procedural-stage').getAttribute('data-planet-key'),key);
 await page.getByRole('combobox',{name:'Planeta atual',exact:true}).selectOption(row.id);
 await page.waitForFunction(name=>document.querySelector('.strategy-world-identity h2')?.textContent===name,row.name);
 assert.equal(await page.locator('.resource-raw_ore strong').innerText(),'321');assert.notEqual(await page.locator('.planet-procedural-stage').getAttribute('data-planet-key'),key);
 await page.getByRole('combobox',{name:'Selecionar colônia'}).selectOption(homeId);
 await page.waitForFunction(name=>document.querySelector('.strategy-world-identity h2')?.textContent===name,home.system.planet.name);await ready();
 if(mobile)await page.getByRole('tab',{name:'Situação e ordens',exact:true}).click();
 for(const [label,path]of[['Instalações','/development'],['Pesquisa','/research'],['Estaleiro','/shipyard'],['Exploração','/galaxy']]){
  await page.getByRole('navigation',{name:'Ordens rápidas'}).getByRole('link',{name:label,exact:true}).click();await page.waitForFunction(path=>location.hash==='#'+path,path);await page.locator('.master-ui').waitFor();assert.equal(await page.locator('.resource-hud').count(),1);assert.equal(await page.locator('.sidebar-navigation').count(),1);assert.equal(await page.locator('.px-masthead').count(),0);await page.locator('.px-view').waitFor();
  await page.goto(output.origin+'/#/universe');await ready();if(mobile)await page.getByRole('tab',{name:'Situação e ordens',exact:true}).click();
 }
 if(!mobile){const original=page.viewportSize();for(const width of [1501,1550,1630,1640]){await page.setViewportSize({width,height:900});await page.waitForTimeout(180);await fits();const truncated=await page.locator('.resource-indicator .resource-full').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent));assert.deepEqual(truncated,[],`Resource labels at ${width}px`);}await page.setViewportSize(original);await page.waitForTimeout(180);}
 await fits();await page.screenshot({path:output.path,fullPage:false});updateSnapshots(null);
 return {kind:'master-functional-flow',passed:true,checks:['resource/records/help/operations dialogs','keyboard image mode','procedural restoration','stock/population update retains canvas and geographic identity','top and bottom planet selectors','four actual contextual destinations','contextual destinations retain the shared shell',...(!mobile?['intermediate desktop widths keep resource labels readable']:[])]};
}
module.exports={masterFlow};
