const assert=require('node:assert/strict'),path=require('node:path');
const {inspectLayout}=require('./checks.cjs');
// Read-only staged browser journey. Mutating API requests remain blocked by the parent runner.
async function stellarFlow(page,{output}){
 const size=page.viewportSize(),mobile=size.width===390;
 const capture=name=>page.screenshot({path:path.join(output,`stellar-${size.width}x${size.height}-${name}.png`)});
 const inspect=async(critical=[])=>{const result=await page.evaluate(inspectLayout,{critical,inspectors:['.stellar-detail'],allowedScroll:[]});assert.deepEqual(result.findings,[],'Stellar inspector must remain accessible');};
 while(await page.locator('dialog[open]').count())await page.keyboard.press('Escape');
 const main=page.getByRole('tablist',{name:'Engenharia estelar',exact:true});
 await main.getByRole('tab',{name:'Projetos',exact:true}).click();await page.waitForTimeout(150);await capture('projects');
 await main.getByRole('tab',{name:'Módulos',exact:true}).click();await page.waitForTimeout(100);
 await inspect();await capture('modules');
 await main.getByRole('tab',{name:'Unidades',exact:true}).click();
 await page.getByRole('tab',{name:'Modelo',exact:true}).click();
 await page.locator('.naval-canvas canvas').waitFor();await page.waitForTimeout(800);
 const canvas=await page.locator('.naval-canvas canvas').elementHandle();
 assert(await canvas.evaluate(el=>el.width>0&&el.height>0),'Approved model must have a real canvas');
 await inspect(['.naval-angles button']);await capture('approved-model');
 await main.getByRole('tab',{name:'Custódia',exact:true}).click();
 if(mobile)await page.getByRole('button',{name:'Mostrar seleção de engenharia estelar',exact:true}).click();
 await page.getByRole('button',{name:/Núcleo selado/}).click();
 const deck=page.locator('.content-pages[aria-label="Preparação de custódia"]');
 const action=page.getByRole('combobox',{name:/^Ação de custódia/});
 for(let count=0;count<20&&!await action.isVisible();count++){
  const next=deck.locator(':scope > nav [data-qa-next]');if(!await next.count()||await next.isDisabled())break;await next.click();
 }
 await action.selectOption('decommission');
 await page.getByRole('button',{name:'Revisar custódia',exact:true}).click();await page.waitForTimeout(100);
 const confirmation=page.getByRole('button',{name:'Confirmar selar relíquia',exact:true});
 assert(await confirmation.isVisible()&&await confirmation.isEnabled(),'Primary custody confirmation must remain reachable');
 await inspect(['.stellar-confirm button']);await capture('custody-review');
 // Never click confirmation: authoritative behavior is proven by the PostgreSQL cases.
 assert(await canvas.evaluate(el=>!el.isConnected),'Leaving model inspection must release its canvas');
 return {kind:'stellar-read-only-workflow',passed:true,checks:['project/module subviews','approved procedural model','canvas cleanup','sealed core selection','custody review','primary action accessible','no gameplay mutation']};
}
module.exports={stellarFlow};
